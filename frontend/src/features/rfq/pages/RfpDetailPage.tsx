'use client';

import React, { Suspense, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { Button } from '../../../components/ui/button';
import { getApi, postApi } from '../../shared/apiClient';
import { procurementBidApi } from '../../procurementBid/api';
import { ProcurementDetailUnifiedView, ProcurementDetailSkeleton } from '../components/ProcurementDetailUnifiedView';
import { CancelProcurementModal } from '../../procurement/components/CancelProcurementModal';
import { adaptProcurementUnifiedProps } from '../utils/procurementUnifiedAdapter';
import { toast } from 'sonner';

function RfpDetailContent({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || '';
  const { user } = useAuth();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

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

  const { data: bidData, isLoading: isBidLoading, error: bidError, refetch: refetchBid } = useQuery({
    queryKey: ['rfp-bid-detail', requestId || activeId, user?.id],
    queryFn: () => procurementBidApi.detail((requestId || activeId)!),
    enabled: !!(requestId || activeId),
    initialData: isMatchingInitial && (initialData?.sourceModel === 'BID' || initialData?.bidNumber) ? initialData : undefined,
    staleTime: 60_000,
  });

  const targetReqId = requirementId || (bidData as any)?.sourceId || (bidData as any)?.requirementId || fallbackReqId;

  const { data: reqData, isLoading: isReqLoading, error: reqError, refetch: refetchReq } = useQuery({
    queryKey: ['rfp-req-detail', targetReqId, user?.id],
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

  const isAnyLoading = isBidLoading || isReqLoading;
  const hasValidInitialData = Boolean(
    initialData &&
    typeof initialData === 'object' &&
    (initialData.id || initialData.bidNumber || initialData.requirementNumber || initialData.title)
  );

  if (!bidData && !reqData && !hasValidInitialData && isAnyLoading) {
    return <ProcurementDetailSkeleton procurementTypeLabel="Request for Proposal" />;
  }

  if (!isAnyLoading && !bidData && !reqData && !hasValidInitialData) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-black text-slate-950">RFP Opportunity unavailable</h1>
        <p className="max-w-md text-sm font-semibold leading-relaxed text-slate-500">
          {(bidError as Error)?.message || (reqError as Error)?.message || 'The requested RFP record could not be loaded.'}
        </p>
        <Button type="button" variant="outline" onClick={() => router.back()} className="mt-1">
          <ArrowLeft className="h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  const bid: any = bidData || (hasValidInitialData && (initialData.bidNumber || initialData.sourceModel === 'BID') ? initialData : {});
  const reqObj: any = reqData?.requirement || reqData?.data?.requirement || reqData?.data || reqData || (hasValidInitialData && (initialData.requirementNumber || initialData.sourceModel === 'REQUIREMENT') ? (initialData.requirement || initialData) : {});
  const isBuyerOrAdmin = user?.role === 'buyer' || user?.role === 'admin' || (user as any)?.role === 'master_admin';
  const statusUpper = String(bid.status || reqObj.status || 'OPEN').toUpperCase();
  const canCancel = isBuyerOrAdmin && !['CANCELLED', 'AWARDED', 'COMPLETED', 'CLOSED'].includes(statusUpper);

  const handleSubmitProposal = () => {
    if (!user) {
      toast.error('Please login to participate in this RFP.');
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    const resolvedId = bid.id || activeId || requestId;
    router.push(`/bids/${encodeURIComponent(resolvedId)}/participate`);
  };

  const viewProps = adaptProcurementUnifiedProps(bid, reqObj, {
    user,
    router,
    requestId: activeId,
    procurementType: 'RFP',
    procurementLabel: 'Request for Proposal',
    backRouteLabel: isBuyerOrAdmin ? 'My Procurements' : 'Opportunities',
    backRoute: isBuyerOrAdmin ? '/buyer/my-procurements' : '/seller/opportunities',
    onRefresh: async () => {
      await Promise.allSettled([refetchBid(), refetchReq()]);
    },
    onCancel: canCancel ? () => setCancelModalOpen(true) : undefined,
    onSubmitAction: isBuyerOrAdmin ? () => router.push(`/bids/${bid.id || requestId}/results`) : handleSubmitProposal,
  });

  return (
    <>
      <ProcurementDetailUnifiedView {...viewProps} />
      {canCancel && (
        <CancelProcurementModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          procurement={{
            id: bid.id || reqObj.id || (!isNaN(Number(requestId)) ? Number(requestId) : 0) || String(requestId),
            type: 'bid_tender',
            title: viewProps.subject,
            referenceNumber: viewProps.displayId || String(requestId),
            typeLabel: 'Request for Proposal',
            status: statusUpper,
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

export default function RfpDetailPage({ initialData }: { initialData?: any } = {}) {
  return (
    <Suspense fallback={<ProcurementDetailSkeleton procurementTypeLabel="Request for Proposal" />}>
      <RfpDetailContent initialData={initialData} />
    </Suspense>
  );
}
