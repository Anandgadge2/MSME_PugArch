import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, CircleAlert, FileClock, KeyRound, LockKeyhole, Mail, Plus, RefreshCw, Save, Search, Shield, Smartphone, UserPlus, Users } from 'lucide-react';
import { api, unwrapApiData } from '../lib/api';
import { Button } from '../components/ui/button';
import { KpiCard } from '../features/shared/KpiCard';
import { Pagination } from '../features/shared/Pagination';
import { usePagination } from '../features/shared/hooks';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/useOrgRole';
import { sanitizeIndianMobileInput, sanitizePersonNameInput, validateIndianMobile, validatePersonName, validateRequiredText } from '../lib/validation';

type ScopeType = 'PLATFORM' | 'DISTRICT' | 'ORGANIZATION';

type Permission = {
  id: number;
  code: string;
  module: string;
  action?: string | null;
  resource?: string | null;
  description?: string | null;
};

type Role = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  scopeType: ScopeType;
  scopeId?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  isDefault?: boolean;
  permissions: Array<{ permissionId: number; permission: Permission }>;
  _count?: { users: number };
};

type Member = {
  id: number;
  name: string;
  email: string;
  mobile?: string | null;
  role: string;
  accountType?: string;
  accountStatus: string;
  organizationId?: number | null;
  districtId?: number | null;
  mustChangePassword?: boolean;
  requiresMobileVerification?: boolean;
  mobileVerified?: boolean;
  roles?: Array<{ role: Role; isActive: boolean }>;
  orgMemberships?: Array<{ orgRole: string; invitedById?: number | null; acceptedAt?: string | null; isActive: boolean }>;
};

type Invitation = {
  id: number;
  name?: string | null;
  email: string;
  mobile?: string | null;
  roleIds: number[];
  status: string;
  expiresAt: string;
  acceptedAt?: string | null;
  createdAt: string;
};

const scopeLabels: Record<ScopeType, string> = {
  PLATFORM: 'Platform',
  DISTRICT: 'District',
  ORGANIZATION: 'Organization'
};

