'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Building2,
  FileText,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { getApi, postApi } from '../../shared/apiClient';
import { formatCurrency, formatDate } from '../../shared/format';

export interface PbgManagementCardProps {
  purchaseOrderId: number;
  poAmount: number;
  isBuyer: boolean;
  isSeller: boolean;
  isAdmin: boolean;
  onRefresh?: () => void;
}

export function PbgManagementCard({
  purchaseOrderId,
  poAmount,
  isBuyer,
  isSeller,
  isAdmin,
  onRefresh
}: PbgManagementCardProps) {
  const [loading, setLoading] = useState(true);
  const [pbgData, setPbgData] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states for seller submission
  const [selectedType, setSelectedType] = useState<'BANK_GUARANTEE' | 'FDR_PLEDGE' | 'RETENTION_DEDUCTION'>('BANK_GUARANTEE');
  const [bankName, setBankName] = useState('');
  const [bgNumber, setBgNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const fetchPbg = async () => {
    try {
      setLoading(true);
      const res: any = await getApi(`/pbg/purchase-orders/${purchaseOrderId}`);
      if (res?.data) {
        setPbgData(res.data);
      }
    } catch (err: any) {
      console.warn('Failed to load PBG record:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (purchaseOrderId) {
      fetchPbg();
    }
  }, [purchaseOrderId]);

  const pbg = pbgData?.performanceGuarantee;
  const pbgAmount = pbg?.amount || Math.round((poAmount * 0.03) * 100) / 100;

  const handleSellerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await postApi(`/pbg/purchase-orders/${purchaseOrderId}/submit`, {
        type: selectedType,
        percentage: selectedType === 'RETENTION_DEDUCTION' ? 5.0 : 3.0,
        bankName: selectedType === 'RETENTION_DEDUCTION' ? 'District Escrow (Retention Holdback)' : bankName,
        bgNumber: selectedType === 'RETENTION_DEDUCTION' ? undefined : bgNumber,
        expiryDate: selectedType === 'RETENTION_DEDUCTION' ? undefined : expiryDate
      });

      toast.success(
        selectedType === 'RETENTION_DEDUCTION'
          ? '5% MSME Retention Money deduction mode activated successfully.'
          : 'Performance Bank Guarantee submitted for Maker-Checker verification.'
      );
      fetchPbg();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit performance security');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMakerReview = async (approved: boolean) => {
    if (!pbg?.id) return;
    try {
      setSubmitting(true);
      await postApi(`/pbg/${pbg.id}/maker-review`, {
        approved,
        remarks: approved ? 'Document verified by Procurement Officer' : 'Clarification requested'
      });
      toast.success(approved ? 'Maker review approved. Forwarded to Finance Checker.' : 'Returned to seller for revision.');
      fetchPbg();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record maker review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckerApprove = async (approved: boolean) => {
    if (!pbg?.id) return;
    try {
      setSubmitting(true);
      await postApi(`/pbg/${pbg.id}/checker-approve`, {
        approved,
        twoFactorVerified: true,
        remarks: approved ? 'Approved by District Finance Checker' : 'Rejected by Checker'
      });
      toast.success(approved ? 'PBG Verified & Active (GFR 171 Compliant).' : 'Rejected by Checker.');
      fetchPbg();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to complete checker approval');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRelease = async () => {
    if (!pbg?.id) return;
    try {
      setSubmitting(true);
      await postApi(`/pbg/${pbg.id}/release`, {
        remarks: 'Contract & warranty obligations successfully fulfilled.'
      });
      toast.success('Performance Security discharged and released.');
      fetchPbg();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to release PBG');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-xl border border-slate-200">
        <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
        <span className="text-xs font-semibold text-slate-600">Verifying GFR 171 Security Compliance...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" role="region" aria-label="Performance Bank Guarantee Status">
      {/* Header */}
      <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Performance Security & PBG (GFR 2017 Rule 171)</h3>
            <p className="text-xs text-slate-500">Statutory 3%–5% contract performance assurance for orders &gt; ₹5,00,000</p>
          </div>
        </div>

        <div>
          {pbg?.status === 'VERIFIED_ACTIVE' && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Verified & Active
            </span>
          )}
          {pbg?.status === 'SUBMITTED_FOR_VERIFICATION' && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
              <AlertCircle className="w-3.5 h-3.5 mr-1" />
              Maker-Checker Verification
            </span>
          )}
          {(!pbg || pbg?.status === 'PENDING_SUBMISSION') && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
              <ShieldAlert className="w-3.5 h-3.5 mr-1" />
              Pending Submission
            </span>
          )}
          {pbg?.status === 'RELEASED_COMPLETED' && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
              <Lock className="w-3.5 h-3.5 mr-1" />
              Discharged & Released
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Active PBG Display */}
        {pbg ? (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 font-medium">Security Mode:</span>
                <p className="font-bold text-slate-800 mt-0.5">
                  {pbg.type === 'RETENTION_DEDUCTION'
                    ? '5% MSME Retention Money'
                    : pbg.type === 'FDR_PLEDGE'
                    ? 'FDR Pledged to DIC'
                    : 'Bank Guarantee (e-PBG)'}
                </p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Guaranteed Amount:</span>
                <p className="font-bold text-slate-900 mt-0.5">{formatCurrency(pbg.amount)}</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Bank / Reference:</span>
                <p className="font-semibold text-slate-800 mt-0.5">{pbg.bgNumber || 'Retention Holdback'}</p>
              </div>
              <div>
                <span className="text-slate-500 font-medium">GFR Claim Expiry (+60d):</span>
                <p className="font-bold text-slate-800 mt-0.5">
                  {pbg.claimExpiryDate ? formatDate(pbg.claimExpiryDate) : 'Until Final Warranty'}
                </p>
              </div>
            </div>

            {/* Maker-Checker Workflow Actions for Buyer / Admin */}
            {(isBuyer || isAdmin) && pbg.status === 'SUBMITTED_FOR_VERIFICATION' && (
              <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-600 font-medium">
                  {pbg.makerReviewerId ? 'Maker verified. Pending Checker dual-authorization.' : 'Review submitted guarantee documents:'}
                </span>
                <div className="flex gap-2">
                  {!pbg.makerReviewerId ? (
                    <>
                      <Button size="sm" variant="outline" disabled={submitting} onClick={() => handleMakerReview(false)}>
                        Request Revision
                      </Button>
                      <Button size="sm" disabled={submitting} onClick={() => handleMakerReview(true)}>
                        Verify as Maker
                      </Button>
                    </>
                  ) : isAdmin ? (
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={submitting} onClick={() => handleCheckerApprove(true)}>
                      Checker Approve (2FA)
                    </Button>
                  ) : (
                    <span className="text-xs font-bold text-amber-700">Awaiting Finance Checker Sign-off</span>
                  )}
                </div>
              </div>
            )}

            {/* Release Action */}
            {(isBuyer || isAdmin) && pbg.status === 'VERIFIED_ACTIVE' && (
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500">Discharge upon verified completion of 12/24-month warranty:</span>
                <Button size="sm" variant="outline" disabled={submitting} onClick={handleRelease}>
                  Discharge & Release Security
                </Button>
              </div>
            )}
          </div>
        ) : isSeller ? (
          /* Submission Form for Seller */
          <form onSubmit={handleSellerSubmit} className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
              <strong>Mandatory Compliance Notice:</strong> Per GFR 2017 Rule 171, this Purchase Order requires Performance Security within 15 days of order issuance.
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Choose Security Compliance Mode:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedType('BANK_GUARANTEE')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedType === 'BANK_GUARANTEE'
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">Option 1: Bank Guarantee / e-PBG</p>
                  <p className="text-[11px] text-slate-500 mt-1">Upload BG / FDR document from scheduled commercial bank (3%).</p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedType('RETENTION_DEDUCTION')}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedType === 'RETENTION_DEDUCTION'
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">Option 2: 5% MSME Retention Money</p>
                  <p className="text-[11px] text-slate-500 mt-1">Recommended for rural SHGs & Micro-units. Auto-deducted from invoice escrow.</p>
                </button>
              </div>
            </div>

            {selectedType !== 'RETENTION_DEDUCTION' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="pbg-bank-name" className="text-xs font-semibold text-slate-700 block mb-1">Issuing Bank *</label>
                  <input
                    id="pbg-bank-name"
                    type="text"
                    required
                    placeholder="e.g. State Bank of India"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="pbg-number" className="text-xs font-semibold text-slate-700 block mb-1">BG / FDR Reference No. *</label>
                  <input
                    id="pbg-number"
                    type="text"
                    required
                    placeholder="e.g. 00012BG2026"
                    value={bgNumber}
                    onChange={(e) => setBgNumber(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="pbg-expiry" className="text-xs font-semibold text-slate-700 block mb-1">Guarantee Expiry Date *</label>
                  <input
                    id="pbg-expiry"
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Performance Security ({formatCurrency(selectedType === 'RETENTION_DEDUCTION' ? poAmount * 0.05 : pbgAmount)})
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-xs text-slate-500 py-2">
            Awaiting performance guarantee submission from awarded seller (Statutory 15-day window).
          </div>
        )}
      </div>
    </div>
  );
}
