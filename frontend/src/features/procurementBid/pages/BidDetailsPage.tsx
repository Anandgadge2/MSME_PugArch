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
import ReverseAuctionDetailPage from '../../reverseAuctions/pages/ReverseAuctionDetailPage';
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

      // On /bids/:id routes, procurement bids are the primary resource. Prioritize bid API first!
      const [bidRes, mktRes, reqRes] = await Promise.allSettled([
        procurementBidApi.detail(requestId, true),
        getApi<any>(`/api/marketplace/requirements/${requestId}`),
        getApi<any>(`/api/requirements/${requestId}`)
      ]);

      if (bidRes.status === 'fulfilled' && bidRes.value) {
        const val: any = bidRes.value;
        if (val && (val.id || val.bidNumber || val.title)) {
          return val;
        }
      }
      if (mktRes.status === 'fulfilled' && mktRes.value) {
        const val: any = mktRes.value;
        const item = val?.requirement || val?.data || val;
        if (item && (item.id || item.title || item.requirementNumber)) {
          const matches =
            !requestId ||
            String(item.id) === String(requestId) ||
            String(item.requirementNumber || '').toLowerCase() === String(requestId).toLowerCase() ||
            String(item.bidNumber || '').toLowerCase() === String(requestId).toLowerCase();
          if (matches) return item;
        }
      }
      if (reqRes.status === 'fulfilled' && reqRes.value) {
        const val: any = reqRes.value;
        const item = val?.data || val;
        if (item && (item.id || item.title || item.requirementNumber)) {
          return item;
        }
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
  const validInitialData = bidData && (bidData.id || bidData.bidNumber || bidData.requirementNumber || bidData.title) ? bidData : undefined;
  const queryType = String(searchParams?.get('type') || searchParams?.get('method') || '').toUpperCase();
  const rawMethod = String(
    bidObj.canonicalMethod ||
    bidObj.method ||
    bidObj.procurementMethod ||
    bidObj.sourcingMethod ||
    bidObj.bidType ||
    bidObj.procurementType ||
    bidObj.type ||
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

  // 1. Reverse Auction (Check FIRST before generic Open Tender)
  if (
    Boolean(bidObj.linkedAuctionId || bidObj.auctionId) ||
    rawMethod.includes('AUCTION') ||
    rawMethod.includes('REVERSE') ||
    queryType.includes('AUCTION') ||
    queryType.includes('REVERSE') ||
    title.includes('REVERSE AUCTION') ||
    desc.includes('REVERSE AUCTION') ||
    reqNum.startsWith('RA-') ||
    String(bidObj.bidType || '').toUpperCase() === 'REVERSE AUCTION' ||
    String(bidObj.procurementType || '').toUpperCase() === 'REVERSE AUCTION' ||
    String(bidObj.canonicalMethod || '').toUpperCase() === 'REVERSE_AUCTION'
  ) {
    const auctionTargetId = bidObj.linkedAuctionId || bidObj.auctionId || bidObj.id || requestId;
    return <ReverseAuctionDetailPage id={auctionTargetId} />;
  }

  // 2. Rate Contract (Check before generic Open Tender)
  if (
    rawMethod.includes('RATE') ||
    title.includes('RATE CONTRACT') ||
    title.includes('RATE_CONTRACT') ||
    title.includes('RATE') ||
    desc.includes('RATE_CONTRACT') ||
    desc.includes('RATE CONTRACT') ||
    reqNum.startsWith('RC-') ||
    String(bidObj.canonicalMethod || '').toUpperCase() === 'RATE_CONTRACT' ||
    String(bidObj.bidType || '').toUpperCase() === 'RATE_CONTRACT' ||
    String(bidObj.contractType || '').toUpperCase() === 'RATE_CONTRACT' ||
    String(bidObj.method || '').toUpperCase().includes('RATE') ||
    queryType.includes('RATE')
  ) {
    return <RateContractDetailPage initialData={bidObj} />;
  }

  // 2. Open Tender
  if (rawMethod.includes('OPEN') || title.includes('OPENTENDER') || title.includes('OPEN TENDER')) {
    return <OpenTenderDetailPage initialData={validInitialData} />;
  }

  // 3. Limited Tender
  if (rawMethod.includes('LIMITED') || title.includes('LIMITEDTENDER') || title.includes('LIMITED TENDER')) {
    return <LimitedTenderDetailPage initialData={validInitialData} />;
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
    return <RfqDetailPage initialData={validInitialData} />;
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
    return <RfpDetailPage initialData={validInitialData} />;
  }

  // Default for standard procurement requirement/bid is Request for Quotation
  return <RfqDetailPage initialData={validInitialData} />;
}
