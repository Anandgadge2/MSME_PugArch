import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Bell,
  BarChart2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  X,
  Loader2,
  ExternalLink,
  Download,
  HelpCircle,
  Scale,
  UserCheck,
  Building2,
  Mail,
  Phone,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { FocusTrap } from '../ui/FocusTrap';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '../../features/shared/format';
import { cn } from '../../lib/utils';

interface ConsentItem {
  key: string;
  title: string;
  description: string;
  isMandatory: boolean;
  version: string;
  status: 'ACTIVE' | 'WITHDRAWN';
  givenAt: string;
  withdrawnAt?: string | null;
}

const STATUTORY_POLICIES = [
  { label: 'Privacy Policy', file: 'Privacy_Policy_JSG_Smile.pdf', desc: 'Personal data governance, collection, and storage rules' },
  { label: 'Terms & Conditions', file: 'Terms_and_Conditions.pdf', desc: 'General exchange usage terms and conditions' },
  { label: 'Procurement Policy', file: 'Order_Placement_Procurement_Policy.pdf', desc: 'Procurement facilitation and order creation guidelines' },
  { label: 'MSME Supplier Agreement', file: 'MSME_Registration_Supplier_Participation_Agreement.pdf', desc: 'MSME participation and settlement agreement' },
];

export function ConsentManagementCard() {
  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeWithdrawConsent, setActiveWithdrawConsent] = useState<ConsentItem | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchConsents = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/api/consent');
      if (res.ok) {
        const body = await res.json();
        if (body?.data?.consents) {
          setConsents(body.data.consents);
        } else if (body?.consents) {
          setConsents(body.consents);
        }
      }
    } catch (err) {
      console.error('Failed to load consents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConsents();
  }, []);

  const handleConfirmWithdraw = async () => {
    if (!activeWithdrawConsent) return;
    try {
      setIsSubmitting(true);
      const res = await api.post('/api/consent/withdraw', {
        consentKey: activeWithdrawConsent.key,
        reason: withdrawReason.trim() || undefined,
      });
      const body = await res.json().catch(() => null);

      if (res.ok) {
        toast.success(body?.message || body?.data?.message || 'Consent successfully withdrawn');
        setActiveWithdrawConsent(null);
        setWithdrawReason('');
        fetchConsents();
      } else {
        toast.error(body?.message || 'Failed to withdraw consent. Please try again.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to withdraw consent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getConsentIcon = (key: string) => {
    if (key.includes('AADHAAR')) return <ShieldCheck className="h-5 w-5 text-indigo-600" aria-hidden="true" />;
    if (key.includes('ESCROW')) return <FileText className="h-5 w-5 text-blue-600" aria-hidden="true" />;
    if (key.includes('COMMUNICATION')) return <Bell className="h-5 w-5 text-amber-600" aria-hidden="true" />;
    return <BarChart2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />;
  };

  const handleDownload = (filename: string) => {
    const link = document.createElement('a');
    link.href = `/docs/${filename}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Statutory Header Card */}
      <Card className="border-l-4 border-l-[#12335f] border-slate-200 bg-slate-50/50 shadow-xs">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-[#12335f]/10 p-2.5 text-[#12335f] shrink-0">
              <Shield className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  DPDP Privacy &amp; Data Consent Management
                </h3>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800">
                  Digital Personal Data Protection Act 2023 / 2026
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Under Section 6(6) of the DPDP Act, you possess the statutory right as a Data Principal to review and withdraw previously granted data processing consents at any time. Non-essential data processing will cease immediately upon withdrawal.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DPDP Statutory Rights Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="flex items-center gap-2 text-[#12335f]">
            <UserCheck className="h-4 w-4" aria-hidden="true" />
            <h4 className="text-xs font-black uppercase tracking-wide">Right to Access</h4>
          </div>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
            Obtain a summary of personal data being processed and third parties with whom data is shared.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="flex items-center gap-2 text-indigo-600">
            <FileText className="h-4 w-4" aria-hidden="true" />
            <h4 className="text-xs font-black uppercase tracking-wide">Right to Correction</h4>
          </div>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
            Request correction of inaccurate or misleading personal and organizational records at any time.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="flex items-center gap-2 text-amber-600">
            <Scale className="h-4 w-4" aria-hidden="true" />
            <h4 className="text-xs font-black uppercase tracking-wide">Right to Withdraw</h4>
          </div>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
            Withdraw consent as easily as it was given, with immediate cessation of secondary telemetry.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="flex items-center gap-2 text-emerald-600">
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            <h4 className="text-xs font-black uppercase tracking-wide">Right to Grievance</h4>
          </div>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
            Direct statutory escalation channel to the platform Grievance Redressal Officer.
          </p>
        </div>
      </div>

      {/* Consent Items List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Active Processing Consents Ledger</h4>
          <span className="text-[11px] font-bold text-slate-400">Section 6(1) &amp; Section 6(6) Compliant</span>
        </div>

        {isLoading ? (
          <div role="status" aria-busy="true" aria-live="polite" className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <Loader2 className="h-6 w-6 animate-spin text-[#12335f] mx-auto mb-2" aria-hidden="true" />
            <span className="text-xs font-bold text-slate-500">Loading statutory privacy ledger...</span>
          </div>
        ) : consents.length === 0 ? (
          <div role="status" className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-500">
            No active data processing consents on record.
          </div>
        ) : (
          consents.map((item) => {
            const isWithdrawn = item.status === 'WITHDRAWN';
            return (
              <Card key={item.key} className="border-slate-200 bg-white transition hover:shadow-xs">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="rounded-xl bg-slate-100 p-2.5 shrink-0">
                        {getConsentIcon(item.key)}
                      </div>
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900">{item.title}</h4>
                          {item.isMandatory ? (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-700 border border-slate-200">
                              Core Platform
                            </span>
                          ) : (
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-200">
                              Optional
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">{item.description}</p>
                        <div className="flex items-center gap-3 pt-1 text-[10px] font-mono text-slate-400 flex-wrap">
                          <span>Version: {item.version}</span>
                          <span>•</span>
                          <span>Granted: {formatDate(item.givenAt)}</span>
                          {isWithdrawn && item.withdrawnAt && (
                            <>
                              <span>•</span>
                              <span className="text-red-600 font-bold">Withdrawn: {formatDateTime(item.withdrawnAt)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {isWithdrawn ? (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-black text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Consent Withdrawn
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Active Consent
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setActiveWithdrawConsent(item)}
                            className="h-8 text-xs font-black uppercase tracking-wider text-red-600 border-red-200 hover:bg-red-50 rounded-xl"
                            aria-label={`Withdraw consent for ${item.title}`}
                          >
                            Withdraw
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Statutory Policy Library Documents */}
      <div className="p-5 sm:p-6 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#12335f]" aria-hidden="true" />
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">Statutory Policy Documents &amp; Disclosures</h4>
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase">Legal Disclosures</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {STATUTORY_POLICIES.map((p) => (
            <div key={p.file} className="p-3.5 rounded-xl border border-slate-200/80 bg-white flex items-center justify-between gap-3 hover:border-slate-300 transition-colors">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">{p.label}</p>
                <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">{p.desc}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => window.open(`/docs/${p.file}`, '_blank', 'noopener,noreferrer')}
                  className="p-1.5 text-slate-500 hover:text-[#12335f] hover:bg-slate-100 rounded-lg transition-colors"
                  title={`View ${p.label} PDF`}
                  aria-label={`View ${p.label} PDF in new tab`}
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(p.file)}
                  className="p-1.5 text-slate-500 hover:text-[#12335f] hover:bg-slate-100 rounded-lg transition-colors"
                  title={`Download ${p.label} PDF`}
                  aria-label={`Download ${p.label} PDF`}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grievance Redressal Officer Contact Card */}
      <div className="p-5 rounded-2xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Data Protection &amp; Grievance Redressal Officer</h4>
          </div>
          <p className="text-xs text-slate-600 font-medium">
            For data correction, consent withdrawal disputes, or DPDP compliance queries, reach our nodal officer:
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-700 font-bold">
            <span className="inline-flex items-center gap-1.5 text-slate-600"><Mail className="h-3.5 w-3.5 text-[#12335f]" aria-hidden="true" /> grievance@jsgsmile.in</span>
            <span className="inline-flex items-center gap-1.5 text-slate-600"><Phone className="h-3.5 w-3.5 text-[#12335f]" aria-hidden="true" /> 1800-120-MSME (Mon-Fri 9:00 AM - 6:00 PM IST)</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="inline-block bg-slate-100 text-slate-600 border border-slate-200 rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-wider">
            SLA: 7 Business Days
          </span>
        </div>
      </div>

      {/* Confirmation Modal with FocusTrap for WCAG 2.1 AA */}
      {activeWithdrawConsent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdraw-dialog-title"
        >
          <FocusTrap onEscape={() => setActiveWithdrawConsent(null)} className="w-full max-w-md">
            <div className="w-full overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200">
              <header className="flex items-center justify-between border-b border-slate-100 bg-red-50 px-5 py-4">
                <div className="flex items-center gap-2 text-red-800">
                  <ShieldAlert className="h-5 w-5 text-red-600" aria-hidden="true" />
                  <h3 id="withdraw-dialog-title" className="text-sm font-black uppercase tracking-wider">
                    Confirm Consent Withdrawal
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveWithdrawConsent(null)}
                  className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </header>

              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-700 leading-relaxed">
                  You are about to withdraw statutory consent for: <br />
                  <strong className="text-slate-900">{activeWithdrawConsent.title}</strong>
                </p>

                {activeWithdrawConsent.isMandatory && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 leading-relaxed space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                      Important Consideration:
                    </p>
                    <p>
                      Withdrawing this core platform consent may restrict associated transactional operations (such as participating in tenders, placing purchase orders, or generating escrow invoices).
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="withdraw-reason" className="block text-xs font-bold text-slate-700">
                    Reason for withdrawal (Optional)
                  </label>
                  <textarea
                    id="withdraw-reason"
                    rows={3}
                    value={withdrawReason}
                    onChange={(e) => setWithdrawReason(e.target.value)}
                    placeholder="Provide context for our statutory compliance ledger..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 resize-none font-medium text-slate-800"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveWithdrawConsent(null)}
                    disabled={isSubmitting}
                    className="rounded-xl font-bold uppercase text-xs tracking-wider"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmWithdraw}
                    disabled={isSubmitting}
                    className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-black uppercase text-xs tracking-wider"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" aria-hidden="true" /> : null}
                    Confirm Withdrawal
                  </Button>
                </div>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </div>
  );
}
