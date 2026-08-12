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
      try {
        const bid = await procurementBidApi.detail(requestId);
        if (bid) return bid;
      } catch {}
      try {
        const req = await getApi<any>(`/api/requirements/${requestId}`);
        if (req) return req.data || req;
      } catch {}
      return null;
    },
    enabled: !!requestId,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#12335f]" />
        <p className="text-sm font-bold text-slate-500">Loading procurement details...</p>
      </div>
    );
  }

  const bidObj: any = bidData || {};
  const pt = String(bidObj.procurementType || bidObj.bidType || bidObj.type || bidObj.method || '').toUpperCase();
  const title = String(bidObj.title || bidObj.subject || '').toUpperCase();

  if (pt.includes('OPEN') || title.includes('OPENTENDER') || title.includes('OPEN TENDER')) {
    return <OpenTenderDetailPage />;
  }

  if (pt.includes('LIMITED') || title.includes('LIMITEDTENDER') || title.includes('LIMITED TENDER')) {
    return <LimitedTenderDetailPage />;
  }

  if (pt.includes('RATE') || title.includes('RATE CONTRACT')) {
    return <RateContractDetailPage />;
  }

  if (pt.includes('RFQ') || title.includes('RFQ')) {
    return <RfqDetailPage />;
  }

  return <RfpDetailPage />;
}
