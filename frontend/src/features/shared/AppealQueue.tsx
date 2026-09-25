import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  ExternalLink,
  Building2,
  ShieldAlert,
  Search,
  Filter,
  Users,
  MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';

interface OrganizationAppeal {
  id: number;
  organizationName: string;
  gstin: string | null;
  panNumber: string | null;
  organizationType: string | null;
  district: string | null;
  state: string | null;
  verificationStatus: string;
  isBlacklisted: boolean;
  blacklistReason: string | null;
  blacklistedAt: string | null;
  suspensionType: 'MANUAL' | 'AUTO_DISPUTE' | 'AUTO_KYC_EXPIRED' | null;
  appealStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  appealMessage: string | null;
  appealDocumentUrl: string | null;
  appealSubmittedAt: string | null;
  appealCount: number;
  appealReviewedAt: string | null;
  appealRejectionReason: string | null;
  appealReviewedByUserId: number | null;
  _count?: {
    users: number;
    disputesAgainst: number;
  };
  users?: Array<{
    id: number;
    name: string;
    email: string;
    mobile?: string;
    role: string;
  }>;
}

interface AppealQueueProps {
  authHeaders: Record<string, string>;
  title?: string;
  districtScoped?: boolean;
}

export function AppealQueue({
  authHeaders,
  title = 'Suspension Appeals Review Desk',
  districtScoped = false
}: AppealQueueProps) {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<'PENDING' | 'REJECTED' | 'all'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State for Verdict
  const [selectedOrg, setSelectedOrg] = useState<OrganizationAppeal | null>(null);
  const [verdictAction, setVerdictAction] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: appeals = [], isLoading, refetch } = useQuery<OrganizationAppeal[]>({
    queryKey: ['admin-appeals', filterStatus],
    queryFn: async () => {
      const res = await api.fetch(
        `/api/admin/organizations/appeals?status=${filterStatus}`,
        { headers: authHeaders }
      );
      if (!res.ok) throw new Error('Failed to load appeals');
      const json = await res.json();
      return json.data || [];
    },
    staleTime: 30_000
  });

  const filteredAppeals = appeals.filter(a => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.organizationName?.toLowerCase().includes(q) ||
      a.gstin?.toLowerCase().includes(q) ||
      a.district?.toLowerCase().includes(q)
    );
  });

  const openVerdictModal = (org: OrganizationAppeal, verdict: 'APPROVED' | 'REJECTED') => {
    setSelectedOrg(org);
    setVerdictAction(verdict);
    setAdminRemarks(verdict === 'APPROVED' ? 'Approved upon administrative verification and remediation.' : '');
  };

  const closeVerdictModal = () => {
    setSelectedOrg(null);
    setVerdictAction(null);
    setAdminRemarks('');
  };

  const submitVerdict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg || !verdictAction) return;

    const trimmedRemarks = adminRemarks.trim();
    if (trimmedRemarks.length < 5) {
      toast.error('Admin remarks must be at least 5 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.fetch(
        `/api/admin/organizations/${selectedOrg.id}/appeal/resolve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders
          },
          body: JSON.stringify({
            verdict: verdictAction,
            adminRemarks: trimmedRemarks
          })
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to resolve appeal');
      }

      toast.success(
        verdictAction === 'APPROVED'
          ? `${selectedOrg.organizationName} has been reinstated successfully.`
          : `Appeal for ${selectedOrg.organizationName} has been rejected.`
      );

      closeVerdictModal();
      refetch();
      queryClient.invalidateQueries({ queryKey: ['admin-appeals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit determination.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      role="region"
      aria-label="Suspension Appeals Queue"
      className="space-y-6"
    >
      {/* Header & Filter Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {districtScoped && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-800">
                District Scoped
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Review formal representations and make reinstatement determinations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Sub-Filters */}
          {(['PENDING', 'REJECTED', 'all'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilterStatus(st)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                filterStatus === st
                  ? 'bg-[#0c2340] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'PENDING' ? 'Pending Review' : st === 'REJECTED' ? 'Rejected' : 'All Records'}
            </button>
          ))}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          type="search"
          placeholder="Filter by organization, GSTIN, or district..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0c2340] focus:ring-1 focus:ring-[#0c2340] outline-none"
        />
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-slate-100 animate-pulse border border-slate-200" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredAppeals.length === 0 && (
        <Card className="rounded-2xl border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-sm font-bold text-slate-900">
            No Appeals Found
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
            {filterStatus === 'PENDING'
              ? 'There are no pending suspension appeals requiring review at this time.'
              : 'No organization appeal records match the specified query.'}
          </p>
        </Card>
      )}

      {/* Appeals List */}
      {!isLoading && filteredAppeals.length > 0 && (
        <div className="space-y-4" role="feed" aria-label="Appeals Feed">
          {filteredAppeals.map((org) => {
            const isPending = org.appealStatus === 'PENDING';
            const isAutoDispute = org.suspensionType === 'AUTO_DISPUTE';

            return (
              <Card
                key={org.id}
                className={`overflow-hidden rounded-2xl border transition hover:shadow-md ${
                  isPending
                    ? 'border-amber-200 bg-amber-50/10'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="p-6">
                  {/* Top Bar: Title, Badges, District */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base text-slate-950">
                          {org.organizationName}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            isPending
                              ? 'bg-amber-100 text-amber-900'
                              : org.appealStatus === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-red-100 text-red-900'
                          }`}
                        >
                          {org.appealStatus === 'PENDING'
                            ? 'Pending Determination'
                            : `Appeal ${org.appealStatus}`}
                        </span>

                        {isAutoDispute && (
                          <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-900">
                            Auto-Suspension (Disputes)
                          </span>
                        )}

                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          Attempt {org.appealCount} / 2
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        {org.gstin && (
                          <span>
                            GSTIN: <strong className="font-mono text-slate-700">{org.gstin}</strong>
                          </span>
                        )}
                        {org.panNumber && (
                          <span>
                            PAN: <strong className="font-mono text-slate-700">{org.panNumber}</strong>
                          </span>
                        )}
                        <span>District: <strong className="text-slate-700">{org.district || 'Unassigned'}</strong></span>
                        <span>State: <strong className="text-slate-700">{org.state || 'India'}</strong></span>
                        {org._count && (
                          <span>
                            Critical Disputes: <strong className="text-red-700">{org._count.disputesAgainst}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons for Pending Appeals */}
                    {isPending && (
                      <div className="flex items-center gap-2 self-start">
                        <Button
                          type="button"
                          onClick={() => openVerdictModal(org, 'APPROVED')}
                          className="h-9 rounded-xl bg-emerald-700 px-4 text-xs font-bold uppercase tracking-wide text-white hover:bg-emerald-800 shadow-sm"
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Approve &amp; Reinstate
                        </Button>
                        <Button
                          type="button"
                          onClick={() => openVerdictModal(org, 'REJECTED')}
                          className="h-9 rounded-xl border border-red-300 bg-white px-4 text-xs font-bold uppercase tracking-wide text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                          Reject Appeal
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Suspension & Appeal Body Details */}
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {/* Left: Original Suspension Reason */}
                    <div className="rounded-xl border border-red-100 bg-red-50/40 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-red-900">
                        Original Suspension Reason
                      </p>
                      <p className="mt-1 text-xs text-slate-800 leading-relaxed font-medium">
                        {org.blacklistReason || 'Restricted by platform administration.'}
                      </p>
                      {org.blacklistedAt && (
                        <p className="mt-2 text-[10px] text-slate-500">
                          Suspended on:{' '}
                          {new Date(org.blacklistedAt).toLocaleDateString('en-IN', {
                            dateStyle: 'medium'
                          })}
                        </p>
                      )}
                    </div>

                    {/* Right: Organization's Submitted Representation */}
                    <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#0c2340]">
                        Organization Representation / Clarification
                      </p>
                      <p className="mt-1 text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                        {org.appealMessage || 'No written statement provided.'}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        {org.appealSubmittedAt && (
                          <p className="text-[10px] text-slate-500">
                            Submitted on:{' '}
                            {new Date(org.appealSubmittedAt).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </p>
                        )}

                        {org.appealDocumentUrl && (
                          <a
                            href={org.appealDocumentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0c2340] hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                            View Attached Remediation Proof
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Previous Rejection Reason (if any) */}
                  {org.appealRejectionReason && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                      <span className="font-bold text-red-900">Prior Rejection Remarks:</span>{' '}
                      {org.appealRejectionReason}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Verdict Dialog / Modal */}
      {selectedOrg && verdictAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="verdict-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <h3
                  id="verdict-dialog-title"
                  className="text-base font-bold text-slate-900"
                >
                  {verdictAction === 'APPROVED' ? 'Approve & Reinstate Organization' : 'Reject Suspension Appeal'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedOrg.organizationName} ({selectedOrg.gstin || selectedOrg.district || 'Portal Record'})
                </p>
              </div>
              <button
                type="button"
                onClick={closeVerdictModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close dialog"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitVerdict} className="mt-4 space-y-4">
              <div
                className={`rounded-xl p-3.5 text-xs ${
                  verdictAction === 'APPROVED'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border border-red-200 bg-red-50 text-red-900'
                }`}
              >
                {verdictAction === 'APPROVED' ? (
                  <p>
                    <strong>Reinstatement Notice:</strong> Approving this appeal will lift the restriction immediately, set verification status to Verified, and restore full procurement access.
                  </p>
                ) : (
                  <p>
                    <strong>Rejection Notice:</strong> Rejecting will maintain the organization suspension. If this was their 2nd attempt, the portal appeals mechanism will lock.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="verdict-remarks"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
                >
                  Official Administrative Remarks <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="verdict-remarks"
                  required
                  rows={3}
                  minLength={5}
                  maxLength={1000}
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  placeholder="Record justification, settlement verification, or grounds for refusal..."
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0c2340] focus:ring-1 focus:ring-[#0c2340] outline-none"
                />
                <span className="mt-1 block text-[10px] text-slate-400">
                  Minimum 5 characters. This statement is recorded in the permanent audit trail and communicated to the organization.
                </span>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  onClick={closeVerdictModal}
                  className="h-9 rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || adminRemarks.trim().length < 5}
                  className={`h-9 rounded-xl px-5 text-xs font-bold uppercase tracking-wider text-white ${
                    verdictAction === 'APPROVED'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-red-700 hover:bg-red-800'
                  }`}
                >
                  {isSubmitting
                    ? 'Recording...'
                    : verdictAction === 'APPROVED'
                    ? 'Confirm Reinstatement'
                    : 'Confirm Rejection'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
