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

    channel.bind('MESSAGES_READ', (data: { type: string; conversationId: number; readByUserId: number; readAt: string }) => {
      if (!isMounted) return;
      console.log(`[Pusher] Received MESSAGES_READ for conversation ${conversationId}:`, data);

      queryClient.setQueryData<ConversationDto>(['conversations', 'detail', conversationId], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          unreadCount: 0,
          messages: (oldData.messages || []).map((m) =>
            m.senderId !== data.readByUserId ? { ...m, status: 'read' } : m
          )
        };
      });
      void queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['conversations', 'unread-count'] });
    });

    channel.bind('MESSAGE_DELETED', (data: { type: string; conversationId: number; messageId: number; message?: MessageDto }) => {
      if (!isMounted) return;
      console.log(`[Pusher] Received MESSAGE_DELETED for conversation ${conversationId}:`, data);

      queryClient.setQueryData<ConversationDto>(['conversations', 'detail', conversationId], (oldData) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          messages: (oldData.messages || []).map((m) =>
            m.id === data.messageId
              ? { ...m, content: 'This message was deleted', status: 'deleted', attachments: [] }
              : m
          )
        };
      });
      void queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
    });

    return () => {
      isMounted = false;
      console.log(`[Pusher] Unsubscribing from conversation channel ${channelName}`);
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [conversationId, queryClient]);
};
