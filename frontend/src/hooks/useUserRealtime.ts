'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getPusherClient, isPusherAvailable } from '../lib/realtime';

export interface UserRealtimeEvent {
  type: string;
  procurementId?: number | string;
  requirementId?: number | string;
  auctionId?: number | string;
  awardedAmount?: number;
  status?: string;
  timestamp?: string;
}

export const useUserRealtime = (userId: number | string | null | undefined) => {
  const queryClient = useQueryClient();
  const numUserId = Number(userId);

  useEffect(() => {
    if (!Number.isFinite(numUserId) || numUserId <= 0) return;
    if (!isPusherAvailable()) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    let isMounted = true;
    const channelName = `private-user-${numUserId}`;
    const channel = pusher.subscribe(channelName);

    const invalidateAll = () => {
      void queryClient.invalidateQueries({ queryKey: ['buyer-unified-participations'] });
      void queryClient.invalidateQueries({ queryKey: ['quote-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['procurement-bid'] });
      void queryClient.invalidateQueries({ queryKey: ['procurement-bids'] });
      void queryClient.invalidateQueries({ queryKey: ['limited-tender-bid-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['limited-tender-req-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['open-tender-bid-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['open-tender-req-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['rfp-bid-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['rfp-req-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['rate-contract-bid-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['bid-dispatcher-meta'] });
      void queryClient.invalidateQueries({ queryKey: ['buyerMyProcurements'] });
      void queryClient.invalidateQueries({ queryKey: ['buyer-procurements'] });
      void queryClient.invalidateQueries({ queryKey: ['marketplace-requirement'] });
      void queryClient.invalidateQueries({ queryKey: ['rfq-buyer-responses-v2'] });
      void queryClient.invalidateQueries({ queryKey: ['reverse-auction-live'] });
      void queryClient.invalidateQueries({ queryKey: ['reverse-auction-participants'] });
      void queryClient.invalidateQueries({ queryKey: ['reverse-auction-result'] });
      void queryClient.invalidateQueries({ queryKey: ['procurement-awards'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    };

    channel.bind('AWARD_RECEIVED', (data: UserRealtimeEvent) => {
      if (!isMounted) return;
      invalidateAll();
      window.dispatchEvent(new CustomEvent('awards:updated', { detail: data }));
      window.dispatchEvent(new CustomEvent('notifications:updated'));
      window.dispatchEvent(new CustomEvent('orders:updated'));
      const amtStr = data.awardedAmount ? ` for ₹${Number(data.awardedAmount).toLocaleString('en-IN')}` : '';
      toast.success('🏆 Contract Award Received!', {
        id: `award-received-${data.auctionId || data.procurementId || 'award'}`,
        description: `You have received a new contract award offer${amtStr}. Review and confirm to proceed.`,
        duration: 7000,
      });
    });

    channel.bind('BID_STATUS_CHANGED', (data: UserRealtimeEvent) => {
      if (!isMounted) return;
      invalidateAll();
      const enriched = {
        ...data,
        bidId: data.procurementId || (data as any).bidId,
        procurementId: data.procurementId,
        requirementId: data.requirementId,
        status: data.status,
      };
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('procurement:updated', { detail: enriched }));
        if (data.status === 'AWARD_ACCEPTED' || data.type === 'AWARD_ACCEPTED') {
          window.dispatchEvent(new CustomEvent('award:accepted', { detail: enriched }));
          window.dispatchEvent(new CustomEvent('awards:updated', { detail: enriched }));
        }
      }
      toast.info('Procurement Status Updated', {
        id: `bid-status-${data.procurementId || data.requirementId || 'status'}`,
        description: data.status ? `Status updated to ${data.status.replace(/_/g, ' ')}.` : 'Your procurement dashboard has been refreshed.',
        duration: 5000,
      });
    });

    return () => {
      isMounted = false;
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [numUserId, queryClient]);
};
