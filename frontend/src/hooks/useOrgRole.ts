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
    memberCount?: number;
    hasFinanceOfficer?: boolean;
    internalApprovalRequired?: boolean;
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
    memberCount: number;
    hasFinanceOfficer: boolean;
    internalApprovalRequired: boolean;
    hasApprovalWorkflow: boolean;
}

export const DEFAULT_BUYER_PERMISSIONS: string[] = [
    'dashboard.view', 'marketplace.view', 'requirement.view', 'requirement.create', 
    'requirement.publish', 'tender.view', 'tender.create', 'tender.update', 
    'tender.publish', 'cart.view', 'cart.add', 'cart.submit_for_approval', 
    'approval.view', 'approval.submit', 'purchase_order.view', 'purchase_order.create', 
    'purchase_order.approve', 'checkout.initiate', 'checkout.approve', 'delivery.view', 
    'delivery.confirm', 'payment.view', 'payment.initiate', 'invoice.view', 
    'invoice.approve', 'grn.view', 'grn.create', 'grn.approve', 'dispute.view', 
    'dispute.manage', 'reverse_auction.view', 'team.member.view', 'team.role.manage', 
    'organization.view', 'organization.update', 'report.view'
];

export const DEFAULT_SELLER_PERMISSIONS: string[] = [
    'dashboard.view', 'catalogue.product.view', 'catalogue.product.create', 
    'catalogue.product.update', 'catalogue.product.delete', 'catalogue.service.view', 
    'catalogue.service.create', 'catalogue.service.update', 'catalogue.service.delete', 
    'marketplace.view', 'bid.submit', 'delivery.view', 'delivery.create', 
    'delivery.update', 'delivery.dispatch', 'purchase_order.view', 'payment.view', 
    'invoice.view', 'invoice.approve', 'grn.view', 'dispute.view', 'reverse_auction.view', 
    'reverse_auction.bid.submit', 'team.member.view', 'team.role.manage', 
    'organization.view', 'organization.update', 'report.view'
];

const PERMISSIONS_CACHE_KEY = 'msme_permissions_cache';
let inMemoryPermissions: string[] | null = null;
let permissionsFetchPromise: Promise<string[]> | null = null;

const getStoredPermissions = (): string[] | null => {
    if (inMemoryPermissions && inMemoryPermissions.length > 0) return inMemoryPermissions;
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(PERMISSIONS_CACHE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                inMemoryPermissions = parsed;
                return parsed;
            }
        }
    } catch {
        // ignore
    }
    return null;
};

const storePermissions = (perms: string[]) => {
    inMemoryPermissions = perms;
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(PERMISSIONS_CACHE_KEY, JSON.stringify(perms));
        } catch {
            // ignore
        }
    }
};

export const clearPermissionsCache = () => {
    inMemoryPermissions = null;
    permissionsFetchPromise = null;
    if (typeof window !== 'undefined') {
        try {
            localStorage.removeItem(PERMISSIONS_CACHE_KEY);
        } catch {
            // ignore
        }
    }
};

