'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
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
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  slaDueAt?: string | null;
  createdAt: string;
  updatedAt: string;
  userId?: number;
  user?: { id: number; name?: string; email?: string; role?: string };
  assignedAdminId?: number | null;
  assignedAdmin?: { id: number; name?: string; email?: string };
  comments?: GrievanceComment[];
}

const PRIORITY_BADGES: Record<string, string> = {
  LOW: 'border-slate-200 bg-slate-100 text-slate-700',
  MEDIUM: 'border-blue-200 bg-blue-50 text-blue-800',
  HIGH: 'border-amber-200 bg-amber-50 text-amber-800',
  URGENT: 'border-red-300 bg-red-50 text-red-800 font-black'
};

const STATUS_BADGES: Record<string, string> = {
  OPEN: 'border-amber-300 bg-amber-50 text-amber-900',
  IN_PROGRESS: 'border-blue-300 bg-blue-50 text-blue-900',
  RESOLVED: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  CLOSED: 'border-slate-200 bg-slate-100 text-slate-700'
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

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['adminGrievances'],
    queryFn: async () => {
      const res = await getApi<GrievanceTicket[]>('/api/grievances');
      return normalizeList<GrievanceTicket>(res);
    },
    staleTime: 30_000
  });

  const tickets = useMemo(() => data || [], [data]);

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, remarks }: { id: number; status: string; remarks?: string }) => {
      return putApi(`/api/grievances/${id}/status`, { status, remarks });
    },
    onSuccess: () => {
      toast.success('Grievance status updated successfully');
      queryClient.invalidateQueries({ queryKey: ['adminGrievances'] });
      setSelectedTicket(null);
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
    onSuccess: () => {
      toast.success('Comment added to grievance ticket');
      queryClient.invalidateQueries({ queryKey: ['adminGrievances'] });
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
      open: tickets.filter(t => t.status === 'OPEN').length,
      inProgress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
      urgent: tickets.filter(t => t.priority === 'URGENT').length,
      resolved: tickets.filter(t => t.status === 'RESOLVED' || t.status === 'CLOSED').length
    };
  }, [tickets]);

  // Filters
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTicket = t.ticketNumber?.toLowerCase().includes(q);
        const matchSubject = t.subject?.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchUser = t.user?.name?.toLowerCase().includes(q) || t.user?.email?.toLowerCase().includes(q);
        if (!matchTicket && !matchSubject && !matchDesc && !matchUser) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, priorityFilter, searchQuery]);

  const { pageItems, page, total, pageSize, setPage, setPageSize } = usePagination(filteredTickets, 10);

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Total Grievances"
          value={counts.total}
          subtext="All stakeholder grievance tickets"
          icon={FileText}
          tone="blue"
          active={statusFilter === ''}
          onClick={() => setStatusFilter('')}
        />
        <KpiCard
          label="Open Tickets"
          value={counts.open}
          subtext="Awaiting initial administrative review"
          icon={AlertTriangle}
          tone="amber"
          active={statusFilter === 'OPEN'}
          onClick={() => setStatusFilter(statusFilter === 'OPEN' ? '' : 'OPEN')}
        />
        <KpiCard
          label="In Progress"
          value={counts.inProgress}
          subtext="Active inquiry or investigation"
          icon={Clock}
          tone="indigo"
          active={statusFilter === 'IN_PROGRESS'}
          onClick={() => setStatusFilter(statusFilter === 'IN_PROGRESS' ? '' : 'IN_PROGRESS')}
        />
        <KpiCard
          label="Urgent Priority"
          value={counts.urgent}
          subtext="SLA critical grievances"
          icon={AlertTriangle}
          tone="red"
          active={priorityFilter === 'URGENT'}
          onClick={() => setPriorityFilter(priorityFilter === 'URGENT' ? '' : 'URGENT')}
        />
        <KpiCard
          label="Resolved / Closed"
          value={counts.resolved}
          subtext="Resolved grievance cases"
          icon={CheckCircle2}
          tone="green"
          active={statusFilter === 'RESOLVED'}
          onClick={() => setStatusFilter(statusFilter === 'RESOLVED' ? '' : 'RESOLVED')}
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
                placeholder="Search ticket #, subject, or submitter..."
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
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
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
                  <option value="URGENT">Urgent</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
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
          <div className={selectedTicket ? 'lg:col-span-6 xl:col-span-7' : 'lg:col-span-12'}>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="divide-y divide-slate-100">
                {pageItems.map(ticket => {
                  const isSelected = selectedTicket?.id === ticket.id;
                  return (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
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
                              PRIORITY_BADGES[ticket.priority] || 'border-slate-200 bg-slate-100 text-slate-700'
                            }`}
                          >
                            {ticket.priority}
                          </span>
                        </div>
                        <span
                          className={`rounded-md border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                            STATUS_BADGES[ticket.status] || 'border-slate-200 bg-slate-100 text-slate-700'
                          }`}
                        >
                          {ticket.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <h3 className="mt-2 text-sm font-black text-slate-900 line-clamp-1">{ticket.subject}</h3>
                      <p className="mt-1 text-xs text-slate-600 line-clamp-2">{ticket.description}</p>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] font-semibold text-slate-500">
                        <span>Submitted by: {ticket.user?.name || ticket.user?.email || `User #${ticket.userId || 'N/A'}`}</span>
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
            <div className="lg:col-span-6 xl:col-span-5 animate-in fade-in duration-200">
              <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 p-4 bg-slate-50">
                  <div>
                    <span className="font-mono text-xs font-black text-[#12335f]">
                      {selectedTicket.ticketNumber || `#GRV-${selectedTicket.id}`}
                    </span>
                    <h2 className="text-sm font-black text-slate-900 mt-0.5">{selectedTicket.subject}</h2>
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
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Priority</span>
                      <p className="mt-0.5 font-bold text-slate-800">{selectedTicket.priority}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current Status</span>
                      <p className="mt-0.5 font-bold text-slate-800">{selectedTicket.status.replace(/_/g, ' ')}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Submitter</span>
                      <p className="mt-0.5 font-bold text-slate-800">
                        {selectedTicket.user?.name || selectedTicket.user?.email || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">SLA Due At</span>
                      <p className="mt-0.5 font-bold text-slate-800">
                        {selectedTicket.slaDueAt ? formatDateTime(selectedTicket.slaDueAt) : 'Standard 48h SLA'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Grievance Description</span>
                    <p className="mt-1 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs leading-relaxed text-slate-700 font-normal">
                      {selectedTicket.description}
                    </p>
                  </div>

                  {/* Admin Status Resolution Controls */}
                  {isAdmin && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 space-y-2.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#12335f]">
                        Admin Resolution Action
                      </span>
                      <div className="flex gap-2">
                        <select
                          value={newStatus || selectedTicket.status}
                          onChange={e => setNewStatus(e.target.value)}
                          className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-800"
                        >
                          <option value="OPEN">Open</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="RESOLVED">Resolved</option>
                          <option value="CLOSED">Closed</option>
                        </select>
                        <Button
                          disabled={updateStatusMutation.isPending}
                          onClick={() => {
                            const statusToSet = newStatus || selectedTicket.status;
                            updateStatusMutation.mutate({
                              id: selectedTicket.id,
                              status: statusToSet,
                              remarks: statusRemarks
                            });
                          }}
                          className="h-9 bg-[#12335f] hover:bg-[#0b2447] text-white text-xs font-bold px-3"
                        >
                          Update Status
                        </Button>
                      </div>
                      <input
                        type="text"
                        value={statusRemarks}
                        onChange={e => setStatusRemarks(e.target.value)}
                        placeholder="Resolution / status change remarks..."
                        className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs placeholder-slate-400 outline-none"
                      />
                    </div>
                  )}

                  {/* Comments Thread */}
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Inquiry & Notes Log
                    </span>
                    <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                      {(!selectedTicket.comments || selectedTicket.comments.length === 0) ? (
                        <p className="text-xs text-slate-400 italic">No notes logged yet.</p>
                      ) : (
                        selectedTicket.comments.map(c => (
                          <div key={c.id} className="rounded-lg bg-slate-50 p-2 text-xs border border-slate-100">
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold mb-1">
                              <span>{c.author?.name || 'Administrator'}</span>
                              <span>{formatDateTime(c.createdAt)}</span>
                            </div>
                            <p className="text-slate-700 font-normal">{c.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <input
                        type="text"
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder="Add response or administrative note..."
                        className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs placeholder-slate-400 outline-none focus:border-[#12335f]"
                        onKeyDown={e => {
                          if (e.key === 'Enter' && commentText.trim()) {
                            addCommentMutation.mutate({ id: selectedTicket.id, content: commentText.trim() });
                          }
                        }}
                      />
                      <Button
                        disabled={!commentText.trim() || addCommentMutation.isPending}
                        onClick={() => addCommentMutation.mutate({ id: selectedTicket.id, content: commentText.trim() })}
                        className="h-9 bg-slate-900 text-white hover:bg-slate-800 text-xs px-3"
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
