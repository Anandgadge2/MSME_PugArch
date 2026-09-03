'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui/button';
import { getApi } from '../../shared/apiClient';
import { procurementBidApi } from '../../procurementBid/api';
import { ProcurementDetailUnifiedView } from '../components/ProcurementDetailUnifiedView';
import RfqDetailPage from './RfqDetailPage';
import { toast } from 'sonner';

function formatDateString(dateVal?: string | Date | null, includeTime: boolean = false) {
  if (!dateVal) return undefined;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  if (includeTime) {
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function firstPresent<T = any>(...values: T[]): T | undefined {
  return values.find(v => v !== undefined && v !== null && v !== '');
}

export default function RfpDetailPage({ initialData }: { initialData?: any } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || '';
  const { user } = useAuth();
  const currentUser: any = user;

  const explicitReqId = searchParams?.get('requirementId') || '';
  const explicitRequestId = searchParams?.get('requestId') || searchParams?.get('bidId') || '';
  const rawIdParam = searchParams?.get('id') || '';

  const pathTokens = pathname.split('/').filter(Boolean);
  const rawPathId = pathTokens.length >= 2 ? pathTokens[pathTokens.length - 1] : '';
  const pathnameId = (rawPathId && !['rfp', 'bids', 'rfqs', 'details'].includes(rawPathId.toLowerCase())) ? rawPathId : '';

  const activeId = explicitReqId || explicitRequestId || rawIdParam || pathnameId;
  const requestId = explicitRequestId || (activeId.startsWith('REQ-') ? '' : activeId);
  const requirementId = explicitReqId || (activeId.startsWith('REQ-') ? activeId : '');
  const fallbackReqId = activeId;

  const isMatchingInitial = Boolean(
    initialData && activeId && (
      String(initialData.id).toLowerCase() === String(activeId).toLowerCase() ||
      String(initialData.requirementNumber || '').toLowerCase() === String(activeId).toLowerCase() ||
      String(initialData.bidNumber || '').toLowerCase() === String(activeId).toLowerCase() ||
      String(initialData.displayId || '').toLowerCase() === String(activeId).toLowerCase()
    )
  );

  const { data: bidData, isLoading: isBidLoading, error: bidError } = useQuery({
    queryKey: ['rfp-bid-detail', requestId || activeId],
    queryFn: () => procurementBidApi.detail((requestId || activeId)!),
    enabled: !!(requestId || activeId),
    initialData: isMatchingInitial && (initialData?.sourceModel === 'BID' || initialData?.bidNumber) ? initialData : undefined,
    staleTime: 60_000,
  });

  const targetReqId = requirementId || (bidData as any)?.sourceId || (bidData as any)?.requirementId || fallbackReqId;

  const { data: reqData, isLoading: isReqLoading, error: reqError } = useQuery({
    queryKey: ['rfp-req-detail', targetReqId],
    queryFn: async () => {
      try {
        const res2 = await getApi<any>(`/api/marketplace/requirements/${targetReqId}`);
        if (res2) return res2.data || res2;
      } catch {}
      try {
        const res = await getApi<any>(`/api/requirements/${targetReqId}`);
        if (res) return res.data || res;
      } catch {}
      return null;
    },
    enabled: !!targetReqId && (!bidData || !(bidData as any).items?.length),
    initialData: isMatchingInitial && (initialData?.title || initialData?.requirement) ? initialData : undefined,
    staleTime: 60_000,
  });

  const isLoading = !initialData && !bidData && !reqData && (isBidLoading || isReqLoading);
  const bid: any = bidData || {};
  const reqObj: any = reqData || {};
  const payload = bid.technicalPacket || bid.payload || reqObj.payload || {};
  const basics = payload.basics || {};
  const schedule = payload.schedule || {};
  const terms = payload.terms || {};
  const tender = payload.tender || {};
  const rules = payload.rules || {};
  const evaluation = payload.evaluation || {};
  const serviceDetails = payload.serviceDetails || {};

  if (isLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#12335f]" />
        <p className="text-sm font-bold text-slate-500">Loading RFP details...</p>
      </div>
    );
  }

  const hasFatalError = !bidData && !reqData;
  if (hasFatalError) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-black text-slate-950">RFP unavailable</h1>
        <p className="max-w-md text-sm font-semibold leading-relaxed text-slate-500">
          {(bidError as Error)?.message || (reqError as Error)?.message || 'The requested RFP record could not be loaded.'}
        </p>
        <Button type="button" variant="outline" onClick={() => router.back()} className="mt-1">
          <ArrowLeft className="h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  const title = bid.title || bid.subject || reqObj.title || basics.title || 'Request for Proposal';
  const rfpNumber = bid.bidNumber || bid.referenceNumber || reqObj.requirementNumber || bid.id || `RFP-${requestId}`;

  const methodUpper = String(
    bid.procurementType ||
    bid.bidType ||
    bid.procurementMethod ||
    bid.sourcingMethod ||
    reqObj.procurementMethod ||
    reqObj.type ||
    searchParams?.get('type') ||
    ''
  ).toUpperCase();
  const descUpper = String(bid.description || reqObj.description || basics.description || '').toUpperCase();
  const titleUpper = String(bid.title || reqObj.title || basics.title || '').toUpperCase();

  const isActuallyRfq =
    methodUpper.includes('RFQ') ||
    methodUpper.includes('QUOTATION') ||
    titleUpper.includes('RFQ') ||
    titleUpper.includes('REQUEST FOR QUOTATION') ||
    descUpper.includes('SOURCING METHOD: RFQ') ||
    descUpper.includes('METHOD: RFQ') ||
    String(rfpNumber).toUpperCase().startsWith('RFQ-');

  if (isActuallyRfq && !methodUpper.includes('RFP')) {
    return <RfqDetailPage initialData={initialData || bidData || reqData} />;
  }

  const participationsList = bid.participations || reqObj.participations || reqObj.responses || [];

  const ownParticipation = participationsList.find(
    (p: any) =>
      p?.supplierId === currentUser?.id ||
      p?.sellerId === currentUser?.id ||
      p?.vendorId === currentUser?.id ||
      p?.sellerOrgId === currentUser?.organizationId ||
      p?.organizationId === currentUser?.organizationId
  );
  const ownResponse = ownParticipation?.response || ownParticipation?.quotation || ownParticipation?.proposal;
  const hasSubmittedProposal = Boolean(ownParticipation || ownResponse);

  const handleSubmitProposal = () => {
    if (!currentUser) {
      toast.error('Please login to participate and submit your proposal.');
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    const targetBidId = firstPresent(
      requestId,
      payload.linkedProcurementBidId,
      bid.id,
      requirementId
    );
    if (!targetBidId) {
      toast.error('Unable to locate the participation record for this RFP.');
      return;
    }
    router.push(`/seller/procurement/rfp/${targetBidId}/respond`);
  };

  const isBuyerOrAdmin = currentUser?.role === 'buyer' || currentUser?.role === 'admin';

  return (
    <ProcurementDetailUnifiedView
      procurementType="RFP"
      procurementLabel="Request for Proposal"
      id={bid.id || reqObj.id || requestId || 'RFP'}
      displayId={rfpNumber}
      subject={title}
      status={bid.status || reqObj.status || 'OPEN'}
      buyerName={bid.buyerName || reqObj.contactPerson || reqObj.buyer?.name}
      orgName={bid.buyerOrganizationName || reqObj.buyerOrganization?.organizationName || reqObj.organization?.organizationName}
      buyer={{
        name: bid.buyerName || reqObj.contactPerson || reqObj.buyer?.name || 'Buyer',
        email: bid.buyerEmail || reqObj.buyerEmail || reqObj.buyer?.email || '',
        mobile: bid.buyerMobile || reqObj.buyerMobile || reqObj.buyer?.mobile || '',
        buyerProfile: bid.buyerOrganization || reqObj.buyerOrganization || reqObj.organization,
      }}
      estimatedValue={bid.estimatedValue || reqObj.estimatedValue || basics.estimatedValue}
      deadlineDate={bid.endDate || reqObj.lastDate || schedule.submissionDate || schedule.submissionDeadline}
      createdAt={bid.startDate || bid.createdAt || reqObj.createdAt}
      publishedDate={formatDateString(schedule.publishDate || schedule.publishedDate || bid.startDate || reqObj.createdAt)}
      closingDate={formatDateString(bid.endDate || reqObj.lastDate || schedule.submissionDate || schedule.submissionDeadline, true)}
      clarificationDate={formatDateString(schedule.clarificationDeadline || schedule.clarificationDate, true)}
      technicalDate={formatDateString(bid.technicalOpeningDate || schedule.technicalOpeningDate, true)}
      financialDate={formatDateString(bid.financialOpeningDate || schedule.financialOpeningDate, true)}
      awardDate={formatDateString(tender.awardDate || schedule.awardDate || schedule.awardingDate, true)}
      category={bid.category?.name || bid.category || reqObj.category?.name || basics.category}
      subCategory={basics.subCategory || reqObj.subCategory}
      projectDuration={terms.projectDuration || terms.contractPeriod}
      department={payload.internal?.departmentName || bid.departmentName}
      contactPerson={bid.buyerName || reqObj.contactPerson}
      buyerEmail={bid.buyerEmail || reqObj.buyerEmail}
      buyerMobile={bid.buyerMobile || reqObj.buyerMobile}
      buyerAddress={reqObj.buyerAddress || reqObj.location}
      procurementMethod="Request for Proposal"
      buyingType={basics.buyingType || 'Services / Solutions'}
      deliveryLocation={bid.deliveryLocation || bid.location || reqObj.location || basics.deliveryLocation}
      paymentTerms={bid.paymentTerms || terms.paymentTerms || 'Milestone Based Payment'}
      deliveryTerms={bid.deliveryTerms || terms.deliveryTerms || 'SLA Dependent'}
      description={bid.description || reqObj.description || basics.description || serviceDetails.scopeOfWork}
      payload={payload}
      documents={bid.documents || bid.bidDocuments || reqObj.documents || payload.documents || []}
      items={bid.items || payload.items || reqObj.items || payload.boqTable || []}
      requiredDocuments={payload.requiredDocs || reqObj.requiredDocuments}
      boqTable={payload.boqTable || payload.boq}
      serviceDetails={serviceDetails}
      consigneeDetails={payload.consigneeDetails}
      evaluationMethod={
        [
          evaluation.method,
          evaluation.evaluationMethod,
          payload.evaluation?.method,
          payload.evaluation?.evaluationMethod,
          payload.evaluationMethod,
          reqObj?.payload?.evaluation?.method,
          bid.technicalPacket?.evaluation?.method,
          bid.evaluationMethod,
        ].find(c => typeof c === 'string' && c.trim().length > 0 && !['l1', 'l1 basis', 'l1 evaluation'].includes(c.trim().toLowerCase())) ||
        bid.evaluationMethod ||
        evaluation.method ||
        payload.evaluationMethod ||
        'QCBS (Quality & Cost Based Selection)'
      }
      participations={participationsList}
      participantsCount={bid.participantsCount ?? participationsList.length}
      hasSubmittedProposal={hasSubmittedProposal}
      ownParticipation={ownParticipation}
      ownResponse={ownResponse}
      emdAmount={bid.emdAmount || reqObj.emdAmount || basics.emdAmount}
      isEmdRequired={bid.isEmdRequired ?? reqObj.isEmdRequired ?? basics.isEmdRequired}
      backRoute={isBuyerOrAdmin ? '/buyer/my-procurements' : '/seller/opportunities'}
      backRouteLabel={isBuyerOrAdmin ? 'My Procurements' : 'Opportunities'}
      submitButtonLabel={isBuyerOrAdmin ? undefined : (hasSubmittedProposal ? 'View Proposal' : 'Submit Proposal')}
      onSubmitClick={isBuyerOrAdmin ? undefined : handleSubmitProposal}
      clarificationKind={requirementId || bidData?.sourceModel === 'REQUIREMENT' ? 'requirement' : 'quote-request'}
      clarificationEntityId={bid.id || reqObj.id || requirementId || requestId}
    />
  );
}
