import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getPusherClient, isPusherAvailable } from '../../../lib/realtime';
import type { ConversationDto, MessageDto } from '../api';

export const useConversationRealtime = (conversationId: number | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId || !isPusherAvailable()) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    let isMounted = true;
    const channelName = `private-conversation-${conversationId}`;
    console.log(`[Pusher] Subscribing to conversation channel ${channelName}`);
    const channel = pusher.subscribe(channelName);

    channel.bind('MESSAGE_CREATED', (data: { type: string; conversationId: number; message: MessageDto }) => {
      if (!isMounted || !data.message) return;
      console.log(`[Pusher] Received MESSAGE_CREATED for conversation ${conversationId}:`, data.message);

      queryClient.setQueryData<ConversationDto>(['conversations', 'detail', conversationId], (oldData) => {
        if (!oldData) return oldData;
        const exists = oldData.messages?.some((m) => m.id === data.message.id);
        if (exists) return oldData;

        return {
          ...oldData,
          messages: [...(oldData.messages || []), data.message],
          lastMessageAt: data.message.createdAt || new Date().toISOString()
        };
      });

      void queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['conversations', 'unread-count'] });
    });

    return () => {
      isMounted = false;
      console.log(`[Pusher] Unsubscribing from conversation channel ${channelName}`);
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [conversationId, queryClient]);
};
