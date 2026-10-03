'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { getApi, postApi } from '../../shared/apiClient';
import { Button } from '../../../components/ui/button';
import { procurementBidApi } from '../../procurementBid/api';
import { ProcurementDetailUnifiedView, ProcurementDetailSkeleton } from '../components/ProcurementDetailUnifiedView';
import { CancelProcurementModal } from '../../procurement/components/CancelProcurementModal';
import { adaptProcurementUnifiedProps } from '../utils/procurementUnifiedAdapter';
import { useProcurementRealtime } from '../hooks/useProcurementRealtime';

function RfqDetailContent({ initialData }: { initialData?: any }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user } = useAuth();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [isConvertingInvoice, setIsConvertingInvoice] = useState(false);

  const explicitReqId = searchParams?.get('requirementId') || '';
  const explicitRequestId = searchParams?.get('requestId') || searchParams?.get('bidId') || searchParams?.get('rfqId') || '';
  const rawIdParam = searchParams?.get('id') || '';

  const pathTokens = (pathname || '').split('/').filter(Boolean);
  const rawPathId = pathTokens.length >= 2 ? pathTokens[pathTokens.length - 1] : '';
  const pathnameId = (rawPathId && !['rfq', 'rfqs', 'bids', 'opportunities', 'details'].includes(rawPathId.toLowerCase())) ? rawPathId : '';

  let requirementId = explicitReqId;
  let requestId = explicitRequestId;

  if (!requirementId && !requestId && (rawIdParam || pathnameId)) {
    const candidate = rawIdParam || pathnameId;
    if (candidate.toLowerCase().startsWith('req-')) {
      requirementId = candidate.replace(/^req-/i, '');
    } else {
      requestId = candidate;
    }
  }

  const activeRfqId = explicitReqId || explicitRequestId || rawIdParam || pathnameId;
  const isMatchingInitial = Boolean(
    initialData && activeRfqId && (
      String(initialData.id).toLowerCase() === String(activeRfqId).toLowerCase() ||
      String(initialData.requirementNumber || '').toLowerCase() === String(activeRfqId).toLowerCase() ||
      String(initialData.bidNumber || '').toLowerCase() === String(activeRfqId).toLowerCase() ||
      String(initialData.displayId || '').toLowerCase() === String(activeRfqId).toLowerCase()
    )
  );

  const { data: bidData, isLoading: bidLoading, refetch: refetchBid } = useQuery({
    queryKey: ['rfq-detail-bid', requestId, user?.id],
    queryFn: () => procurementBidApi.detail(requestId),
    enabled: Boolean(requestId && (!explicitReqId || requestId !== explicitReqId)),
    initialData: Boolean(requestId) && isMatchingInitial && (initialData?.sourceModel === 'BID' || initialData?.sourceModel === 'PROCUREMENT_BID' || initialData?.bidNumber) ? initialData : undefined,
    staleTime: 60_000,
  });

  const targetReqId = requirementId || (bidData as any)?.sourceId || (bidData as any)?.requirementId || (!requestId?.startsWith('BID-') ? requestId : '');

  const { data: reqData, isLoading: reqLoading, refetch: refetchReq } = useQuery({
    queryKey: ['rfq-detail-req', targetReqId, user?.id],
    queryFn: async () => getApi<any>(`/api/marketplace/requirements/${targetReqId}`),
    enabled: Boolean(targetReqId),
    initialData: Boolean(targetReqId) && isMatchingInitial && (initialData?.sourceModel === 'REQUIREMENT' || initialData?.requirementNumber?.startsWith('REQ-')) ? (initialData.requirement || initialData) : undefined,
    staleTime: 60_000,
  });

  const effectiveTargetId = String(bidData?.id || reqData?.id || reqData?.requirement?.id || requestId || targetReqId);

  const { data: buyerResponses = [], refetch: refetchResponses } = useQuery({
    queryKey: ['rfq-buyer-responses-v2', effectiveTargetId, targetReqId, (bidData as any)?.id],
    queryFn: async () => {
      if (!effectiveTargetId) return [];
      try {
        const res = await getApi<any>(`/api/phase4/requirements/${effectiveTargetId}/responses`);
        return Array.isArray(res) ? res : res?.data || res?.responses || [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(effectiveTargetId) && (user?.role === 'buyer' || user?.role === 'admin'),
    staleTime: 15_000,
  });

  const isCurrentSellerAwarded = Boolean((bidData as any)?.isAwarded || (reqData as any)?.isAwarded);

  const { data: invoiceStatusData, isLoading: invoiceStatusLoading } = useQuery({
    queryKey: ['rfq-invoice-status', requestId || effectiveTargetId, user?.id],
    queryFn: async () => {
      const idToQuery = requestId || effectiveTargetId;
      if (!idToQuery) return { exists: false, canConvertToInvoice: false, isAwarded: false, hasAcceptedPO: false };
      try {
        const res = await getApi<any>(`/api/seller/procurement-bids/${idToQuery}/invoice`);
        return res?.data || res || { exists: false, canConvertToInvoice: false, isAwarded: false, hasAcceptedPO: false };
      } catch {
        return { exists: false, canConvertToInvoice: false, isAwarded: false, hasAcceptedPO: false };
      }
    },
    enabled: Boolean(requestId || effectiveTargetId) && user?.role === 'seller' && isCurrentSellerAwarded,
    staleTime: 0,
  });

  useProcurementRealtime(effectiveTargetId);

  const isQueryInProgress = bidLoading || reqLoading;
  const rawBid: any = bidData || (reqData as any)?.requirement || (reqData as any)?.data || reqData || initialData || {};
  const reqObj: any = (reqData as any)?.requirement || reqData || {};

  if (!bidData && !reqData && !initialData && isQueryInProgress) {
    return <ProcurementDetailSkeleton procurementTypeLabel="Request for Quotation" />;
  }

  if (!bidData && !reqData && !initialData && !isQueryInProgress) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-black text-slate-950">Procurement Requirement Not Found</h1>
        <p className="max-w-md text-sm font-semibold leading-relaxed text-slate-500">
          The requested RFQ opportunity could not be loaded or may no longer be available.
        </p>
        <Button onClick={() => router.push(user?.role === 'buyer' ? '/buyer/my-procurements' : '/seller/opportunities')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-6 h-10 rounded-xl">
          {user?.role === 'buyer' ? 'Return to Procurements' : 'Return to Opportunities'}
        </Button>
      </div>
    );
  }

  const isBuyerOrAdmin = user?.role === 'buyer' || user?.role === 'admin' || (user as any)?.role === 'master_admin';
  const statusUpper = String(rawBid.status || reqObj.status || 'OPEN').toUpperCase();
  const canCancel = isBuyerOrAdmin && !['CANCELLED', 'AWARDED', 'COMPLETED', 'CLOSED'].includes(statusUpper);

  const handleConvertToInvoice = async () => {
    const idToUse = requestId || effectiveTargetId;
    if (!idToUse) return;
    setIsConvertingInvoice(true);
    try {
      const result = await postApi<any>(`/api/seller/procurement-bids/${idToUse}/convert-to-invoice`, {});
      toast.success('Invoice generated successfully!');
      const createdInvoiceId = result?.id || result?.data?.id;
      if (createdInvoiceId) {
        router.push(`/seller/invoices/${createdInvoiceId}`);
      } else {
        router.push('/seller/invoices');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to convert to invoice.');
    } finally {
      setIsConvertingInvoice(false);
    }
  };

  const handleSubmitQuotation = () => {
    if (!user) {
      toast.error('Please login to submit a quotation.');
      router.push(`/login?redirect=${encodeURIComponent(pathname || '')}`);
      return;
    }
    const resolvedId = effectiveTargetId || activeRfqId;
    router.push(`/bids/${encodeURIComponent(resolvedId)}/participate`);
  };

  const mergedBid = {
    ...rawBid,
    participations: buyerResponses.length ? buyerResponses : (rawBid.participations || []),
  };

  const viewProps = adaptProcurementUnifiedProps(mergedBid, reqObj, {
    user,
    router,
    requestId: activeRfqId,
    procurementType: 'RFQ',
    procurementLabel: 'Request for Quotation',
    backRouteLabel: isBuyerOrAdmin ? 'My Procurements' : 'Opportunities',
    backRoute: isBuyerOrAdmin ? '/buyer/my-procurements' : '/seller/opportunities/rfqs',
    onRefresh: async () => {
      await Promise.allSettled([refetchBid(), refetchReq(), refetchResponses()]);
    },
    onCancel: canCancel ? () => setCancelModalOpen(true) : undefined,
    onSubmitAction: isBuyerOrAdmin ? () => router.push(`/bids/${effectiveTargetId}/results`) : handleSubmitQuotation,
    invoiceStatusData: user?.role === 'seller' && isCurrentSellerAwarded ? {
      exists: Boolean(invoiceStatusData?.exists),
      invoiceId: invoiceStatusData?.invoiceId,
      canConvertToInvoice: Boolean(invoiceStatusData?.canConvertToInvoice),
      hasAcceptedPO: Boolean(invoiceStatusData?.hasAcceptedPO),
      loading: invoiceStatusLoading,
    } : null,
    isConvertingInvoice,
    onConvertToInvoice: invoiceStatusData?.canConvertToInvoice ? handleConvertToInvoice : undefined,
  });

  return (
    <>
      <ProcurementDetailUnifiedView {...viewProps} />
      {canCancel && (
        <CancelProcurementModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          procurement={{
            id: rawBid?.id || reqObj?.id || (!isNaN(Number(activeRfqId)) ? Number(activeRfqId) : 0) || String(activeRfqId),
            type: rawBid?.sourceModel === 'REQUIREMENT' || reqObj?.id ? 'requirement' : 'bid_tender',
            title: viewProps.subject,
            referenceNumber: viewProps.displayId || String(activeRfqId),
            typeLabel: 'Request for Quotation',
            status: statusUpper,
          }}
          onConfirm={async (params) => {
            await postApi('/api/buyer/procurements/cancel', params);
            toast.success('RFQ cancelled successfully');
            router.push('/buyer/my-procurements');
          }}
        />
      )}
    </>
  );
}

export default function RfqDetailPage({ initialData }: { initialData?: any } = {}) {
  return (
    <Suspense fallback={<ProcurementDetailSkeleton procurementTypeLabel="Request for Quotation" />}>
      <RfqDetailContent initialData={initialData} />
    </Suspense>
  );
}
