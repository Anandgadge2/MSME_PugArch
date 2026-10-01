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
      void queryClient.invalidateQueries({ queryKey: ['buyerMyProcurements'] });
      void queryClient.invalidateQueries({ queryKey: ['buyer-procurements'] });
      void queryClient.invalidateQueries({ queryKey: ['marketplace-requirement'] });
      void queryClient.invalidateQueries({ queryKey: ['rfq-buyer-responses-v2'] });
      void queryClient.invalidateQueries({ queryKey: ['reverse-auction-live'] });
      void queryClient.invalidateQueries({ queryKey: ['reverse-auction-participants'] });
      void queryClient.invalidateQueries({ queryKey: ['reverse-auction-result'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
    };

    channel.bind('AWARD_RECEIVED', (data: UserRealtimeEvent) => {
      if (!isMounted) return;
      invalidateAll();
      const amtStr = data.awardedAmount ? ` for ₹${Number(data.awardedAmount).toLocaleString('en-IN')}` : '';
      toast.success('🏆 Contract Award Received!', {
        description: `You have received a new contract award offer${amtStr}. Review and confirm to proceed.`,
        duration: 7000,
      });
    });

    channel.bind('BID_STATUS_CHANGED', (data: UserRealtimeEvent) => {
      if (!isMounted) return;
      invalidateAll();
      toast.info('Procurement Status Updated', {
        description: data.status ? `Status updated to ${data.status}.` : 'Your procurement dashboard has been refreshed.',
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
