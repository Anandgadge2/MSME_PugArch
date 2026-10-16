'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Trophy,
  FileCheck,
  Building2,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Sparkles,
  ExternalLink,
  Receipt,
  XCircle,
  Paperclip,
  Upload,
  FileText,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { getApi, postApi } from '../shared/apiClient';
import { formatCurrency } from '../shared/format';
import { procurementBidApi } from '../procurementBid/api';
import { PO_DECLINE_REASONS, getPoDeclineReasonByCode } from '../procurementBid/poDeclineReasons';

interface PendingAward {
  id: number;
  bidId: number;
  bidNumber: string;
  title: string;
  amount: number;
  awardStatus: string;
  awardedAt?: string;
  buyerOrganizationName: string;
  purchaseOrder?: {
    id: number;
    poNumber: string;
    status: string;
    poStatus?: string;
    amount: number;
  } | null;
}

interface PendingPO {
  id: number;
  poNumber: string;
  title: string;
  amount: number;
  status: string;
  poStatus?: string;
  createdAt?: string;
  buyerName?: string;
  buyerOrganizationName?: string;
}

interface PendingResponse {
  hasPending: boolean;
  count: number;
  awards: PendingAward[];
  purchaseOrders: PendingPO[];
}

/**
 * Animated pop-up appearing on seller login whenever a Bid Award or Purchase Order
 * has been issued to the seller. Persistently displays across logins until the
 * seller accepts the bid award and purchase order.
 */
