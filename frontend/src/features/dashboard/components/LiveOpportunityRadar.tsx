'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { 
  Gavel, 
  FileText, 
  Clock, 
  MapPin, 
  Building2, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Zap, 
  TrendingUp,
  Tag,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/card';
import { procurementBidApi } from '../../procurementBid/api';
import { reverseAuctionApi } from '../../reverseAuctions/api';
import { useAuth } from '../../../hooks/useAuth';
import { isShgUser } from '../../../lib/shg';

type FilterTab = 'all' | 'tenders' | 'rfqs' | 'auctions';

interface OpportunityItem {
  id: string;
  refId: string;
  title: string;
  type: 'Tender' | 'RFQ' | 'Reverse Auction';
  buyerName: string;
  department?: string;
  location: string;
  estimatedValue: number;
  closingDate: string;
  daysLeft: number;
  isEmdExempt: boolean;
  category: string;
  actionHref: string;
  actionLabel: string;
  urgent?: boolean;
}

export function LiveOpportunityRadar() {
  const { user } = useAuth();
  const isShg = isShgUser(user) || user?.role === 'shg';
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-live-opportunities'],
    queryFn: async () => {
      const [bidsRes, auctionsRes] = await Promise.allSettled([
        procurementBidApi.list({ take: 8 }),
        reverseAuctionApi.list({ pageSize: 6 })
      ]);

      const bids = bidsRes.status === 'fulfilled' && bidsRes.value
        ? (bidsRes.value?.items || (Array.isArray(bidsRes.value) ? bidsRes.value : []))
        : [];

      const auctions = auctionsRes.status === 'fulfilled' && auctionsRes.value
        ? ((auctionsRes.value as any)?.items || (auctionsRes.value as any)?.auctions || (Array.isArray(auctionsRes.value) ? auctionsRes.value : []))
        : [];

      return { bids, auctions };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  const opportunities: OpportunityItem[] = useMemo(() => {
    const list: OpportunityItem[] = [];
    const rolePrefix = isShg ? '/shg' : '/seller';
    const now = new Date();

    // 1. Process Bids (RFQs, Tenders, etc.)
    if (data?.bids && data.bids.length > 0) {
      data.bids.forEach((bid: any, idx: number) => {
        const closing = bid.endDate ? new Date(bid.endDate) : null;
        const diffDays = closing ? Math.max(1, Math.ceil((closing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 5;
        
        const pType = String(bid.procurementType || bid.bidType || '').toUpperCase();
        const isAuction = pType === 'REVERSE_AUCTION' || pType === 'AUCTION';
        const isRfq = pType === 'RFQ' || pType.includes('RFQ') || (!pType.includes('TENDER') && !isAuction);
        
        const type: OpportunityItem['type'] = isAuction ? 'Reverse Auction' : isRfq ? 'RFQ' : 'Tender';

        let actionHref = '';
        let actionLabel = '';

        if (type === 'Reverse Auction') {
          actionHref = `${rolePrefix}/procurement/reverse-auction/${bid.auctionCode || bid.id}/live`;
          actionLabel = 'Join Auction';
        } else if (type === 'RFQ') {
          actionHref = `${rolePrefix}/procurement/rfq/${bid.id}`;
          actionLabel = 'Quote Now';
        } else {
          actionHref = `${rolePrefix}/procurement/open-tender/${bid.id}`;
          actionLabel = 'Bid Now';
        }

        list.push({
          id: String(bid.id || `bid-${idx}`),
          refId: bid.bidNumber || (bid.id ? `BID-${bid.id}` : `TND-${1000 + idx}`),
          title: bid.title || 'Procurement Opportunity',
          type,
          buyerName: bid.buyerName || bid.organization?.organizationName || 'Verified Buyer',
          department: bid.departmentName || 'Procurement Division',
          location: bid.deliveryLocation || bid.location || [bid.district, bid.state].filter(Boolean).join(', ') || 'National',
          estimatedValue: Number(bid.estimatedValue || bid.budget || 0),
          closingDate: bid.endDate ? new Date(bid.endDate).toISOString().split('T')[0] : 'Open',
          daysLeft: diffDays,
          isEmdExempt: Boolean(bid.emdExempt),
          category: bid.category || 'General',
          actionHref,
          actionLabel,
          urgent: diffDays <= 3
        });
      });
    }

    // Direct Auctions
    if (Array.isArray(data?.auctions)) {
      data.auctions.forEach((auction: any) => {
        if (!auction) return;
        const closing = auction.endTime ? new Date(auction.endTime) : null;
        const diffDays = closing ? Math.max(1, Math.ceil((closing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 5;

        list.push({
          id: `ra-${auction.id}`,
          refId: auction.auctionCode || `RA-${auction.id}`,
          title: auction.title || auction.itemName || 'Live Reverse Auction Opportunity',
          type: 'Reverse Auction',
          buyerName: auction.buyerOrgName || auction.buyerName || 'Verified Buyer',
          department: auction.departmentName || 'Procurement Division',
          location: auction.location || auction.deliveryLocation || [auction.district, auction.state].filter(Boolean).join(', ') || 'National',
          estimatedValue: Number(auction.currentLowestAmount || auction.startPrice || 0),
          closingDate: auction.endTime ? new Date(auction.endTime).toISOString().split('T')[0] : 'Open',
          daysLeft: diffDays,
          isEmdExempt: true,
          category: auction.category || 'Dynamic Auction',
          actionHref: `${rolePrefix}/procurement/reverse-auction/${auction.auctionCode || auction.id}/live`,
          actionLabel: 'Join Auction',
          urgent: diffDays <= 3
        });
      });
    }

    return list;
  }, [data, isShg]);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return opportunities;
    if (activeTab === 'tenders') return opportunities.filter(o => o.type === 'Tender');
    if (activeTab === 'rfqs') return opportunities.filter(o => o.type === 'RFQ');
    if (activeTab === 'auctions') return opportunities.filter(o => o.type === 'Reverse Auction');
    return opportunities;
  }, [opportunities, activeTab]);

  const countByTab = useMemo(() => ({
    all: opportunities.length,
    tenders: opportunities.filter(o => o.type === 'Tender').length,
    rfqs: opportunities.filter(o => o.type === 'RFQ').length,
    auctions: opportunities.filter(o => o.type === 'Reverse Auction').length
  }), [opportunities]);

  const rolePrefix = isShg ? '/shg' : '/seller';
  const viewAllHref = activeTab === 'tenders'
    ? `${rolePrefix}/opportunities/open-tenders`
    : activeTab === 'rfqs'
    ? `${rolePrefix}/opportunities/rfqs`
    : activeTab === 'auctions'
    ? `${rolePrefix}/opportunities/auctions`
    : `${rolePrefix}/opportunities`;

  const viewAllLabel = activeTab === 'tenders'
    ? 'View All Tenders'
    : activeTab === 'rfqs'
    ? 'View All RFQs'
    : activeTab === 'auctions'
    ? 'View All Auctions'
    : `View All (${opportunities.length})`;

  return (
    <section 
      aria-labelledby="live-opportunities-heading"
      className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden flex flex-col"
    >
      {/* ── Card Header ── */}
      <div className="bg-slate-50/50 px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-indigo-50 text-[#12335f] flex items-center justify-center font-bold">
            <Zap className="h-4 w-4 fill-indigo-500/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 id="live-opportunities-heading" className="text-xs font-bold uppercase tracking-wide text-slate-900">
                Live Opportunities & Matched Leads
              </h2>
              {opportunities.length > 0 && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              )}
            </div>
            <p className="text-[10px] font-medium text-slate-500">
              Matched to your registered business category & geographical presence
            </p>
          </div>
        </div>

        <Link 
          href={viewAllHref}
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#12335f] hover:text-[#0b2445] transition shrink-0"
        >
          {viewAllLabel}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1.5 px-3.5 py-2 border-b border-slate-100 bg-white overflow-x-auto no-scrollbar" role="tablist" aria-label="Opportunity types">
        {(['all', 'tenders', 'rfqs', 'auctions'] as FilterTab[]).map(tab => {
          const isActive = activeTab === tab;
          const count = countByTab[tab];
          const label = tab === 'all' ? 'All Leads' : tab === 'tenders' ? 'Public Tenders' : tab === 'rfqs' ? 'Direct RFQs' : 'Reverse Auctions';
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
                isActive 
                  ? 'bg-[#12335f] text-white shadow-xs' 
                  : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              <span>{label}</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Opportunity List / Empty State ── */}
      {isLoading ? (
        <div className="py-10 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-[#12335f]" />
          <span className="text-xs font-medium">Scanning live opportunities...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center bg-slate-50/50">
          <Gavel className="h-8 w-8 mx-auto text-slate-300 mb-2" />
          <p className="text-xs font-bold text-slate-700">
            {activeTab === 'auctions' 
              ? 'No live reverse auctions right now.'
              : activeTab === 'rfqs'
              ? 'No direct RFQs found.'
              : activeTab === 'tenders'
              ? 'No public tenders found.'
              : 'No active opportunities found.'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {activeTab === 'auctions'
              ? 'Real-time dynamic reverse auctions and bidding events will appear here when scheduled by buyers.'
              : activeTab === 'rfqs'
              ? 'Direct price quotation requests from buyer departments will appear here in real time.'
              : activeTab === 'tenders'
              ? 'Public competitive tenders matching your registered categories will appear here in real time.'
              : 'New public tenders and buyer RFQs matching your business categories will appear here in real time.'}
          </p>
          <Link href={viewAllHref} className="mt-3 inline-block">
            <Button variant="outline" className="h-7 px-3 text-[10px] font-bold uppercase bg-white">
              {activeTab === 'auctions' ? 'Explore All Opportunities' : 'Browse All Opportunities'}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 p-2 sm:p-3 space-y-2">
          {filtered.map((item) => {
            const isTender = item.type === 'Tender';
            const isRfq = item.type === 'RFQ';

            return (
              <div 
                key={item.id}
                className="group rounded-lg p-2.5 sm:p-3 transition-all duration-200 bg-slate-50/40 hover:bg-slate-50 border border-slate-200/60 hover:border-indigo-200 hover:shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                {/* Left Details */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded tracking-wider border ${
                      isTender 
                        ? 'bg-blue-50 text-blue-700 border-blue-200' 
                        : isRfq 
                        ? 'bg-purple-50 text-purple-700 border-purple-200' 
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {item.type}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 font-mono">
                      {item.refId}
                    </span>
                    {item.isEmdExempt && (
                      <span className="inline-flex items-center gap-0.5 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShieldCheck className="h-2.5 w-2.5" /> EMD Exempt
                      </span>
                    )}
                    {item.urgent && (
                      <span className="inline-flex items-center gap-0.5 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 animate-pulse">
                        <Clock className="h-2.5 w-2.5" /> {item.daysLeft}d left
                      </span>
                    )}
                  </div>

                  <Link href={item.actionHref} className="block group/link">
                    <h3 className="text-xs font-bold text-slate-900 line-clamp-1 group-hover/link:text-[#12335f] group-hover/link:underline transition-colors">
                      {item.title}
                    </h3>
                  </Link>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1 font-medium text-slate-700 truncate max-w-[200px]">
                      <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                      {item.buyerName}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-slate-500">
                      <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                      {item.location}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-slate-500">
                      <Tag className="h-3 w-3 text-slate-400 shrink-0" />
                      {item.category}
                    </span>
                  </div>
                </div>

                {/* Right Action & Value */}
                <div className="flex items-center justify-between md:flex-col md:items-end shrink-0 gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-left md:text-right">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Est. Value</p>
                    <p className="text-xs font-extrabold text-[#12335f]">
                      {item.estimatedValue > 0 ? `₹${item.estimatedValue.toLocaleString('en-IN')}` : 'Quote Based'}
                    </p>
                  </div>

                  <Link href={item.actionHref}>
                    <Button 
                      className="h-7 px-3 rounded bg-[#12335f] hover:bg-[#0b2445] text-white text-[9px] font-bold uppercase tracking-wider shadow-xs transition"
                    >
                      {item.actionLabel}
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Card Footer Fast Insight ── */}
      <div className="bg-slate-50/80 px-3.5 py-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-medium text-slate-600">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
          MSME advantage: 100% EMD waived on all public tenders.
        </span>
        <Link 
          href={`${rolePrefix}/opportunities`}
          className="font-bold uppercase tracking-wider text-[#12335f] hover:underline"
        >
          Explore All Opportunities →
        </Link>
      </div>
    </section>
  );
}

export default React.memo(LiveOpportunityRadar);
