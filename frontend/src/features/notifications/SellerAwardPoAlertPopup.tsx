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
  Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { getApi, postApi } from '../shared/apiClient';
import { formatCurrency } from '../shared/format';

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

  const [awards, setAwards] = useState<PendingAward[]>([]);
  const [pos, setPOs] = useState<PendingPO[]>([]);
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'awards' | 'pos'>('awards');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const isSellerOrShg = user?.role === 'seller' || user?.role === 'shg';

  const checkPendingAwardsAndPOs = useCallback(async () => {
    if (!user?.id || !isSellerOrShg) return;

    try {
      const res = await getApi<PendingResponse>('/api/seller/pending-awards-and-pos');
      const pendingAwards = Array.isArray(res?.awards) ? res.awards : [];
      const pendingPOs = Array.isArray(res?.purchaseOrders) ? res.purchaseOrders : [];

      setAwards(pendingAwards);
      setPOs(pendingPOs);

      if (pendingAwards.length > 0) {
        setActiveTab('awards');
        setVisible(true);
      } else if (pendingPOs.length > 0) {
        setActiveTab('pos');
        setVisible(true);
      } else {
        setVisible(false);
      }
    } catch {
      // Silent error handling — non-blocking pop-up
    }
  }, [user?.id, isSellerOrShg]);

  useEffect(() => {
    if (!user?.id || !isSellerOrShg) return;

    // Check if dismissed in this specific active session
    const sessionKey = `seller-award-po-dismissed:${user.id}`;
    if (sessionStorage.getItem(sessionKey)) {
      return;
    }

    void checkPendingAwardsAndPOs();

    // Listen to global updates
    const handleUpdate = () => {
      void checkPendingAwardsAndPOs();
    };
    window.addEventListener('notifications:updated', handleUpdate);
    window.addEventListener('orders:updated', handleUpdate);

    return () => {
      window.removeEventListener('notifications:updated', handleUpdate);
      window.removeEventListener('orders:updated', handleUpdate);
    };
  }, [user?.id, isSellerOrShg, checkPendingAwardsAndPOs]);

  if (!visible || (!awards.length && !pos.length)) {
    return null;
  }

  const handleDismissSession = () => {
    if (user?.id) {
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

      window.dispatchEvent(new CustomEvent('notifications:updated'));
      window.dispatchEvent(new CustomEvent('orders:updated'));
      await checkPendingAwardsAndPOs();
    } catch (err: any) {
      toast.error('Failed to accept award', {
        description: err?.message || 'Please try again or open the order page.'
      });
    } finally {
      setAcceptingId(null);
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
      await checkPendingAwardsAndPOs();
    } catch (err: any) {
      toast.error('Failed to accept purchase order', {
        description: err?.message || 'Please try again or open the purchase order page.'
      });
    } finally {
      setAcceptingId(null);
    }
  };

  const currentListCount = awards.length + pos.length;

  return (
    <aside
      role="alertdialog"
      aria-label="Pending Bid Award and Purchase Order Notifications"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-[95] w-[min(94vw,430px)] rounded-2xl border-2 border-amber-400/80 bg-white/95 p-0 shadow-2xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-6 duration-300 sm:bottom-6 sm:right-6"
    >
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-t-[14px] bg-gradient-to-r from-[#0b2447] via-[#12335f] to-[#1d4ed8] px-4 py-3 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-[#0b2447] shadow-md ring-2 ring-amber-300/60">
              <Trophy className="h-5 w-5 animate-pulse" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white">
                {currentListCount}
              </span>
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Action Required
                </p>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/20 px-1.5 py-0.2 text-[9px] font-bold text-amber-200">
                  <Sparkles className="h-2.5 w-2.5" /> Pending
                </span>
              </div>
              <h4 className="text-sm font-black text-white leading-snug">
                {awards.length > 0 && pos.length > 0
                  ? 'Bid Award & Purchase Order Issued'
                  : awards.length > 0
                  ? 'Contract Award Offer Received'
                  : 'Purchase Order Issued to You'}
              </h4>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismissSession}
            aria-label="Dismiss alert for this session"
            title="Dismiss for current session"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher if both exist */}
        {awards.length > 0 && pos.length > 0 && (
          <div className="mt-3 flex gap-2 border-t border-white/10 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('awards')}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition ${
                activeTab === 'awards'
                  ? 'bg-amber-400 text-[#0b2447]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Bid Awards ({awards.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pos')}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition ${
                activeTab === 'pos'
                  ? 'bg-amber-400 text-[#0b2447]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Purchase Orders ({pos.length})
            </button>
          </div>
        )}
      </div>

      {/* Main Body */}
      <div className="max-h-[380px] overflow-y-auto p-3.5 divide-y divide-slate-100">
        {/* Awards List */}
        {activeTab === 'awards' &&
          awards.map((award) => {
            const isAccepting = acceptingId === `award-${award.id}`;
            const po = award.purchaseOrder;

            return (
              <div key={award.id} className="pt-3 first:pt-0 pb-3 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-900 border border-amber-200">
                        {award.bidNumber || 'Award Offer'}
                      </span>
                      {po && (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-900 border border-emerald-200 flex items-center gap-1">
                          <Receipt className="h-2.5 w-2.5" /> {po.poNumber || 'PO Generated'}
                        </span>
                      )}
                    </div>
                    <h5 className="mt-1 text-xs font-black text-slate-900 line-clamp-2 leading-snug">
                      {award.title}
                    </h5>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
                      <span className="truncate">{award.buyerOrganizationName}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Award Value</p>
                    <p className="text-xs font-black text-emerald-700">
                      {formatCurrency(award.amount)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isAccepting}
                    onClick={() => handleAcceptAward(award)}
                    className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isAccepting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Accepting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Accept Award {po ? '& PO' : ''}
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleDismissSession();
                      if (po?.id) {
                        router.push(`/procurement-orders/${po.id}`);
                      } else {
                        router.push(award.bidId ? `/bids/${award.bidId}` : '/seller/awards');
                      }
                    }}
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:text-[#0b2447]"
                  >
                    <span>View</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}

        {/* POs List */}
        {activeTab === 'pos' &&
          pos.map((po) => {
            const isAccepting = acceptingId === `po-${po.id}`;

            return (
              <div key={po.id} className="pt-3 first:pt-0 pb-3 last:pb-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-900 border border-emerald-200">
                      {po.poNumber || `PO #${po.id}`}
                    </span>
                    <h5 className="mt-1 text-xs font-black text-slate-900 line-clamp-2 leading-snug">
                      {po.title}
                    </h5>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
                      <span className="truncate">
                        {po.buyerOrganizationName || po.buyerName || 'Buyer'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">PO Value</p>
                    <p className="text-xs font-black text-emerald-700">
                      {formatCurrency(po.amount)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isAccepting}
                    onClick={() => handleAcceptPO(po)}
                    className="flex-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isAccepting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Accepting...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Accept Purchase Order
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleDismissSession();
                      router.push(`/procurement-orders/${po.id}`);
                    }}
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 hover:text-[#0b2447]"
                  >
                    <span>View PO</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {/* Footer Info */}
      <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2 text-center rounded-b-[14px]">
        <p className="text-[10px] font-semibold text-slate-500">
          This prompt will reappear on login until you accept your issued awards and purchase orders.
        </p>
      </div>
    </aside>
  );
}