export default function SellerAwardPoAlertPopup() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [awards, setAwards] = useState<PendingAward[]>([]);
  const [pos, setPOs] = useState<PendingPO[]>([]);
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'awards' | 'pos'>('awards');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Decline states for Purchase Orders
  const [decliningPoId, setDecliningPoId] = useState<number | null>(null);
  const [declineReasonCode, setDeclineReasonCode] = useState<string>('BUYER_TERMS_DISCREPANCY');
  const [declineReason, setDeclineReason] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<{ id: number; name: string } | null>(null);
  const [isUploadingEvidence, setIsUploadingEvidence] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  // Decline states for Awards
  const [decliningAwardId, setDecliningAwardId] = useState<number | null>(null);
  const [declineAwardReason, setDeclineAwardReason] = useState('');
  const [isDecliningAward, setIsDecliningAward] = useState(false);

  const isSellerOrShg = user?.role === 'seller' || user?.role === 'shg';

  const getDismissedIds = useCallback((): Set<string> => {
    if (typeof window === 'undefined' || !user?.id) return new Set();
    try {
      const raw = sessionStorage.getItem(`seller-award-po-dismissed-ids:${user.id}`);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  }, [user?.id]);

  const addDismissedIds = useCallback((ids: string[]) => {
    if (typeof window === 'undefined' || !user?.id) return;
    try {
      const current = getDismissedIds();
      ids.forEach((id) => current.add(id));
      sessionStorage.setItem(`seller-award-po-dismissed-ids:${user.id}`, JSON.stringify(Array.from(current)));
    } catch {
      // ignore
    }
  }, [user?.id, getDismissedIds]);

  const clearDismissedId = useCallback((id: string) => {
    if (typeof window === 'undefined' || !user?.id) return;
    try {
      const current = getDismissedIds();
      current.delete(id);
      sessionStorage.setItem(`seller-award-po-dismissed-ids:${user.id}`, JSON.stringify(Array.from(current)));
    } catch {
      // ignore
    }
  }, [user?.id, getDismissedIds]);

  const checkPendingAwardsAndPOs = useCallback(async (forceShow = false) => {
    if (!user?.id || !isSellerOrShg) return;

    try {
      const res = await getApi<PendingResponse>('/api/seller/pending-awards-and-pos');
      const pendingAwards = Array.isArray(res?.awards) ? res.awards : [];
      const rawPendingPOs = Array.isArray(res?.purchaseOrders) ? res.purchaseOrders : [];

      // Deduplicate POs in popup so duplicate POs for the same transaction are never shown twice
      const seenPoKeys = new Set<string>();
      const pendingPOs = rawPendingPOs.filter((p) => {
        const cleanTitle = String(p.title || '')
          .replace(/^Purchase Order - Reverse Auction [^ ]+ \(/i, '')
          .replace(/\)$/, '')
          .replace(/^Reverse Auction — /i, '')
          .trim()
          .toLowerCase();
        const key = `${p.buyerOrganizationName || p.buyerName}-${Number(p.amount).toFixed(2)}-${cleanTitle}`;
        if (seenPoKeys.has(key)) return false;
        seenPoKeys.add(key);
        return true;
      });

      setAwards(pendingAwards);
      setPOs(pendingPOs);

      if (pendingAwards.length === 0 && pendingPOs.length === 0) {
        setVisible(false);
        return;
      }

      const dismissed = getDismissedIds();
      const hasUndismissedAward = pendingAwards.some((a) => !dismissed.has(`award-${a.id}`));
      const hasUndismissedPo = pendingPOs.some((p) => !dismissed.has(`po-${p.id}`));

      if (forceShow || hasUndismissedAward || hasUndismissedPo) {
        if (pendingAwards.length > 0) {
          setActiveTab('awards');
        } else if (pendingPOs.length > 0) {
          setActiveTab('pos');
        }
        setVisible(true);
      }
    } catch {
      // Silent error handling — non-blocking pop-up
    }
  }, [user?.id, isSellerOrShg, getDismissedIds]);

  useEffect(() => {
    if (!user?.id || !isSellerOrShg) return;

    void checkPendingAwardsAndPOs(false);

    // Listen to real-time events across windows & websockets
    const handleUpdate = () => {
      void checkPendingAwardsAndPOs(false);
    };

    const handleForceAwardUpdate = (e: any) => {
      const awardId = e?.detail?.awardId || e?.detail?.procurementId;
      if (awardId) {
        clearDismissedId(`award-${awardId}`);
      }
      void checkPendingAwardsAndPOs(true);
    };

    window.addEventListener('notifications:updated', handleUpdate);
    window.addEventListener('orders:updated', handleUpdate);
    window.addEventListener('awards:updated', handleForceAwardUpdate);
    window.addEventListener('award:issued', handleForceAwardUpdate);

    // Active polling interval for real-time background sync
    const intervalId = setInterval(() => {
      void checkPendingAwardsAndPOs(false);
    }, 15000);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && visible) {
        handleDismissSession();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('notifications:updated', handleUpdate);
      window.removeEventListener('orders:updated', handleUpdate);
      window.removeEventListener('awards:updated', handleForceAwardUpdate);
      window.removeEventListener('award:issued', handleForceAwardUpdate);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [user?.id, isSellerOrShg, checkPendingAwardsAndPOs, clearDismissedId, visible]);

  if (!visible || (!awards.length && !pos.length)) {
    return null;
  }

  const handleDismissSession = () => {
    if (user?.id) {
      const idsToDismiss = [
        ...awards.map((a) => `award-${a.id}`),
        ...pos.map((p) => `po-${p.id}`)
      ];
      addDismissedIds(idsToDismiss);
      sessionStorage.setItem(`seller-award-po-dismissed:${user.id}`, '1');
    }
    setVisible(false);
  };

  const handleAcceptAward = async (award: PendingAward) => {
    setAcceptingId(`award-${award.id}`);
    try {
      // Accept bid award
      await postApi(`/api/seller/procurement-bids/${award.bidId}/accept-award`, {
        awardId: award.id
      }).catch(async () => {
        // Fallback to direct award accept endpoint
        return postApi(`/api/seller/awards/${award.id}/accept`, {});
      });

      // If a purchase order was already generated for this award, acknowledge it too
      if (award.purchaseOrder?.id) {
        await postApi(`/api/purchase-orders/${award.purchaseOrder.id}/acknowledge`, {}).catch(() => undefined);
      }

      toast.success('Contract Award Accepted!', {
        description: `You have successfully accepted the award for ${award.title}. Fulfillment has been opened.`
      });

      window.dispatchEvent(new CustomEvent('award:accepted', { detail: { bidId: award.bidId, awardId: award.id } }));
      window.dispatchEvent(new CustomEvent('orders:updated', { detail: { bidId: award.bidId, awardId: award.id } }));
      window.dispatchEvent(new CustomEvent('notifications:updated'));

      void queryClient.invalidateQueries({ queryKey: ['rfq-detail-bid'] });
      void queryClient.invalidateQueries({ queryKey: ['rfq-detail-req'] });
      void queryClient.invalidateQueries({ queryKey: ['procurement-awards'] });
      void queryClient.invalidateQueries({ queryKey: ['procurement-active-order'] });

      await checkPendingAwardsAndPOs(true);
    } catch (err: any) {
      toast.error('Failed to accept award', {
        description: err?.message || 'Please try again or open the order page.'
      });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDeclineAward = async (award: PendingAward) => {
    if (!declineAwardReason.trim() || declineAwardReason.trim().length < 5) {
      toast.error('Please enter a valid reason for declining the award (at least 5 characters).');
      return;
    }
    setIsDecliningAward(true);
    try {
      await procurementBidApi.declineAward(String(award.bidId), award.id, declineAwardReason.trim()).catch(async () => {
        return postApi(`/api/seller/procurement-bids/${award.bidId}/decline-award`, {
          awardId: award.id,
          reason: declineAwardReason.trim()
        }).catch(async () => {
          return postApi(`/api/seller/awards/${award.id}/reject`, {
            reason: declineAwardReason.trim()
          });
        });
      });

      toast.success('Contract Award Declined', {
        description: `You have declined the award offer for "${award.title}". The buyer has been notified.`
      });

      setDecliningAwardId(null);
      setDeclineAwardReason('');

      window.dispatchEvent(new CustomEvent('award:declined', { detail: { bidId: award.bidId, awardId: award.id } }));
      window.dispatchEvent(new CustomEvent('orders:updated', { detail: { bidId: award.bidId, awardId: award.id } }));
      window.dispatchEvent(new CustomEvent('notifications:updated'));

      void queryClient.invalidateQueries({ queryKey: ['rfq-detail-bid'] });
      void queryClient.invalidateQueries({ queryKey: ['rfq-detail-req'] });
      void queryClient.invalidateQueries({ queryKey: ['procurement-awards'] });
      void queryClient.invalidateQueries({ queryKey: ['procurement-active-order'] });

      await checkPendingAwardsAndPOs(true);
    } catch (err: any) {
      toast.error('Failed to decline award', {
        description: err?.message || 'Please try again.'
      });
    } finally {
      setIsDecliningAward(false);
    }
  };

  const handleAcceptPO = async (po: PendingPO) => {
    setAcceptingId(`po-${po.id}`);
    try {
      await postApi(`/api/purchase-orders/${po.id}/acknowledge`, {}).catch(async () => {
        return postApi(`/api/seller/purchase-orders/${po.id}/accept-po`, {});
      });

      toast.success('Purchase Order Accepted!', {
        description: `Purchase Order #${po.poNumber} has been accepted. Please schedule dispatch in Delivery Management.`
      });

      window.dispatchEvent(new CustomEvent('notifications:updated'));
      window.dispatchEvent(new CustomEvent('orders:updated'));
      await checkPendingAwardsAndPOs(true);
    } catch (err: any) {
      toast.error('Failed to accept purchase order', {
        description: err?.message || 'Please try again or open the purchase order page.'
      });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleUploadEvidence = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be 10MB or less.');
      return;
    }
    setIsUploadingEvidence(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', 'po_decline_evidence');

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData
      });

      if (!res.ok) {
        throw new Error('Upload failed with status ' + res.status);
      }
      const data = await res.json();
      const fileId = data?.data?.fileId || data?.data?.id || data?.fileId || data?.id;
      setEvidenceFile({ id: Number(fileId), name: file.name });
      toast.success('Supporting document uploaded successfully');
    } catch (err: any) {
      toast.error('Failed to upload evidence document', {
        description: err?.message || 'Please try a different file.'
      });
    } finally {
      setIsUploadingEvidence(false);
      e.target.value = '';
    }
  };

  const handleDeclinePO = async (poId: number) => {
    if (!declineReason.trim() || declineReason.trim().length < 10) {
      toast.error('Please enter detailed remarks for declining the Purchase Order (minimum 10 characters).');
      return;
    }

    const matchedReason = getPoDeclineReasonByCode(declineReasonCode);
    if (matchedReason?.requiresEvidence && !evidenceFile) {
      toast.error(`Supporting evidence is mandatory for "${matchedReason.label}". Please upload a file.`);
      return;
    }

    setIsDeclining(true);
    try {
      await postApi(`/api/seller/purchase-orders/${poId}/decline`, {
        reasonCode: declineReasonCode,
        reason: declineReason.trim(),
        evidenceFileId: evidenceFile?.id,
        category: matchedReason?.category
      });

      toast.success('Purchase Order Declined', {
        description: matchedReason?.isExcused
          ? 'Contractual/Excused reason recorded. Zero penalty applied to your vendor rating. PBG released under GFR 171.'
          : 'Purchase Order cancelled. Commercial default recorded under Vendor Discipline.'
      });

      setDecliningPoId(null);
      setDeclineReason('');
      setDeclineReasonCode('BUYER_TERMS_DISCREPANCY');
      setEvidenceFile(null);
      window.dispatchEvent(new CustomEvent('notifications:updated'));
      window.dispatchEvent(new CustomEvent('orders:updated'));
      await checkPendingAwardsAndPOs(true);
    } catch (err: any) {
      toast.error('Failed to decline purchase order', {
        description: err?.message || 'Please try again.'
      });
    } finally {
      setIsDeclining(false);
    }
  };

  const currentListCount = awards.length + pos.length;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleDismissSession();
        }
      }}
    >
      <aside
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="award-alert-title"
        aria-describedby="award-alert-desc"
        aria-live="polite"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border-2 border-amber-400 bg-white shadow-2xl animate-in zoom-in-95 duration-200 focus:outline-none my-8 max-h-[90vh] flex flex-col"
      >
        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-t-[14px] bg-gradient-to-r from-[#0b2447] via-[#12335f] to-[#1d4ed8] px-5 py-4 text-white shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-[#0b2447] shadow-lg ring-2 ring-amber-300/70">
                <Trophy className="h-6 w-6 animate-pulse" />
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white shadow">
                  {currentListCount}
                </span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-wider text-amber-300">
                    Action Required
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-200 border border-amber-400/30">
                    <Sparkles className="h-3 w-3" /> Pending Decision
                  </span>
                </div>
                <h3 id="award-alert-title" className="text-base font-black text-white leading-snug">
                  {awards.length > 0 && pos.length > 0
                    ? 'Contract Award & Purchase Order Issued'
                    : awards.length > 0
                    ? 'Contract Award Offer Received'
                    : 'Purchase Order Issued to You'}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismissSession}
              aria-label="Dismiss alert for this session"
              title="Dismiss for current session"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p id="award-alert-desc" className="mt-2 text-xs text-slate-200/90 leading-relaxed">
            {awards.length > 0
              ? 'You have received an official contract award offer. Please review the terms and accept or decline below.'
              : 'You have received an issued purchase order. Please review and acknowledge to commence fulfillment.'}
          </p>

          {/* Tab Switcher if both exist */}
          {awards.length > 0 && pos.length > 0 && (
            <div className="mt-3 flex gap-2 border-t border-white/10 pt-2.5">
              <button
                type="button"
                onClick={() => setActiveTab('awards')}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${
                  activeTab === 'awards'
                    ? 'bg-amber-400 text-[#0b2447] shadow-sm'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Contract Awards ({awards.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('pos')}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${
                  activeTab === 'pos'
                    ? 'bg-amber-400 text-[#0b2447] shadow-sm'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Purchase Orders ({pos.length})
              </button>
            </div>
          )}
        </div>

        {/* Main Body */}
        <div className="overflow-y-auto p-4 sm:p-5 divide-y divide-slate-100 flex-1">
          {/* Awards List */}
          {activeTab === 'awards' &&
            awards.map((award) => {
              const isAccepting = acceptingId === `award-${award.id}`;
              const po = award.purchaseOrder;
              const isDeclineOpen = decliningAwardId === award.id;

              return (
                <div key={award.id} className="pt-4 first:pt-0 pb-4 last:pb-0">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:border-amber-200 hover:bg-amber-50/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-900 border border-amber-200">
                            {award.bidNumber || 'Award Offer'}
                          </span>
                          {po && (
                            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-900 border border-emerald-200 flex items-center gap-1">
                              <Receipt className="h-3 w-3" /> {po.poNumber || 'PO Generated'}
                            </span>
                          )}
                        </div>
                        <h4 className="mt-1.5 text-sm font-black text-slate-900 leading-snug">
                          {award.title}
                        </h4>
                        <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{award.buyerOrganizationName}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Award Value</p>
                        <p className="text-sm font-black text-emerald-700">
                          {formatCurrency(award.amount)}
                        </p>
                      </div>
                    </div>

                    {/* Decline form for Award */}
                    {isDeclineOpen ? (
                      <div className="mt-3.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3 animate-in fade-in duration-200">
                        <label
                          htmlFor={`decline-award-input-${award.id}`}
                          className="block text-xs font-bold text-rose-900 mb-1"
                        >
                          Reason for Declining Award (required, minimum 5 characters):
                        </label>
                        <textarea
                          id={`decline-award-input-${award.id}`}
                          rows={2}
                          value={declineAwardReason}
                          onChange={(e) => setDeclineAwardReason(e.target.value)}
                          placeholder="e.g. Inability to fulfill requested timeline or delivery specifications..."
                          className="w-full rounded-lg border border-rose-300 p-2 text-xs font-medium text-slate-900 bg-white focus:outline-rose-500 resize-none shadow-inner"
                        />
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[11px] text-rose-600 font-medium">
                            {declineAwardReason.trim().length < 5
                              ? `Minimum 5 characters (${declineAwardReason.trim().length}/5)`
                              : 'Reason ready'}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDecliningAwardId(null);
                                setDeclineAwardReason('');
                              }}
                              disabled={isDecliningAward}
                              className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeclineAward(award)}
                              disabled={isDecliningAward || declineAwardReason.trim().length < 5}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50 shadow-sm transition"
                            >
                              {isDecliningAward ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}
                              Confirm Decline Award
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Action Buttons for Award */
                      <div className="mt-3.5 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isAccepting || isDecliningAward}
                          onClick={() => handleAcceptAward(award)}
                          className="flex-1 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {isAccepting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Accepting Award...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Accept Award {po ? '& PO' : ''}
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isAccepting || isDecliningAward}
                          onClick={() => {
                            setDecliningAwardId(award.id);
                            setDeclineAwardReason('');
                          }}
                          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>Decline Award</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleDismissSession();
                            if (po?.id) {
                              router.push(`/seller/orders?orderId=${po.id}`);
                            } else {
                              router.push(award.bidId ? `/bids/${award.bidId}` : '/seller/orders');
                            }
                          }}
                          className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-[#0b2447]"
                        >
                          <span>View</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          {/* POs List */}
          {activeTab === 'pos' &&
            pos.map((po) => {
              const isAccepting = acceptingId === `po-${po.id}`;
              const isDeclineOpen = decliningPoId === po.id;

              return (
                <div key={po.id} className="pt-4 first:pt-0 pb-4 last:pb-0">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-900 border border-emerald-200">
                          {po.poNumber || `PO #${po.id}`}
                        </span>
                        <h4 className="mt-1.5 text-sm font-black text-slate-900 leading-snug">
                          {po.title}
                        </h4>
                        <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">
                            {po.buyerOrganizationName || po.buyerName || 'Buyer Organization'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PO Value</p>
                        <p className="text-sm font-black text-emerald-700">
                          {formatCurrency(po.amount)}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    {decliningPoId === po.id ? (
                      <div className="mt-3.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 space-y-3 animate-in fade-in duration-200">
                        {/* 1. Structured Reason Category Selector */}
                        <div>
                          <label
                            htmlFor={`decline-po-reason-select-${po.id}`}
                            className="block text-xs font-bold text-slate-800 mb-1"
                          >
                            Reason for Declining PO & Category <span className="text-rose-600">*</span>
                          </label>
                          <select
                            id={`decline-po-reason-select-${po.id}`}
                            value={declineReasonCode}
                            onChange={(e) => setDeclineReasonCode(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 p-2 text-xs font-semibold text-slate-900 bg-white focus:outline-rose-500 shadow-sm"
                          >
                            <optgroup label="Contractual / Excused Reasons (Zero Vendor Penalty)">
                              {PO_DECLINE_REASONS.filter((r) => r.isExcused).map((r) => (
                                <option key={r.code} value={r.code}>
                                  {r.label}
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="Commercial / Operational Defaults (Recorded under Discipline)">
                              {PO_DECLINE_REASONS.filter((r) => !r.isExcused).map((r) => (
                                <option key={r.code} value={r.code}>
                                  {r.label}
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>

                        {/* 2. Policy Impact Notice Badge */}
                        {(() => {
                          const matchedReason = getPoDeclineReasonByCode(declineReasonCode);
                          if (matchedReason?.isExcused) {
                            return (
                              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed">
                                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-bold text-emerald-800">Excused Contractual Reason</p>
                                  <p className="text-emerald-700">Zero penalty on your vendor reliability rating. Any active Performance Bank Guarantee (PBG) is automatically released under GFR 171.</p>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-bold text-amber-800">Commercial Default Notice</p>
                                <p className="text-amber-700">This decline will be recorded under Vendor Discipline. 3+ unexcused declines in 90 days trigger administrative review and bidding restrictions.</p>
                              </div>
                            </div>
                          );
                        })()}

                        {/* 3. Detailed Justification Remarks */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label
                              htmlFor={`decline-po-input-${po.id}`}
                              className="block text-xs font-bold text-slate-800"
                            >
                              Detailed Factual Justification <span className="text-rose-600">*</span>
                            </label>
                            <span className="text-[10px] font-bold text-slate-400">
                              {declineReason.trim().length}/10 chars min
                            </span>
                          </div>
                          <textarea
                            id={`decline-po-input-${po.id}`}
                            rows={2}
                            value={declineReason}
                            onChange={(e) => setDeclineReason(e.target.value)}
                            placeholder="Provide specific factual justification for the procurement audit record..."
                            className="w-full rounded-lg border border-slate-300 p-2 text-xs font-medium text-slate-900 bg-white focus:outline-rose-500 resize-none shadow-inner"
                          />
                        </div>

                        {/* 4. Evidence File Attachment */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Supporting Document{' '}
                            {getPoDeclineReasonByCode(declineReasonCode)?.requiresEvidence ? (
                              <span className="text-rose-600 font-bold">*(Mandatory for Force Majeure)</span>
                            ) : (
                              <span className="text-slate-400 font-normal">(Optional PDF/PNG/JPG up to 10MB)</span>
                            )}
                          </label>

                          {evidenceFile ? (
                            <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 shadow-sm">
                              <div className="flex items-center gap-2 truncate">
                                <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                                <span className="text-xs font-semibold text-slate-800 truncate">{evidenceFile.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setEvidenceFile(null)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition"
                                title="Remove file"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer transition shadow-sm">
                              {isUploadingEvidence ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                                  <span>Uploading...</span>
                                </>
                              ) : (
                                <>
                                  <Paperclip className="h-3.5 w-3.5 text-slate-500" />
                                  <span>Attach Evidence Document</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept=".pdf,.png,.jpg,.jpeg"
                                onChange={handleUploadEvidence}
                                disabled={isUploadingEvidence || isDeclining}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>

                        {/* 5. Actions */}
                        <div className="mt-2 flex items-center justify-end gap-2 pt-2 border-t border-rose-200/60">
                          <button
                            type="button"
                            onClick={() => {
                              setDecliningPoId(null);
                              setDeclineReason('');
                              setEvidenceFile(null);
                            }}
                            disabled={isDeclining}
                            className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclinePO(po.id)}
                            disabled={
                              isDeclining ||
                              declineReason.trim().length < 10 ||
                              (getPoDeclineReasonByCode(declineReasonCode)?.requiresEvidence && !evidenceFile)
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50 shadow-sm transition"
                          >
                            {isDeclining ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                            Confirm Decline
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3.5 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isAccepting || isDeclining}
                          onClick={() => handleAcceptPO(po)}
                          className="flex-1 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {isAccepting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Accepting PO...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-4 w-4" />
                              Accept PO
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isAccepting || isDeclining}
                          onClick={() => {
                            setDecliningPoId(po.id);
                            setDeclineReason('');
                          }}
                          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" />
                          <span>Decline PO</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            handleDismissSession();
                            router.push(`/seller/orders?orderId=${po.id}`);
                          }}
                          className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-[#0b2447]"
                        >
                          <span>View</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer Info */}
        <div className="border-t border-slate-100 bg-slate-50/90 px-5 py-3 text-center rounded-b-[14px] shrink-0">
          <p className="text-[11px] font-semibold text-slate-500">
            This prompt appears in the center of your screen when awards or purchase orders are issued to you. Action is required to commence fulfillment.
          </p>
        </div>
      </aside>
    </div>
  );
}
