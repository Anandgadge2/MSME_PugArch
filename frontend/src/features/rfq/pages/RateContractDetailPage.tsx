'use client';

import React, { Suspense, useState, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { getApi, postApi } from '../../shared/apiClient';
import { Button } from '../../../components/ui/button';
import { procurementBidApi } from '../../procurementBid/api';
import { fetchRateContractDetail } from '../../rateContract/api';
import { ProcurementDetailUnifiedView, ProcurementDetailSkeleton } from '../components/ProcurementDetailUnifiedView';
import { CancelProcurementModal } from '../../procurement/components/CancelProcurementModal';
import { adaptProcurementUnifiedProps } from '../utils/procurementUnifiedAdapter';

function RateContractDetailContent({ initialData }: { initialData?: any }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const isBuyerOrAdmin = user?.role === 'buyer' || user?.role === 'admin' || (user as any)?.role === 'master_admin';
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const pathTokens = (pathname || '').split('/').filter(Boolean);
  const rawPathId = pathTokens.length >= 2 ? pathTokens[pathTokens.length - 1] : '';
  const pathnameId = (rawPathId && !['rate-contract', 'rfp', 'rfq', 'limited-tender', 'open-tender', 'bids', 'opportunities', 'details'].includes(rawPathId.toLowerCase())) ? rawPathId : '';

  const explicitReqId = searchParams?.get('requirementId') || '';
  const explicitRequestId = searchParams?.get('requestId') || searchParams?.get('bidId') || searchParams?.get('rfqId') || '';
  const rawIdParam = searchParams?.get('id') || pathnameId || '';

  let requirementId = explicitReqId;
  let requestId = explicitRequestId;

  if (!requirementId && !requestId && rawIdParam) {
    if (rawIdParam.toLowerCase().startsWith('req-')) {
      requirementId = rawIdParam.replace(/^req-/i, '');
    } else if (rawIdParam.toLowerCase().startsWith('bid-') || rawIdParam.toLowerCase().startsWith('qr-') || rawIdParam.toLowerCase().startsWith('rc-')) {
      requestId = rawIdParam;
    } else {
      requirementId = rawIdParam;
      requestId = rawIdParam;
    }
  }

  const activeRcId = explicitReqId || explicitRequestId || rawIdParam || pathnameId;
  const isMatchingInitial = Boolean(
    initialData && activeRcId && (
      String(initialData.id).toLowerCase() === String(activeRcId).toLowerCase() ||
      String(initialData.requirementNumber || '').toLowerCase() === String(activeRcId).toLowerCase() ||
      String(initialData.bidNumber || '').toLowerCase() === String(activeRcId).toLowerCase() ||
      String(initialData.displayId || '').toLowerCase() === String(activeRcId).toLowerCase()
    )
  );

  const hasValidSellerInitial = user?.role === 'seller' ? Boolean(initialData?.myParticipation || initialData?.hasSubmittedProposal) : true;
  const { data: bidData, isLoading: bidLoading, error: bidError, refetch: refetchBid } = useQuery({
    queryKey: ['procurement-bid-rc-detail', requestId, user?.id],
    queryFn: () => procurementBidApi.detail(requestId),
    enabled: !!requestId,
    initialData: isMatchingInitial && (initialData?.sourceModel === 'BID' || initialData?.bidNumber) && hasValidSellerInitial ? initialData : undefined,
    staleTime: 10_000,
    retry: 1,
  });

  const { data: reqData, isLoading: reqLoading, error: reqError, refetch: refetchReq } = useQuery({
    queryKey: ['marketplace-requirement-rc-detail', requirementId, user?.id],
    queryFn: async () => {
      const data = await getApi<any>(`/api/marketplace/requirements/${requirementId}`);
      return data?.requirement || data?.data?.requirement || data?.data || data;
    },
    enabled: !!requirementId,
    initialData: isMatchingInitial && (initialData?.title || initialData?.requirement) ? initialData : undefined,
    staleTime: 60_000,
    retry: 1,
  });

  const contractId = !isNaN(Number(rawIdParam)) ? Number(rawIdParam) : (rawIdParam.startsWith('rc-') ? Number(rawIdParam.replace('rc-', '')) : null);
  const { data: contractData, isLoading: contractLoading, error: contractError, refetch: refetchContract } = useQuery({
    queryKey: ['rate-contract-detail', contractId, user?.id],
    queryFn: () => fetchRateContractDetail(contractId!),
    enabled: !!contractId,
    staleTime: 60_000,
    retry: 1,
  });

  const hasValidInitialData = Boolean(
    initialData &&
    typeof initialData === 'object' &&
    (initialData.id || initialData.bidNumber || initialData.requirementNumber || initialData.title)
  );
  const isQueryInProgress = bidLoading || reqLoading || contractLoading;
  const hasData = Boolean(bidData || reqData || contractData || hasValidInitialData);

  if (!hasData && isQueryInProgress) {
    return <ProcurementDetailSkeleton procurementTypeLabel="Rate Contract" />;
  }

  if (!hasData && !isQueryInProgress) {
    const errorMsg = (bidError as Error)?.message || (reqError as Error)?.message || (contractError as Error)?.message || 'The requested Rate Contract record could not be loaded.';
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-black text-slate-950">Rate Contract unavailable</h1>
        <p className="max-w-md text-sm font-semibold leading-relaxed text-slate-500">{errorMsg}</p>
        <Button type="button" variant="outline" onClick={() => router.back()} className="mt-1">
          <ArrowLeft className="h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  const rcData: any = contractData || bidData || reqData || initialData || {};
  const reqObj: any = reqData?.requirement || reqData?.data?.requirement || reqData?.data || reqData || {};
  const statusUpper = String(rcData.status || 'OPEN').toUpperCase();
  const canCancel = isBuyerOrAdmin && !['CANCELLED', 'AWARDED', 'COMPLETED', 'CLOSED'].includes(statusUpper);

  const handleSubmitQuotation = () => {
    if (!user) {
      toast.error('Please login to submit a rate quotation.');
      router.push(`/login?redirect=${encodeURIComponent(pathname || '')}`);
      return;
    }
    const resolvedId = rcData.id || requestId || requirementId;
    router.push(`/bids/${encodeURIComponent(resolvedId)}/participate`);
  };

  const viewProps = adaptProcurementUnifiedProps(rcData, reqObj, {
    user,
    router,
    requestId: activeRcId,
    procurementType: 'RATE_CONTRACT',
    procurementLabel: 'Rate Contract',
    backRouteLabel: isBuyerOrAdmin ? 'My Procurements' : 'Rate Contract Opportunities',
    backRoute: isBuyerOrAdmin ? '/buyer/my-procurements' : '/seller/opportunities/rate-contracts',
    onRefresh: async () => {
      await Promise.allSettled([refetchBid(), refetchReq(), refetchContract()]);
    },
    onCancel: canCancel ? () => setCancelModalOpen(true) : undefined,
    onSubmitAction: isBuyerOrAdmin ? () => router.push(`/bids/${rcData?.id || requestId}/results`) : handleSubmitQuotation,
    extraProps: {
      contractId: contractData?.id || (rcData?.contractId ? Number(rcData.contractId) : (contractId || undefined)),
      contractNumber: contractData?.contractNumber || (rcData as any)?.contractNumber || null,
      rateContractConfig: rcData?.rateContractConfig || rcData?.payload?.rateContractConfig,
      terms: rcData?.terms || rcData?.payload?.terms,
      contractDocument: rcData?.contractDocument,
      utilization: contractData?.utilization || rcData?.utilization || null,
    },
  });

  return (
    <>
      <ProcurementDetailUnifiedView {...viewProps} />
      {canCancel && (
        <CancelProcurementModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          procurement={{
            id: contractData?.id || bidData?.id || reqData?.id || String(rcData?.id || activeRcId),
            type: contractData ? 'rate_contract' : (bidData?.sourceModel === 'REQUIREMENT' || reqData ? 'requirement' : 'bid_tender'),
            title: viewProps.subject,
            referenceNumber: viewProps.displayId || String(rcData?.id || activeRcId),
            typeLabel: 'Rate Contract',
            status: statusUpper,
          }}
          onConfirm={async (params) => {
            await postApi('/api/buyer/procurements/cancel', params);
            toast.success('Rate Contract cancelled successfully');
            router.push('/buyer/my-procurements');
          }}
        />
      )}
    </>
  );
}

export default function RateContractDetailPage({ initialData }: { initialData?: any } = {}) {
  return (
    <Suspense fallback={<ProcurementDetailSkeleton procurementTypeLabel="Rate Contract" />}>
      <RateContractDetailContent initialData={initialData} />
    </Suspense>
  );
}
