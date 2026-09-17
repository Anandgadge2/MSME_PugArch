'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { KpiCard } from '../../shared/KpiCard';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { Pagination } from '../../shared/Pagination';
import { usePagination } from '../../shared/hooks';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { formatDateTime, formatRelative } from '../../shared/format';
import { getApi, normalizeList, putApi, postApi } from '../../shared/apiClient';

export interface GrievanceComment {
  id: number;
  content: string;
  internal: boolean;
  createdAt: string;
  author?: { id: number; name?: string; email?: string; role?: string };
}

export interface GrievanceTicket {
  id: number;
  ticketNumber?: string | null;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  slaDueAt?: string | null;
  createdAt: string;
  updatedAt: string;
  userId?: number | null;
  user?: { id: number; name?: string; email?: string; role?: string } | null;
  assignedAdminId?: number | null;
  assignedAdmin?: { id: number; name?: string; email?: string } | null;
  complainantName?: string | null;
  complainantEmail?: string | null;
  complainantMobile?: string | null;
  enterpriseName?: string | null;
  referenceNumber?: string | null;
  resolutionRemarks?: string | null;
  resolvedAt?: string | null;
  comments?: GrievanceComment[];
}

const PRIORITY_BADGES: Record<string, string> = {
  LOW: 'border-slate-200 bg-slate-100 text-slate-700',
  NORMAL: 'border-blue-200 bg-blue-50 text-blue-800',
  MEDIUM: 'border-blue-200 bg-blue-50 text-blue-800',
  HIGH: 'border-amber-200 bg-amber-50 text-amber-800',
  URGENT: 'border-red-300 bg-red-50 text-red-800 font-black'
};

const STATUS_BADGES: Record<string, string> = {
  OPEN: 'border-amber-300 bg-amber-50 text-amber-900',
  ASSIGNED: 'border-purple-300 bg-purple-50 text-purple-900',
  IN_PROGRESS: 'border-blue-300 bg-blue-50 text-blue-900',
  WAITING_ON_USER: 'border-slate-300 bg-slate-100 text-slate-800',
  RESOLVED: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  CLOSED: 'border-slate-200 bg-slate-100 text-slate-700',
  REJECTED: 'border-red-200 bg-red-50 text-red-800'
};

