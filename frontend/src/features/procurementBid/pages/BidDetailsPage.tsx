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
import { reverseAuctionApi } from '../../reverseAuctions/api';
import { procurementBidApi } from '../api';
import { getApi } from '../../shared/apiClient';
import { Skeleton, ProcurementDetailSkeleton } from '../../../components/ui/skeleton';
import { useAuth } from '../../../hooks/useAuth';

export default function BidDetailsPage() {
  const pathname = usePathname() || '';
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const pathTokens = pathname.split('/').filter(Boolean);
  const rawPathId = pathTokens.length >= 2 ? pathTokens[pathTokens.length - 1] : '';
  const pathnameId = (rawPathId && !['bids', 'tenders', 'details'].includes(rawPathId.toLowerCase())) ? rawPathId : '';

  const requestId = searchParams.get('requestId') || searchParams.get('id') || pathnameId;

  const { data: bidData, isLoading } = useQuery({
    queryKey: ['bid-dispatcher-meta', requestId, user?.id],
    queryFn: async () => {
      if (!requestId) return null;

      if (/^RA[-_]?/i.test(requestId) || /^PRC[-_]?/i.test(requestId)) {
        try {
          const auction = await reverseAuctionApi.get(requestId);
          if (auction && (auction.id || auction.auctionCode || auction.title)) {
            return {
              ...auction,
              procurementMethod: 'REVERSE_AUCTION',
              procurementType: 'Reverse Auction',
              bidType: 'Reverse Auction'
            };
          }
        } catch {}
      }

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

  // Canonical URL enforcement: If accessed via numeric ID (e.g. /bids/318) or alias,
  // seamlessly rewrite the URL in place to canonical /bids/{bidNumber}?type={method}&...
  React.useEffect(() => {
    if (!bidData || typeof window === 'undefined') return;
    const resolvedRef =
      bidData.bidNumber ||
      bidData.referenceNumber ||
      bidData.requirementNumber ||
      bidData.auctionCode ||
      null;

    if (!resolvedRef) return;

    // Sanitize resolvedRef to ensure no bullets, hyphens or composite tokens get encoded into the URL path
    const cleanRef = String(resolvedRef).split(/[\u2022•|]/)[0].trim().replace(/\s+-\s+.*$/, '');
    if (!cleanRef) return;

    try {
      const currentUrl = new URL(window.location.href);
      const targetPath = `/bids/${encodeURIComponent(cleanRef)}`;
      let changed = false;

      if (currentUrl.pathname !== targetPath) {
        currentUrl.pathname = targetPath;
        changed = true;
      }

      const canonicalType = (
        bidData.procurementMethod ||
        bidData.procurementType ||
        bidData.bidType ||
        searchParams?.get('type') ||
        searchParams?.get('method') ||
        ''
      ).toUpperCase();

      if (canonicalType && !currentUrl.searchParams.has('type')) {
        currentUrl.searchParams.set('type', canonicalType);
        changed = true;
      }

      if (changed) {
        window.history.replaceState(window.history.state, '', currentUrl.toString());
      }
    } catch {}
  }, [bidData, searchParams]);

  if (isLoading) {
    return <ProcurementDetailSkeleton procurementTypeLabel="Procurement Opportunity" />;
  }

  const bidObj: any = bidData || {};
  const validInitialData = bidData && (bidData.id || bidData.bidNumber || bidData.requirementNumber || bidData.title) ? bidData : undefined;
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

  // 1. Rate Contracts (Highest precedence for RC- prefix or explicit RATE_CONTRACT query/method)
  const isRateContract =
    reqNum.startsWith('RC-') ||
    queryType.includes('RATE') ||
    rawMethod.includes('RATE') ||
    title.includes('RATE CONTRACT');

  if (isRateContract) {
    return <RateContractDetailPage initialData={validInitialData} />;
  }

  // 2. Limited Tenders
  const isLimitedTender =
    reqNum.startsWith('LTND-') ||
    queryType.includes('LIMITED') ||
    rawMethod.includes('LIMITED') ||
    title.includes('LIMITEDTENDER') ||
    title.includes('LIMITED TENDER');

  if (isLimitedTender) {
    return <LimitedTenderDetailPage initialData={validInitialData} />;
  }

  // 3. Open Tenders
  const isOpenTender =
    reqNum.startsWith('TND-') ||
    reqNum.startsWith('TENDER-') ||
    queryType.includes('OPEN') ||
    rawMethod.includes('OPEN_TENDER') ||
    rawMethod.includes('OPEN TENDER') ||
    title.includes('OPENTENDER') ||
    title.includes('OPEN TENDER') ||
    ((rawMethod.includes('OPEN') || rawMethod.includes('TENDER')) && !rawMethod.includes('RFQ') && !rawMethod.includes('RFP') && !rawMethod.includes('RATE'));

  if (isOpenTender) {
    return <OpenTenderDetailPage initialData={validInitialData} />;
  }

  // 4. Reverse Auctions (Only standalone auctions with RA- prefix or pure reverse auction sourcing without parent tender)
  const isReverseAuction =
    reqNum.startsWith('RA-') ||
    queryType === 'REVERSE_AUCTION' ||
    rawMethod === 'REVERSE_AUCTION' ||
    (rawMethod.includes('AUCTION') && !rawMethod.includes('RATE') && !rawMethod.includes('TENDER') && !rawMethod.includes('RFQ') && !rawMethod.includes('RFP')) ||
    (title.includes('REVERSE AUCTION') && !title.includes('RATE CONTRACT') && !reqNum.startsWith('RC-'));

  if (isReverseAuction) {
    return <ReverseAuctionDetailPage id={bidObj?.auctionCode || bidObj?.id || requestId} />;
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

  // Default for standard procurement requirement/bid is Request for Quotation
  return <RfqDetailPage initialData={validInitialData} />;
}
