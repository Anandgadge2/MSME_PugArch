import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    createQuoteRequest,
    deleteQuoteRequest,
    fetchQuoteRequestById,
    fetchQuoteRequests,
    submitQuoteResponse,
    decideQuoteResponse,
    updateQuoteRequest,
    fetchVendors,
    fetchVendorCatalogue,
    fetchClarifications,
    askClarification,
    replyClarification,
    fetchRequirementClarifications,
    askRequirementClarification,
    replyRequirementClarification
} from './api';
import type { NewQuoteRequestPayload, NewQuoteResponsePayload } from './types';

const KEY = ['quote-requests'] as const;

export const useQuoteRequests = (params: { q?: string; status?: string; page?: number; pageSize?: number } = {}) =>
    useQuery({
        queryKey: [...KEY, 'list', params] as const,
        queryFn: () => fetchQuoteRequests(params)
    });

export const useQuoteRequest = (id: number | undefined) =>
    useQuery({
        queryKey: [...KEY, 'detail', id || 0] as const,
        queryFn: () => fetchQuoteRequestById(id as number),
        enabled: !!id && id > 0
    });

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
    void qc.invalidateQueries({ queryKey: KEY });
    void qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] });
};

export const useCreateQuoteRequest = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: NewQuoteRequestPayload) => createQuoteRequest(payload),
        onSuccess: () => { invalidate(qc); }
    });
};

export const useUpdateQuoteRequest = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Partial<NewQuoteRequestPayload> & { status?: string } }) =>
            updateQuoteRequest(id, data),
        onSuccess: () => { invalidate(qc); }
    });
};

export const useSubmitQuoteResponse = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: NewQuoteResponsePayload }) => submitQuoteResponse(id, data),
        onSuccess: () => { invalidate(qc); }
    });
};
export const useDecideQuoteResponse = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, decision, title }: { id: number; decision: 'accept' | 'reject'; title?: string }) =>
            decideQuoteResponse(id, decision, title ? { title } : {}),
        onSuccess: () => { invalidate(qc); }
    });
};

export const useDeleteQuoteRequest = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => deleteQuoteRequest(id),
        onSuccess: () => { invalidate(qc); }
    });
};

export const useVendors = () =>
    useQuery({
        queryKey: ['vendors'] as const,
        queryFn: () => fetchVendors()
    });

export const useVendorCatalogue = (vendorId: number | undefined) =>
    useQuery({
        queryKey: ['vendors', 'catalogue', vendorId || 0] as const,
        queryFn: () => fetchVendorCatalogue(vendorId as number),
        enabled: !!vendorId && vendorId > 0
    });

const CLARIFICATION_KEY = ['quote-request-clarifications'] as const;

// Clarifications live on two backend entities: QuoteRequest (requestId flow) and
// BuyerRequirement (requirementId flow). `kind` picks the endpoint family.
export type ClarificationKind = 'quote-request' | 'requirement';

export const useClarifications = (id: number | string | undefined, kind: ClarificationKind = 'quote-request') => {
    const qc = useQueryClient();

    useEffect(() => {
        const handleNotifUpdate = () => {
            void qc.invalidateQueries({ queryKey: CLARIFICATION_KEY });
        };
        window.addEventListener('notifications:updated', handleNotifUpdate);
        return () => window.removeEventListener('notifications:updated', handleNotifUpdate);
    }, [qc]);

    return useQuery({
        queryKey: [...CLARIFICATION_KEY, kind, id || '0'] as const,
        queryFn: () => (kind === 'requirement'
            ? fetchRequirementClarifications(id as any)
            : fetchClarifications(id as any)),
        enabled: Boolean(id) && String(id).trim().length > 0,
        refetchInterval: 4000,
        refetchIntervalInBackground: false
    });
};

export const useAskClarification = (id: number | string | undefined, kind: ClarificationKind = 'quote-request') => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ question, visibility }: { question: string; visibility?: 'PUBLIC' | 'PRIVATE' }) =>
            (kind === 'requirement'
                ? askRequirementClarification(id as any, question, visibility)
                : askClarification(id as any, question, visibility)),
        onSuccess: (newClar: any) => {
            if (newClar && typeof newClar === 'object') {
                const item = newClar?.data ?? newClar;
                qc.setQueryData([...CLARIFICATION_KEY, kind, id || '0'], (old: any[] = []) => {
                    const list = Array.isArray(old) ? old : [];
                    if (item.id && list.some(c => c.id === item.id)) return list;
                    return [...list, item];
                });
            }
            void qc.invalidateQueries({ queryKey: CLARIFICATION_KEY });
        }
    });
};

export const useReplyClarification = (id: number | string | undefined, kind: ClarificationKind = 'quote-request') => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ clarId, response }: { clarId: number; response: string }) =>
            (kind === 'requirement'
                ? replyRequirementClarification(id as any, clarId, response)
                : replyClarification(id as any, clarId, response)),
        onSuccess: (updatedClar: any) => {
            if (updatedClar && typeof updatedClar === 'object') {
                const item = updatedClar?.data ?? updatedClar;
                qc.setQueryData([...CLARIFICATION_KEY, kind, id || '0'], (old: any[] = []) => {
                    const list = Array.isArray(old) ? old : [];
                    return list.map(c => (c.id === item.id ? { ...c, ...item } : c));
                });
            }
            void qc.invalidateQueries({ queryKey: CLARIFICATION_KEY });
        }
    });
};
