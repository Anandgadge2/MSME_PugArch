import React, { memo, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Eye, Filter, RefreshCw, Search, ShieldCheck, Users, X, Grid, List, Save, Edit3, Trash2, Building2, Store, Laptop, Clock, Phone, Mail, User, CheckCircle2, BadgeCheck, FileText, Info } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import { EmptyState, ErrorState, LoadingState } from '../../shared/FeatureStates';
import { KpiCard } from '../../shared/KpiCard';
import { Pagination } from '../../shared/Pagination';
import { formatDate } from '../../shared/format';
import { useFeatureQuery, useResponsiveViewMode } from '../../shared/hooks';
import { EntityIdLink } from '../../shared/EntityIdLink';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { toast } from 'sonner';
import { api } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';
import { sanitizeIndianMobileInput, sanitizePersonNameInput, validateIndianMobile, validatePersonName } from '../../../lib/validation';




type AdminKind = 'users' | 'audit' | 'fraud' | 'rules';
type RecordMap = Record<string, any>;

const config = {
  users: {
    title: 'Users',
    eyebrow: 'Admin Registry',
    description: 'Account status, registration status, role, onboarding state, sessions, and compliance signals.',
    endpoint: '/api/admin/users',
    icon: Users
  },
  audit: {
    title: 'Audit Logs',
    eyebrow: 'Administrative Trail',
    description: 'Write actions, actors, affected entities, and immutable event payloads.',
    endpoint: '/api/admin/audit-logs',
    icon: Eye
  },
  fraud: {
    title: 'Fraud Alerts',
    eyebrow: 'Risk Monitoring',
    description: 'Risk alerts, severity, review state, linked user, and entity references.',
    endpoint: '/api/admin/fraud-alerts',
    icon: AlertTriangle
  },
  rules: {
    title: 'Compliance Rules',
    eyebrow: 'Policy Controls',
    description: 'Active compliance rules, severity, violation samples, and control coverage.',
    endpoint: '/api/admin/compliance-rules',
    icon: ShieldCheck
  }
} satisfies Record<AdminKind, { title: string; eyebrow: string; description: string; endpoint: string; icon: any }>;

const readRecords = (data: any): RecordMap[] => Array.isArray(data) ? data : data?.records || data?.data?.records || [];
const totalOf = (data: any, fallback: number) => Number(data?.total ?? data?.data?.total ?? fallback);
const label = (value: unknown) => String(value ?? '-').replace(/_/g, ' ');

const rowTitle = (kind: AdminKind, record: RecordMap) => {
  if (kind === 'users') return record.name || record.email || `User #${record.id}`;
  if (kind === 'audit') return record.action || `Audit #${record.id}`;
  if (kind === 'fraud') return record.alertType || `Alert #${record.id}`;
  return record.title || record.code || `Rule #${record.id}`;
};

const rowIdLabel = (kind: AdminKind, record: RecordMap) => {
  const id = record.id ?? '-';
  if (kind === 'users') return `USR-${id}`;
  if (kind === 'audit') return `AUD-${id}`;
  if (kind === 'fraud') return `FRD-${id}`;
  return `RUL-${id}`;
};

const rowSubtitle = (kind: AdminKind, record: RecordMap) => {
  if (kind === 'users') return [record.email, record.mobile, record.organization?.name, record.registrationStatus && `registration: ${record.registrationStatus}`, record.onboardingStatus && `onboarding: ${record.onboardingStatus}`].filter(Boolean).join(' | ');
  if (kind === 'audit') return [record.User?.email, record.entityType && `${record.entityType} #${record.entityId || '-'}`].filter(Boolean).join(' | ');
  if (kind === 'fraud') return [record.user?.email, record.entityType && `${record.entityType} #${record.entityId || '-'}`].filter(Boolean).join(' | ');
  return record.description || record.code || '-';
};

const statusOf = (kind: AdminKind, record: RecordMap) => {
  if (kind === 'users') return record.registrationStatus || record.onboardingStatus || record.accountStatus || record.role;
  if (kind === 'audit') return record.entityType || 'recorded';
  if (kind === 'rules') return record.isActive === false ? 'inactive' : 'active';
  return record.status || 'open';
};

const aadhaarKycOf = (record: RecordMap) => record.aadhaarKyc || record.kycVerifications?.[0] || null;

