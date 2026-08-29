import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { getApi } from '../features/shared/apiClient';

export type OrgRole = string;

export interface OrgStatus {
    organization: {
        id: number;
        organizationName: string;
        verificationStatus: string;
        organizationOnboardingStatus?: string;
    } | null;
    membership: {
        orgRole?: string;
        isActive: boolean;
        acceptedAt?: string;
    } | null;
    isApproved: boolean;
}

interface PermissionPayload {
    permissions: string[];
}

interface UseOrgRoleReturn {
    orgRole: string | null;
    orgStatus: OrgStatus | null;
    isApproved: boolean;
    isOrgAdmin: boolean;
    isProcurementOfficer: boolean;
    isFinanceOfficer: boolean;
    isTechnicalOfficer: boolean;
    isLogisticsOfficer: boolean;
    isViewer: boolean;
    canTransact: boolean;
    hasMinRole: (_minRole: string) => boolean;
    hasPermission: (permissionCode: string) => boolean;
    permissions: string[];
    loading: boolean;
    reload: () => void;
}

export function usePermissions() {
    const { user, token } = useAuth();
    const cachedPermissions = useMemo(
        () => Array.isArray(user?.permissions) ? user.permissions : [],
        [user?.permissions]
    );
    const query = useQuery({
        queryKey: ['auth', 'permissions', user?.id],
        enabled: Boolean(token && user),
        queryFn: async () => {
            const data = await getApi<PermissionPayload>('/api/auth/me/permissions', true);
            return Array.isArray(data?.permissions) ? data.permissions : [];
        },
        initialData: cachedPermissions,
        initialDataUpdatedAt: 0,
        placeholderData: cachedPermissions,
        staleTime: 60_000,
        retry: 1
    });

    const permissions = useMemo(() => {
        if (!user) return [];
        return Array.from(new Set(Array.isArray(query.data) ? query.data : cachedPermissions));
    }, [cachedPermissions, query.data, user]);

    const hasPermission = useCallback((permissionCode: string) => {
        return permissions.includes('*') || permissions.includes(permissionCode);
    }, [permissions]);

    return {
        permissions,
        hasPermission,
        loading: Boolean(token && user && query.isFetching && query.dataUpdatedAt === 0),
        reload: () => { void query.refetch(); }
    };
}

export function usePermission(permissionCode: string) {
    const { hasPermission, loading } = usePermissions();
    return { allowed: hasPermission(permissionCode), loading };
}

export function useOrgRole(): UseOrgRoleReturn {
    const { user, token } = useAuth();
    const [orgStatus, setOrgStatus] = useState<OrgStatus | null>(null);
    const [orgLoading, setOrgLoading] = useState(false);
    const isInitialLoad = useRef(true);
    const permissionState = usePermissions();

    const load = useCallback(async (skipCache = false) => {
        if (!token || !user) return;

        if (isInitialLoad.current) {
            setOrgLoading(true);
        }

        try {
            const endpoint = skipCache
                ? `/api/org/status?_ts=${Date.now()}`
                : '/api/org/status';
            const data = await getApi<OrgStatus>(endpoint, skipCache);
            setOrgStatus(data);
            isInitialLoad.current = false;
        } catch {
            setOrgStatus(null);
        } finally {
            setOrgLoading(false);
        }
    }, [token, user]);

    useEffect(() => {
        void load();
    }, [load]);

    const hasPermission = permissionState.hasPermission;
    const orgRole = orgStatus?.membership?.orgRole ?? null;
    const isApproved = orgStatus?.isApproved ?? false;

    return {
        orgRole,
        orgStatus,
        isApproved,
        isOrgAdmin: hasPermission('team.role.manage'),
        isProcurementOfficer: hasPermission('tender.create') || hasPermission('tender.publish'),
        isFinanceOfficer: hasPermission('payment.verify') || hasPermission('payment.initiate') || hasPermission('invoice.approve'),
        isTechnicalOfficer: hasPermission('bid.technical.evaluate'),
        isLogisticsOfficer: hasPermission('grn.create') || hasPermission('grn.approve'),
        isViewer: permissionState.permissions.length > 0 && permissionState.permissions.every(code => code.endsWith('.view')),
        canTransact: isApproved && permissionState.permissions.some(code => !code.endsWith('.view')),
        hasMinRole: () => false,
        hasPermission,
        permissions: permissionState.permissions,
        loading: orgLoading || permissionState.loading,
        reload: () => {
            void load(true);
            void permissionState.reload();
        }
    };
}
