'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui/button';
import { getApi, postApi } from '../../shared/apiClient';
import { procurementBidApi } from '../../procurementBid/api';
import { ProcurementDetailUnifiedView, ProcurementDetailSkeleton } from '../components/ProcurementDetailUnifiedView';
import { formatRefId } from '../../../utils/refIdUtils';
import RfqDetailPage from './RfqDetailPage';
import { toast } from 'sonner';
import { CancelProcurementModal } from '../../procurement/components/CancelProcurementModal';
import { formatDate, formatDateTime } from '../../shared/format';

function formatDateString(dateVal?: string | Date | null, includeTime: boolean = false) {
  if (!dateVal) return undefined;
  const formatted = includeTime ? formatDateTime(dateVal) : formatDate(dateVal);
  return formatted === '—' ? String(dateVal) : formatted;
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
    initialData && (
      !activeId ||
      String(initialData.id).toLowerCase() === String(activeId).toLowerCase() ||
      String(initialData.requirementNumber || '').toLowerCase() === String(activeId).toLowerCase() ||
      String(initialData.bidNumber || '').toLowerCase() === String(activeId).toLowerCase() ||
      String(initialData.displayId || '').toLowerCase() === String(activeId).toLowerCase() ||
      String(initialData.sourceId || '').toLowerCase() === String(activeId).toLowerCase()
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
        const unwrapped = res2?.requirement || res2?.data?.requirement || res2?.data || res2;
        if (unwrapped && (unwrapped.id || unwrapped.title || unwrapped.requirementNumber)) return unwrapped;
      } catch {}
      try {
        const res = await getApi<any>(`/api/requirements/${targetReqId}`);
        const unwrapped = res?.requirement || res?.data?.requirement || res?.data || res;
        if (unwrapped && (unwrapped.id || unwrapped.title || unwrapped.requirementNumber)) return unwrapped;
      } catch {}
      return null;
    },
    enabled: !!targetReqId,
    initialData: isMatchingInitial && (initialData?.title || initialData?.requirement) ? (initialData.requirement || initialData) : undefined,
    staleTime: 60_000,
  });

  const isLoading = !initialData && !bidData && !reqData && (isBidLoading || isReqLoading);
  const bid: any = bidData || {};
  const reqObj: any = reqData?.requirement || reqData?.data?.requirement || reqData?.data || reqData || {};
  const payload =
    bid.technicalPacket ||
    bid.payload ||
    reqObj.technicalPacket ||
    reqObj.payload ||
    {};
  const basics = payload.basics || {};
  const schedule = payload.schedule || {};
  const terms = payload.terms || {};
  const tender = payload.tender || {};
  const rules = payload.rules || {};
  const evaluation = payload.evaluation || {};
  const serviceDetails = payload.serviceDetails || {};

  if (isLoading) {
    return <ProcurementDetailSkeleton procurementTypeLabel="Request for Proposal" />;
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

  const isGenericTitle = (s?: any) => {
    if (!s || typeof s !== 'string') return true;
    const str = s.trim().toLowerCase();
    return (
      str === '' ||
      str === 'request for proposal' ||
      str === 'request for quotation' ||
      str === 'procurement requirement' ||
      str === 'procurement opportunity' ||
      str === 'open tender' ||
      str === 'limited tender' ||
      str === 'rate contract' ||
      str === 'rate contract opportunity' ||
      str === 'rfq opportunity' ||
      str === 'rfp opportunity' ||
      str === 'tender opportunity' ||
      str.includes('no description') ||
      str.includes('no scope') ||
      str === 'n/a' ||
      str === '—'
    );
  };

  const candidateTitles = [
    bid.title,
    reqObj.title,
    basics.title,
    basics.contractTitle,
    basics.procurementTitle,
    tender.tenderTitle,
    tender.title,
    serviceDetails.title,
    serviceDetails.serviceTitle,
    bid.subject,
    reqObj.subject,
    bid.itemName,
    reqObj.itemName,
    bid.name,
    reqObj.name,
    (Array.isArray(bid.items) && (bid.items[0]?.itemName || bid.items[0]?.name || bid.items[0]?.title)),
    (Array.isArray(reqObj.items) && (reqObj.items[0]?.itemName || reqObj.items[0]?.name || reqObj.items[0]?.title)),
    (Array.isArray(payload.items) && (payload.items[0]?.itemName || payload.items[0]?.name || payload.items[0]?.title)),
  ];

  const firstValidTitle = candidateTitles.find(t => t && !isGenericTitle(String(t)));
  const title = firstValidTitle ? String(firstValidTitle).trim() : (bid.title || reqObj.title || 'Request for Proposal');
  const rawRfpRef =
    bid.bidNumber ||
    bid.referenceNumber ||
    reqObj.requirementNumber ||
    reqObj.bidNumber ||
    basics.bidNumber ||
    basics.requirementNumber;
  const rfpNumber = formatRefId('RFP', bid.id || reqObj.id || requestId, rawRfpRef, 'RFP');

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
  const [cancelModalOpen, setCancelModalOpen] = React.useState(false);
  const rawStatus = String(bid.status || reqObj.status || 'OPEN').toUpperCase();
  const canCancel = isBuyerOrAdmin && !['CANCELLED', 'AWARDED', 'COMPLETED', 'CLOSED'].includes(rawStatus);

  return (
    <>
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
        onCancelClick={canCancel ? () => setCancelModalOpen(true) : undefined}
        cancelButtonLabel={rawStatus === 'DRAFT' || rawStatus === 'SUBMITTED' ? 'Withdraw Request' : 'Cancel RFP'}
        clarificationKind={requirementId || bidData?.sourceModel === 'REQUIREMENT' ? 'requirement' : 'quote-request'}
        clarificationEntityId={bid.id || reqObj.id || requirementId || requestId}
      />
      {canCancel && (
        <CancelProcurementModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          procurement={{
            id: Number(reqObj.id || bid.id || requirementId || requestId),
            type: bidData?.sourceModel === 'REQUIREMENT' || requirementId ? 'requirement' : 'bid_tender',
            title: title,
            referenceNumber: rfpNumber,
            typeLabel: 'RFP',
            status: rawStatus,
          }}
          onConfirm={async (params) => {
            await postApi('/api/buyer/procurements/cancel', params);
            toast.success('RFP cancelled successfully');
            router.push('/buyer/my-procurements');
          }}
        />
      )}
    </>
  );
}