const severityClass = (value: unknown) => {
  const normalized = String(value || '').toLowerCase();
  if (['critical', 'high'].includes(normalized)) return 'border-rose-200 bg-rose-50 text-rose-700';
  if (['medium', 'pending', 'under_compliance_review'].includes(normalized)) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (['active', 'approved_for_procurement', 'low', 'closed', 'resolved'].includes(normalized)) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-blue-200 bg-slate-50 text-[#12335f]';
};

export default function AdminRecordsPage({ kind }: { kind: AdminKind }) {
  const cfg = config[kind];
  const { user: currentUser } = useAuth();
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [severity, setSeverity] = useState('');
  const [selected, setSelected] = useState<RecordMap | null>(null);
  const [editingUser, setEditingUser] = useState<RecordMap | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(20);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [viewMode, setViewMode] = useResponsiveViewMode();

  const [sortKey, setSortKey] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const handler = setTimeout(() => setQuery(searchInput), 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [query, role, status, severity, kind]);

  const setPageSize = useCallback((nextPageSize: number) => {
    setPageSizeState(nextPageSize);
    setPage(1);
  }, []);

  const handleToggleUserStatus = async (record: RecordMap) => {
    const currentUserId = currentUser?.id;
    if (currentUserId && Number(record.id) === Number(currentUserId)) {
      toast.error("You cannot deactivate your own account!");
      return;
    }

    const newStatus = record.accountStatus === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';

    // Optimistic UI Update
    setData((current: any) => {
      if (!current) return current;
      const recordsList = readRecords(current);
      const updatedList = recordsList.map((r: any) => r.id === record.id ? { ...r, accountStatus: newStatus } : r);
      if (Array.isArray(current)) return updatedList;
      return { ...current, records: updatedList };
    });

    try {
      const res = await api.fetch(`/api/admin/users/${record.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ accountStatus: newStatus })
      });
      if (res.ok) {
        toast.success(`User status updated to ${newStatus === 'ACTIVE' ? 'Active' : 'Inactive'}`);
        api.invalidate();
        reload();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.message || 'Failed to update status');
        // Rollback
        setData((current: any) => {
          if (!current) return current;
          const recordsList = readRecords(current);
          const updatedList = recordsList.map((r: any) => r.id === record.id ? { ...r, accountStatus: record.accountStatus } : r);
          if (Array.isArray(current)) return updatedList;
          return { ...current, records: updatedList };
        });
      }
    } catch (err) {
      toast.error('Unable to update user status');
      // Rollback
      setData((current: any) => {
        if (!current) return current;
        const recordsList = readRecords(current);
        const updatedList = recordsList.map((r: any) => r.id === record.id ? { ...r, accountStatus: record.accountStatus } : r);
        if (Array.isArray(current)) return updatedList;
        return { ...current, records: updatedList };
      });
    }
  };

  const handleDeleteUser = async (record: RecordMap) => {
    const currentUserId = currentUser?.id;
    if (currentUserId && Number(record.id) === Number(currentUserId)) {
      toast.error("You cannot delete your own account!");
      return;
    }

    if (!window.confirm(`Are you sure you want to permanently delete user "${record.name || record.email}"? This will clean up all active sessions, compliance violations, and fraud alerts for this user.`)) {
      return;
    }

    // Optimistic UI Update (remove from local list)
    setData((current: any) => {
      if (!current) return current;
      const recordsList = readRecords(current);
      const updatedList = recordsList.filter((r: any) => r.id !== record.id);
      if (Array.isArray(current)) return updatedList;
      return { ...current, records: updatedList };
    });

    try {
      const res = await api.fetch(`/api/admin/users/${record.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        toast.success("User successfully deleted");
        api.invalidate();
        reload();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.message || "Failed to delete user");
        api.invalidate();
        reload();
      }
    } catch (err) {
      toast.error("Unable to delete user");
      api.invalidate();
      reload();
    }
  };

  const handleUpdateUser = async (updatedFields: { name: string; email: string; mobile: string; role: string }) => {
    if (!editingUser) return;

    // Optimistic UI Update
    setData((current: any) => {
      if (!current) return current;
      const recordsList = readRecords(current);
      const updatedList = recordsList.map((r: any) => r.id === editingUser.id ? { ...r, ...updatedFields } : r);
      if (Array.isArray(current)) return updatedList;
      return { ...current, records: updatedList };
    });

    try {
      const res = await api.fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedFields)
      });
      if (res.ok) {
        toast.success("User updated successfully");
        setEditingUser(null);
        api.invalidate();
        reload();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.message || "Failed to update user");
        api.invalidate();
        reload();
      }
    } catch (err) {
      toast.error("Unable to update user");
      api.invalidate();
      reload();
    }
  };

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.set('skip', String((page - 1) * pageSize));
    params.set('take', String(pageSize));
    if (query.trim()) params.set('q', query.trim());
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    if (kind === 'users' && status) {
      if (['completed', 'incomplete'].includes(status)) params.set('registrationStatus', status);
      else params.set('accountStatus', status);
    }
    if (severity) params.set('severity', severity);
    const queryString = params.toString();
    return `${cfg.endpoint}${queryString ? `?${queryString}` : ''}`;
  }, [cfg.endpoint, kind, page, pageSize, query, role, severity, status]);

  const { data, loading, refreshing, error, reload, setData } = useFeatureQuery<any>(endpoint, { records: [] });
  const rawRecords = useMemo(() => readRecords(data), [data]);

  const total = totalOf(data, rawRecords.length);
  const Icon = cfg.icon;

  const records = useMemo(() => {
    const valueForSort = (record: RecordMap) => {
      if (sortKey === 'record') return rowTitle(kind, record);
      if (sortKey === 'status') return String(statusOf(kind, record));
      if (sortKey === 'severity') return record.severity || record.role || record.alertType || '';
      if (sortKey === 'date') return new Date(record.createdAt || record.updatedAt || 0).getTime();
      return '';
    };

    return [...rawRecords].sort((a, b) => {
      const aVal = valueForSort(a);
      const bVal = valueForSort(b);
      const res = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return sortDirection === 'asc' ? res : -res;
    });
  }, [kind, rawRecords, sortDirection, sortKey]);

  const toggleSort = useCallback((key: string) => {
    setSortDirection(prev => sortKey === key && prev === 'asc' ? 'desc' : 'asc');
    setSortKey(key);
  }, [sortKey]);

  const currentUserId = useMemo(() => currentUser ? Number(currentUser.id) : null, [currentUser]);

  const metrics = useMemo(() => {
    if (kind === 'users') {
      const activeCount = records.filter(r => r.accountStatus === 'ACTIVE').length;
      return [
        { label: 'Total Users', value: total, tone: 'blue' as const, subtext: 'Registered user base' },
        { label: 'Active Users', value: activeCount, tone: 'green' as const, subtext: 'Currently authorized' }
      ];
    }
    const open = records.filter(record => ['open', 'pending', 'PENDING', 'under_compliance_review'].includes(String(statusOf(kind, record)))).length;
    const critical = records.filter(record => ['HIGH', 'CRITICAL', 'high', 'critical'].includes(String(record.severity))).length;
    return [
      { label: 'Loaded Records', value: records.length, tone: 'blue' as const, subtext: 'In current view' },
      { label: kind === 'fraud' || kind === 'rules' ? 'High Risk' : 'Pending Review', value: kind === 'fraud' || kind === 'rules' ? critical : open, tone: kind === 'fraud' || kind === 'rules' ? 'red' : 'amber', subtext: 'Action required' }
    ];
  }, [kind, records, total]);


  if (loading && records.length === 0) return <LoadingState label={`Loading ${cfg.title.toLowerCase()}...`} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">{cfg.eyebrow}</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">{cfg.title}</h1>
          <p className="mt-1 max-w-3xl text-xs font-semibold text-slate-500">{cfg.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
          <Button variant="outline" onClick={reload} className="h-10 rounded-lg text-xs font-black uppercase"><RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />Refresh</Button>
        </div>
      </div>

      <div className={cn("grid gap-3", kind === 'users' ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3")}>
        {metrics.map(item => (
          <KpiCard
            key={item.label}
            label={item.label}
            value={item.value}
            subtext={item.subtext}
            icon={Icon}
            tone={item.tone}
          />
        ))}
      </div>


      <Card className="border-slate-200/80 shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-2.5 items-center w-full">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder={`Search ${cfg.title.toLowerCase()}...`} className="h-10 w-full rounded-lg border border-slate-200 pl-10 pr-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20 bg-slate-50/50 hover:bg-slate-50 focus:bg-white transition-all text-slate-900" />
            </div>

            <div className={cn(
              "flex-col sm:flex-row gap-2 w-full lg:w-auto shrink-0",
              showMobileFilters ? "flex" : "hidden lg:flex"
            )}>
              <select value={role} onChange={event => setRole(event.target.value)} disabled={kind !== 'users'} className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-bold disabled:bg-slate-50 disabled:text-slate-300 w-full lg:w-[160px] bg-white text-slate-900 outline-none focus:ring-2 focus:ring-[#12335f]/20 transition-all"><option value="">All roles</option><option value="admin">Admin</option><option value="buyer">Buyer</option><option value="seller">Seller</option></select>
              <select value={status} onChange={event => setStatus(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-xs font-bold w-full lg:w-[160px] bg-white text-slate-900 outline-none focus:ring-2 focus:ring-[#12335f]/20 transition-all"><option value="">All statuses</option><option value="completed">Registration completed</option><option value="incomplete">Registration incomplete</option><option value="approved_for_procurement">Approved onboarding</option><option value="PENDING">Pending account</option><option value="ACTIVE">Active account</option><option value="OPEN">Open</option><option value="CLOSED">Closed</option></select>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className="lg:hidden h-10 w-full sm:w-auto gap-2 rounded-lg text-xs font-black uppercase tracking-wider border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0"
            >
              <Filter className="h-4 w-4 text-slate-500" />
              <span>Filters {showMobileFilters ? '(Hide)' : '(Show)'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>


      {records.length === 0 ? (
        <EmptyState title={kind === 'fraud' ? 'No active fraud alerts' : `No ${cfg.title.toLowerCase()} found`} />
      ) : viewMode === 'grid' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {records.map((record, index) => (
              <AdminRecordCard
                key={`${kind}-${record.id || rowTitle(kind, record)}`}
                kind={kind}
                record={record}
                srNo={(page - 1) * pageSize + index + 1}
                onView={() => setSelected(record)}
                onToggleStatus={handleToggleUserStatus}
                onEdit={setEditingUser}
                onDelete={handleDeleteUser}
                currentUserId={currentUserId}
              />
            ))}
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white overflow-x-clip">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-left text-sm">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="p-3 w-16">Sr. No.</th>
                  <th className="p-3"><SortHeadButton label="Record" field="record" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} /></th>
                  <th className="p-3"><SortHeadButton label="Status" field="status" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} /></th>
                  <th className="p-3"><SortHeadButton label="Severity/Role" field="severity" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} /></th>
                  <th className="p-3"><SortHeadButton label="Date" field="date" sortKey={sortKey} sortDirection={sortDirection} onSort={toggleSort} /></th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record, index) => (
                  <tr key={`${kind}-${record.id || rowTitle(kind, record)}`} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-xs font-black text-slate-400">{String((page - 1) * pageSize + index + 1).padStart(2, '0')}</td>
                    <td className="p-3">
                      <EntityIdLink
                        label={rowIdLabel(kind, record)}
                        id={record.id}
                        size="sm"
                        onClick={() => setSelected(record)}
                      />
                      <p className="mt-1 font-black text-slate-900 text-wrap-anywhere">{rowTitle(kind, record)}</p>
                      <p className="text-[10px] font-semibold text-slate-500 text-wrap-anywhere">{rowSubtitle(kind, record) || `#${record.id || '-'}`}</p>
                      {kind === 'users' && aadhaarKycOf(record) && (
                        <span className={cn(
                          'mt-2 inline-flex rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wider',
                          aadhaarKycOf(record)?.status === 'VERIFIED'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : aadhaarKycOf(record)?.status === 'FAILED'
                              ? 'border-rose-200 bg-rose-50 text-rose-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                        )}>
                          Aadhaar {label(aadhaarKycOf(record)?.status)}
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {kind === 'users' ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleUserStatus(record)}
                            className={cn(
                              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#12335f] focus:ring-offset-2",
                              record.accountStatus === 'ACTIVE' ? "bg-emerald-500" : "bg-slate-300"
                            )}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                record.accountStatus === 'ACTIVE' ? "translate-x-4" : "translate-x-0"
                              )}
                            />
                          </button>
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-wider",
                            record.accountStatus === 'ACTIVE' ? "text-emerald-700" : "text-slate-500"
                          )}>
                            {record.accountStatus === 'ACTIVE' ? "Active" : "Inactive"}
                          </span>
                        </div>
                      ) : (
                        <span className={`rounded-lg border px-3 py-1 text-[10px] font-black uppercase ${severityClass(statusOf(kind, record))}`}>{label(statusOf(kind, record))}</span>
                      )}
                    </td>
                    <td className="p-3 text-xs font-black uppercase text-slate-700">{label(record.severity || record.role || record.alertType || '-')}</td>
                    <td className="p-3 text-xs font-bold text-slate-500">{formatDateTime(record.createdAt || record.updatedAt)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" onClick={() => setSelected(record)} className="h-9 rounded-lg text-xs font-black"><Eye className="mr-2 h-4 w-4" />View</Button>
                        {kind === 'users' && (
                          <>
                            <Button variant="outline" onClick={() => setEditingUser(record)} className="h-9 rounded-lg text-xs font-black text-blue-600 hover:text-blue-700 border-blue-100 hover:bg-blue-50/50"><Edit3 className="mr-2 h-4 w-4" />Edit</Button>
                            <Button variant="outline" onClick={() => handleDeleteUser(record)} className="h-9 rounded-lg text-xs font-black text-rose-600 hover:text-rose-700 border-rose-100 hover:bg-rose-50/50" disabled={Number(record.id) === Number(currentUserId)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
        </div>
      )}


      {selected && <DetailPanel kind={kind} record={selected} onClose={() => setSelected(null)} />}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleUpdateUser}
        />
      )}
    </div>
  );
}

function signalText(kind: AdminKind, record: RecordMap) {
  if (kind === 'users') return `${record.sessions?.length || 0} sessions | ${record.complianceViolations?.length || 0} flags`;
  if (kind === 'audit') return record.entityType ? `${record.entityType} #${record.entityId || '-'}` : 'System event';
  if (kind === 'fraud') return record.reviewedAt ? `Reviewed ${formatDate(record.reviewedAt)}` : 'Awaiting review';
  return `${record.violations?.length || 0} recent violations`;
}

function formatDateTime(dateVal: any) {
  if (!dateVal) return '—';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '—';

  const dateStr = d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const timeStr = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return `${dateStr} ${timeStr}`;
}

const SortHeadButton = memo(function SortHeadButton({
  label,
  field,
  sortKey,
  sortDirection,
  onSort
}: {
  label: string;
  field: string;
  sortKey: string;
  sortDirection: 'asc' | 'desc';
  onSort: (field: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 text-left hover:text-slate-700"
    >
      {label}
      <span className="text-slate-400">
        {sortKey === field ? (
          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </span>
    </button>
  );
});

function DetailPanel({ kind, record, onClose }: { kind: AdminKind; record: RecordMap; onClose: () => void }) {
  const safeRecord = { ...record };
  delete safeRecord.password;

  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const containerEl = containerRef.current;
    if (!scrollEl || !containerEl) return;

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'TEXTAREA') {
        const textarea = target as HTMLTextAreaElement;
        if (textarea.scrollHeight > textarea.clientHeight) {
          return;
        }
      }
      e.stopPropagation();
      e.preventDefault();
      scrollEl.scrollTop += e.deltaY;
    };

    containerEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      containerEl.removeEventListener('wheel', handleWheel);
    };
  }, [mounted]);

  if (!mounted) return null;

  const modalNode = kind === 'users' ? (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <aside 
        className="w-full max-w-2xl h-[85vh] max-h-[85vh] flex flex-col bg-slate-50 shadow-2xl border border-slate-200/80 rounded-3xl animate-in zoom-in-95 duration-200 overflow-hidden my-auto shrink-0" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="shrink-0 relative overflow-hidden bg-[radial-gradient(circle_at_18%_18%,#1f6f63_0,#12335f_46%,#07172e_100%)] p-6 text-white shadow-md">
          <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-emerald-300/15 blur-3xl" />
          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 border border-white/20 text-2xl font-black text-emerald-300 backdrop-blur-md shadow-inner">
                {(record.name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200 backdrop-blur-sm">
                  <User className="h-3 w-3" /> User Detail • {rowIdLabel('users', record)}
                </div>
                <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white">{record.name || 'Unnamed User'}</h2>
                <p className="mt-0.5 text-xs font-medium text-blue-100/90">{record.email || 'No email registered'}</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="rounded-xl border border-white/20 bg-white/10 p-2.5 text-white hover:bg-white/20 transition-all duration-200 shadow-sm shrink-0 ml-3" 
              aria-label="Close detail"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mouse-wheel scrollable body */}
        <div 
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-5 overscroll-contain focus:outline-none"
        >
          {/* Quick Status Cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            <DetailMetric label="Account Status" value={label(record.accountStatus || record.onboardingStatus || 'pending')} statusTag={record.accountStatus === 'ACTIVE' ? 'active' : 'pending'} />
            <DetailMetric label="Role" value={label(record.role || '-')} />
            <DetailMetric label="Registered Date" value={formatDate(record.createdAt)} />
          </div>

          {/* Contact Information */}
          <DetailSection title="Contact Information" icon={Phone}>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <DetailField label="Full Name" value={record.name} />
              <DetailField label="Email" value={record.email} />
              <DetailField label="Mobile" value={record.mobile || record.phone} />
              <DetailField label="Alternate Phone" value={record.alternatePhone} />
            </div>
          </DetailSection>

          {aadhaarKycOf(record) && (
            <DetailSection title="Aadhaar Verification" icon={ShieldCheck}>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <DetailField label="Status" value={label(aadhaarKycOf(record)?.status)} />
                <DetailField label="Provider" value="MeriPehchaan" />
                <DetailField label="Verified Name" value={aadhaarKycOf(record)?.verifiedName || 'Not available'} />
                <DetailField label="Verified At" value={formatDate(aadhaarKycOf(record)?.verifiedAt)} />
                <DetailField label="Reference Key" value={aadhaarKycOf(record)?.referenceKey || 'Not available'} />
                <DetailField label="Subject" value={aadhaarKycOf(record)?.idTokenSubject || 'Not available'} />
              </div>
            </DetailSection>
          )}

          {/* Organization */}
          {(record.organization?.id || record.organization?.organizationName || record.profile?.businessName || record.profile?.organizationName) && (
            <DetailSection title="Organization" icon={Building2}>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <DetailField label="Organization Name" value={record.organization?.organizationName || record.profile?.businessName || record.profile?.organizationName} />
                {record.organization?.id && <DetailField label="Org ID" value={`ORG-${record.organization.id}`} />}
                <DetailField label="GSTIN" value={record.organization?.gstin || record.profile?.gst} />
                <DetailField label="Verification Status" value={record.organization?.verificationStatus} />
              </div>
            </DetailSection>
          )}

          {/* Profile / Business Details */}
          {Object.keys(record.profile || {}).length > 0 && (
            <DetailSection title="Business Profile" icon={Store}>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <DetailField label="PAN" value={record.profile?.pan} />
                <DetailField label="GST" value={record.profile?.gst} />
                <DetailField label="Udyam Number" value={record.profile?.udyamNumber} />
                <DetailField label="Industry" value={record.profile?.industry} />
                <DetailField label="State" value={record.profile?.state} />
                <DetailField label="City" value={record.profile?.city} />
                <DetailField label="Annual Turnover" value={record.profile?.annualTurnover} />
                <DetailField label="Annual Budget" value={record.profile?.annualBudget} />
                {record.profile?.productCategories && (
                  <DetailField label="Product Categories" value={Array.isArray(record.profile.productCategories) ? record.profile.productCategories.join(', ') : record.profile.productCategories} />
                )}
                {record.profile?.procurementCategories && (
                  <DetailField label="Procurement Categories" value={Array.isArray(record.profile.procurementCategories) ? record.profile.procurementCategories.join(', ') : record.profile.procurementCategories} />
                )}
              </div>
            </DetailSection>
          )}

          {/* Onboarding Section Status */}
          {Object.keys(record.sectionStatus || {}).length > 0 && (
            <DetailSection title="Onboarding Verification" icon={CheckCircle2}>
              <div className="space-y-3">
                {/* Informative Explanation Banner */}
                <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 p-3.5 text-xs text-blue-900 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-blue-950">Onboarding Submission vs Admin Approval Status</p>
                      <p className="text-[11px] leading-relaxed text-blue-800">
                        <strong className="font-semibold text-blue-950">User Form Submission: COMPLETED</strong> — All mandatory onboarding form checkpoints ({Object.keys(record.sectionStatus || {}).join(', ')}) were filled & submitted by the user.
                      </p>
                      <p className="text-[11px] leading-relaxed text-blue-800">
                        <strong className="font-semibold text-blue-950">Admin Review: {label(record.organization?.verificationStatus || record.accountStatus || 'PENDING')}</strong> — Organization compliance verification by platform admin is currently {record.organization?.verificationStatus || 'PENDING'}.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="grid gap-3.5 sm:grid-cols-2">
                  <DetailField label="Onboarding Started At" value={formatDate(record.createdAt)} />
                  <DetailField label="Onboarding Submitted At" value={formatDate(record.profile?.updatedAt || record.updatedAt || record.createdAt)} />
                </div>

                {/* Section Checkpoints */}
                <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
                  {Object.entries(record.sectionStatus || {}).map(([section, status]) => (
                    <div key={section} className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-slate-50/70 px-3.5 py-2.5 transition-colors hover:bg-white">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-700">{section} Verification</span>
                      <span className={`rounded-full border px-3 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        status === 'approved' || status === 'completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : status === 'rejected' ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : status === 'resubmission_required' ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-blue-200 bg-blue-50 text-[#12335f]'
                      }`}>{label(String(status))}</span>
                    </div>
                  ))}
                </div>
              </div>
            </DetailSection>
          )}

          {/* Sessions */}
          {(record.sessions || []).length > 0 && (
            <DetailSection title={`Active Sessions (${record.sessions.length})`} icon={Laptop}>
              <div className="space-y-2">
                {record.sessions.slice(0, 5).map((session: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-slate-50/70 p-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{session.device || session.userAgent || 'Unknown Device'}</span>
                      {session.ip && <span className="ml-2 text-slate-400 font-medium">({session.ip})</span>}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">{formatDate(session.lastActive || session.createdAt)}</span>
                  </div>
                ))}
                {record.sessions.length > 5 && (
                  <p className="text-center text-[10px] font-bold text-slate-400">+{record.sessions.length - 5} more sessions</p>
                )}
              </div>
            </DetailSection>
          )}

          {/* Compliance Violations */}
          {(record.complianceViolations || []).length > 0 && (
            <DetailSection title={`Compliance Flags (${record.complianceViolations.length})`} icon={AlertTriangle}>
              <div className="space-y-2.5">
                {record.complianceViolations.map((v: any, idx: number) => (
                  <div key={idx} className="rounded-xl border border-slate-200/60 bg-slate-50/70 p-3.5 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-800">{v.rule || v.ruleCode || v.type || `Flag #${idx + 1}`}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${severityClass(v.severity)}`}>{v.severity || 'info'}</span>
                    </div>
                    {v.description && <p className="text-slate-600 font-medium">{v.description}</p>}
                    {v.createdAt && <p className="mt-1 text-[10px] text-slate-400 font-medium">Flagged: {formatDate(v.createdAt)}</p>}
                  </div>
                ))}
              </div>
            </DetailSection>
          )}

          {/* Admin Feedback */}
          {record.adminFeedback && (
            <DetailSection title="Admin Feedback" icon={FileText}>
              <p className="text-xs font-semibold leading-relaxed text-slate-700 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/60">{record.adminFeedback}</p>
            </DetailSection>
          )}

          {/* Timestamps */}
          <DetailSection title="Timestamps" icon={Clock}>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <DetailField label="Created At" value={formatDate(record.createdAt)} />
              <DetailField label="Updated At" value={formatDate(record.updatedAt)} />
              <DetailField label="Last Login" value={formatDate(record.lastLoginAt)} />
              <DetailField label="Email Verified" value={record.emailVerified ? 'Yes' : 'No'} />
            </div>
          </DetailSection>
        </div>
      </aside>
    </div>
  ) : (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <aside className="w-full max-w-2xl h-[85vh] max-h-[85vh] flex flex-col bg-slate-50 shadow-2xl border border-slate-200/80 rounded-3xl animate-in zoom-in-95 duration-200 overflow-hidden my-auto shrink-0" onClick={e => e.stopPropagation()}>
        <div className="shrink-0 relative overflow-hidden bg-[radial-gradient(circle_at_18%_18%,#1f6f63_0,#12335f_46%,#07172e_100%)] p-6 text-white shadow-md">
          <div className="flex items-start justify-between relative z-10">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-200 backdrop-blur-sm">
                {config[kind].title} Detail
              </div>
              <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight text-white">{rowTitle(kind, record)}</h2>
              <p className="mt-0.5 text-xs font-medium text-blue-100/90">{rowSubtitle(kind, record)}</p>
            </div>
            <button onClick={onClose} className="rounded-xl border border-white/20 bg-white/10 p-2.5 text-white hover:bg-white/20 transition-all duration-200 shadow-sm shrink-0 ml-3" aria-label="Close detail"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div 
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-5 overscroll-contain focus:outline-none"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <DetailMetric label="Status" value={label(statusOf(kind, record))} />
            <DetailMetric label="Severity/Role" value={label(record.severity || record.role || '-')} />
            <DetailMetric label="Created" value={formatDate(record.createdAt)} />
          </div>
          <Card className="rounded-2xl border border-slate-200/80 shadow-sm"><CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600"><Filter className="h-4 w-4 text-[#12335f]" /> Full Record</div>
            <pre className="max-h-[520px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs font-semibold leading-relaxed text-slate-100">{JSON.stringify(safeRecord, null, 2)}</pre>
          </CardContent></Card>
        </div>
      </aside>
    </div>
  );

  return createPortal(modalNode, document.body);
}

const DetailMetric = memo(function DetailMetric({ label, value, statusTag }: { label: string; value: string; statusTag?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm hover:border-slate-300 transition-all duration-200">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className={cn(
          "text-sm font-black uppercase tracking-tight",
          statusTag === 'active' || value.toLowerCase() === 'active' ? "text-emerald-700" : "text-slate-900"
        )}>
          {value}
        </span>
      </div>
    </div>
  );
});

const DetailSection = memo(function DetailSection({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden hover:border-slate-300 transition-all duration-200">
      <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-3.5 flex items-center gap-2.5">
        {Icon && <Icon className="h-4 w-4 text-[#12335f]" />}
        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-700">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
});

const DetailField = memo(function DetailField({ label, value }: { label: string; value?: string | number | null }) {
  const display = value !== undefined && value !== null && String(value).trim() !== '' ? String(value) : 'N/A';
  return (
    <div className="space-y-1">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <div className={cn(
        "text-xs font-bold break-all rounded-xl p-2.5 border transition-colors",
        display === '—' ? "bg-slate-50/50 border-slate-100 text-slate-400 font-normal" : "bg-slate-50/80 border-slate-200/70 text-slate-800"
      )}>
        {display}
      </div>
    </div>
  );
});

const AdminRecordCard = memo(function AdminRecordCard({
  kind,
  record,
  srNo,
  onView,
  onToggleStatus,
  onEdit,
  onDelete,
  currentUserId
}: {
  kind: AdminKind;
  record: RecordMap;
  srNo: number;
  onView: () => void;
  onToggleStatus?: (record: RecordMap) => void;
  onEdit?: (record: RecordMap) => void;
  onDelete?: (record: RecordMap) => void;
  currentUserId?: number | null;
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex flex-col justify-between h-full min-h-[180px]">
        <div>
          <div className="flex items-start justify-between gap-3">
            <span className="rounded bg-slate-50 px-2 py-1 font-mono text-[10px] font-black text-[#12335f]">{String(srNo).padStart(2, '0')}</span>
            {kind === 'users' && onToggleStatus ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onToggleStatus(record)}
                  className={cn(
                    "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    record.accountStatus === 'ACTIVE' ? "bg-emerald-500" : "bg-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out",
                      record.accountStatus === 'ACTIVE' ? "translate-x-3" : "translate-x-0"
                    )}
                  />
                </button>
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-wider",
                  record.accountStatus === 'ACTIVE' ? "text-emerald-700" : "text-slate-500"
                )}>
                  {record.accountStatus === 'ACTIVE' ? "Active" : "Inactive"}
                </span>
              </div>
            ) : (
              <span className={`rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase ${severityClass(statusOf(kind, record))}`}>{label(statusOf(kind, record))}</span>
            )}
          </div>
          <h3 className="mt-3 line-clamp-2 text-sm font-black text-slate-900 text-wrap-anywhere">{rowTitle(kind, record)}</h3>
          <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-slate-500 text-wrap-anywhere">{rowSubtitle(kind, record) || `#${record.id || '-'}`}</p>
          <div className="mt-3">
            <EntityIdLink
              label={rowIdLabel(kind, record)}
              id={record.id}
              size="sm"
              onClick={onView}
            />
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <span className="text-[9px] font-bold text-slate-400">{formatDateTime(record.createdAt || record.updatedAt)}</span>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" onClick={onView} className="h-8 rounded-lg text-[10px] font-black px-2.5"><Eye className="mr-1 h-3.5 w-3.5" />View</Button>
            {kind === 'users' && onEdit && onDelete && (
              <>
                <Button variant="outline" onClick={() => onEdit(record)} className="h-8 rounded-lg text-[10px] font-black px-2 text-blue-600 hover:text-blue-700 border-blue-100 hover:bg-blue-50/50"><Edit3 className="h-3.5 w-3.5" /></Button>
                <Button variant="outline" onClick={() => onDelete(record)} className="h-8 rounded-lg text-[10px] font-black px-2 text-rose-600 hover:text-rose-700 border-rose-100 hover:bg-rose-50/50" disabled={Number(record.id) === Number(currentUserId)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

function UserEditModal({
  user,
  onClose,
  onSave
}: {
  user: RecordMap;
  onClose: () => void;
  onSave: (data: { name: string; email: string; mobile: string; role: string }) => void;
}) {
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [mobile, setMobile] = useState(user.mobile || '');
  const [role, setRole] = useState(user.role || 'seller');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nameError = validatePersonName(name, 'Full name');
    if (nameError) {
      toast.error(nameError);
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error("A valid email is required");
      return;
    }
    if (mobile.trim()) {
      const mobileError = validateIndianMobile(mobile, 'Mobile number');
      if (mobileError) {
        toast.error(mobileError);
        return;
      }
    }
    onSave({ name: name.trim().replace(/\s+/g, ' '), email: email.trim(), mobile: mobile.trim(), role });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <h3 className="text-sm font-black text-slate-950 uppercase tracking-wider">Edit User Profile</h3>
            <p className="text-[10px] font-semibold text-slate-500">Modify user information and system role.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 transition-colors"><X className="h-4 w-4" /></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(sanitizePersonNameInput(e.target.value))}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20 bg-slate-50/50 hover:bg-slate-50 focus:bg-white transition-all text-slate-900"
              placeholder="Enter full name"
              maxLength={100}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20 bg-slate-50/50 hover:bg-slate-50 focus:bg-white transition-all text-slate-900"
              placeholder="email@example.com"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mobile Number</label>
            <input
              type="text"
              value={mobile}
              onChange={e => setMobile(sanitizeIndianMobileInput(e.target.value))}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20 bg-slate-50/50 hover:bg-slate-50 focus:bg-white transition-all text-slate-900"
              placeholder="10-digit mobile number"
              inputMode="numeric"
              maxLength={10}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">System Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold bg-white text-slate-900 outline-none focus:ring-2 focus:ring-[#12335f]/20 transition-all"
            >
              <option value="admin">Administrator</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
            </select>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="h-9 px-4 rounded-lg text-xs font-black uppercase tracking-wider">Cancel</Button>
            <Button type="submit" className="h-9 px-4 rounded-lg text-xs font-black uppercase tracking-wider bg-[#12335f] text-white hover:bg-[#1e467d] transition-colors flex items-center gap-1.5"><Save className="h-4 w-4" /> Save Changes</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

