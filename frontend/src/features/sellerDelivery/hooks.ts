/**
 * React Query hooks for seller delivery management.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    addDeliveryDocument,
    fetchDelivery,
    fetchDocuments,
    fetchDeliveries,
    fetchLogisticsPartners,
    fetchTimeline,
    manualStatusUpdate,
    markDispatched,
    markPacked,
    markReadyForPickup,
    sellerAccept,
    sellerReject,
    updateDispatchDetails
} from './api';
import { queryKeys } from '../shared/queryKeys';

const KEY = ['delivery'] as const;

export const invalidateDeliveryCache = async (qc: ReturnType<typeof useQueryClient>, id?: number) => {
    // Invalidate queries to mark them stale and trigger silent background refetches.
    // Never call qc.refetchQueries here as that forces synchronous network waterfalls.
    await Promise.all([
        qc.invalidateQueries({ queryKey: KEY }),
        qc.invalidateQueries({ queryKey: queryKeys.deliveries.all }),
        id ? qc.invalidateQueries({ queryKey: [...KEY, 'detail', id] }) : Promise.resolve(),
        id ? qc.invalidateQueries({ queryKey: [...KEY, 'timeline', id] }) : Promise.resolve(),
        id ? qc.invalidateQueries({ queryKey: queryKeys.deliveries.detail(id) }) : Promise.resolve(),
        id ? qc.invalidateQueries({ queryKey: queryKeys.deliveries.timeline(id) }) : Promise.resolve(),
    ]);
};

const invalidate = (qc: ReturnType<typeof useQueryClient>, id?: number) => invalidateDeliveryCache(qc, id);

export const useDeliveries = (params?: { status?: string; q?: string; role?: string }) =>
    useQuery({
        queryKey: [...KEY, 'list', params || {}] as const,
        queryFn: () => fetchDeliveries(params)
    });

export const useDelivery = (id: number | undefined) =>
    useQuery({
        queryKey: [...KEY, 'detail', id || 0] as const,
        queryFn: () => fetchDelivery(id as number),
        enabled: !!id && id > 0
    });

export const useDeliveryTimeline = (id: number | undefined) =>
    useQuery({
        queryKey: [...KEY, 'timeline', id || 0] as const,
        queryFn: () => fetchTimeline(id as number),
        enabled: !!id && id > 0
    });

export const useDeliveryDocuments = (id: number | undefined) =>
    useQuery({
        queryKey: [...KEY, 'documents', id || 0] as const,
        queryFn: () => fetchDocuments(id as number),
        enabled: !!id && id > 0
    });

export const useLogisticsPartners = () =>
    useQuery({
        queryKey: ['logistics-partners'] as const,
        queryFn: fetchLogisticsPartners,
        staleTime: 5 * 60 * 1000
    });

export const useSellerAccept = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Parameters<typeof sellerAccept>[1] }) => sellerAccept(id, data),
        onSuccess: (_data, vars) => { void invalidate(qc, vars.id); }
    });
};

export const useSellerReject = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, reason }: { id: number; reason: string }) => sellerReject(id, reason),
        onSuccess: (_data, vars) => { void invalidate(qc, vars.id); }
    });
};

export const useMarkPacked = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Parameters<typeof markPacked>[1] }) => markPacked(id, data),
        onSuccess: (_data, vars) => { void invalidate(qc, vars.id); }
    });
};

export const useUpdateDispatchDetails = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateDispatchDetails>[1] }) => updateDispatchDetails(id, data),
        onSuccess: (_data, vars) => { void invalidate(qc, vars.id); }
    });
};

export const useMarkReadyForPickup = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => markReadyForPickup(id),
        onSuccess: (_data, id) => { void invalidate(qc, id); }
    });
};

export const useMarkDispatched = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => markDispatched(id),
        onSuccess: (_data, id) => { void invalidate(qc, id); }
    });
};

export const useManualStatusUpdate = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Parameters<typeof manualStatusUpdate>[1] }) => manualStatusUpdate(id, data),
        onSuccess: (_data, vars) => { void invalidate(qc, vars.id); }
    });
};

export const useAddDeliveryDocument = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: number; data: Parameters<typeof addDeliveryDocument>[1] }) => addDeliveryDocument(id, data),
        onSuccess: (_data, vars) => { void invalidate(qc, vars.id); }
    });
};