const emptyRole = {
  name: '',
  description: '',
  scopeType: 'ORGANIZATION' as ScopeType,
  status: 'ACTIVE',
  permissionCodes: ['dashboard.view'] as string[]
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

const memberActivation = (member: Member) => {
  if (member.mustChangePassword) return { label: 'Password change pending', className: 'border-amber-200 bg-amber-50 text-amber-800' };
  if (member.requiresMobileVerification) return { label: 'Mobile OTP pending', className: 'border-blue-200 bg-blue-50 text-blue-800' };
  return { label: 'Active', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
};

export default function RbacPanel() {
  const { user } = useAuth();
  const { permissions: currentPermissions, loading: permissionsLoading, reload: reloadPermissions } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'roles' | 'team' | 'audit'>('team');
  const [query, setQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [draft, setDraft] = useState(emptyRole);
  const [rolePermissionDraft, setRolePermissionDraft] = useState<Record<number, string[]>>({});
  const [invite, setInvite] = useState({ name: '', email: '', mobile: '', roleIds: [] as number[] });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const {
    page: membersPage,
    pageSize: membersPageSize,
    pageItems: pagedMembers,
    total: totalMembers,
    setPage: setMembersPage,
    setPageSize: setMembersPageSize
  } = usePagination(members, 10);

  const {
    page: auditPage,
    pageSize: auditPageSize,
    pageItems: pagedAuditLogs,
    total: totalAuditLogs,
    setPage: setAuditPage,
    setPageSize: setAuditPageSize
  } = usePagination(auditLogs, 10);

  const canManage = user?.role === 'master_admin' || currentPermissions?.includes('*') || currentPermissions?.includes('team.role.manage');
  const canViewTeam = user?.role === 'master_admin' || currentPermissions?.includes('*') || currentPermissions?.includes('team.member.view');
  const canInvite = user?.role !== 'master_admin' && (currentPermissions?.includes('*') || currentPermissions?.includes('team.member.invite'));
  const canAssign = user?.role === 'master_admin' || currentPermissions?.includes('*') || currentPermissions?.includes('team.role.assign') || currentPermissions?.includes('team.role.manage');

  const defaultScope = useMemo(() => {
    if (user?.role === 'master_admin') return { scopeType: 'PLATFORM' as ScopeType, scopeId: null };
    if (user?.role === 'admin') return { scopeType: 'DISTRICT' as ScopeType, scopeId: user.districtId ? String(user.districtId) : user.activeScope?.scopeId || null };
    return { scopeType: 'ORGANIZATION' as ScopeType, scopeId: user?.organizationId ? String(user.organizationId) : null };
  }, [user]);

  const selectedRole = selectedRoleId === -1 ? null : roles.find(role => role.id === selectedRoleId) || roles[0] || null;

  const modules = useMemo(() => ['All', ...Array.from(new Set(permissions.map(p => p.module || 'Other')))], [permissions]);

  const groupedPermissions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return permissions
      .filter(permission => moduleFilter === 'All' || permission.module === moduleFilter)
      .filter(permission => !q || [permission.code, permission.module, permission.description || ''].join(' ').toLowerCase().includes(q))
      .reduce<Record<string, Permission[]>>((acc, permission) => {
        const permModule = permission.module || 'Other';
        acc[permModule] = acc[permModule] || [];
        acc[permModule].push(permission);
        return acc;
      }, {});
  }, [permissions, query, moduleFilter]);

  const load = async () => {
    setLoading(true);
    try {
      const headers = authHeaders();
      const canLoadRoles = canManage || canAssign || canInvite || currentPermissions.includes('*') || currentPermissions.includes('team.role.view');
      const canLoadAudit = currentPermissions.includes('*') || currentPermissions.includes('audit.view');
      const [rolesRes, permsRes, membersRes, invitesRes, auditRes] = await Promise.all([
        canLoadRoles ? api.get('/api/rbac/roles', { headers, skipCache: true }) : Promise.resolve(null),
        canManage ? api.get('/api/rbac/permissions/grouped', { headers, skipCache: true }) : Promise.resolve(null),
        canViewTeam ? api.get('/api/team/members', { headers, skipCache: true }) : Promise.resolve(null),
        (canViewTeam || canInvite) ? api.get('/api/team/invitations', { headers, skipCache: true }) : Promise.resolve(null),
        canLoadAudit ? api.get('/api/rbac/audit-logs', { headers, skipCache: true }) : Promise.resolve(null)
      ]);
      if (rolesRes?.ok) {
        const nextRoles = unwrapApiData<Role[]>(await rolesRes.json());
        setRoles(nextRoles);
        setRolePermissionDraft(Object.fromEntries(nextRoles.map(role => [role.id, role.permissions?.map(row => row.permission.code) || []])));
      }
      if (permsRes?.ok) {
        const grouped = unwrapApiData<Record<string, Permission[]>>(await permsRes.json());
        setPermissions(Object.values(grouped).flat());
      }
      if (membersRes?.ok) setMembers(unwrapApiData(await membersRes.json()));
      if (invitesRes?.ok) setInvitations(unwrapApiData(await invitesRes.json()));
      if (auditRes?.ok) setAuditLogs(unwrapApiData(await auditRes.json()));
    } catch {
      toast.error('Unable to load roles and permissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permissionsLoading) void load();
  }, [permissionsLoading]);

  useEffect(() => {
    setDraft(prev => ({ ...prev, scopeType: defaultScope.scopeType }));
  }, [defaultScope.scopeType]);

  const selectedCodes = useMemo(
    () => new Set(selectedRole ? rolePermissionDraft[selectedRole.id] || [] : []),
    [selectedRole, rolePermissionDraft]
  );

  const draftCodes = new Set(draft.permissionCodes);

  const toggleDraftPermission = (code: string) => {
    setDraft(prev => ({
      ...prev,
      permissionCodes: prev.permissionCodes.includes(code)
        ? prev.permissionCodes.filter(item => item !== code)
        : [...prev.permissionCodes, code]
    }));
  };

  const toggleSelectedRolePermission = (code: string) => {
    if (!selectedRole) return;
    setRolePermissionDraft(prev => {
      const current = prev[selectedRole.id] || [];
      return {
        ...prev,
        [selectedRole.id]: current.includes(code)
          ? current.filter(item => item !== code)
          : [...current, code]
      };
    });
  };

  const saveRole = async () => {
    const roleNameError = validateRequiredText(draft.name, 'Role name', {
      min: 2,
      max: 80,
      pattern: /^[A-Za-z0-9][A-Za-z0-9 _./&()'-]*$/,
      patternMessage: 'Role name can contain letters, numbers, spaces, and common separators'
    });
    if (roleNameError) {
      toast.error(roleNameError);
      return;
    }
    const normalizedRoleName = draft.name.trim().replace(/\s+/g, ' ');
    setSaving(true);
    try {
      const res = await api.post('/api/rbac/roles', {
        ...draft,
        name: normalizedRoleName,
        scopeId: defaultScope.scopeId
      }, { headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Unable to create role');
      const createdRole = unwrapApiData<Role>(await res.json());
      toast.success('Role created.');
      setDraft({ ...emptyRole, scopeType: defaultScope.scopeType });
      setSelectedRoleId(createdRole.id);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create role.');
    } finally {
      setSaving(false);
    }
  };

  const saveSelectedRolePermissions = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const res = await api.post(`/api/rbac/roles/${selectedRole.id}/permissions`, {
        permissionCodes: rolePermissionDraft[selectedRole.id] || []
      }, { headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Unable to update role');
      toast.success('Role permissions saved.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update role.');
    } finally {
      setSaving(false);
    }
  };

  const assignRole = async () => {
    if (!selectedMemberId || !selectedRole) return;
    setSaving(true);
    try {
      const res = await api.post(`/api/rbac/users/${selectedMemberId}/roles`, {
        roleId: selectedRole.id,
        scopeType: selectedRole.scopeType,
        scopeId: selectedRole.scopeId
      }, { headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Unable to assign role');
      toast.success('Role assigned.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to assign role.');
    } finally {
      setSaving(false);
    }
  };

  const sendInvite = async () => {
    const cleanName = sanitizePersonNameInput(invite.name).trim();
    const cleanMobile = sanitizeIndianMobileInput(invite.mobile);
    const nameError = validatePersonName(cleanName, 'Name');
    if (nameError) return toast.error(nameError);
    if (cleanMobile) {
      const mobileError = validateIndianMobile(cleanMobile, 'Mobile number');
      if (mobileError) return toast.error(mobileError);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invite.email.trim())) return toast.error('Enter a valid email address.');
    if (invite.roleIds.length === 0) return toast.error('Select at least one role for this user.');
    const selectedInviteRoles = roles.filter(role => invite.roleIds.includes(role.id));
    if (!selectedInviteRoles.some(role => role.permissions?.some(row => row.permission.code === 'dashboard.view'))) {
      return toast.error('Select a role that includes dashboard.view so this user can open the workspace dashboard.');
    }
    setSaving(true);
    try {
      const res = await api.post('/api/team/invite', {
        ...invite,
        name: cleanName,
        email: invite.email.trim().toLowerCase(),
        mobile: cleanMobile || undefined
      }, { headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Unable to create invite');
      toast.success('Invitation email sent and sub-login created.');
      setInvite({ name: '', email: '', mobile: '', roleIds: [] });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to create invite.');
    } finally {
      setSaving(false);
    }
  };

  if (permissionsLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm font-bold text-slate-500">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        Loading access policy
      </div>
    );
  }

  if (!canManage && !canViewTeam) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <LockKeyhole className="h-8 w-8 text-slate-500" />
        <h1 className="mt-4 text-xl font-bold text-slate-950">Team access is restricted</h1>
        <p className="mt-2 text-sm text-slate-600">Your assigned role does not include team.member.view or team.role.manage.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            <Shield className="h-4 w-4" />
            Secure workspace administration
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Team & RBAC</h1>
          <p className="mt-1 text-sm text-slate-600">Create roles, invite sub-logins, and review activation for this {scopeLabels[defaultScope.scopeType].toLowerCase()} workspace.</p>
        </div>
        <Button onClick={() => { reloadPermissions(); void load(); }} variant="outline" className="gap-2" disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Roles"
          value={roles.length}
          subtext="Configured access roles"
          icon={Shield}
          tone="blue"
          loading={loading}
          active={activeTab === 'roles'}
          onClick={() => setActiveTab('roles')}
        />
        <KpiCard
          label="Team Members"
          value={members.length}
          subtext="Active intra-org accounts"
          icon={Users}
          tone="green"
          loading={loading}
          active={activeTab === 'team'}
          onClick={() => setActiveTab('team')}
        />
        <KpiCard
          label="Pending Invites"
          value={invitations.filter(invitation => invitation.status !== 'ACCEPTED' && invitation.status !== 'CANCELLED').length}
          subtext="Awaiting secure activation"
          icon={Mail}
          tone="purple"
          loading={loading}
          active={activeTab === 'team'}
          onClick={() => setActiveTab('team')}
        />
        <KpiCard
          label="Audit Events"
          value={auditLogs.length}
          subtext="Recorded security actions"
          icon={FileClock}
          tone="amber"
          loading={loading}
          active={activeTab === 'audit'}
          onClick={() => setActiveTab('audit')}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ...(canManage ? [['roles', 'Roles & permissions', Shield]] : []),
          ['team', 'Team Members', Users],
          ...((currentPermissions.includes('*') || currentPermissions.includes('audit.view')) ? [['audit', 'Audit Logs', FileClock]] : [])
        ].map(([key, label, Icon]) => (
          <button
            key={key as string}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-bold transition ${activeTab === key ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'}`}
          >
            <Icon className="h-4 w-4" />
            {label as string}
          </button>
        ))}
      </div>

      {activeTab === 'roles' && canManage && (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-black text-slate-950">Create Role</h2>
              <div className="mt-4 space-y-3">
                <input value={draft.name} onFocus={() => setSelectedRoleId(-1)} onChange={e => { setSelectedRoleId(-1); setDraft(prev => ({ ...prev, name: e.target.value })); }} maxLength={80} className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-500" placeholder="Role name" />
                <textarea value={draft.description} onChange={e => setDraft(prev => ({ ...prev, description: e.target.value }))} className="min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-500" placeholder="Description" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600">
                    {scopeLabels[defaultScope.scopeType]} scope
                  </div>
                  <select value={draft.status} onChange={e => setDraft(prev => ({ ...prev, status: e.target.value as any }))} className="h-10 rounded-md border border-slate-200 px-3 text-sm">
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
                <Button onClick={saveRole} disabled={saving} className="w-full gap-2 bg-slate-950 text-white">
                  <Plus className="h-4 w-4" />
                  Create Role
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {roles.map(role => (
                <button
                  key={role.id}
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full rounded-lg border bg-white p-3 text-left shadow-sm transition ${selectedRole?.id === role.id ? 'border-slate-950 ring-2 ring-slate-950/10' : 'border-slate-200 hover:border-slate-400'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black text-slate-950">{role.name}</span>
                    <span className="rounded bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{role.status}</span>
                  </div>
                  <p title={role.description || role.code} className="mt-1 line-clamp-2 text-xs text-slate-500">{role.description || role.code}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-500">
                    <span>{scopeLabels[role.scopeType]}</span>
                    <span>{role.permissions?.length || 0} permissions</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">{selectedRole?.name || 'Permissions for new role'}</h2>
                <p className="text-xs font-semibold text-slate-500">Only permissions already available to your account are shown.</p>
              </div>
              {selectedRole && (
                <Button onClick={saveSelectedRolePermissions} disabled={saving} className="gap-2 bg-slate-950 text-white">
                  <Save className="h-4 w-4" />
                  Save Matrix
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 md:flex-row">
              <div className="relative md:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={e => setQuery(e.target.value)} className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-500" placeholder="Search permissions" />
              </div>
              <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm">
                {modules.map(module => <option key={module} value={module}>{module}</option>)}
              </select>
            </div>
            <div className="max-h-[640px] overflow-y-auto p-4">
              {Object.entries(groupedPermissions).map(([module, items]) => (
                <section key={module} className="mb-5">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">{module}</h3>
                    <button
                      onClick={() => selectedRole
                        ? setRolePermissionDraft(prev => ({ ...prev, [selectedRole.id]: Array.from(new Set([...(prev[selectedRole.id] || []), ...items.map(item => item.code)])) }))
                        : setDraft(prev => ({ ...prev, permissionCodes: Array.from(new Set([...prev.permissionCodes, ...items.map(item => item.code)])) }))}
                      className="text-xs font-bold text-slate-700 underline"
                    >
                      Select all in module
                    </button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {items.map(permission => {
                      const assigned = selectedCodes.has(permission.code);
                      const inDraft = draftCodes.has(permission.code);
                      return (
                        <button
                          key={permission.id}
                          onClick={() => selectedRole ? toggleSelectedRolePermission(permission.code) : toggleDraftPermission(permission.code)}
                          className={`flex min-h-20 items-start gap-3 rounded-md border p-3 text-left transition ${inDraft ? 'border-emerald-300 bg-emerald-50' : assigned ? 'border-slate-300 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                        >
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${inDraft || assigned ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300'}`}>
                            {(inDraft || assigned) && <Check className="h-3 w-3" />}
                          </span>
                          <span className="min-w-0">
                            <span title={permission.code} className="block truncate font-mono text-xs font-black text-slate-950">{permission.code}</span>
                            <span className="mt-1 block text-xs leading-relaxed text-slate-500">{permission.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="grid gap-5 lg:grid-cols-[390px_1fr]">
          <div className="space-y-5">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-gradient-to-r from-[#0b2447] to-[#12335f] p-5 text-white">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20"><UserPlus className="h-5 w-5" /></span>
                  <div>
                    <h2 className="font-black">Create sub-login</h2>
                    <p className="text-xs text-blue-100">Credentials are emailed automatically</p>
                  </div>
                </div>
              </div>

              {canInvite ? (
                <div className="space-y-4 p-5">
                  <label className="block text-xs font-black uppercase tracking-wide text-slate-600">Full name <span className="text-red-600">*</span>
                    <input value={invite.name} onChange={e => setInvite(prev => ({ ...prev, name: sanitizePersonNameInput(e.target.value) }))} maxLength={100} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#12335f] focus:ring-2 focus:ring-blue-100" placeholder="e.g. Priya Sharma" />
                  </label>
                  <label className="block text-xs font-black uppercase tracking-wide text-slate-600">Work email <span className="text-red-600">*</span>
                    <input type="email" value={invite.email} onChange={e => setInvite(prev => ({ ...prev, email: e.target.value }))} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-[#12335f] focus:ring-2 focus:ring-blue-100" placeholder="name@organization.com" />
                  </label>
                  <label className="block text-xs font-black uppercase tracking-wide text-slate-600">Mobile number <span className="font-semibold normal-case text-slate-400">(optional now)</span>
                    <div className="mt-2 flex overflow-hidden rounded-lg border border-slate-300 focus-within:border-[#12335f] focus-within:ring-2 focus-within:ring-blue-100">
                      <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600">+91</span>
                      <input value={invite.mobile} onChange={e => setInvite(prev => ({ ...prev, mobile: sanitizeIndianMobileInput(e.target.value) }))} inputMode="numeric" maxLength={10} className="h-11 min-w-0 flex-1 px-3 text-sm outline-none" placeholder="10-digit number" />
                    </div>
                  </label>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wide text-slate-600">Assign role <span className="text-red-600">*</span></span>
                      <button type="button" onClick={() => setActiveTab('roles')} className="text-xs font-bold text-blue-700 hover:underline">Manage roles</button>
                    </div>
                    {roles.length ? (
                      <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                        {roles.filter(role => role.status === 'ACTIVE').map(role => (
                          <label key={role.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${invite.roleIds.includes(role.id) ? 'border-blue-300 bg-blue-50' : 'border-transparent bg-white hover:border-slate-200'}`}>
                            <input type="checkbox" className="mt-1" checked={invite.roleIds.includes(role.id)} onChange={() => setInvite(prev => ({ ...prev, roleIds: prev.roleIds.includes(role.id) ? prev.roleIds.filter(id => id !== role.id) : [...prev.roleIds, role.id] }))} />
                            <span className="min-w-0"><span className="block text-sm font-black text-slate-900">{role.name}</span><span className="block text-xs text-slate-500">{role.permissions?.length || 0} permissions · {role.permissions?.some(row => row.permission.code === 'dashboard.view') ? 'Dashboard ready' : 'No dashboard access'}</span></span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <button type="button" onClick={() => setActiveTab('roles')} className="flex w-full items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
                        <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                        <span><span className="block text-sm font-black text-amber-900">Create a role first</span><span className="text-xs text-amber-800">Define only the permissions this user needs, then return to send the invite.</span></span>
                      </button>
                    )}
                  </div>

                  <Button onClick={sendInvite} disabled={saving || invite.roleIds.length === 0} className="h-11 w-full gap-2 bg-[#12335f] font-bold text-white hover:bg-[#0b2447]">
                    <Mail className="h-4 w-4" />
                    {saving ? 'Sending secure invite…' : 'Send invite & credentials'}
                  </Button>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="font-black text-slate-800">What happens next</p>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                      <span><Mail className="mx-auto mb-1 h-4 w-4" />Email</span>
                      <span><KeyRound className="mx-auto mb-1 h-4 w-4" />Password</span>
                      <span><Smartphone className="mx-auto mb-1 h-4 w-4" />Mobile OTP</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 text-sm text-slate-600">Your role can view the team but cannot create sub-logins.</div>
              )}
            </div>

            {invitations.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-black text-slate-950">Recent invitations</h3>
                <div className="mt-3 space-y-2">
                  {invitations.slice(0, 5).map(invitation => (
                    <div key={invitation.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-bold text-slate-900">{invitation.name || invitation.email}</span><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase text-slate-600">{invitation.status.replace(/_/g, ' ')}</span></div>
                      <p className="mt-1 truncate text-xs text-slate-500">{invitation.email}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-base font-black text-slate-950">Team members</h2><p className="text-xs text-slate-500">Primary and delegated users in this workspace</p></div>
              {canAssign && roles.length > 0 && (
                <div className="flex gap-2">
                  <select value={selectedRole?.id || ''} onChange={event => setSelectedRoleId(Number(event.target.value))} className="h-9 max-w-44 rounded-md border border-slate-200 px-2 text-xs font-bold">
                    {roles.filter(role => role.status === 'ACTIVE').map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                  </select>
                  <Button onClick={assignRole} disabled={!selectedMemberId || !selectedRole || saving || Number(selectedMemberId) === Number(user?.id)} variant="outline" className="h-9">Assign role</Button>
                </div>
              )}
            </div>
            <div className="divide-y divide-slate-100">
              {pagedMembers.map(member => {
                const activation = memberActivation(member);
                const isPrimary = Number(member.id) === Number(user?.id) || member.orgMemberships?.some(row => !row.invitedById && row.orgRole === 'ORG_ADMIN');
                return (
                  <button key={member.id} onClick={() => setSelectedMemberId(member.id)} className={`grid w-full gap-3 p-4 text-left transition md:grid-cols-[1.2fr_170px_180px] ${selectedMemberId === member.id ? 'bg-blue-50/60 ring-1 ring-inset ring-blue-100' : 'bg-white hover:bg-slate-50'}`}>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2"><span className="truncate font-black text-slate-950">{member.name}</span>{isPrimary && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[9px] font-black uppercase text-white">Primary admin</span>}</span>
                      <span className="block truncate text-xs text-slate-500">{member.email}{member.mobile ? ` · +91 ${member.mobile}` : ''}</span>
                    </span>
                    <span className="text-xs text-slate-600"><span className="block font-black uppercase text-slate-500">Assigned role</span><span className="mt-1 block">{member.roles?.filter(row => row.isActive).map(row => row.role.name).join(', ') || (isPrimary ? 'Workspace administrator' : 'No role assigned')}</span></span>
                    <span><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${activation.className}`}>{activation.label}</span><span className="mt-1 block text-[10px] font-bold uppercase text-slate-400">{member.accountStatus}</span></span>
                  </button>
                );
              })}
              {pagedMembers.length === 0 && <div className="p-10 text-center text-sm text-slate-500">No team members found in this workspace.</div>}
            </div>
            <div className="border-t border-slate-200 bg-white">
              <Pagination
                page={membersPage}
                pageSize={membersPageSize}
                total={totalMembers}
                onPageChange={setMembersPage}
                onPageSizeChange={setMembersPageSize}
                label="members"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <h2 className="text-sm font-black text-slate-950">RBAC Audit Logs</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {pagedAuditLogs.map(log => (
              <div key={log.id} className="grid gap-2 p-4 text-sm md:grid-cols-[220px_1fr_180px]">
                <span className="font-mono text-xs font-bold text-slate-700">{log.action}</span>
                <span className="text-slate-600">{log.User?.name || 'System'} changed {log.entityType || 'rbac'} #{log.entityId || ''}</span>
                <span className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
            ))}
            {auditLogs.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No RBAC audit activity yet.</div>}
          </div>
          <div className="border-t border-slate-200 bg-white">
            <Pagination
              page={auditPage}
              pageSize={auditPageSize}
              total={totalAuditLogs}
              onPageChange={setAuditPage}
              onPageSizeChange={setAuditPageSize}
              label="audit logs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