export function GrievancesSection({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<GrievanceTicket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [commentText, setCommentText] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusRemarks, setStatusRemarks] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['adminGrievances'],
    queryFn: async () => {
      const res = await getApi<GrievanceTicket[]>('/api/grievances');
      return normalizeList<GrievanceTicket>(res);
    },
    staleTime: 30_000
  });

  const tickets = useMemo(() => data || [], [data]);

  // Status mutation with automatic email dispatch notice
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, remarks }: { id: number; status: string; remarks?: string }) => {
      return putApi(`/api/grievances/${id}/status`, { status: status.toLowerCase(), remarks });
    },
    onSuccess: (updated: any) => {
      toast.success('Grievance status updated & resolution email dispatched to registered address');
      queryClient.invalidateQueries({ queryKey: ['adminGrievances'] });
      if (selectedTicket) {
        setSelectedTicket(prev => prev ? { ...prev, ...updated, status: newStatus || prev.status, resolutionRemarks: statusRemarks || prev.resolutionRemarks } : null);
      }
      setNewStatus('');
      setStatusRemarks('');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update grievance status');
    }
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: string }) => {
      return postApi(`/api/grievances/${id}/comments`, { content, internal: false });
    },
    onSuccess: (newComment: any) => {
      toast.success('Response logged and update email dispatched to complainant');
      queryClient.invalidateQueries({ queryKey: ['adminGrievances'] });
      if (selectedTicket) {
        setSelectedTicket(prev => prev ? { ...prev, comments: [...(prev.comments || []), newComment] } : null);
      }
      setCommentText('');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to post comment');
    }
  });

  // KPI Calculations
  const counts = useMemo(() => {
    return {
      total: tickets.length,
      open: tickets.filter(t => (t.status || '').toLowerCase() === 'open').length,
      inProgress: tickets.filter(t => ['in_progress', 'assigned'].includes((t.status || '').toLowerCase())).length,
      urgent: tickets.filter(t => (t.priority || '').toLowerCase() === 'urgent').length,
      resolved: tickets.filter(t => ['resolved', 'closed'].includes((t.status || '').toLowerCase())).length
    };
  }, [tickets]);

  // Filters
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      const s = (t.status || '').toLowerCase();
      const p = (t.priority || '').toLowerCase();
      if (statusFilter && s !== statusFilter.toLowerCase()) return false;
      if (priorityFilter && p !== priorityFilter.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTicket = t.ticketNumber?.toLowerCase().includes(q) || String(t.id).includes(q);
        const matchSubject = t.subject?.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchUser = t.user?.name?.toLowerCase().includes(q) || t.user?.email?.toLowerCase().includes(q);
        const matchComplainant = t.complainantName?.toLowerCase().includes(q) || t.complainantEmail?.toLowerCase().includes(q);
        const matchOrg = t.enterpriseName?.toLowerCase().includes(q) || t.referenceNumber?.toLowerCase().includes(q);
        if (!matchTicket && !matchSubject && !matchDesc && !matchUser && !matchComplainant && !matchOrg) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, priorityFilter, searchQuery]);

  const { pageItems, page, total, pageSize, setPage, setPageSize } = usePagination(filteredTickets, 10);

  const recipientEmail = selectedTicket?.complainantEmail || selectedTicket?.user?.email;
  const submitterName = selectedTicket?.complainantName || selectedTicket?.user?.name || 'Citizen / Stakeholder';

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Total Grievances"
          value={counts.total}
          subtext="All stakeholder tickets"
          icon={FileText}
          tone="blue"
          active={statusFilter === ''}
          onClick={() => setStatusFilter('')}
        />
        <KpiCard
          label="Open Tickets"
          value={counts.open}
          subtext="Pending administrative review"
          icon={AlertTriangle}
          tone="amber"
          active={statusFilter === 'open'}
          onClick={() => setStatusFilter(statusFilter === 'open' ? '' : 'open')}
        />
        <KpiCard
          label="In Progress"
          value={counts.inProgress}
          subtext="Active inquiry / investigation"
          icon={Clock}
          tone="indigo"
          active={statusFilter === 'in_progress'}
          onClick={() => setStatusFilter(statusFilter === 'in_progress' ? '' : 'in_progress')}
        />
        <KpiCard
          label="Urgent Priority"
          value={counts.urgent}
          subtext="SLA critical grievances"
          icon={AlertTriangle}
          tone="red"
          active={priorityFilter === 'urgent'}
          onClick={() => setPriorityFilter(priorityFilter === 'urgent' ? '' : 'urgent')}
        />
        <KpiCard
          label="Resolved / Closed"
          value={counts.resolved}
          subtext="Redressed & dispatched"
          icon={CheckCircle2}
          tone="green"
          active={statusFilter === 'resolved'}
          onClick={() => setStatusFilter(statusFilter === 'resolved' ? '' : 'resolved')}
        />
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm">
        <ResponsiveFilterBar
          activeFilterCount={(searchQuery ? 1 : 0) + (statusFilter ? 1 : 0) + (priorityFilter ? 1 : 0)}
          searchInput={
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search ticket #, subject, complainant name or email..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
              />
            </div>
          }
          filters={
            <>
              <div className="w-full sm:w-auto sm:min-w-[150px]">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                  aria-label="Filter by grievance status"
                >
                  <option value="">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="waiting_on_user">Waiting on User</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="w-full sm:w-auto sm:min-w-[150px]">
                <select
                  value={priorityFilter}
                  onChange={e => setPriorityFilter(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer"
                  aria-label="Filter by grievance priority"
                >
                  <option value="">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </>
          }
        />
      </div>

      {/* Main Content: List & Details Drawer */}
      {isLoading ? (
        <LoadingState label="Loading grievance records from system..." />
      ) : error ? (
        <InlineError message={(error as Error).message} onRetry={() => refetch()} />
      ) : filteredTickets.length === 0 ? (
        <EmptyState
          title="No grievances found"
          description="There are currently no grievance tickets matching your selected criteria."
          action={
            (searchQuery || statusFilter || priorityFilter) ? {
              label: 'Clear Filters',
              onClick: () => {
                setSearchQuery('');
                setStatusFilter('');
                setPriorityFilter('');
              }
            } : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className={selectedTicket ? 'lg:col-span-6 xl:col-span-6' : 'lg:col-span-12'}>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="divide-y divide-slate-100">
                {pageItems.map(ticket => {
                  const isSelected = selectedTicket?.id === ticket.id;
                  const normPriority = (ticket.priority || 'NORMAL').toUpperCase();
                  const normStatus = (ticket.status || 'OPEN').toUpperCase();
                  const displayName = ticket.complainantName || ticket.user?.name || 'Citizen';
                  const displayEmail = ticket.complainantEmail || ticket.user?.email;

                  return (
                    <div
                      key={ticket.id}
                      onClick={() => {
                        setSelectedTicket(ticket);
                        setNewStatus(ticket.status || 'open');
                        setStatusRemarks(ticket.resolutionRemarks || '');
                      }}
                      className={`cursor-pointer p-4 transition-all hover:bg-slate-50 ${
                        isSelected ? 'bg-blue-50/70 border-l-4 border-[#12335f]' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-[#12335f]">
                            {ticket.ticketNumber || `#GRV-${ticket.id}`}
                          </span>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                              PRIORITY_BADGES[normPriority] || 'border-slate-200 bg-slate-100 text-slate-700'
                            }`}
                          >
                            {normPriority}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {ticket.category}
                          </span>
                        </div>
                        <span
                          className={`rounded-md border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                            STATUS_BADGES[normStatus] || 'border-slate-200 bg-slate-100 text-slate-700'
                          }`}
                        >
                          {ticket.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <h3 className="mt-2 text-sm font-black text-slate-900 line-clamp-1">{ticket.subject}</h3>
                      <p className="mt-1 text-xs text-slate-600 line-clamp-2">{ticket.description}</p>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] font-semibold text-slate-500">
                        <div className="flex items-center gap-1.5 truncate max-w-sm">
                          <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="text-slate-700 font-bold">{displayName}</span>
                          {displayEmail && <span className="text-slate-400 truncate">({displayEmail})</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          {ticket.slaDueAt && (
                            <span className="flex items-center gap-1 text-amber-700">
                              <Clock className="h-3 w-3" />
                              SLA: {formatDateTime(ticket.slaDueAt)}
                            </span>
                          )}
                          <span>{formatRelative(ticket.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-slate-100 p-3">
                <Pagination
                  page={page}
                  total={total}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </div>
          </div>

          {/* Selected Ticket Detail Panel */}
          {selectedTicket && (
            <div className="lg:col-span-6 xl:col-span-6 animate-in fade-in duration-200">
              <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 p-4 bg-slate-50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-[#12335f]">
                        {selectedTicket.ticketNumber || `#GRV-${selectedTicket.id}`}
                      </span>
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          STATUS_BADGES[(selectedTicket.status || 'OPEN').toUpperCase()] || 'border-slate-200 bg-slate-100 text-slate-700'
                        }`}
                      >
                        {selectedTicket.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <h2 className="text-sm font-black text-slate-900 mt-1">{selectedTicket.subject}</h2>
                  </div>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    aria-label="Close grievance details"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <CardContent className="space-y-4 p-4 text-xs font-semibold">
                  {/* Complainant & Case Dossier Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-xl bg-slate-50 p-3.5 border border-slate-200/80">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Complainant / Submitter</span>
                      <p className="mt-0.5 font-bold text-slate-900">{submitterName}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Registered Email (Resolution Recipient)</span>
                      <p className="mt-0.5 font-mono font-bold text-blue-800 flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 shrink-0 text-blue-600" />
                        <span className="truncate">{recipientEmail || 'None entered'}</span>
                      </p>
                    </div>
                    {selectedTicket.complainantMobile && (
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Mobile Contact</span>
                        <p className="mt-0.5 font-mono font-bold text-slate-800 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-500" />
                          {selectedTicket.complainantMobile}
                        </p>
                      </div>
                    )}
                    {selectedTicket.enterpriseName && (
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Enterprise / Legal Entity</span>
                        <p className="mt-0.5 font-bold text-slate-800 flex items-center gap-1">
                          <Building className="h-3 w-3 text-slate-500" />
                          {selectedTicket.enterpriseName}
                        </p>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Classification</span>
                      <p className="mt-0.5 font-bold text-slate-800">{selectedTicket.category}</p>
                    </div>
                    {selectedTicket.referenceNumber && (
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Associated Reference No.</span>
                        <p className="mt-0.5 font-mono font-bold text-slate-800">{selectedTicket.referenceNumber}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">SLA Due At</span>
                      <p className="mt-0.5 font-bold text-slate-800">
                        {selectedTicket.slaDueAt ? formatDateTime(selectedTicket.slaDueAt) : 'Standard 48h SLA'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Filing Date</span>
                      <p className="mt-0.5 font-bold text-slate-800">{formatDateTime(selectedTicket.createdAt)}</p>
                    </div>
                  </div>

                  {/* Grievance Narrative */}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Statement of Grievance Facts</span>
                    <p className="mt-1 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs leading-relaxed text-slate-800 font-normal whitespace-pre-line">
                      {selectedTicket.description}
                    </p>
                  </div>

                  {/* Display existing resolution if already recorded */}
                  {selectedTicket.resolutionRemarks && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-1">
                      <div className="flex items-center justify-between text-emerald-900 font-black text-xs">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          Official Administrative Resolution
                        </span>
                        {selectedTicket.resolvedAt && (
                          <span className="text-[10px] font-semibold text-emerald-700">
                            {formatDateTime(selectedTicket.resolvedAt)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-800 font-normal leading-relaxed whitespace-pre-line pt-1">
                        {selectedTicket.resolutionRemarks}
                      </p>
                      <p className="text-[10px] font-bold text-emerald-800 pt-1">
                        ✓ Dispatched via registered email to {recipientEmail || 'complainant'}
                      </p>
                    </div>
                  )}

                  {/* Admin Resolution & Official Reply Utility */}
                  {isAdmin && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase tracking-wider text-[#12335f] flex items-center gap-1.5">
                          <ShieldCheck className="h-4 w-4 text-blue-600" />
                          Admin Resolution &amp; Email Dispatch Utility
                        </span>
                        {recipientEmail && (
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                            Email Alert Active
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                        Selecting a resolution status and providing official remarks will record the decision and automatically transmit an official resolution email directly to{' '}
                        <strong className="text-blue-900 font-mono">{recipientEmail || 'the entered email address'}</strong>.
                      </p>

                      <div className="space-y-2">
                        <label htmlFor="grv-update-status" className="block text-[11px] font-bold text-slate-700">
                          Target Workflow Status <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="grv-update-status"
                          value={newStatus || selectedTicket.status}
                          onChange={e => setNewStatus(e.target.value)}
                          className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 focus:border-[#12335f] outline-none shadow-xs"
                        >
                          <option value="open">Open (Under Review)</option>
                          <option value="in_progress">In Progress (Active Investigation)</option>
                          <option value="waiting_on_user">Waiting on User / Clarification Requested</option>
                          <option value="resolved">Resolved (Redressal Completed)</option>
                          <option value="closed">Closed (Case Concluded)</option>
                          <option value="rejected">Rejected (Ineligible / Unsubstantiated)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                          <label htmlFor="grv-update-remarks">
                            Official Resolution Findings &amp; Email Reply Remarks <span className="text-red-500">*</span>
                          </label>
                          <span className="text-[10px] text-slate-400 font-mono">{statusRemarks.length} / 2000</span>
                        </div>
                        <textarea
                          id="grv-update-remarks"
                          rows={4}
                          value={statusRemarks}
                          onChange={e => setStatusRemarks(e.target.value)}
                          placeholder="Provide detailed statutory findings, actions taken by the Nodal Officer, and resolution notes that will be emailed to the stakeholder..."
                          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-normal text-slate-900 placeholder-slate-400 outline-none focus:border-[#12335f] focus:ring-1 focus:ring-[#12335f] leading-relaxed shadow-xs"
                        />
                      </div>

                      <div className="pt-1 flex items-center justify-end">
                        <Button
                          disabled={updateStatusMutation.isPending || !statusRemarks.trim()}
                          onClick={() => {
                            const statusToSet = newStatus || selectedTicket.status;
                            updateStatusMutation.mutate({
                              id: selectedTicket.id,
                              status: statusToSet,
                              remarks: statusRemarks.trim()
                            });
                          }}
                          className="h-10 bg-[#12335f] hover:bg-[#0b2447] text-white text-xs font-bold px-5 rounded-xl shadow transition active:scale-95"
                        >
                          <Send className="h-3.5 w-3.5 mr-1.5" />
                          <span>{updateStatusMutation.isPending ? 'Sending & Updating...' : 'Save Resolution & Dispatch Email Reply'}</span>
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Comments Thread */}
                  <div className="space-y-2.5 border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Inquiry &amp; Discussion Log
                    </span>
                    <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                      {(!selectedTicket.comments || selectedTicket.comments.length === 0) ? (
                        <p className="text-xs text-slate-400 italic">No notes logged yet.</p>
                      ) : (
                        selectedTicket.comments.map(c => (
                          <div key={c.id} className="rounded-xl bg-slate-50 p-2.5 text-xs border border-slate-200/70">
                            <div className="flex justify-between text-[10px] text-slate-500 font-bold mb-1">
                              <span>{c.author?.name || 'Administrator'}</span>
                              <span>{formatDateTime(c.createdAt)}</span>
                            </div>
                            <p className="text-slate-800 font-normal leading-relaxed">{c.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder="Add response note (dispatches email alert to complainant)..."
                        className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs placeholder-slate-400 outline-none focus:border-[#12335f]"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && commentText.trim() && !addCommentMutation.isPending) {
                            addCommentMutation.mutate({ id: selectedTicket.id, content: commentText.trim() });
                          }
                        }}
                      />
                      <Button
                        disabled={!commentText.trim() || addCommentMutation.isPending}
                        onClick={() => addCommentMutation.mutate({ id: selectedTicket.id, content: commentText.trim() })}
                        className="h-10 bg-slate-900 text-white hover:bg-slate-800 text-xs px-4 rounded-xl"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