export function usePermissions() {
    const { user } = useAuth();
    const [remotePermissions, setRemotePermissions] = useState<string[]>(() => {
        const stored = getStoredPermissions();
        if (stored && stored.length > 0) return stored;
        if (Array.isArray(user?.permissions) && user.permissions.length > 0) return user.permissions;
        return [];
    });
    const [loading, setLoading] = useState(false);

    const userId = user?.id;
    const userRole = user?.role;
    const userPermissionsStr = Array.isArray(user?.permissions) ? user.permissions.join(',') : '';

    const load = useCallback(async (force = false) => {
        if (!userId) {
            setRemotePermissions((prev) => (prev.length === 0 ? prev : []));
            setLoading(false);
            return;
        }

        if (userRole === 'master_admin' || userRole === 'admin') {
            setRemotePermissions((prev) => (prev.length === 1 && prev[0] === '*' ? prev : ['*']));
            setLoading(false);
            return;
        }

        const existing = getStoredPermissions() || (Array.isArray(user?.permissions) && user.permissions.length > 0 ? user.permissions : null);
        if (existing && existing.length > 0 && !force) {
            setRemotePermissions((prev) => {
                if (prev.length === existing.length && prev.every((p, i) => p === existing[i])) return prev;
                return existing;
            });
        } else if (!existing) {
            setLoading(true);
        }

        try {
            if (!permissionsFetchPromise || force) {
                permissionsFetchPromise = (async () => {
                    try {
                        const data = await getApi<PermissionPayload>('/api/auth/me/permissions', force);
                        const perms = Array.isArray(data?.permissions) ? data.permissions : [];
                        if (perms.length > 0) {
                            storePermissions(perms);
                        }
                        return perms;
                    } catch {
                        const fallback = Array.isArray(user?.permissions) && user.permissions.length > 0
                            ? user.permissions
                            : (existing || []);
                        return fallback;
                    } finally {
                        permissionsFetchPromise = null;
                    }
                })();
            }
            const perms = await permissionsFetchPromise;
            if (perms.length > 0) {
                setRemotePermissions((prev) => {
                    if (prev.length === perms.length && prev.every((p, i) => p === perms[i])) return prev;
                    return perms;
                });
            }
        } finally {
            setLoading(false);
        }
    }, [userId, userRole, userPermissionsStr, user?.permissions]);

    useEffect(() => {
        void load();
    }, [load]);

    const reloadPermissions = useCallback(() => {
        void load(true);
    }, [load]);

    const permissions = useMemo(() => {
        const isMasterOrAdmin = userRole === 'master_admin' || userRole === 'admin';
        if (isMasterOrAdmin) return ['*'];

        const cached = Array.isArray(user?.permissions) && user.permissions.length > 0 ? user.permissions : [];
        const serverPerms = remotePermissions.length > 0 ? remotePermissions : cached;

        // If server or cached permissions exist, respect them strictly
        if (serverPerms.length > 0) {
            return serverPerms;
        }

        // For standard primary users (non-subusers), provide immediate default role permissions
        if (!user?.isSubUser) {
            if (userRole === 'buyer') {
                return DEFAULT_BUYER_PERMISSIONS;
            }
            if (userRole === 'seller' || userRole === 'shg') {
                return DEFAULT_SELLER_PERMISSIONS;
            }
        }

        return ['dashboard.view'];
    }, [remotePermissions, user?.isSubUser, user?.permissions, userRole]);

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

    return { permissions, hasPermission, loading, reload: reloadPermissions };
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

    const userId = user?.id;
    const userOrgId = user?.organizationId;
    const memberFetchAttemptedRef = useRef(false);

    useEffect(() => {
        memberFetchAttemptedRef.current = false;
    }, [userId, userOrgId]);

    const load = useCallback(async (skipCache = false) => {
        if (!token || !userId) return;

        if (isInitialLoad.current) {
            setOrgLoading(true);
        }

        try {
            const endpoint = skipCache
                ? `/api/org/status?_ts=${Date.now()}`
                : '/api/org/status';
            const data = await getApi<OrgStatus>(endpoint, skipCache);
            setOrgStatus((prev) => {
                if (prev && JSON.stringify(prev) === JSON.stringify(data)) return prev;
                return data;
            });
            isInitialLoad.current = false;
        } catch {
            setOrgStatus((prev) => (prev === null ? prev : null));
        } finally {
            setOrgLoading(false);
        }
    }, [token, userId]);

    useEffect(() => {
        void load();
    }, [load]);

    // Fallback if backend /api/org/status didn't provide memberCount yet
    useEffect(() => {
        if (!orgStatus || orgStatus.memberCount !== undefined || !token || !userId || memberFetchAttemptedRef.current) return;
        memberFetchAttemptedRef.current = true;
        getApi<any[]>('/api/org/members').then((members) => {
            if (Array.isArray(members)) {
                const count = members.filter(m => m.isActive).length;
                const hasFinance = members.some(m =>
                    m.isActive && (
                        m.orgRole === 'FINANCE_OFFICER' ||
                        m.customRole?.roleKey === 'finance_officer' ||
                        m.customRole?.roleKey === 'finance' ||
                        (typeof m.customRole?.name === 'string' && m.customRole.name.toLowerCase().includes('finance'))
                    )
                );
                setOrgStatus(prev => prev ? { ...prev, memberCount: count, hasFinanceOfficer: hasFinance } : prev);
            }
        }).catch(() => {
            setOrgStatus(prev => prev ? { ...prev, memberCount: 1, hasFinanceOfficer: false } : prev);
        });
    }, [orgStatus?.memberCount, token, userId]);

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
        },
        memberCount: typeof orgStatus?.memberCount === 'number' ? orgStatus.memberCount : 1,
        hasFinanceOfficer: Boolean(orgStatus?.hasFinanceOfficer),
        internalApprovalRequired: typeof orgStatus?.internalApprovalRequired === 'boolean'
            ? orgStatus.internalApprovalRequired
            : (typeof orgStatus?.memberCount === 'number' ? orgStatus.memberCount > 1 : false),
        hasApprovalWorkflow: (typeof orgStatus?.internalApprovalRequired === 'boolean' ? orgStatus.internalApprovalRequired : (typeof orgStatus?.memberCount === 'number' ? orgStatus.memberCount > 1 : false)) && ((typeof orgStatus?.memberCount === 'number' ? orgStatus.memberCount : 1) > 1)
    };
}
