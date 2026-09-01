/**
 * React Query hooks for messages.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    archiveConversation,
    createConversation,
    deleteMessage,
    fetchConversation,
    fetchConversations,
    fetchUnreadMessageCount,
    markConversationRead,
    muteConversation,
    searchMessageUsers,
    sendMessage,
    type ConversationDto
} from './api';

const KEY = ['conversations'] as const;

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
    qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
};

export const useConversations = () =>
    useQuery({
        queryKey: [...KEY, 'list'] as const,
        queryFn: fetchConversations,
        staleTime: 10_000,
        gcTime: 5 * 60 * 1000
    });

export const useConversation = (id: number | undefined) => {
    const qc = useQueryClient();
    return useQuery({
        queryKey: [...KEY, 'detail', id || 0] as const,
        queryFn: () => fetchConversation(id as number),
        enabled: !!id && id > 0,
        initialData: () => {
            if (!id) return undefined;
            const list = qc.getQueryData<ConversationDto[]>([...KEY, 'list']);
            return list?.find(c => c.id === id);
        },
        initialDataUpdatedAt: () => {
            return qc.getQueryState([...KEY, 'list'])?.dataUpdatedAt;
        },
        staleTime: 10_000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 20_000
    });
};

export const useCreateConversation = () => {
    const qc = useQueryClient();
    return useMutation({ mutationFn: createConversation, onSuccess: () => { void invalidate(qc); } });
};

export const useSendMessage = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Parameters<typeof sendMessage>[1] }) => sendMessage(id, data),
        onSuccess: () => { void invalidate(qc); }
    });
};

export const useDeleteMessage = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ conversationId, messageId }: { conversationId: number; messageId: number }) =>
            deleteMessage(conversationId, messageId),
        onSuccess: (_data, vars) => {
            void invalidate(qc);
        }
    });
};

export const useMarkConversationRead = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: markConversationRead,
        onSuccess: (_data, id) => {
            void invalidate(qc);
            void qc.invalidateQueries({ queryKey: [...KEY, 'detail', id] });
            void qc.invalidateQueries({ queryKey: [...KEY, 'unread-count'] });
        }
    });
};

export const useArchiveConversation = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: archiveConversation,
        onSuccess: (_data, id) => {
            void invalidate(qc);
            void qc.invalidateQueries({ queryKey: [...KEY, 'detail', id] });
        }
    });
};

export const useMuteConversation = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, muted }: { id: number; muted: boolean }) => muteConversation(id, muted),
        onSuccess: (_data, variables) => {
            void qc.invalidateQueries({ queryKey: [...KEY, 'detail', variables.id] });
        }
    });
};

export const useUnreadMessageCount = () =>
    useQuery({
        queryKey: [...KEY, 'unread-count'] as const,
        queryFn: fetchUnreadMessageCount,
        refetchInterval: 30_000
    });

export const useMessageUserSearch = (params: { q?: string; role?: string }, enabled = true) =>
    useQuery({
        queryKey: [...KEY, 'users', params.role || 'all', params.q || ''] as const,
        queryFn: () => searchMessageUsers(params),
        enabled,
        staleTime: 30_000
    });
