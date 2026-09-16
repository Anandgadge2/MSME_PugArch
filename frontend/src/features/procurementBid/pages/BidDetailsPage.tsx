'use client';

import React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import RfpDetailPage from '../../rfq/pages/RfpDetailPage';
import RfqDetailPage from '../../rfq/pages/RfqDetailPage';
import RateContractDetailPage from '../../rfq/pages/RateContractDetailPage';
import OpenTenderDetailPage from '../../rfq/pages/OpenTenderDetailPage';
import LimitedTenderDetailPage from '../../rfq/pages/LimitedTenderDetailPage';
import { procurementBidApi } from '../api';
import { getApi } from '../../shared/apiClient';
import { Skeleton, ProcurementDetailSkeleton } from '../../../components/ui/skeleton';

export default function BidDetailsPage() {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();

  const pathTokens = pathname.split('/').filter(Boolean);
  const rawPathId = pathTokens.length >= 2 ? pathTokens[pathTokens.length - 1] : '';
  const pathnameId = (rawPathId && !['bids', 'tenders', 'details'].includes(rawPathId.toLowerCase())) ? rawPathId : '';

  const requestId = searchParams.get('requestId') || searchParams.get('id') || pathnameId;

  const { data: bidData, isLoading } = useQuery({
    queryKey: ['bid-dispatcher-meta', requestId],
    queryFn: async () => {
      if (!requestId) return null;

      const isReqPattern = /^REQ[-_]?\d+/i.test(requestId);

      if (isReqPattern) {
        try {
          const req = await getApi<any>(`/api/marketplace/requirements/${requestId}`);
          const item = req?.requirement || req?.data || req;
          if (item && (item.id || item.title || item.requirementNumber)) return item;
        } catch {}
        try {
          const req = await getApi<any>(`/api/requirements/${requestId}`);
          const item = req?.data || req;
          if (item && (item.id || item.title || item.requirementNumber)) return item;
        } catch {}
      }

      const [mktRes, bidRes, reqRes] = await Promise.allSettled([
        getApi<any>(`/api/marketplace/requirements/${requestId}`),
        procurementBidApi.detail(requestId),
        getApi<any>(`/api/requirements/${requestId}`)
      ]);

      if (mktRes.status === 'fulfilled' && mktRes.value) {
        const val: any = mktRes.value;
        const item = val?.requirement || val?.data || val;
        if (item && (item.id || item.title || item.requirementNumber)) return item;
      }
      if (bidRes.status === 'fulfilled' && bidRes.value) {
        return bidRes.value;
      }
      if (reqRes.status === 'fulfilled' && reqRes.value) {
        const val: any = reqRes.value;
        return val?.data || val;
      }
      return null;
    },
    enabled: !!requestId,
    staleTime: 60_000,
  });

  if (isLoading) {
    return <ProcurementDetailSkeleton procurementTypeLabel="Procurement Opportunity" />;
  }

  const bidObj: any = bidData || {};
  const queryType = String(searchParams?.get('type') || searchParams?.get('method') || '').toUpperCase();
  const rawMethod = String(
    bidObj.procurementMethod ||
    bidObj.sourcingMethod ||
    bidObj.procurementType ||
    bidObj.bidType ||
    bidObj.type ||
    bidObj.method ||
    bidObj.canonicalMethod ||
    bidObj.methodSlug ||
    bidObj.payload?.basics?.procurementMethod ||
    bidObj.payload?.basics?.procurementType ||
    bidObj.payload?.type ||
    bidObj.technicalPacket?.basics?.procurementMethod ||
    bidObj.technicalPacket?.basics?.procurementType ||
    queryType ||
    ''
  ).toUpperCase();
  const desc = String(bidObj.description || bidObj.payload?.basics?.description || '').toUpperCase();
  const title = String(bidObj.title || bidObj.subject || '').toUpperCase();
  const reqNum = String(bidObj.requirementNumber || bidObj.referenceNumber || bidObj.bidNumber || requestId || '').toUpperCase();

  if (rawMethod.includes('OPEN') || title.includes('OPENTENDER') || title.includes('OPEN TENDER')) {
    return <OpenTenderDetailPage initialData={bidObj} />;
  }

  if (rawMethod.includes('LIMITED') || title.includes('LIMITEDTENDER') || title.includes('LIMITED TENDER')) {
    return <LimitedTenderDetailPage initialData={bidObj} />;
  }

  if (rawMethod.includes('RATE') || title.includes('RATE CONTRACT') || reqNum.startsWith('RC-')) {
    return <RateContractDetailPage initialData={bidObj} />;
  }

  const isRfq =
    queryType.includes('RFQ') ||
    rawMethod.includes('RFQ') ||
    rawMethod.includes('QUOTATION') ||
    title.includes('RFQ') ||
    title.includes('REQUEST FOR QUOTATION') ||
    desc.includes('SOURCING METHOD: RFQ') ||
    desc.includes('METHOD: RFQ') ||
    reqNum.startsWith('RFQ-');

  if (isRfq) {
    return <RfqDetailPage initialData={bidObj} />;
  }

  const isExplicitRfp =
    (queryType.includes('RFP') ||
      rawMethod.includes('RFP') ||
      rawMethod.includes('REQUEST FOR PROPOSAL') ||
      title.includes('RFP') ||
      title.includes('REQUEST FOR PROPOSAL') ||
      desc.includes('SOURCING METHOD: RFP') ||
      reqNum.startsWith('RFP-')) &&
    !rawMethod.includes('RFQ');

  if (isExplicitRfp) {
    return <RfpDetailPage initialData={bidObj} />;
  }

  // Default for standard procurement requirement/bid is Request for Quotation
  return <RfqDetailPage initialData={bidObj} />;
}
