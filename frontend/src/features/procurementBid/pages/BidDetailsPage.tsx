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
import { Skeleton } from '../../../components/ui/skeleton';

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
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 lg:px-8">
          {/* Header Skeleton */}
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-32" />
              <span className="text-slate-300">/</span>
              <Skeleton className="h-4 w-24" />
            </div>
          </div>

          <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0 space-y-3 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-32 rounded-full" />
                </div>
                <div>
                  <Skeleton className="h-8 w-3/4 max-w-lg mb-2" />
                  <div className="flex items-center gap-2 mt-1.5">
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Skeleton className="h-9 w-24 rounded-lg" />
                <Skeleton className="h-9 w-32 rounded-lg" />
              </div>
            </div>
          </header>

          {/* Procurement Status / Stepper Skeleton */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs overflow-hidden">
            <div className="relative flex items-center justify-between w-full max-w-4xl mx-auto">
              <div className="absolute top-4 left-0 w-full h-0.5 bg-slate-100 z-0">
                <Skeleton className="h-full w-full" />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-3 relative z-10 w-1/4">
                  <Skeleton className="h-8 w-8 rounded-full border-4 border-white" />
                  <div className="flex flex-col items-center gap-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ITEM / BOQ DETAILS Skeleton */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-5 gap-4 bg-slate-50 p-3 border-b border-slate-200">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-5 gap-4 p-3 items-center">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* OTHER PROCUREMENT DETAILS Skeleton */}
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <section key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <Skeleton className="h-6 w-40" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="space-y-1.5">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                  {i % 2 === 0 && (
                    <div className="sm:col-span-2 space-y-1.5">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-6 w-48" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  const bidObj: any = bidData || {};
  const pt = String(bidObj.procurementType || bidObj.bidType || bidObj.type || bidObj.method || '').toUpperCase();
  const title = String(bidObj.title || bidObj.subject || '').toUpperCase();

  if (pt.includes('OPEN') || title.includes('OPENTENDER') || title.includes('OPEN TENDER')) {
    return <OpenTenderDetailPage initialData={bidObj} />;
  }

  if (pt.includes('LIMITED') || title.includes('LIMITEDTENDER') || title.includes('LIMITED TENDER')) {
    return <LimitedTenderDetailPage initialData={bidObj} />;
  }

  if (pt.includes('RATE') || title.includes('RATE CONTRACT')) {
    return <RateContractDetailPage initialData={bidObj} />;
  }

  if (pt.includes('RFQ') || title.includes('RFQ')) {
    return <RfqDetailPage initialData={bidObj} />;
  }

  return <RfpDetailPage initialData={bidObj} />;
}
