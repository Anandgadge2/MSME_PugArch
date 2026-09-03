'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, CalendarClock, ShieldCheck, FileText, Landmark,
  Gavel, CheckCircle2, AlertTriangle, HelpCircle, FileDown,
  Lock, ArrowRight, MessageSquare, ClipboardList, Info, FileUp, Loader2, Eye
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { procurementBidApi } from '../../procurementBid/api';
import type { ProcurementBid } from '../../procurementBid/data';
import { MethodBadge, ProcurementStatusBadge, BuyerTypeBadge } from '../../procurementWizard/components/SourcingWizardComponents';
import { toast } from 'sonner';
import { useAuth } from '../../../hooks/useAuth';
import { ProcurementDetailUnifiedView } from '../../rfq/components/ProcurementDetailUnifiedView';
import { peekApi } from '../../shared/apiClient';

interface PageProps {
  id: string;
}

export default function SellerEventDetailPage({ id }: PageProps) {
  const router = useRouter();
  const { user } = useAuth();
  
  // Instant Cache Hydration: If already visited in this session, render instantly without skeleton flicker
  const cachedBid = useMemo(() => {
    if (!id) return null;
    return peekApi<ProcurementBid>(`/api/procurement-bids/${id}`);
  }, [id]);

  const [bid, setBid] = useState<ProcurementBid | null>(cachedBid);
  const [loading, setLoading] = useState(!cachedBid);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'documents' | 'clarifications' | 'packets'>('overview');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [questionText, setQuestionText] = useState('');

  const myParticipation = useMemo(() => {
    if (!bid || !user) return null;
    return bid.participations?.find((p: any) => Number(p.sellerId) === Number(user.id));
  }, [bid, user]);

  const [nowMs] = useState(() => Date.now());
  const isSubmitted = Boolean(myParticipation && (myParticipation.submissionStatus === 'SUBMITTED' || (myParticipation as any).status === 'SUBMITTED'));
  const isRequiresResubmission = myParticipation?.rejectionReason?.startsWith('REQUIRES_RESUBMISSION');
  const canEditEvent = !['AWARDED', 'CLOSED', 'CANCELLED'].includes(bid?.status || '') && (!bid?.endDate || new Date(bid.endDate).getTime() >= nowMs);

  const loadData = React.useCallback(() => {
    return procurementBidApi.detail(id)
      .then(res => {
        setBid(res);
        setError('');
      })
      .catch(err => {
        setError(err.message || 'Failed to load opportunity details');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Is Two Packet Bid or RFP requiring technical qualification?
  const isTwoPacket = useMemo(() => {
    const method = String(bid?.procurementType || '').toUpperCase();
    return method.includes('TWO_PACKET') || method.includes('TWO PACKET') || method.includes('RFP') || method.includes('SEALED_TENDER');
  }, [bid]);

  // Is financial packet locked?
  const isFinancialLocked = useMemo(() => {
    if (!isTwoPacket) return false;
    // Lock if technical evaluation is not completed or seller has not submitted technical offer
    const isTechPassed = bid?.currentStage === 'Financial Evaluation' || bid?.currentStage === 'Qualified' || bid?.currentStage === 'Awarded';
    return !isTechPassed;
  }, [bid, isTwoPacket]);

  const handleAskQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;

    setSubmittingQuestion(true);
    procurementBidApi.askClarification(id, questionText)
      .then(() => {
        toast.success('Your clarification request was submitted successfully.');
        setQuestionText('');
        loadData();
      })
      .catch((err: any) => {
        toast.error(err.message || 'Failed to submit clarification question');
      })
      .finally(() => {
        setSubmittingQuestion(false);
      });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 lg:px-8">
          {/* Breadcrumb Skeleton */}
          <div className="h-4 w-48 rounded bg-slate-200 animate-pulse" />

          {/* Header Skeleton */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 animate-pulse">
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="h-8 w-28 rounded-lg bg-slate-200" />
            </div>
            <div className="h-8 w-2/3 rounded bg-slate-200" />
            <div className="h-4 w-1/3 rounded bg-slate-200" />
          </div>

          {/* Tabs Bar Skeleton */}
          <div className="flex gap-2 border-b border-slate-200 pb-2 animate-pulse">
            <div className="h-9 w-24 rounded-lg bg-slate-200" />
            <div className="h-9 w-32 rounded-lg bg-slate-200" />
            <div className="h-9 w-36 rounded-lg bg-slate-200" />
            <div className="h-9 w-28 rounded-lg bg-slate-200" />
          </div>

          {/* Body Card Skeleton */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4 animate-pulse">
            <div className="h-32 rounded-lg bg-slate-100" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-16 rounded-lg bg-slate-100" />
              <div className="h-16 rounded-lg bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !bid) {
    return (
      <div className="p-12 text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto" />
        <p className="text-sm font-bold text-rose-600">{error || 'Opportunity details not found'}</p>
        <Button type="button" variant="outline" onClick={() => router.push('/seller/procurement/events')}>
          Back to Bids & Tenders
        </Button>
      </div>
    );
  }

  const participationUrl = bid.sourceModel === 'TENDER' && bid.sourceId 
    ? `/seller/tenders/${bid.sourceId}/bid` 
    : `/bids/${bid.id}`;

  return (
    <ProcurementDetailUnifiedView
      procurementType={bid.procurementType || 'PROCUREMENT'}
      procurementLabel={bid.procurementType || 'Opportunity Detail'}
      id={bid.id}
      displayId={bid.id}
      subject={bid.title}
      status={bid.status || 'OPEN'}
      buyerName={bid.buyer?.name}
      orgName={bid.buyerOrganization?.organizationName || bid.buyer?.name}
      buyer={bid.buyer}
      estimatedValue={bid.estimatedValue}
      deadlineDate={bid.endDate}
      createdAt={bid.startDate || (bid as any).createdAt}
      publishedDate={bid.startDate ? String(bid.startDate) : undefined}
      closingDate={bid.endDate ? String(bid.endDate) : undefined}
      category={bid.category}
      procurementMethod={bid.procurementType}
      deliveryLocation={bid.deliveryLocation}
      description={bid.description}
      payload={bid.technicalPacket || (bid as any).payload || {}}
      documents={(bid.documents || (bid as any).bidDocuments || []).map((d: any, idx: number) => ({
        id: d.id || idx + 1,
        name: d.fileName || d.name || d.documentType || `Document ${idx + 1}`,
        meta: d.documentType || d.meta,
        fileAssetId: d.fileAssetId,
        url: d.fileUrl || d.url,
        required: true,
      }))}
      items={(bid as any).items || bid.technicalPacket?.items || []}
      evaluationMethod={
        [
          bid.technicalPacket?.evaluation?.method,
          bid.technicalPacket?.evaluation?.evaluationMethod,
          bid.technicalPacket?.evaluationMethod,
          bid.technicalPacket?.rules?.evaluationMethod,
          bid.evaluationMethod,
        ].find(c => typeof c === 'string' && c.trim().length > 0 && !['l1', 'l1 basis', 'l1 evaluation'].includes(c.trim().toLowerCase())) ||
        bid.evaluationMethod ||
        'L1 Basis'
      }
      participations={bid.participations || []}
      participantsCount={bid.participantsCount || bid.participations?.length || 0}
      hasSubmittedProposal={isSubmitted}
      ownParticipation={myParticipation}
      emdAmount={bid.emdAmount}
      isEmdRequired={bid.isEmdRequired}
      backRoute="/seller/procurement/events"
      backRouteLabel="Bids & Tenders"
      submitButtonLabel={isSubmitted ? 'View Proposal' : 'Submit Proposal'}
      onSubmitClick={() => router.push(`/bids/${bid.id}/participate`)}
    />
  );
}
