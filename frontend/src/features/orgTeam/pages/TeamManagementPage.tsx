/**
 * TeamManagementPage — users with team permissions can invite members, view all members,
 * change roles, and remove members.
 *
 * Route: /org/team
 * Access: team.member.view permission
 */
import { useMemo, useState } from 'react';
import {
    Mail, Plus, RefreshCw, Search, Shield, Trash2, UserCheck,
    UserPlus, Users, X, ChevronDown, Clock, CheckCircle2, KeyRound, History, Copy, Power,
    Pencil, UserX, Send, Phone
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { useAuth } from '../../../hooks/useAuth';
import { useOrgRole, usePermissions, type OrgRole } from '../../../hooks/useOrgRole';
import { getApi, postApi, putApi, patchApi, deleteApi } from '../../shared/apiClient';
import { formatDateTime, formatRelative } from '../../shared/format';
import { EntityIdLink } from '../../shared/EntityIdLink';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { KpiCard } from '../../shared/KpiCard';
import { Pagination } from '../../shared/Pagination';
import { SortableHeader, type SortDirection } from '../../shared/SortableHeader';
import { useFeatureQuery, usePagination, useResponsiveViewMode } from '../../shared/hooks';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { validateRequiredText } from '../../../lib/validation';

// ─── Types ────────────────────────────────────────────────────────────────────

type Member = {
    id: number;
    userId: number;
    orgRole: OrgRole;
    customRoleId?: number | null;
    customRole?: { id: number; name: string; roleKey: string };
    isActive: boolean;
    invitedAt: string;
    acceptedAt?: string;
    user: {
        id: number;
        name: string;
        email: string;
        mobile?: string;
        accountStatus: string;
        lastLoginAt?: string;
        createdAt: string;
    };
    invitedBy?: { id: number; name: string; email: string };
};

type Invitation = {
    id: number;
    email: string;
    orgRole: OrgRole;
    customRoleId?: number | null;
    customRole?: { id: number; name: string; roleKey: string };
    status?: string;
    expiresAt: string;
    createdAt: string;
    invitedBy: { id: number; name: string; email: string };
};
type OrgPermission = { key: string; label: string; module: string; description: string };
type OrgCustomRole = {
    id: number;
    name: string;
    description?: string | null;
    roleKey: string;
    isSystemRole: boolean;
    isActive: boolean;
    permissions?: Array<{ permissionKey: string; allowed: boolean }>;
    _count?: { memberships?: number };
};
type AccessTransfer = {
    id: number;
    toEmail?: string | null;
    reason: string;
    status: string;
    createdAt: string;
    completedAt?: string | null;
    fromUser?: { id: number; name: string; email: string };
    toUser?: { id: number; name: string; email: string };
    role?: { id: number; name: string };
};
type MemberSortKey = 'name' | 'email' | 'role' | 'status' | 'joined' | 'lastLogin';
type TeamTab = 'members' | 'invitations' | 'roles' | 'transfers';

// ─── Constants ────────────────────────────────────────────────────────────────

const roleBadgeClass = 'border-slate-200 bg-slate-50 text-slate-700';

// ─── Skeletons ────────────────────────────────────────────────────────────────

const MemberGridSkeleton = () => (
    <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 w-full">
                        <div className="h-4 w-16 bg-slate-200 rounded" />
                        <div className="h-5 w-3/4 bg-slate-200 rounded" />
                        <div className="h-3 w-1/2 bg-slate-100 rounded" />
                    </div>
                    <div className="h-5 w-16 bg-slate-100 rounded" />
                </div>
                <div className="mt-4 space-y-3">
                    <div className="h-3 w-full bg-slate-100 rounded" />
                    <div className="h-3 w-4/5 bg-slate-100 rounded" />
                    <div className="h-3 w-3/4 bg-slate-100 rounded" />
                </div>
                <div className="mt-4 flex justify-end border-t border-slate-100 pt-3 gap-2">
                    <div className="h-8 w-8 rounded-md bg-slate-100" />
                    <div className="h-8 w-8 rounded-md bg-slate-100" />
                </div>
            </div>
        ))}
    </div>
);

const MemberTableSkeleton = () => (
    <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/60">
                <tr>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <th key={i} className="px-4 py-3"><div className="h-3 w-16 bg-slate-200 rounded animate-pulse" /></th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                        <td className="px-4 py-3"><div className="h-3 w-6 bg-slate-100 rounded" /></td>
                        <td className="px-4 py-3 space-y-2"><div className="h-4 w-24 bg-slate-200 rounded" /><div className="h-3 w-32 bg-slate-100 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-3 w-40 bg-slate-100 rounded" /></td>
                        <td className="px-4 py-3"><div className="h-5 w-20 bg-slate-100 rounded-md" /></td>
                        <td className="px-4 py-3"><div className="h-5 w-16 bg-slate-100 rounded-md" /></td>
                        <td className="px-4 py-3 space-y-2"><div className="h-3 w-20 bg-slate-100 rounded" /><div className="h-2 w-16 bg-slate-50 rounded" /></td>
                        <td className="px-4 py-3 space-y-2"><div className="h-3 w-20 bg-slate-100 rounded" /><div className="h-2 w-16 bg-slate-50 rounded" /></td>
                        <td className="px-4 py-3 text-right"><div className="inline-flex gap-2"><div className="h-8 w-8 bg-slate-100 rounded-md" /><div className="h-8 w-8 bg-slate-100 rounded-md" /></div></td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const ListSkeleton = ({ count = 3 }: { count?: number }) => (
    <div className="divide-y divide-slate-100">
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-4 animate-pulse">
                <div className="flex items-center gap-3 w-full">
                    <div className="h-6 w-6 shrink-0 rounded-full bg-slate-200" />
                    <div className="space-y-2 w-full max-w-sm">
                        <div className="h-4 w-3/4 bg-slate-200 rounded" />
                        <div className="h-3 w-1/2 bg-slate-100 rounded" />
                    </div>
                </div>
                <div className="flex gap-2 shrink-0">
                    <div className="h-8 w-16 bg-slate-100 rounded-md" />
                    <div className="h-8 w-8 bg-slate-100 rounded-md" />
                </div>
            </div>
        ))}
    </div>
);

const RoleCardSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 items-start">
        {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm animate-pulse">
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 w-full">
                        <div className="h-4 w-1/3 bg-slate-200 rounded" />
                        <div className="h-3 w-2/3 bg-slate-100 rounded" />
                    </div>
                    <div className="h-5 w-16 bg-slate-100 rounded-md shrink-0" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                    {Array.from({ length: 5 }).map((_, j) => (
                        <div key={j} className="h-6 w-20 bg-slate-100 rounded-md" />
                    ))}
                </div>
            </div>
        ))}
    </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeamManagementPage() {
    const { user } = useAuth();
    const { orgStatus } = useOrgRole();
    const { hasPermission, loading: permissionsLoading } = usePermissions();
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [sortKey, setSortKey] = useState<MemberSortKey>('joined');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [viewMode, setViewMode] = useResponsiveViewMode('phase7:team-management:view-mode');
    const [activeTab, setActiveTab] = useState<TeamTab>('members');
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [transferMember, setTransferMember] = useState<Member | null>(null);

    const { data: membersData, loading: membersLoading, refreshing: membersRefreshing, error: membersError, reload: reloadMembers } =
        useFeatureQuery<Member[]>('/api/org/members', []);

    const { data: invitesData, loading: invitesLoading, refreshing: invitesRefreshing, reload: reloadInvites } =
        useFeatureQuery<Invitation[]>('/api/org/invitations', []);
    const { data: rolesData, loading: rolesLoading, reload: reloadRoles } =
        useFeatureQuery<OrgCustomRole[]>('/api/org/roles', []);
    const { data: catalogData } =
        useFeatureQuery<{ catalog: OrgPermission[]; grouped: Record<string, OrgPermission[]>; templates: Array<{ roleKey: string; name: string }> }>('/api/org/permissions/catalog', { catalog: [], grouped: {}, templates: [] });
    const { data: transfersData, loading: transfersLoading, reload: reloadTransfers } =
        useFeatureQuery<AccessTransfer[]>('/api/org/access-transfer/logs', []);

    const members = Array.isArray(membersData) ? membersData : [];
    const invitations = Array.isArray(invitesData) ? invitesData : [];
    const roles = Array.isArray(rolesData) ? rolesData : [];
    const transfers = Array.isArray(transfersData) ? transfersData : [];
    const permissionGroups = catalogData?.grouped || {};
    const currentOrgRole = orgStatus?.membership?.orgRole ?? '';
    const canViewTeam = hasPermission('team.member.view');
    const canInviteTeam = hasPermission('team.member.invite');
    const canManageRoles = hasPermission('team.role.manage');
    const canAssignRoles = hasPermission('team.role.assign') || canManageRoles;
    const canDisableMembers = hasPermission('team.member.disable');
    const roleOptions = useMemo(() => {
        const labels = new Map<string, string>();
        members.forEach(member => {
            const roleName = member.customRole?.name || member.orgRole.replace(/_/g, ' ');
            labels.set(roleName, roleName);
        });
        roles.forEach(role => {
            if (role.name) labels.set(role.name, role.name);
        });
        invitations.forEach(invite => {
            const roleName = invite.customRole?.name || invite.orgRole.replace(/_/g, ' ');
            labels.set(roleName, roleName);
        });
        return Array.from(labels, ([value, label]) => ({ value, label }));
    }, [invitations, members, roles]);
    const visibleMembers = useMemo(() => {
        const text = searchTerm.trim().toLowerCase();
        return [...members].filter(member => {
            const roleName = member.customRole?.name || member.orgRole.replace(/_/g, ' ');
            const haystack = [
                member.userId,
                member.user.name,
                member.user.email,
                member.user.mobile,
                member.orgRole,
                roleName,
                member.user.accountStatus
            ].join(' ').toLowerCase();
            if (text && !haystack.includes(text)) return false;
            if (roleFilter && member.orgRole !== roleFilter && roleName !== roleFilter) return false;
            if (statusFilter === 'active' && !member.isActive) return false;
            if (statusFilter === 'inactive' && member.isActive) return false;
            return true;
        }).sort((a, b) => {
            const valueFor = (member: Member) => {
                if (sortKey === 'name') return member.user.name || '';
                if (sortKey === 'email') return member.user.email || '';
                if (sortKey === 'role') return member.customRole?.name || member.orgRole || '';
                if (sortKey === 'status') return member.isActive ? 'active' : 'inactive';
                if (sortKey === 'lastLogin') return new Date(member.user.lastLoginAt || 0).getTime();
                return new Date(member.acceptedAt || member.invitedAt || 0).getTime();
            };
            const av = valueFor(a);
            const bv = valueFor(b);
            const result = typeof av === 'number' && typeof bv === 'number'
                ? av - bv
                : String(av).localeCompare(String(bv));
            return sortDirection === 'asc' ? result : -result;
        });
    }, [members, roleFilter, searchTerm, sortDirection, sortKey, statusFilter]);
    const { page, pageSize, pageItems, total, setPage, setPageSize } = usePagination(visibleMembers, 10);

    const toggleSort = (field: MemberSortKey) => {
        setSortDirection(prev => sortKey === field && prev === 'asc' ? 'desc' : 'asc');
        setSortKey(field);
        setPage(1);
    };

    const [resendingInviteId, setResendingInviteId] = useState<number | null>(null);

    const handleToggleMemberStatus = async (member: Member) => {
        const action = member.isActive ? 'deactivate' : 'reactivate';
        const confirmMessage = member.isActive
            ? `Are you sure you want to deactivate ${member.user.name}? They will not be able to log in or access organization features until reactivated.`
            : `Reactivate login access for ${member.user.name}?`;
        if (!window.confirm(confirmMessage)) return;

        try {
            if (member.isActive) {
                await patchApi(`/api/org/members/${member.userId}/deactivate`, { reason: 'Deactivated by Org Admin' });
                toast.success(`${member.user.name} has been deactivated`);
            } else {
                await patchApi(`/api/org/members/${member.userId}/reactivate`, {});
                toast.success(`${member.user.name} has been reactivated`);
            }
            reloadMembers();
        } catch (err: any) {
            toast.error(err?.message || `Failed to ${action} member`);
        }
    };

    const handleResendInvite = async (invite: Invitation) => {
        setResendingInviteId(invite.id);
        try {
            await postApi(`/api/org/invitations/${invite.id}/resend`, {});
            toast.success(`Invitation credentials resent to ${invite.email}`);
            reloadInvites();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to resend invitation');
        } finally {
            setResendingInviteId(null);
        }
    };

    const handleRemoveMember = async (member: Member) => {
        if (!window.confirm(`Remove ${member.user.name} from the organisation? They will lose access immediately.`)) return;
        try {
            await deleteApi(`/api/org/members/${member.userId}`);
            toast.success(`${member.user.name} removed from organisation`);
            reloadMembers();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to remove member');
        }
    };

    const handleCancelInvite = async (invite: Invitation) => {
        try {
            await deleteApi(`/api/org/invitations/${invite.id}`);
            toast.success('Invitation cancelled');
            reloadInvites();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to cancel invitation');
        }
    };

    const renderMemberActions = (member: Member) => (
        <>
            {member.userId !== Number(user?.id) && (
                <div className="flex items-center justify-end gap-1">
                    {canAssignRoles && (
                        <button
                            type="button"
                            onClick={() => setEditingMember(member)}
                            title="Edit member details"
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-[#12335f] hover:bg-slate-50 transition"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {canDisableMembers && (
                        <button
                            type="button"
                            onClick={() => handleToggleMemberStatus(member)}
                            title={member.isActive ? "Deactivate member" : "Activate member"}
                            className={`flex h-8 w-8 items-center justify-center rounded-md border transition ${
                                member.isActive
                                    ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                        >
                            {member.isActive ? <Power className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        </button>
                    )}
                    {canAssignRoles && (
                        <button
                            type="button"
                            onClick={() => setTransferMember(member)}
                            title="Transfer access"
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-indigo-700 hover:bg-indigo-50 transition"
                        >
                            <History className="h-3.5 w-3.5" />
                        </button>
                    )}
                    {canDisableMembers && (
                        <button
                            type="button"
                            onClick={() => handleRemoveMember(member)}
                            title="Remove member permanently"
                            className="flex h-8 w-8 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 transition"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            )}
            {member.userId === Number(user?.id) && (
                <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded">You (Admin)</span>
            )}
        </>
    );

    if (permissionsLoading) {
        return <LoadingState label="Checking team access..." />;
    }

    if (!canViewTeam) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="text-center">
                    <Shield className="mx-auto h-12 w-12 text-slate-300" />
                    <p className="mt-3 text-sm font-black text-slate-600 uppercase tracking-widest">Access Restricted</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">You do not have permission to view team access.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-[1560px] space-y-5 px-4 pb-12">
            {/* Header */}
            <div>
                {/* <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#12335f]">ORGANISATION</p> */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">Team Management</h1>
                        {/* <p className="mt-1 text-sm font-semibold text-slate-500">
                            {orgStatus?.organization?.organizationName ? `${orgStatus.organization.organizationName} — ` : ''}Manage members, roles, permissions, and access transfers for your organisation.
                        </p> */}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => { reloadMembers(); reloadInvites(); }}
                            className="h-10 rounded-lg text-xs font-black uppercase shadow-sm bg-white hover:bg-slate-50 border-slate-200"
                        >
                            <RefreshCw className={`mr-2 h-4 w-4 text-[#12335f] ${(membersRefreshing || invitesRefreshing) ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                        {canInviteTeam && (
                            <Button
                                onClick={() => setShowInviteModal(true)}
                                className="h-10 rounded-lg text-xs font-black uppercase shadow-sm bg-[#12335f] hover:bg-[#0b2447] text-white"
                            >
                                <UserPlus className="mr-2 h-4 w-4" /> Invite Member
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    label="Total Members"
                    value={members.length}
                    subtext="All onboarded team profiles"
                    icon={Users}
                    tone="blue"
                    active={activeTab === 'members' && !statusFilter}
                    onClick={() => { setActiveTab('members'); setStatusFilter(''); }}
                    loading={membersLoading}
                />
                <KpiCard
                    label="Active Members"
                    value={members.filter(m => m.isActive).length}
                    subtext="Enabled organization logins"
                    icon={UserCheck}
                    tone="green"
                    active={activeTab === 'members' && statusFilter === 'active'}
                    onClick={() => { setActiveTab('members'); setStatusFilter('active'); }}
                    loading={membersLoading}
                />
                <KpiCard
                    label="Pending Invites"
                    value={invitations.length}
                    subtext="Awaiting user signup acceptance"
                    icon={Mail}
                    tone="amber"
                    active={activeTab === 'invitations'}
                    onClick={() => setActiveTab('invitations')}
                    loading={invitesLoading}
                />
                <KpiCard
                    label="Org Role"
                    value={currentOrgRole ? currentOrgRole.replace(/_/g, ' ') : '—'}
                    subtext="Your effective access level"
                    icon={Shield}
                    tone="purple"
                    active={activeTab === 'roles'}
                    onClick={() => setActiveTab('roles')}
                    loading={permissionsLoading}
                />
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 gap-2 overflow-x-auto no-scrollbar pt-1">
                {[
                    { key: 'members' as TeamTab, label: 'Members', icon: Users, count: members.length },
                    { key: 'invitations' as TeamTab, label: 'Invitations', icon: Mail, count: invitations.length },
                    { key: 'roles' as TeamTab, label: 'Roles & Permissions', icon: KeyRound, count: roles.length },
                    { key: 'transfers' as TeamTab, label: 'Access Transfers', icon: History, count: transfers.length }
                ].map(({ key, label, icon: TabIcon, count }) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setActiveTab(key)}
                        className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                            activeTab === key
                                ? 'border-[#12335f] text-[#12335f]'
                                : 'border-transparent text-slate-500 hover:text-slate-900'
                        }`}
                    >
                        <TabIcon className="h-4 w-4" />
                        <span>{label}</span>
                        {typeof count === 'number' && (
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                                activeTab === key ? 'bg-[#12335f]/10 text-[#12335f]' : 'bg-slate-100 text-slate-500'
                            }`}>
                                {count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {membersError && <InlineError message={membersError} onRetry={reloadMembers} />}

            {activeTab === 'members' && (
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm">
                    <ResponsiveFilterBar
                        activeFilterCount={(searchTerm ? 1 : 0) + (roleFilter ? 1 : 0) + (statusFilter ? 1 : 0)}
                        searchInput={
                            <div className="relative w-full">
                                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={searchTerm}
                                    onChange={event => { setSearchTerm(event.target.value); setPage(1); }}
                                    placeholder="Search member name, email, mobile, role..."
                                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
                                />
                            </div>
                        }
                        filters={
                            <>
                                <div className="w-full sm:w-auto sm:min-w-[150px]">
                                    <select
                                        value={roleFilter}
                                        onChange={event => { setRoleFilter(event.target.value); setPage(1); }}
                                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                                    >
                                        <option value="">All roles</option>
                                        {roleOptions.map(role => <option key={role.value} value={role.value}>{role.label}</option>)}
                                    </select>
                                </div>
                                <div className="w-full sm:w-auto sm:min-w-[140px]">
                                    <select
                                        value={statusFilter}
                                        onChange={event => { setStatusFilter(event.target.value); setPage(1); }}
                                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                                    >
                                        <option value="">Any status</option>
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                                {(searchTerm || roleFilter || statusFilter) && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setSearchTerm('');
                                            setRoleFilter('');
                                            setStatusFilter('');
                                            setPage(1);
                                        }}
                                        className="h-10 rounded-xl border-rose-200 bg-rose-50/60 text-xs font-extrabold text-rose-700 hover:bg-rose-100 min-w-[80px]"
                                    >
                                        Reset
                                    </Button>
                                )}
                            </>
                        }
                        endContent={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
                    />
                </div>
            )}

            {/* Members Table */}
            {activeTab === 'members' && <Card className="border-slate-200/80 bg-white shadow-sm overflow-hidden rounded-2xl">
                <CardContent className="p-0">
                    <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Team Members ({total} shown of {members.length})</p>
                    </div>
                    {membersLoading ? (
                        viewMode === 'grid' ? <MemberGridSkeleton /> : <MemberTableSkeleton />
                    ) : members.length === 0 ? (
                        <EmptyState title="No members yet" description="Invite your first team member to get started." />
                    ) : pageItems.length === 0 ? (
                        <EmptyState title="No members match these filters" description="Clear the search, role, or status filter to see all members." />
                    ) : viewMode === 'grid' ? (
                        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
                            {pageItems.map(member => (
                                <article key={member.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#12335f]/30 hover:shadow-lg">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <EntityIdLink label={`MBR-${member.userId}`} id={member.userId} size="sm" onClick={() => { }} />
                                            <h2 className="mt-1 text-sm font-black text-slate-950 text-wrap-anywhere">{member.user.name}</h2>
                                            <p className="text-[10px] font-semibold text-slate-500 text-wrap-anywhere">{member.user.email}</p>
                                        </div>
                                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${member.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                                            {member.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="mt-4 grid gap-2 text-xs font-semibold text-slate-600">
                                        <p><span className="font-black text-slate-900">Role:</span> <span className={`ml-1 inline-flex rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${roleBadgeClass}`}>{member.customRole?.name || member.orgRole.replace(/_/g, ' ')}</span></p>
                                        <p><span className="font-black text-slate-900">Joined:</span> {formatDateTime(member.acceptedAt || member.invitedAt)}</p>
                                        <p><span className="font-black text-slate-900">Last login:</span> {member.user.lastLoginAt ? formatRelative(member.user.lastLoginAt) : 'Never'}</p>
                                        {member.user.mobile && <p><span className="font-black text-slate-900">Mobile:</span> {member.user.mobile}</p>}
                                    </div>
                                    <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
                                        {renderMemberActions(member)}
                                    </div>
                                </article>
                            ))}
                            <div className="md:col-span-2 xl:col-span-3">
                                <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} label="members" />
                            </div>
                        </div>
                    ) : (
                        <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[800px] text-sm">
                                <thead className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left w-12">#</th>
                                        <th className="px-4 py-2.5 text-left"><SortableHeader label="Member" field="name" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                        <th className="px-4 py-2.5 text-left w-56"><SortableHeader label="Email" field="email" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                        <th className="px-4 py-2.5 text-left w-48"><SortableHeader label="Role" field="role" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                        <th className="px-4 py-2.5 text-left w-32"><SortableHeader label="Status" field="status" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                        <th className="px-4 py-2.5 text-left w-44"><SortableHeader label="Joined" field="joined" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                        <th className="px-4 py-2.5 text-left w-44"><SortableHeader label="Last Login" field="lastLogin" activeField={sortKey} direction={sortDirection} onSort={toggleSort} /></th>
                                        <th className="px-4 py-2.5 text-right w-32">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pageItems.map((member, idx) => (
                                        <tr key={member.id} className="hover:bg-slate-50/60">
                                            <td className="px-4 py-3 text-xs font-mono text-slate-400">{String((page - 1) * pageSize + idx + 1).padStart(2, '0')}</td>
                                            <td className="px-4 py-3">
                                                <EntityIdLink label={`MBR-${member.userId}`} id={member.userId} size="sm" onClick={() => { }} />
                                                <p className="mt-1 text-sm font-black text-slate-900 text-wrap-anywhere">{member.user.name}</p>
                                                {member.user.mobile && (
                                                    <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                                        <Phone className="h-2.5 w-2.5" /> {member.user.mobile}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-[10px] font-semibold text-slate-500 text-wrap-anywhere">{member.user.email}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${roleBadgeClass}`}>
                                                    {member.customRole?.name || member.orgRole.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-black uppercase ${member.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                                                    {member.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                                                <p>{formatDateTime(member.acceptedAt || member.invitedAt)}</p>
                                                <p className="text-[10px] text-slate-400">{formatRelative(member.acceptedAt || member.invitedAt)}</p>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-semibold text-slate-500">
                                                {member.user.lastLoginAt ? (
                                                    <>
                                                        <p>{formatDateTime(member.user.lastLoginAt)}</p>
                                                        <p className="text-[10px] text-slate-400">{formatRelative(member.user.lastLoginAt)}</p>
                                                    </>
                                                ) : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                                                {renderMemberActions(member)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} label="members" />
                        </>
                    )}
                </CardContent>
            </Card>}

            {/* Pending Invitations */}
            {activeTab === 'invitations' && (
                <Card className="border-slate-200/80 shadow-sm">
                    <CardContent className="p-0">
                        <div className="border-b border-slate-100 bg-amber-50/60 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Pending Invitations ({invitations.length})</p>
                        </div>
                        {invitesLoading ? <ListSkeleton count={3} /> : invitations.length === 0 ? <EmptyState title="No pending invitations" description="Send an invite when a team member needs access." /> : <div className="divide-y divide-slate-100">
                            {invitations.map(invite => (
                                <div key={invite.id} className="flex items-center justify-between gap-4 px-4 py-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-black text-slate-900 text-wrap-anywhere">{invite.email}</p>
                                            <p className="text-[10px] font-semibold text-slate-500">
                                                Invited as <span className="font-black">{invite.customRole?.name || invite.orgRole.replace(/_/g, ' ')}</span> · Expires {formatRelative(invite.expiresAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {canInviteTeam && (
                                            <button
                                                type="button"
                                                disabled={resendingInviteId === invite.id}
                                                onClick={() => handleResendInvite(invite)}
                                                className="flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-slate-200 bg-white text-xs font-bold text-[#12335f] hover:bg-slate-50 transition disabled:opacity-50"
                                                title="Resend invitation email"
                                            >
                                                <Send className={`h-3.5 w-3.5 ${resendingInviteId === invite.id ? 'animate-pulse' : ''}`} />
                                                <span>{resendingInviteId === invite.id ? 'Sending...' : 'Resend'}</span>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleCancelInvite(invite)}
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50 transition"
                                            title="Cancel invitation"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>}
                    </CardContent>
                </Card>
            )}

            {activeTab === 'roles' && (
                <Card className="border-slate-200/80 shadow-sm">
                    <CardContent className="p-0">
                        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Roles & Permissions ({roles.length})</p>
                            <Button onClick={() => setShowRoleModal(true)} className="h-9 bg-[#12335f] text-white">
                                <Plus className="mr-2 h-4 w-4" /> Create Role
                            </Button>
                        </div>
                        {rolesLoading ? <RoleCardSkeleton /> : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 items-start">
                                {roles.map(role => {
                                    const permissions = (role.permissions || []).filter(p => p.allowed).map(p => p.permissionKey);
                                    return (
                                        <article key={role.id} className="rounded-2xl border border-slate-200/80 bg-slate-50/30 p-4 sm:p-5 shadow-sm hover:shadow hover:-translate-y-0.5 transition-all duration-200 flex flex-col justify-start">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-[#12335f] truncate">{role.name}</p>
                                                    <p className="mt-1 text-[11px] font-semibold text-slate-500 leading-snug">{role.description || 'Custom organization role'}</p>
                                                </div>
                                                <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-2xs ${role.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                                                    {role.isSystemRole ? 'Template' : role.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <div className="mt-3.5 flex flex-wrap gap-1.5">
                                                {permissions.slice(0, 10).map(permission => (
                                                    <span key={permission} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-tight text-[#12335f] shadow-2xs">
                                                        {permission.replace(/_/g, ' ')}
                                                    </span>
                                                ))}
                                                {permissions.length > 10 && (
                                                    <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[9px] font-black uppercase tracking-tight text-white shadow-2xs">
                                                        +{permissions.length - 10}
                                                    </span>
                                                )}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {activeTab === 'transfers' && (
                <Card className="border-slate-200/80 shadow-sm">
                    <CardContent className="p-0">
                        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Access Transfers ({transfers.length})</p>
                        </div>
                        {transfersLoading ? <ListSkeleton count={4} /> : transfers.length === 0 ? <EmptyState title="No access transfers" description="Transfer a member role when an employee moves out of this organization." /> : (
                            <div className="divide-y divide-slate-100">
                                {transfers.map(row => (
                                    <div key={row.id} className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_auto]">
                                        <div>
                                            <p className="text-sm font-black text-slate-950">{row.fromUser?.name || `User #${row.fromUser?.id || '-'}`} → {row.toUser?.name || row.toEmail || 'Pending invitee'}</p>
                                            <p className="mt-1 text-xs font-semibold text-slate-500">{row.reason}</p>
                                            <p className="mt-1 text-[10px] font-bold uppercase text-slate-400">{formatRelative(row.createdAt)} · {row.role?.name || 'Same role'}</p>
                                        </div>
                                        <span className="h-fit rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase text-slate-700">{row.status}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Modals */}
            {showInviteModal && (
                <InviteModal
                    roles={roles}
                    onClose={() => setShowInviteModal(false)}
                    onSuccess={() => { setShowInviteModal(false); reloadInvites(); }}
                />
            )}
            {editingMember && (
                <EditMemberModal
                    member={editingMember}
                    roles={roles}
                    onClose={() => setEditingMember(null)}
                    onSuccess={() => { setEditingMember(null); reloadMembers(); reloadRoles(); }}
                />
            )}
            {showRoleModal && (
                <RoleModal
                    permissionGroups={permissionGroups}
                    templates={catalogData?.templates || []}
                    onClose={() => setShowRoleModal(false)}
                    onSuccess={() => { setShowRoleModal(false); reloadRoles(); }}
                />
            )}
            {transferMember && (
                <TransferAccessModal
                    member={transferMember}
                    roles={roles}
                    onClose={() => setTransferMember(null)}
                    onSuccess={() => { setTransferMember(null); reloadTransfers(); reloadInvites(); reloadMembers(); }}
                />
            )}
        </div>
    );
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
    label,
    value,
    icon: Icon,
    isActive = false,
    onClick,
    activeColorClass,
    inactiveColorClass,
    valueColorClass
}: {
    label: string;
    value: string | number;
    icon: any;
    isActive?: boolean;
    onClick?: () => void;
    activeColorClass?: string;
    inactiveColorClass?: string;
    valueColorClass?: string;
}) {
    const isClickable = !!onClick;
    return (
        <div
            onClick={onClick}
            className={`flex flex-col justify-between rounded-2xl border p-4 shadow-sm transition-all duration-200 min-h-[92px] ${
                isClickable ? 'cursor-pointer' : ''
            } ${
                isActive
                    ? `bg-white border-transparent ring-2 ${activeColorClass || 'border-[#12335f] ring-[#12335f]/25'}`
                    : 'bg-white border-slate-200/80 hover:border-slate-350 hover:shadow-md'
            }`}
        >
            <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-450 leading-tight">
                    {label}
                </p>
                <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-all duration-200 ${
                        isActive ? (activeColorClass || 'bg-[#12335f]/10 text-[#12335f]') : (inactiveColorClass || 'text-slate-600 bg-slate-50 border-slate-200')
                    }`}
                >
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <p className={`mt-2 text-xl font-black tracking-tight leading-none text-wrap-anywhere ${valueColorClass || 'text-slate-900'}`}>
                {value}
            </p>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</label>
            {children}
        </div>
    );
}

// ─── Invite Modal ─────────────────────────────────────────────────────────────

function InviteModal({ roles, onClose, onSuccess }: { roles: OrgCustomRole[]; onClose: () => void; onSuccess: () => void }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [mobile, setMobile] = useState('');
    const [customRoleId, setCustomRoleId] = useState<number | ''>(roles.find(role => role.isActive)?.id || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !email.includes('@')) {
            toast.error('Enter a valid email address');
            return;
        }
        setSaving(true);
        try {
            await postApi('/api/org/invite', {
                name: name.trim() || undefined,
                email: email.trim().toLowerCase(),
                mobile: mobile.trim() ? mobile.trim().replace(/\D/g, '').slice(-10) : undefined,
                customRoleId: customRoleId === '' ? undefined : customRoleId
            });
            toast.success(`Sub-user created and invitation credentials emailed to ${email}`);
            onSuccess();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to send invitation');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#0b1f3a] to-[#12335f] px-5 py-4 text-white">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest">Create & Invite Sub-User</h3>
                        <p className="mt-0.5 text-[10px] text-white/70">Provisions account and emails login credentials</p>
                    </div>
                    <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Full Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Rahul Sharma"
                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Email Address *</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="colleague@company.com"
                            required
                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mobile Number (Optional)</label>
                        <input
                            type="tel"
                            value={mobile}
                            onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            placeholder="9876543210"
                            maxLength={10}
                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20 font-mono"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Role / Permissions *</label>
                        <select value={customRoleId} onChange={e => setCustomRoleId(e.target.value === '' ? '' : Number(e.target.value))} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-[#12335f]/20">
                            <option value="">Select a dynamic role</option>
                            {roles.filter(role => role.isActive).map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                        </select>
                        <p className="text-[10px] font-semibold text-slate-400">
                            The sub-user will receive their temporary password via email, set a new password, and verify their mobile OTP on first login.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={saving} className="bg-[#12335f] text-white font-bold">
                            {saving ? 'Creating & Sending...' : 'Create & Send Credentials'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Edit Member Modal ────────────────────────────────────────────────────────

function EditMemberModal({
    member,
    roles,
    onClose,
    onSuccess
}: {
    member: Member;
    roles: OrgCustomRole[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const initialRoleId = member.customRoleId || member.customRole?.id || roles.find(r => r.roleKey.toLowerCase().replace(/-/g, '_') === String(member.orgRole).toLowerCase().replace(/-/g, '_'))?.id || '';
    const [name, setName] = useState(member.user.name || '');
    const [mobile, setMobile] = useState(member.user.mobile || '');
    const [orgRole, setOrgRole] = useState<OrgRole>(member.orgRole || 'ORG_MEMBER');
    const [customRoleId, setCustomRoleId] = useState<number | ''>(initialRoleId);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName || trimmedName.length < 2) {
            toast.error('Please enter a valid full name (at least 2 characters).');
            return;
        }

        const trimmedMobile = mobile.trim();
        if (trimmedMobile && !/^[6-9]\d{9}$/.test(trimmedMobile)) {
            toast.error('Please enter a valid 10-digit mobile number starting with 6-9, or leave it blank.');
            return;
        }

        setSaving(true);
        try {
            await patchApi(`/api/org/members/${member.userId}`, {
                name: trimmedName,
                mobile: trimmedMobile || null,
                orgRole,
                customRoleId: customRoleId === '' ? null : Number(customRoleId)
            });
            toast.success(`${trimmedName}'s details updated successfully`);
            onSuccess();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update member details');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="edit-member-title">
            <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-[#0b1f3a] to-[#12335f] px-5 py-4 text-white">
                    <div>
                        <h3 id="edit-member-title" className="text-sm font-black uppercase tracking-widest">Edit Member Details</h3>
                        <p className="mt-0.5 text-[10px] text-white/70">{member.user.email}</p>
                    </div>
                    <button onClick={onClose} aria-label="Close dialog" className="rounded-md p-1 text-white/80 hover:bg-white/10 transition">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Full Name *</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Rajesh Kumar"
                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#12335f]/20 focus:border-[#12335f]"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Mobile Number</label>
                        <input
                            type="tel"
                            value={mobile}
                            onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            placeholder="10-digit mobile number"
                            maxLength={10}
                            className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#12335f]/20 focus:border-[#12335f] font-mono"
                        />
                        <p className="text-[10px] text-slate-400">Used for transaction updates and verification alerts.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Primary Role *</label>
                            <select
                                value={orgRole}
                                onChange={e => setOrgRole(e.target.value as OrgRole)}
                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#12335f]/20 focus:border-[#12335f]"
                            >
                                <option value="ORG_ADMIN">Admin (Full Access)</option>
                                <option value="ORG_MANAGER">Manager</option>
                                <option value="PROCUREMENT_OFFICER">Procurement Officer</option>
                                <option value="FINANCE_OFFICER">Finance Officer</option>
                                <option value="TECHNICAL_OFFICER">Technical Officer</option>
                                <option value="LOGISTICS_OFFICER">Logistics Officer</option>
                                <option value="ORG_MEMBER">Member (Standard)</option>
                                <option value="VIEWER">Viewer (Read-only)</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Custom Dynamic Role</label>
                            <select
                                value={customRoleId}
                                onChange={e => setCustomRoleId(e.target.value === '' ? '' : Number(e.target.value))}
                                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-[#12335f]/20 focus:border-[#12335f]"
                            >
                                <option value="">No custom role</option>
                                {roles.filter(role => role.isActive).map(role => (
                                    <option key={role.id} value={role.id}>{role.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <div className="text-[11px] text-slate-400">
                            Status: <span className={member.isActive ? "font-bold text-emerald-600" : "font-bold text-amber-600"}>{member.isActive ? "Active" : "Inactive"}</span>
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                            <Button type="submit" disabled={saving} className="bg-[#12335f] hover:bg-[#0b2447] text-white font-bold">
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

function RoleModal({
    permissionGroups,
    templates,
    onClose,
    onSuccess
}: {
    permissionGroups: Record<string, OrgPermission[]>;
    templates: Array<{ roleKey: string; name: string }>;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [name, setName] = useState('Product A Procurement Officer');
    const [description, setDescription] = useState('Category-scoped procurement role with no payment initiation access.');
    const [cloneFrom, setCloneFrom] = useState('procurement_officer');
    const [selected, setSelected] = useState<string[]>(['MARKETPLACE_COMPARE', 'CART_ADD', 'REQUIREMENT_CREATE', 'REQUIREMENT_PUBLISH', 'REQUIREMENT_RESPONSE_COMPARE']);
    const [saving, setSaving] = useState(false);

    const toggle = (permissionKey: string) => {
        setSelected(prev => prev.includes(permissionKey) ? prev.filter(item => item !== permissionKey) : [...prev, permissionKey]);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const nameError = validateRequiredText(name, 'Role name', {
            min: 2,
            max: 80,
            pattern: /^[A-Za-z0-9][A-Za-z0-9 _./&()'-]*$/,
            patternMessage: 'Role name can contain letters, numbers, spaces, and common separators'
        });
        if (nameError) {
            toast.error(nameError);
            return;
        }
        const normalizedName = name.trim().replace(/\s+/g, ' ');
        setSaving(true);
        try {
            await postApi('/api/org/roles', {
                name: normalizedName,
                description: description.trim(),
                cloneFrom,
                permissions: selected
            });
            toast.success('Role created');
            onSuccess();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to create role');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-[#12335f] px-5 py-4 text-white">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest">Create Role</h3>
                        <p className="mt-0.5 text-[10px] text-white/70">Build a custom permission checklist for this organization.</p>
                    </div>
                    <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10"><X className="h-4 w-4" /></button>
                </div>
                <form onSubmit={handleSubmit} className="max-h-[calc(90vh-72px)] overflow-y-auto p-5">
                    <div className="grid gap-3 md:grid-cols-3">
                        <Field label="Role Name">
                            <input value={name} onChange={e => setName(e.target.value)} maxLength={80} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold" />
                        </Field>
                        <Field label="Clone Template">
                            <select value={cloneFrom} onChange={e => setCloneFrom(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold">
                                <option value="">Blank role</option>
                                {templates.map(template => <option key={template.roleKey} value={template.roleKey}>{template.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Selected Permissions">
                            <div className="flex h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-black text-[#12335f]">{selected.length}</div>
                        </Field>
                    </div>
                    <Field label="Description">
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold" />
                    </Field>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {Object.entries(permissionGroups).map(([module, permissions]) => (
                            <div key={module} className="rounded-lg border border-slate-200 p-3">
                                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{module}</p>
                                <div className="grid gap-1.5">
                                    {permissions.map(permission => (
                                        <label key={permission.key} className="flex items-start gap-2 rounded-md p-1.5 hover:bg-slate-50">
                                            <input type="checkbox" checked={selected.includes(permission.key)} onChange={() => toggle(permission.key)} className="mt-0.5" />
                                            <span>
                                                <span className="block text-xs font-black text-slate-800">{permission.label}</span>
                                                <span className="block text-[10px] font-semibold text-slate-500">{permission.description}</span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={saving} className="bg-[#12335f] text-white">{saving ? 'Saving...' : 'Save Role'}</Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function TransferAccessModal({ member, roles, onClose, onSuccess }: { member: Member; roles: OrgCustomRole[]; onClose: () => void; onSuccess: () => void }) {
    const [toEmail, setToEmail] = useState('');
    const [customRoleId, setCustomRoleId] = useState<number | ''>(member.customRoleId || '');
    const [reason, setReason] = useState('');
    const [deactivateOldMember, setDeactivateOldMember] = useState(true);
    const [saving, setSaving] = useState(false);

    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!toEmail.includes('@')) {
            toast.error('Enter replacement email');
            return;
        }
        if (reason.trim().length < 5) {
            toast.error('Reason is required');
            return;
        }
        setSaving(true);
        try {
            await postApi(`/api/org/members/${member.userId}/transfer-access`, {
                toEmail: toEmail.trim().toLowerCase(),
                customRoleId: customRoleId === '' ? undefined : customRoleId,
                reason: reason.trim(),
                deactivateOldMember
            });
            toast.success('Transfer invite created');
            onSuccess();
        } catch (err: any) {
            toast.error(err?.message || 'Transfer failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 bg-[#12335f] px-5 py-4 text-white">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest">Transfer Access</h3>
                        <p className="mt-0.5 text-[10px] text-white/70">{member.user.name} · {member.user.email}</p>
                    </div>
                    <button onClick={onClose} className="rounded-md p-1 text-white/80 hover:bg-white/10"><X className="h-4 w-4" /></button>
                </div>
                <form onSubmit={submit} className="space-y-4 p-5">
                    <Field label="Replacement Email">
                        <input type="email" value={toEmail} onChange={e => setToEmail(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold" />
                    </Field>
                    <Field label="Replacement Role">
                        <select value={customRoleId} onChange={e => setCustomRoleId(e.target.value === '' ? '' : Number(e.target.value))} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold">
                            <option value="">Copy same fallback role</option>
                            {roles.filter(role => role.isActive).map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                        </select>
                    </Field>
                    <Field label="Reason">
                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold" />
                    </Field>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <input type="checkbox" checked={deactivateOldMember} onChange={e => setDeactivateOldMember(e.target.checked)} />
                        Deactivate old member after transfer invite is created
                    </label>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] font-semibold leading-relaxed text-amber-800">
                        Historic records remain linked to the old user. Only future access is transferred.
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={saving} className="bg-[#12335f] text-white">{saving ? 'Sending...' : 'Send Transfer Invite'}</Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
