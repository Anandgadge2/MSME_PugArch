import React, { useState, useEffect } from 'react';
import { Shield, ShieldAlert, ShieldCheck, FileText, Bell, BarChart2, AlertTriangle, CheckCircle2, Clock, X, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { FocusTrap } from '../ui/FocusTrap';
import { api } from '../../lib/api';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '../../features/shared/format';

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

export function ConsentManagementCard() {
  const [consents, setConsents] = useState<ConsentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeWithdrawConsent, setActiveWithdrawConsent] = useState<ConsentItem | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchConsents = async () => {
    try {
      setIsLoading(true);
      const res: any = await api.get('/api/consent');
      if (res?.consents) {
        setConsents(res.consents);
      } else if (res?.data?.consents) {
        setConsents(res.data.consents);
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
      const res: any = await api.post('/api/consent/withdraw', {
        consentKey: activeWithdrawConsent.key,
        reason: withdrawReason.trim() || undefined,
      });

      toast.success(res?.message || 'Consent successfully withdrawn');
      setActiveWithdrawConsent(null);
      setWithdrawReason('');
      fetchConsents();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to withdraw consent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getConsentIcon = (key: string) => {
    if (key.includes('AADHAAR')) return <ShieldCheck className="h-5 w-5 text-indigo-600" />;
    if (key.includes('ESCROW')) return <FileText className="h-5 w-5 text-blue-600" />;
    if (key.includes('COMMUNICATION')) return <Bell className="h-5 w-5 text-amber-600" />;
    return <BarChart2 className="h-5 w-5 text-emerald-600" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Statutory Header Card */}
      <Card className="border-l-4 border-l-[#12335f] border-slate-200 bg-slate-50/50 shadow-xs">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-[#12335f]/10 p-2.5 text-[#12335f] shrink-0">
              <Shield className="h-6 w-6" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  DPDP Privacy & Data Consent Management
                </h3>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800">
                  Digital Personal Data Protection Act 2023 / 2026
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Under Section 6(6) of the DPDP Act, you possess the statutory right to review and withdraw previously granted data processing consents at any time. Non-essential data processing will cease immediately upon withdrawal.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consent Items List */}
      <div className="space-y-4">
        {isLoading ? (
          <div role="status" aria-busy="true" aria-live="polite" className="p-8 text-center bg-white rounded-xl border border-slate-200">
            <Loader2 className="h-6 w-6 animate-spin text-[#12335f] mx-auto mb-2" />
            <span className="text-xs font-bold text-slate-500">Loading privacy ledger...</span>
          </div>
        ) : consents.length === 0 ? (
          <div role="status" className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-500">
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
                      <div className="rounded-lg bg-slate-100 p-2 shrink-0">
                        {getConsentIcon(item.key)}
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900">{item.title}</h4>
                          {item.isMandatory ? (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-600">
                              Core Platform
                            </span>
                          ) : (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                              Optional
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
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
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" /> Consent Withdrawn
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Active Consent
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setActiveWithdrawConsent(item)}
                            className="h-8 text-xs font-bold text-red-600 border-red-200 hover:bg-red-50"
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

      {/* Confirmation Modal */}
      {activeWithdrawConsent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdraw-dialog-title"
        >
          <FocusTrap onEscape={() => setActiveWithdrawConsent(null)} className="w-full max-w-md">
            <div className="w-full overflow-hidden rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
              <header className="flex items-center justify-between border-b border-slate-100 bg-red-50 px-5 py-4">
                <div className="flex items-center gap-2 text-red-800">
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                  <h3 id="withdraw-dialog-title" className="text-sm font-black uppercase tracking-wider">
                    Confirm Consent Withdrawal
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveWithdrawConsent(null)}
                  className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-slate-600"
                  aria-label="Close dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-700 leading-relaxed">
                  You are about to withdraw statutory consent for: <br />
                  <strong className="text-slate-900">{activeWithdrawConsent.title}</strong>
                </p>

                {activeWithdrawConsent.isMandatory && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 leading-relaxed">
                    <p className="font-bold mb-1">Important Consideration:</p>
                    Withdrawing this core platform consent may restrict associated transactional operations (such as participating in tenders or generating escrow invoices).
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
                    placeholder="Provide context for our compliance ledger..."
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-xs outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveWithdrawConsent(null)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmWithdraw}
                    disabled={isSubmitting}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
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
