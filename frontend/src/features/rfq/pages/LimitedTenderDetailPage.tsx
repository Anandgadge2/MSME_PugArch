'use client';

import React, { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui/button';
import { getApi, postApi } from '../../shared/apiClient';
import { procurementBidApi } from '../../procurementBid/api';
import { ProcurementDetailUnifiedView, ProcurementDetailSkeleton } from '../components/ProcurementDetailUnifiedView';
import { CancelProcurementModal } from '../../procurement/components/CancelProcurementModal';
import { formatRefId } from '../../../utils/refIdUtils';
import { formatDate, formatDateTime } from '../../shared/format';
import { toast } from 'sonner';

function formatDateString(dateVal?: string | Date | null, includeTime: boolean = false) {
  if (!dateVal) return undefined;
  const formatted = includeTime ? formatDateTime(dateVal) : formatDate(dateVal);
  return formatted === '—' ? String(dateVal) : formatted;
}

export default function LimitedTenderDetailPage({ initialData }: { initialData?: any } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || '';
  const { user } = useAuth();
  const currentUser: any = user;
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const explicitReqId = searchParams?.get('requirementId') || '';
  const explicitRequestId = searchParams?.get('requestId') || searchParams?.get('bidId') || '';
  const rawIdParam = searchParams?.get('id') || '';

  const pathTokens = pathname.split('/').filter(Boolean);
  const rawPathId = pathTokens.length >= 2 ? pathTokens[pathTokens.length - 1] : '';
  const pathnameId = (rawPathId && !['limited-tender', 'bids', 'tenders', 'details'].includes(rawPathId.toLowerCase())) ? rawPathId : '';

  const activeLimitedId = explicitReqId || explicitRequestId || rawIdParam || pathnameId;
  const requestId = explicitRequestId || (activeLimitedId.startsWith('REQ-') ? '' : activeLimitedId);
  const requirementId = explicitReqId || (activeLimitedId.startsWith('REQ-') ? activeLimitedId : '');
  const fallbackReqId = activeLimitedId;

  const isMatchingInitial = Boolean(
    initialData && activeLimitedId && (
      String(initialData.id).toLowerCase() === String(activeLimitedId).toLowerCase() ||
      String(initialData.requirementNumber || '').toLowerCase() === String(activeLimitedId).toLowerCase() ||
      String(initialData.bidNumber || '').toLowerCase() === String(activeLimitedId).toLowerCase() ||
      String(initialData.displayId || '').toLowerCase() === String(activeLimitedId).toLowerCase()
    )
  );

  const { data: bidData, isLoading: isBidLoading, error: bidError } = useQuery({
    queryKey: ['limited-tender-bid-detail', requestId || activeLimitedId],
    queryFn: () => procurementBidApi.detail((requestId || activeLimitedId)!),
    enabled: !!(requestId || activeLimitedId),
    initialData: isMatchingInitial && (initialData?.sourceModel === 'BID' || initialData?.bidNumber) ? initialData : undefined,
    staleTime: 60_000,
  });

  const targetReqId = requirementId || (bidData as any)?.sourceId || (bidData as any)?.requirementId || fallbackReqId;

  const { data: reqData, isLoading: isReqLoading, error: reqError } = useQuery({
    queryKey: ['limited-tender-req-detail', targetReqId],
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
  const payload = bid.technicalPacket || bid.payload || reqObj.technicalPacket || reqObj.payload || {};
  const basics = payload.basics || {};
  const schedule = payload.schedule || {};
  const terms = payload.terms || {};

  if (isLoading) {
    return <ProcurementDetailSkeleton procurementTypeLabel="Limited Tender" />;
  }


  const hasFatalError = !bidData && !reqData;
  if (hasFatalError) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-black text-slate-950">Limited Tender unavailable</h1>
        <p className="max-w-md text-sm font-semibold leading-relaxed text-slate-500">
          {(bidError as Error)?.message || (reqError as Error)?.message || 'The requested Limited Tender record could not be loaded.'}
        </p>
        <Button type="button" variant="outline" onClick={() => router.back()} className="mt-1">
          <ArrowLeft className="h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  const candidateTitles = [
    bid.title,
    reqObj.title,
    basics.title,
    basics.contractTitle,
    basics.procurementTitle,
    payload.tender?.tenderTitle,
    payload.tender?.title,
    payload.serviceDetails?.title,
    payload.serviceDetails?.serviceTitle,
    bid.subject,
    reqObj.subject,
    bid.itemName,
    reqObj.itemName,
    (Array.isArray(bid.items) && (bid.items[0]?.itemName || bid.items[0]?.name || bid.items[0]?.title)),
    (Array.isArray(reqObj.items) && (reqObj.items[0]?.itemName || reqObj.items[0]?.name || reqObj.items[0]?.title)),
  ];
  const isGeneric = (s?: any) => !s || typeof s !== 'string' || ['limited tender', 'tender opportunity', 'procurement requirement', 'n/a', '—'].includes(s.trim().toLowerCase()) || s.toLowerCase().includes('no description');
  const validTitle = candidateTitles.find(t => t && !isGeneric(String(t)));
  const title = validTitle ? String(validTitle).trim() : (bid.title || reqObj.title || 'Limited Tender Procurement');
  const rawLtndRef = bid.bidNumber || bid.referenceNumber || reqObj.requirementNumber;
  const limitedTenderNumber = formatRefId('LTND', bid.id || reqObj.id || requestId, rawLtndRef, 'LIMITED_TENDER');

  const handleSubmitProposal = () => {
    if (!currentUser) {
      toast.error('Please login to participate in this Limited Tender.');
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    router.push(`/bids/${bid.id || requestId}/participate`);
  };

  const participationsList = bid.participations || reqObj.participations || reqObj.responses || [];

  const ownParticipation = participationsList.find((p: any) =>
    currentUser?.id && (
      Number(p.sellerId || p.sellerUserId) === Number(currentUser.id) ||
      Number(p.seller?.id || p.sellerUser?.id) === Number(currentUser.id) ||
      (currentUser.organizationId && Number(p.sellerOrgId || p.sellerOrganizationId || p.sellerOrganization?.id) === Number(currentUser.organizationId))
    )
  );

  const isOwnSubmitted = Boolean(
    ownParticipation &&
    String(ownParticipation.submissionStatus || ownParticipation.status || '').toUpperCase() === 'SUBMITTED'
  );

  const hasSubmittedProposal = Boolean(
    bid.hasSubmittedProposal ||
    isOwnSubmitted
  );

  const invitedSellersList =
    bid.invitedSellers ||
    payload?.vendors?.invitedSellers ||
    reqObj?.invitedSellers ||
    reqObj?.payload?.vendors?.invitedSellers ||
    [];

  const invitationsList = bid.invitations || reqObj?.invitations || [];

  const computedInviteCount = Math.max(
    Number(bid.invitedCount) || 0,
    Number(bid.invitationsCount) || 0,
    Array.isArray(invitationsList) ? invitationsList.length : 0,
    Array.isArray(invitedSellersList) ? invitedSellersList.length : 0,
    Number(payload?.vendors?.inviteCount) || 0
  );

  const isBuyerOrAdmin = currentUser?.role === 'buyer' || currentUser?.role === 'admin' || currentUser?.role === 'master_admin';
  const statusUpper = String(bid.status || reqObj.status || 'OPEN').toUpperCase();
  const canCancel = isBuyerOrAdmin && !['CANCELLED', 'AWARDED', 'COMPLETED', 'CLOSED'].includes(statusUpper);
  const rawBuyerProfile =
    bid.buyer?.buyerProfile ||
    reqObj.buyer?.buyerProfile ||
    null;

  const resolvedOrgName =
    bid.buyer?.buyerProfile?.organizationName ||
    bid.buyerOrganizationName ||
    reqObj.buyerOrganization?.organizationName ||
    reqObj.organization?.organizationName ||
    (bid.buyer?.name && bid.buyer.name !== bid.buyer?.buyerProfile?.representativeName ? bid.buyer.name : '') ||
    'Buyer Organization';

  const resolvedContactPerson =
    bid.buyer?.buyerProfile?.contactPerson ||
    bid.buyer?.buyerProfile?.representativeName ||
    (bid.buyer?.name && bid.buyer.name !== resolvedOrgName && bid.buyer.name !== 'Buyer' ? bid.buyer.name : '') ||
    (bid.buyerName && bid.buyerName !== resolvedOrgName && bid.buyerName !== 'Buyer' ? bid.buyerName : '') ||
    reqObj.contactPerson ||
    (reqObj.buyer?.name && reqObj.buyer.name !== resolvedOrgName && reqObj.buyer.name !== 'Buyer' ? reqObj.buyer.name : '') ||
    'Authorized Procurement Officer';

  const resolvedBuyerEmail =
    bid.buyer?.buyerProfile?.email ||
    bid.buyer?.email ||
    bid.buyerEmail ||
    reqObj.buyerEmail ||
    reqObj.buyer?.email ||
    '';

  const resolvedBuyerMobile =
    bid.buyer?.buyerProfile?.phone ||
    bid.buyer?.buyerProfile?.mobile ||
    bid.buyer?.mobile ||
    bid.buyerMobile ||
    reqObj.buyerMobile ||
    reqObj.buyer?.mobile ||
    '';

  const resolvedBuyerAddress =
    bid.buyerAddress ||
    bid.buyer?.buyerProfile?.registeredAddress ||
    bid.buyer?.buyerProfile?.address ||
    reqObj.buyerAddress ||
    reqObj.buyer?.buyerProfile?.registeredAddress ||
    rawBuyerProfile?.registeredAddress ||
    rawBuyerProfile?.address ||
    '';

  const resolvedBuyerProfile = rawBuyerProfile || bid.buyerOrganization || reqObj.buyerOrganization || reqObj.organization || {};

  return (
    <>
      <ProcurementDetailUnifiedView
        procurementType="LIMITED_TENDER"
        procurementLabel="Limited Tender"
        id={bid.id || reqObj.id || requestId}
        displayId={limitedTenderNumber}
        invitedCount={computedInviteCount}
        invitedSellers={invitedSellersList}
        invitations={invitationsList}
        subject={title}
        status={bid.status || reqObj.status || 'OPEN'}
        buyerName={resolvedContactPerson}
        contactPerson={resolvedContactPerson}
        orgName={resolvedOrgName}
        buyerEmail={resolvedBuyerEmail}
        buyerMobile={resolvedBuyerMobile}
        buyerAddress={resolvedBuyerAddress}
        buyer={{
          name: resolvedContactPerson,
          email: resolvedBuyerEmail,
          mobile: resolvedBuyerMobile,
          buyerProfile: {
            ...resolvedBuyerProfile,
            organizationName: resolvedOrgName,
            representativeName: resolvedContactPerson,
            contactPerson: resolvedContactPerson,
            email: resolvedBuyerEmail,
            mobile: resolvedBuyerMobile,
            phone: resolvedBuyerMobile,
            registeredAddress: resolvedBuyerAddress || resolvedBuyerProfile?.registeredAddress,
            address: resolvedBuyerAddress || resolvedBuyerProfile?.address,
            department: bid.buyer?.buyerProfile?.department || resolvedBuyerProfile?.department,
          },
        }}
        estimatedValue={bid.estimatedValue || reqObj.estimatedValue || basics.estimatedValue}
        discloseEstimatedCost={Boolean(bid.discloseEstimatedCost ?? payload.discloseEstimatedCost ?? basics.discloseEstimatedCost ?? false)}
        deadlineDate={schedule.submissionDate || schedule.submissionDeadline || bid.rawEndDate || reqObj.lastDate || bid.endDate}
        createdAt={reqObj.createdAt || bid.createdAt || bid.startDate}
        publishedDate={(() => {
          const tCreated = reqObj.createdAt || bid.createdAt;
          const rawPub = schedule.publishDate || schedule.publishedDate;
          if (rawPub && tCreated) {
            const pubMs = new Date(rawPub).getTime();
            const crMs = new Date(tCreated).getTime();
            if (Number.isFinite(pubMs) && Number.isFinite(crMs) && pubMs > crMs + 60000) {
              return formatDateString(rawPub);
            }
          }
          return formatDateString(reqObj.approvedAt || reqObj.publishedAt || bid.publishedAt || bid.approvedAt || tCreated || bid.rawStartDate || bid.startDate);
        })()}
        submissionStartDate={schedule.submissionStartDate || schedule.startDate || (payload.tender as any)?.bidStartDate || reqObj.startDate ? formatDateString(schedule.submissionStartDate || schedule.startDate || (payload.tender as any)?.bidStartDate || reqObj.startDate, true) : undefined}
        closingDate={formatDateString(schedule.submissionDate || schedule.submissionDeadline || bid.rawEndDate || reqObj.lastDate || bid.endDate, true)}
        clarificationDate={schedule.clarificationDeadline || schedule.clarificationEndDate ? formatDateString(schedule.clarificationDeadline || schedule.clarificationEndDate, true) : undefined}
        technicalDate={formatDateString(bid.technicalOpeningDate || schedule.technicalOpeningDate || (payload.tender as any)?.technicalEvaluationDate, true)}
        financialDate={formatDateString(bid.financialOpeningDate || schedule.financialOpeningDate || (payload.tender as any)?.financialEvaluationDate, true)}
        packetType={schedule.packetType || bid.packetType || payload.packetType || ((bid.financialOpeningDate || schedule.financialOpeningDate || (payload.tender as any)?.financialEvaluationDate) ? 'Two Packet' : 'Single Packet')}
        category={bid.category?.name || bid.category || reqObj.category?.name || basics.category}
        procurementMethod="Limited Tender"
        buyingType={basics.buyingType || 'Goods / Products'}
        deliveryLocation={bid.deliveryLocation || bid.location || reqObj.location || basics.deliveryLocation}
        projectDuration={bid.projectDuration || bid.contractPeriod || basics.projectDuration || basics.duration || terms.projectDuration || terms.contractPeriod || undefined}
        paymentTerms={bid.paymentTerms || terms.paymentTerms || undefined}
        deliveryTerms={bid.deliveryTerms || terms.deliveryTerms || undefined}
        description={bid.description || reqObj.description || basics.description}
        payload={payload}
        approvalAuthority={bid.approvalAuthority || payload.internal?.approvalAuthority || payload.approvalAuthority}
        justification={bid.justification || payload.internal?.justification || payload.limitedTenderJustification || basics.justification}
        internalDetails={bid.internalDetails || payload.internal}
        documents={bid.documents || bid.bidDocuments || reqObj.documents || payload.documents || []}
        items={bid.items || payload.items || reqObj.items || payload.boqTable || []}
        evaluationMethod={
          [
            payload.evaluation?.method,
            payload.evaluation?.evaluationMethod,
            payload.evaluationMethod,
            payload.rules?.evaluationMethod,
            reqObj?.payload?.evaluation?.method,
            bid.technicalPacket?.evaluation?.method,
            bid.evaluationMethod,
          ].find(c => typeof c === 'string' && c.trim().length > 0 && !['l1', 'l1 basis', 'l1 evaluation'].includes(c.trim().toLowerCase())) ||
          bid.evaluationMethod ||
          payload.evaluationMethod ||
          'Selective Evaluation'
        }
        participations={participationsList}
        participantsCount={bid.participantsCount ?? participationsList.length}
        hasSubmittedProposal={hasSubmittedProposal}
        ownParticipation={ownParticipation}
        emdAmount={bid.emdAmount || reqObj.emdAmount || basics.emdAmount}
        isEmdRequired={bid.isEmdRequired ?? reqObj.isEmdRequired ?? basics.isEmdRequired}
        backRoute={currentUser?.role === 'buyer' || currentUser?.role === 'admin' ? "/buyer/my-procurements" : "/seller/opportunities"}
        backRouteLabel={currentUser?.role === 'buyer' || currentUser?.role === 'admin' ? "My Procurements" : "Opportunities"}
        submitButtonLabel={currentUser?.role === 'buyer' || currentUser?.role === 'admin' ? 'View Evaluation & Results' : (hasSubmittedProposal ? 'Tender Proposal Submitted' : 'Submit Limited Tender Proposal')}
        onSubmitClick={currentUser?.role === 'buyer' || currentUser?.role === 'admin' ? () => router.push(`/bids/${bid.id || requestId}/results`) : handleSubmitProposal}
        onViewQuotationClick={hasSubmittedProposal ? handleSubmitProposal : undefined}
        onCancelClick={canCancel ? () => setCancelModalOpen(true) : undefined}
        cancelButtonLabel={statusUpper === 'DRAFT' || statusUpper === 'SUBMITTED' ? 'Withdraw Tender' : 'Cancel Tender'}
      />
      {canCancel && (
        <CancelProcurementModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          procurement={{
            id: Number(bid.id || reqObj.id || requestId),
            type: 'bid_tender',
            title: title,
            referenceNumber: limitedTenderNumber,
            typeLabel: 'Limited Tender',
            status: statusUpper,
          }}
          onConfirm={async (params) => {
            await postApi('/api/buyer/procurements/cancel', params);
            toast.success('Limited Tender cancelled successfully');
            router.push('/buyer/my-procurements');
          }}
        />
      )}
    </>
  );
}
