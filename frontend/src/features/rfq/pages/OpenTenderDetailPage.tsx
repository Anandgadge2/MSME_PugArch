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

export default function OpenTenderDetailPage({ initialData }: { initialData?: any } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || '';
  const { user } = useAuth();
  const currentUser: any = user;

  const pathTokens = pathname.split('/').filter(Boolean);
  const rawPathId = pathTokens.length >= 2 ? pathTokens[pathTokens.length - 1] : '';
  const pathnameId = (rawPathId && !['open-tender', 'bids', 'tenders', 'details'].includes(rawPathId.toLowerCase())) ? rawPathId : '';

  const requestId = searchParams.get('requestId') || searchParams.get('id') || pathnameId;
  const requirementId = searchParams.get('requirementId') || (!requestId ? pathnameId : '');

  const activeOpenId = requestId || requirementId || pathnameId;
  const isMatchingInitial = Boolean(
    initialData && activeOpenId && (
      String(initialData.id).toLowerCase() === String(activeOpenId).toLowerCase() ||
      String(initialData.requirementNumber || '').toLowerCase() === String(activeOpenId).toLowerCase() ||
      String(initialData.bidNumber || '').toLowerCase() === String(activeOpenId).toLowerCase() ||
      String(initialData.displayId || '').toLowerCase() === String(activeOpenId).toLowerCase()
    )
  );

  const { data: bidData, isLoading: isBidLoading, error: bidError } = useQuery({
    queryKey: ['open-tender-bid-detail', requestId],
    queryFn: () => procurementBidApi.detail(requestId!),
    enabled: !!requestId,
    initialData: isMatchingInitial && (initialData?.sourceModel === 'BID' || initialData?.bidNumber) ? initialData : undefined,
    staleTime: 60_000,
  });

  const targetReqId = requirementId || (bidData as any)?.sourceId || (bidData as any)?.requirementId;

  const { data: reqData, isLoading: isReqLoading, error: reqError } = useQuery({
    queryKey: ['open-tender-req-detail', targetReqId],
    queryFn: async () => {
      try {
        const res = await getApi<any>(`/api/requirements/${targetReqId}`);
        if (res) return res.data || res;
      } catch {}
      try {
        const res2 = await getApi<any>(`/api/marketplace/requirements/${targetReqId}`);
        if (res2) return res2.data || res2;
      } catch {}
      return null;
    },
    enabled: !!targetReqId && (!bidData || !(bidData as any).items?.length),
    initialData: isMatchingInitial && (initialData?.title || initialData?.requirement) ? initialData : undefined,
    staleTime: 60_000,
  });

  const isLoading = !initialData && (isBidLoading || (!!targetReqId && isReqLoading && !bidData));
  const bid: any = bidData || {};
  const reqObj: any = reqData || {};
  const payload = bid.technicalPacket || bid.payload || reqObj.payload || {};
  const basics = payload.basics || {};
  const schedule = payload.schedule || {};
  const terms = payload.terms || {};

  if (isLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#12335f]" />
        <p className="text-sm font-bold text-slate-500">Loading Open Tender details...</p>
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
        <h1 className="text-xl font-black text-slate-950">Open Tender unavailable</h1>
        <p className="max-w-md text-sm font-semibold leading-relaxed text-slate-500">
          {(bidError as Error)?.message || (reqError as Error)?.message || 'The requested Open Tender record could not be loaded.'}
        </p>
        <Button type="button" variant="outline" onClick={() => router.back()} className="mt-1">
          <ArrowLeft className="h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  const title = bid.title || bid.subject || reqObj.title || basics.title || 'Open Tender Procurement';
  const openTenderNumber = bid.bidNumber || bid.referenceNumber || reqObj.requirementNumber || bid.id || `TND-${requestId}`;

  const handleSubmitProposal = () => {
    if (!currentUser) {
      toast.error('Please login to participate in this Open Tender.');
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    router.push(`/bids/${bid.id || requestId}/participate`);
  };

  const participationsList = bid.participations || reqObj.participations || reqObj.responses || [];

  return (
    <ProcurementDetailUnifiedView
      procurementType="OPEN_TENDER"
      procurementLabel="Open Tender"
      id={bid.id || reqObj.id || requestId}
      displayId={openTenderNumber}
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
      deadlineDate={bid.endDate || reqObj.lastDate || schedule.submissionDate}
      createdAt={bid.startDate || bid.createdAt || reqObj.createdAt}
      publishedDate={formatDateString(schedule.publishDate || bid.startDate || reqObj.createdAt)}
      closingDate={formatDateString(bid.endDate || reqObj.lastDate || schedule.submissionDate, true)}
      clarificationDate={formatDateString(schedule.clarificationDeadline, true)}
      technicalDate={formatDateString(bid.technicalOpeningDate || schedule.technicalOpeningDate, true)}
      financialDate={formatDateString(bid.financialOpeningDate || schedule.financialOpeningDate, true)}
      category={bid.category?.name || bid.category || reqObj.category?.name || basics.category}
      procurementMethod="Open Tender"
      buyingType={basics.buyingType || 'Goods / Products'}
      deliveryLocation={bid.deliveryLocation || bid.location || reqObj.location || basics.deliveryLocation}
      paymentTerms={bid.paymentTerms || terms.paymentTerms || 'Standard Payment Terms'}
      deliveryTerms={bid.deliveryTerms || terms.deliveryTerms || 'Door delivery'}
      description={bid.description || reqObj.description || basics.description}
      payload={payload}
      documents={bid.documents || bid.bidDocuments || reqObj.documents || payload.documents || []}
      items={bid.items || payload.items || reqObj.items || payload.boqTable || []}
      evaluationMethod={bid.evaluationMethod || payload.evaluationMethod || 'L1 Evaluation'}
      participations={participationsList}
      participantsCount={bid.participantsCount ?? participationsList.length}
      emdAmount={bid.emdAmount || reqObj.emdAmount || basics.emdAmount}
      isEmdRequired={bid.isEmdRequired ?? reqObj.isEmdRequired ?? basics.isEmdRequired}
      backRoute={currentUser?.role === 'buyer' || currentUser?.role === 'admin' ? "/buyer/my-procurements" : "/seller/opportunities"}
      backRouteLabel={currentUser?.role === 'buyer' || currentUser?.role === 'admin' ? "My Procurements" : "Opportunities"}
      submitButtonLabel={currentUser?.role === 'buyer' || currentUser?.role === 'admin' ? 'View Evaluation & Results' : 'Submit Tender Proposal'}
      onSubmitClick={currentUser?.role === 'buyer' || currentUser?.role === 'admin' ? () => router.push(`/bids/${bid.id || requestId}/results`) : handleSubmitProposal}
    />
  );
}
