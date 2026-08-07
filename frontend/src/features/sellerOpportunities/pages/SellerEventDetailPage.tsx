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

interface PageProps {
  id: string;
}

export default function SellerEventDetailPage({ id }: PageProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [bid, setBid] = useState<ProcurementBid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'documents' | 'clarifications' | 'packets'>('overview');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [questionText, setQuestionText] = useState('');

  const myParticipation = useMemo(() => {
    if (!bid || !user) return null;
    return bid.participations?.find((p: any) => Number(p.sellerId) === Number(user.id));
  }, [bid, user]);

  const isSubmitted = Boolean(myParticipation && (myParticipation.submissionStatus === 'SUBMITTED' || (myParticipation as any).status === 'SUBMITTED'));
  const isRequiresResubmission = myParticipation?.rejectionReason?.startsWith('REQUIRES_RESUBMISSION');
  const canEditEvent = !['AWARDED', 'CLOSED', 'CANCELLED'].includes(bid?.status || '') && (!bid?.endDate || new Date(bid.endDate).getTime() >= Date.now());

  const loadData = React.useCallback(() => {
    setLoading(true);
    setError('');
    procurementBidApi.detail(id)
      .then(res => {
        setBid(res);
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
      <div className="p-12 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#12335f]" />
        <p className="text-xs font-bold text-slate-500">Fetching opportunity specifications...</p>
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
      evaluationMethod={bid.evaluationMethod || 'L1 Basis'}
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
