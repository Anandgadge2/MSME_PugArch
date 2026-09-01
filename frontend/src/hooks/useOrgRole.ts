import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    const [remotePermissions, setRemotePermissions] = useState<string[]>([]);
    const [loading, setLoading] = useState(Boolean(token && user));

    const load = useCallback(async () => {
        if (!token || !user) {
            setRemotePermissions([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const data = await getApi<PermissionPayload>('/api/auth/me/permissions', true);
            setRemotePermissions(Array.isArray(data?.permissions) ? data.permissions : []);
        } catch {
            setRemotePermissions(Array.isArray(user.permissions) ? user.permissions : []);
        } finally {
            setLoading(false);
        }
    }, [token, user]);

    useEffect(() => {
        void load();
    }, [load]);

    const permissions = useMemo(() => {
        const cached = Array.isArray(user?.permissions) ? user.permissions : [];
        const isMasterOrAdmin = user?.role === 'master_admin' || user?.role === 'admin';
        if (isMasterOrAdmin) return ['*'];

        const serverPerms = remotePermissions.length > 0 ? remotePermissions : cached;

        // If server permissions exist, respect them strictly
        if (serverPerms.length > 0) {
            return serverPerms;
        }

        // Only standalone single-user accounts without an organization receive generic defaults
        if (!user?.organizationId && !user?.isSubUser) {
            if (user?.role === 'buyer') {
                return ['dashboard.view', 'marketplace.view', 'requirement.view', 'requirement.create', 'requirement.publish', 'tender.view', 'tender.create', 'tender.update', 'tender.publish', 'cart.view', 'cart.add', 'cart.submit_for_approval', 'approval.view', 'approval.submit', 'purchase_order.view', 'purchase_order.create', 'purchase_order.approve', 'checkout.initiate', 'checkout.approve', 'delivery.view', 'delivery.confirm', 'payment.view', 'payment.initiate', 'invoice.view', 'invoice.approve', 'grn.view', 'grn.create', 'grn.approve', 'dispute.view', 'dispute.manage', 'reverse_auction.view', 'team.member.view', 'team.role.manage', 'organization.view', 'organization.update', 'report.view'];
            }
            if (user?.role === 'seller' || user?.role === 'shg') {
                return ['dashboard.view', 'catalogue.product.view', 'catalogue.product.create', 'catalogue.product.update', 'catalogue.product.delete', 'catalogue.service.view', 'catalogue.service.create', 'catalogue.service.update', 'catalogue.service.delete', 'marketplace.view', 'bid.submit', 'delivery.view', 'delivery.create', 'delivery.update', 'delivery.dispatch', 'purchase_order.view', 'payment.view', 'invoice.view', 'invoice.approve', 'grn.view', 'dispute.view', 'reverse_auction.view', 'reverse_auction.bid.submit', 'team.member.view', 'team.role.manage', 'organization.view', 'organization.update', 'report.view'];
            }
        }

        return ['dashboard.view'];
    }, [remotePermissions, user?.isSubUser, user?.organizationId, user?.permissions, user?.role]);

    const hasPermission = useCallback((permissionCode: string) => {
        if (!permissionCode) return false;
        if (permissions.includes('*')) return true;
        if (permissions.includes(permissionCode)) return true;
        const upper = permissionCode.toUpperCase().replace(/\./g, '_');
        if (permissions.includes(upper)) return true;
        const lower = permissionCode.toLowerCase().replace(/_/g, '.');
        if (permissions.includes(lower)) return true;
        return false;
    }, [permissions]);

    return { permissions, hasPermission, loading, reload: load };
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
