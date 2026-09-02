'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { sellerRoutes } from '@/lib/routes';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Eye,
  FileText,
  Gavel,
  Globe,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  IndianRupee,
  Clock,
  Users,
  CheckCircle2,
  Layers,
  RotateCcw,
  TrendingUp,
  type LucideIcon
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import { marketplaceApi } from '../../marketplace/api';
import { procurementBidApi } from '../../procurementBid/api';
import { fetchQuoteRequests } from '../../rfq/api';
import { reverseAuctionApi } from '../../reverseAuctions/api';
import { fetchRateContracts } from '../../rateContract/api';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { useResponsiveViewMode } from '../../shared/hooks';
import { Pagination } from '../../shared/Pagination';
import { KpiCard } from '../../shared/KpiCard';
import ProcurementLifecycleTracker from '../../procurementLifecycle/components/ProcurementLifecycleTracker';
import type { ProcurementLifecycleEvent } from '../../procurementLifecycle/statusMapper';
import { useAuth } from '../../../hooks/useAuth';
import { getSellerOpportunityAdapter } from '../adapters';
import { formatRefId } from '../../../utils/refIdUtils';

type OpportunityType = 'RFQ' | 'RFP' | 'Open Tender' | 'Limited Tender' | 'Reverse Auction' | 'Direct Purchase' | 'Rate Contract' | 'Repeat Order';

interface SellerOpportunity {
  id: string;
  type: OpportunityType;
  title: string;
  buyer?: string;
  category?: string;
  location?: string;
  closingDate?: string;
  estimatedValue?: number;
  eligibility: string;
  status: string;
  actionLabel: string;
  href: string;
  detailsHref: string;
  sourceRef: string;
  isInvitation?: boolean;
  publishedAt?: string;
  quantity?: string;
  description?: string;
  documents?: string[];
  responseCount?: number;
  nextAction: string;
  buyerType?: string;
  department?: string;
  deliveryLocation?: string;
  procurementType?: string;
  documentsCount?: number;
  terms?: string[];
  detailRows?: Array<{ label: string; value: string }>;
  events: ProcurementLifecycleEvent[];
}

const DEFAULT_PAGE_SIZE = 10;

const formatDate = (value?: string) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatMoney = (value?: number) => {
  if (!value || Number.isNaN(value)) return 'Value not shown';
  return `Rs. ${value.toLocaleString('en-IN')}`;
};

const formatQuantity = (quantity?: unknown, unit?: unknown) => {
  const value = String(quantity || '').trim();
  const suffix = String(unit || '').trim();
  if (!value) return '';
  return [value, suffix].filter(Boolean).join(' ');
};

const asTextList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  const text = String(value || '').trim();
  return text ? [text] : [];
};

const toNumber = (value: unknown) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Helper to identify closed / dead / concluded opportunity status
 */
const isClosedStatus = (status?: string) => {
  const s = String(status || '').toLowerCase();
  return s.includes('closed') || s.includes('awarded') || s.includes('cancelled') || s.includes('expired') || s.includes('completed') || s.includes('rejected');
};

/**
 * Helper to test if an opportunity is open and active for bidding
 */
const isOpenOpportunity = (item: SellerOpportunity, now: number) => {
  if (isClosedStatus(item.status)) return false;
  if (item.closingDate) {
    const diff = (new Date(item.closingDate).getTime() - now) / 86400000;
    if (diff < 0) return false;
  }
  return true;
};

/**
 * Helper to test if an opportunity closes within the next 7 days
 */
const isClosingSoonOpportunity = (item: SellerOpportunity, now: number) => {
  if (!isOpenOpportunity(item, now)) return false;
  if (!item.closingDate) return false;
  const diff = (new Date(item.closingDate).getTime() - now) / 86400000;
  return diff >= 0 && diff <= 7;
};

/**
 * Helper to test if this seller has participated / submitted a bid
 */
const isParticipatedOpportunity = (item: SellerOpportunity) => {
  const elig = String(item.eligibility || '').toLowerCase();
  const stat = String(item.status || '').toLowerCase();
  const action = String(item.actionLabel || '').toLowerCase();
  return (
    elig.includes('participated') ||
    stat.includes('submitted') ||
    stat.includes('participated') ||
    action.includes('track') ||
    action.includes('view response')
  );
};

/**
 * Helper to test if opportunity is under evaluation
 */
const isUnderEvaluationOpportunity = (item: SellerOpportunity, now: number) => {
  const stat = String(item.status || '').toLowerCase();
  if (stat.includes('eval') || stat.includes('review') || stat.includes('shortlist') || stat.includes('technical')) return true;
  if (item.closingDate) {
    const diff = (new Date(item.closingDate).getTime() - now) / 86400000;
    if (diff < 0 && !stat.includes('awarded') && !stat.includes('cancelled') && !stat.includes('completed')) {
      return true;
    }
  }
  return false;
};

/**
 * Clean procurement descriptions
 */
const cleanOpportunitySummary = (desc?: string | null): string => {
  if (!desc) return '';
  return desc
    .replace(/\r/g, '')
    .replace(/Sourcing Method:\s*(.*?)(?=(?:Value:|Urgency:|$))/is, '')
    .replace(/Value:\s*(.*?)(?=(?:Urgency:|$))/is, '')
    .replace(/Urgency:\s*(.*?)(?=$)/is, '')
    .replace(/[\n\r|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const opportunityEvents = (status?: string, createdAt?: string): ProcurementLifecycleEvent[] => [
  {
    stage: 'PROCUREMENT_CREATED',
    status: status || 'open',
    description: 'Buyer opportunity is available for seller review',
    createdAt,
  },
];

const nextActionFor = (item: Pick<SellerOpportunity, 'type' | 'status' | 'eligibility'>) => {
  const status = String(item.status || '').toLowerCase();
  if (status.includes('closed') || status.includes('awarded')) return 'This opportunity is no longer open for a new seller response. Review details and track the result.';
  if (item.eligibility.toLowerCase().includes('participated')) return 'Your participation is recorded. Track buyer evaluation, award, PO, delivery, invoice, and settlement from this panel.';
  if (item.type === 'Reverse Auction') return 'Open auction details, verify invitation and timeline, then join the live auction when it is active.';
  if (item.type === 'RFQ') return 'Open RFQ details, verify commercial terms and deadline, then submit the quotation before closure.';
  return 'Open details, review documents and eligibility, then submit the bid or response before the closing date.';
};

const typeFromQuery = (value: string | null): OpportunityType | '' => {
  if (value === 'rfq' || value === 'quote') return 'RFQ';
  if (value === 'rfp') return 'RFP';
  if (value === 'open-tender' || value === 'large') return 'Open Tender';
  if (value === 'limited-tender' || value === 'invitations') return 'Limited Tender';
  if (value === 'reverse-auction' || value === 'auction') return 'Reverse Auction';
  if (value === 'rate-contract' || value === 'rate-contracts') return 'Rate Contract';
  return '';
};

const getSubRouteType = (): OpportunityType | '' => {
  if (typeof window === 'undefined') return '';
  const path = window.location.pathname;
  if (path.endsWith('/rfqs')) return 'RFQ';
  if (path.endsWith('/rfps')) return 'RFP';
  if (path.endsWith('/open-tenders')) return 'Open Tender';
  if (path.endsWith('/invitations')) return 'Limited Tender';
  if (path.endsWith('/auctions')) return 'Reverse Auction';
  if (path.endsWith('/rate-contracts')) return 'Rate Contract';
  return '';
};

let globalOpportunitiesCache: SellerOpportunity[] | null = null;

const isSameOpportunities = (a: SellerOpportunity[] | null, b: SellerOpportunity[]) => {
  if (!a) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || 
        a[i].status !== b[i].status || 
        a[i].responseCount !== b[i].responseCount ||
        a[i].title !== b[i].title ||
        a[i].estimatedValue !== b[i].estimatedValue ||
        a[i].closingDate !== b[i].closingDate) {
      return false;
    }
  }
  return true;
};

const formatCurrency = (value: number | string | null | undefined) => {
  const num = Number(value || 0);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const getDaysLeftText = (closingDate?: string) => {
  if (!closingDate) return '';
  const diff = (new Date(closingDate).getTime() - Date.now()) / 86400000;
  if (diff < 0) return 'Closed';
  const days = Math.ceil(diff);
  return `${days} Day${days > 1 ? 's' : ''} Left`;
};

function CountdownTimer({ endDate }: { endDate?: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!endDate) return;
    const calculateTime = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Ended');
        return;
      }
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      
      const pad = (n: number) => String(n).padStart(2, '0');
      setTimeLeft(`${pad(hrs)}h : ${pad(mins)}m : ${pad(secs)}s`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  return <span className="font-mono text-xs font-black text-red-600 animate-pulse">{timeLeft}</span>;
}

export default function SellerOpportunitiesPage({ subRouteType = '' }: { subRouteType?: OpportunityType | '' }) {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<SellerOpportunity[]>(() => globalOpportunitiesCache || []);
  const [loading, setLoading] = useState(() => !globalOpportunitiesCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [prevSubRouteType, setPrevSubRouteType] = useState(subRouteType);
  const [type, setType] = useState<OpportunityType | ''>(() => subRouteType || typeFromQuery(searchParams?.get('type')));

  if (subRouteType !== prevSubRouteType) {
    setPrevSubRouteType(subRouteType);
    setType(subRouteType);
  }
  const [status, setStatus] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SellerOpportunity | null>(null);
  const [viewMode, setViewMode] = useResponsiveViewMode('seller:opportunities:view-mode');
  const [kpiFilter, setKpiFilter] = useState<'all' | 'live' | 'dueSoon' | 'highValue' | 'participated' | 'evaluation'>('all');
  const [category, setCategory] = useState('');
  const [valueRange, setValueRange] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('');
  const [sortField, setSortField] = useState<'type' | 'title' | 'buyer' | 'publishedAt' | 'closingDate' | 'estimatedValue' | ''>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [nowMs] = useState(() => Date.now());

  const todayStr = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const handleStartDateChange = (val: string) => {
    if (val && val > todayStr) {
      toast.warning('Future dates are not allowed');
      return;
    }
    setStartDate(val);
    if (endDate && val && val > endDate) {
      setEndDate(val);
    }
    setPage(1);
  };

  const handleEndDateChange = (val: string) => {
    if (val && val > todayStr) {
      toast.warning('Future dates are not allowed');
      return;
    }
    setEndDate(val);
    if (startDate && val && val < startDate) {
      setStartDate(val);
    }
    setPage(1);
  };

  const handleSort = (field: 'type' | 'title' | 'buyer' | 'publishedAt' | 'closingDate' | 'estimatedValue') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortIcon = (field: 'type' | 'title' | 'buyer' | 'publishedAt' | 'closingDate' | 'estimatedValue') => {
    if (sortField !== field) {
      return <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-slate-300 opacity-40 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="ml-1 h-3.5 w-3.5 shrink-0 text-blue-600 font-extrabold" />
      : <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 text-blue-600 font-extrabold" />;
  };

  const load = React.useCallback((forceFresh = false) => {
    let alive = true;
    if (forceFresh) {
      setLoading(true);
      globalOpportunitiesCache = null;
      setItems([]);
    }

    const dedupeAndSort = (opportunities: SellerOpportunity[]): SellerOpportunity[] => {
      const seenKeys = new Set<string>();
      const seenRefKeys = new Set<string>();
      const seenTitleKeys = new Set<string>();
      const deduped: SellerOpportunity[] = [];

      const cleanCoreTitle = (str: string) => {
        const cleaned = (str || '')
          .toLowerCase()
          .replace(/^procurement of\s+/, '')
          .replace(/\b(annual|rate|contract|contracts|for|service|services|1|year|years|supply|supplies|procurement|of)\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return cleaned || (str || '').trim().toLowerCase();
      };

      const extractRefKeys = (opp: SellerOpportunity) => {
        const keys: string[] = [];
        if (opp.sourceRef) keys.push(String(opp.sourceRef).toUpperCase().trim());

        const searchStr = `${opp.href || ''} ${opp.detailsHref || ''} ${JSON.stringify(opp.detailRows || [])}`;
        const reqIdMatches = searchStr.match(/requirementId=(\d+)/gi) || [];
        const reqNoMatches = searchStr.match(/REQ-[\w-]+/gi) || [];
        const rcNoMatches = searchStr.match(/RC-[\w-]+/gi) || [];

        for (const m of [...reqIdMatches, ...reqNoMatches, ...rcNoMatches]) {
          keys.push(m.toUpperCase().trim());
        }
        return Array.from(new Set(keys));
      };

      opportunities.forEach(opportunity => {
        const exactKey = `${opportunity.type}_${opportunity.sourceRef}_${(opportunity.title || '').trim().toLowerCase()}`;
        const coreTitle = cleanCoreTitle(opportunity.title);
        const titleKey = `${opportunity.type}_${coreTitle}`;

        const refKeys = extractRefKeys(opportunity);
        const existingIndex = deduped.findIndex(item => {
          const itemExact = `${item.type}_${item.sourceRef}_${(item.title || '').trim().toLowerCase()}`;
          const itemTitleKey = `${item.type}_${cleanCoreTitle(item.title)}`;
          const itemRefKeys = extractRefKeys(item);

          if (itemExact === exactKey || itemTitleKey === titleKey) return true;
          return refKeys.length > 0 && refKeys.some(r => itemRefKeys.includes(r));
        });

        if (existingIndex === -1) {
          seenKeys.add(exactKey);
          seenTitleKeys.add(titleKey);
          refKeys.forEach(ref => seenRefKeys.add(ref));
          deduped.push(opportunity);
        } else {
          const existing = deduped[existingIndex];
          const titleA = existing.title || '';
          const titleB = opportunity.title || '';
          const bestTitle = titleB.length > titleA.length ? titleB : titleA;

          const buyerA = existing.buyer || '';
          const buyerB = opportunity.buyer || '';
          const isGenericBuyer = (b: string) => !b || b === 'Verified Buyer' || b === 'Buyer organization';
          const bestBuyer = isGenericBuyer(buyerA) && !isGenericBuyer(buyerB) ? buyerB : (isGenericBuyer(buyerB) ? buyerA : buyerB);

          const categoryA = existing.category || '';
          const categoryB = opportunity.category || '';
          const isGenericCat = (c: string) => !c || c === 'Rate Contract' || c === 'General Sourcing';
          const bestCategory = isGenericCat(categoryA) && !isGenericCat(categoryB) ? categoryB : categoryA;

          const locA = existing.location || '';
          const locB = opportunity.location || '';
          const isGenericLoc = (l: string) => !l || l.includes('Location not specified') || l.includes('Delivery within agreed SLA');
          const bestLoc = isGenericLoc(locA) && !isGenericLoc(locB) ? locB : locA;

          const valA = existing.estimatedValue || 0;
          const valB = opportunity.estimatedValue || 0;
          let bestVal = valA;
          if (valA > 50000000 && valB > 0 && valB <= 50000000) {
            bestVal = valB;
          } else if ((valA === 0 || valA > 50000000) && valB > 0) {
            bestVal = valB;
          }

          deduped[existingIndex] = {
            ...existing,
            title: bestTitle,
            buyer: bestBuyer,
            category: bestCategory,
            location: bestLoc,
            estimatedValue: bestVal,
            href: existing.href || opportunity.href,
            detailsHref: existing.detailsHref || opportunity.detailsHref,
          };
        }
      });

      return deduped.sort((a, b) => new Date(a.closingDate || 0).getTime() - new Date(b.closingDate || 0).getTime());
    };

    const applyChunk = (newOpportunities: SellerOpportunity[]) => {
      if (!alive || !newOpportunities.length) return;
      setItems(prev => {
        const sorted = dedupeAndSort([...prev, ...newOpportunities]);
        globalOpportunitiesCache = sorted;
        return sorted;
      });
      setLoading(false);
    };

    // Trigger parallel fetches and stream results as each completes
    const p1 = procurementBidApi.list({ pageSize: 50 }).then(res => {
      if (!alive) return;
      const next: SellerOpportunity[] = [];
      const bids = res?.items || [];
      bids.forEach((bid: any) => {
        const method = String(bid.procurementType || bid.bidType || '').toUpperCase();
        const allowedMethods = ['RFQ', 'RFP', 'OPEN_TENDER', 'LIMITED_TENDER', 'REVERSE_AUCTION', 'TENDER', 'REPEAT_ORDER', 'RATE_CONTRACT'];
        if (!allowedMethods.includes(method)) return;

        const documents = asTextList(bid.requiredDocuments);
        const terms = asTextList(bid.terms);

        const upperTitle = String(bid.title || bid.itemName || '').toUpperCase();
        const upperMethod = method;
        const upperBidNumber = String(bid.id || bid.bidNumber || bid.sourceId || '').toUpperCase();

        const isExplicitBidRfq = method === 'RFQ' || bid.procurementType === 'RFQ' || bid.bidType === 'RFQ';
        const isExplicitBidRfp = method === 'RFP' || bid.procurementType === 'RFP' || bid.bidType === 'RFP';
        const isExplicitBidTender = method.includes('TENDER') || String(bid.procurementType || '').includes('TENDER');

        const isBidRateContract = !isExplicitBidRfq && !isExplicitBidRfp && !isExplicitBidTender && (
          upperMethod.includes('RATE') ||
          upperTitle.includes('RATE CONTRACT') ||
          upperBidNumber.startsWith('RC-') ||
          bid.sourceModel === 'RATE_CONTRACT' ||
          bid.procurementType === 'RATE_CONTRACT' ||
          bid.bidType === 'RATE_CONTRACT'
        );

        let opportunityType: OpportunityType = 'RFQ';
        if (isBidRateContract) opportunityType = 'Rate Contract';
        else if (method === 'RFP' || upperMethod.includes('RFP')) opportunityType = 'RFP';
        else if (method === 'LIMITED_TENDER' || method === 'LIMITED' || method.includes('LIMITED')) opportunityType = 'Limited Tender';
        else if (method === 'OPEN_TENDER' || method === 'TENDER') opportunityType = 'Open Tender';
        else if (method === 'REVERSE_AUCTION') opportunityType = 'Reverse Auction';
        else if (method === 'REPEAT_ORDER') opportunityType = 'Repeat Order';

        let actionLabel = bid.participated ? 'Track Status' : 'Submit Bid';
        let href = `/bids/${bid.id}/participate`;
        let detailsHref = `/bids/${bid.id}`;

        if (opportunityType === 'Rate Contract') {
          href = sellerRoutes.respond('RATE_CONTRACT', bid.id);
          detailsHref = sellerRoutes.detail('RATE_CONTRACT', bid.id);
          actionLabel = bid.participated ? 'Track Status' : 'Submit Quote';
        } else if (bid.sourceModel === 'TENDER' && bid.sourceId) {
          href = `/seller/tenders/${bid.sourceId}/bid`;
          detailsHref = `/tenders?tender=${bid.sourceId}`;
          actionLabel = bid.participated ? 'Track Status' : 'Submit Quote';
        } else if (method === 'RFP' || opportunityType === 'RFP') {
          href = sellerRoutes.detail('RFP', bid.id);
          detailsHref = sellerRoutes.detail('RFP', bid.id);
          actionLabel = 'Submit Proposal';
        } else {
          href = sellerRoutes.detail('RFQ', bid.id);
          detailsHref = sellerRoutes.detail('RFQ', bid.id);
          actionLabel = 'Submit Quote';
        }

        const opportunity: SellerOpportunity = {
          id: `bid-${bid.id}`,
          type: opportunityType,
          title: bid.title || bid.itemName || 'Procurement opportunity',
          buyer: bid.buyerName,
          category: bid.category,
          location: bid.location,
          closingDate: bid.endDate,
          estimatedValue: toNumber(bid.estimatedValue),
          eligibility: bid.participated ? 'Already participated' : 'Check documents',
          status: bid.status || 'Open',
          actionLabel,
          href,
          detailsHref,
          sourceRef: bid.id || `BID-${bid.sourceId || ''}`,
          publishedAt: bid.startDate,
          quantity: bid.quantity,
          description: bid.description,
          documents,
          responseCount: bid.participantsCount,
          buyerType: bid.buyerType,
          department: bid.departmentName,
          deliveryLocation: bid.deliveryLocation,
          procurementType: bid.procurementType || bid.bidType,
          documentsCount: documents.length || bid.bidDocuments?.length,
          terms,
          nextAction: '',
          isInvitation: bid.isInvited || method === 'LIMITED_TENDER' || bid.visibility === 'PRIVATE' || bid.visibility === 'INVITED_SUPPLIERS',
          detailRows: [
            { label: 'Bid type', value: bid.bidType || 'Not specified' },
            { label: 'Procurement type', value: bid.procurementType || 'Open Bid' },
            { label: 'Department', value: bid.departmentName || 'Procurement' },
            { label: 'Delivery location', value: bid.deliveryLocation || 'Not specified' },
            { label: 'Participants', value: bid.participantsCount !== undefined ? Number(bid.participantsCount).toLocaleString('en-IN') : 'Not shown' },
            { label: 'Technical status', value: bid.technicalStatus || 'Pending' },
          ],
          events: opportunityEvents(bid.status, bid.startDate),
        };
        opportunity.nextAction = nextActionFor(opportunity);
        next.push(opportunity);
      });
      applyChunk(next);
    }).catch(() => {});

    const p2 = marketplaceApi.getRequirements({ pageSize: 50 }).then(res => {
      if (!alive) return;
      const next: SellerOpportunity[] = [];
      const requirements = (res as any)?.requirements || (res as any)?.items || res || [];
      (Array.isArray(requirements) ? requirements : []).forEach((req: any) => {
        const reqMethod = String(req.canonicalMethod || req.procurementMethod || 'RFQ').toUpperCase();
        const allowedMethods = ['RFQ', 'RFP', 'OPEN_TENDER', 'LIMITED_TENDER', 'REVERSE_AUCTION', 'TENDER', 'REPEAT_ORDER', 'RATE_CONTRACT'];
        if (reqMethod && !allowedMethods.includes(reqMethod)) return;

        const reqInvites = Array.isArray(req.payload?.vendors?.invitedSellers) 
          ? req.payload.vendors.invitedSellers 
          : (Array.isArray(req.invitedSellers) ? req.invitedSellers : []);
        
        const isReqPrivate = req.visibility === 'VERIFIED_SELLERS_ONLY' || req.visibility === 'INVITED_SUPPLIERS' || ['LIMITED_TENDER', 'REPEAT_ORDER'].includes(reqMethod);
        
        if (isReqPrivate) {
          const isInvited = reqInvites.includes(user?.id) || reqInvites.includes(user?.organizationId) || req.responsesCount > 0;
          if (!isInvited) return;
        }

        const upperReqTitle = String(req.title || '').toUpperCase();
        const upperReqMethod = String(req.canonicalMethod || req.procurementMethod || req.payload?.fullProcurementMethod || req.payload?.type || req.payload?.basics?.procurementMethod || '').toUpperCase();
        const upperReqNumber = String(req.requirementNumber || req.id || '').toUpperCase();

        const isExplicitReqRfq = reqMethod === 'RFQ' || req.procurementMethod === 'RFQ' || req.canonicalMethod === 'RFQ' || req.payload?.fullProcurementMethod === 'RFQ' || req.payload?.type === 'RFQ' || upperReqMethod === 'RFQ';
        const isExplicitReqRfp = reqMethod === 'RFP' || req.procurementMethod === 'RFP' || req.canonicalMethod === 'RFP' || req.payload?.fullProcurementMethod === 'RFP' || req.payload?.type === 'RFP' || upperReqMethod === 'RFP';
        const isExplicitReqTender = reqMethod.includes('TENDER') || String(req.procurementMethod || '').includes('TENDER') || String(req.canonicalMethod || '').includes('TENDER') || upperReqMethod.includes('TENDER');

        const isReqRateContract = !isExplicitReqRfq && !isExplicitReqRfp && !isExplicitReqTender && (
          upperReqMethod.includes('RATE') ||
          upperReqTitle.includes('RATE CONTRACT') ||
          upperReqNumber.startsWith('RC-') ||
          req.procurementMethod === 'RATE_CONTRACT' ||
          req.canonicalMethod === 'RATE_CONTRACT' ||
          req.payload?.type === 'RATE_CONTRACT' ||
          req.payload?.fullProcurementMethod === 'RATE_CONTRACT'
        );

        let opportunityType: OpportunityType = 'RFQ';
        if (isReqRateContract) opportunityType = 'Rate Contract';
        else if (reqMethod === 'RFP' || upperReqMethod.includes('RFP')) opportunityType = 'RFP';
        else if (reqMethod === 'LIMITED_TENDER' || reqMethod === 'LIMITED' || reqMethod.includes('LIMITED')) opportunityType = 'Limited Tender';
        else if (reqMethod === 'OPEN_TENDER' || reqMethod === 'TENDER') opportunityType = 'Open Tender';
        else if (reqMethod === 'REVERSE_AUCTION') opportunityType = 'Reverse Auction';
        else if (reqMethod === 'REPEAT_ORDER') opportunityType = 'Repeat Order';

        const documents = asTextList(req.requiredDocuments);
        const linkedBidId = req.payload?.linkedProcurementBidId;
        const canonicalReqId = req.requirementNumber || req.sourceId || (typeof req.id === 'number' && req.id < 0 ? Math.abs(req.id) : req.id);
        const buildDetailHref = () => {
          if (opportunityType === 'Rate Contract') return sellerRoutes.detail('RATE_CONTRACT', canonicalReqId);
          if (opportunityType === 'RFQ') return sellerRoutes.detail('RFQ', canonicalReqId);
          if (opportunityType === 'RFP') return sellerRoutes.detail('RFP', canonicalReqId);
          if (opportunityType === 'Open Tender') return sellerRoutes.detail('OPEN_TENDER', canonicalReqId);
          if (opportunityType === 'Limited Tender') return sellerRoutes.detail('LIMITED_TENDER', canonicalReqId);
          if (opportunityType === 'Reverse Auction') return sellerRoutes.detail('REVERSE_AUCTION', req.sourceId || canonicalReqId);
          return `/marketplace/requirements/${canonicalReqId}`;
        };
        const detailHref = buildDetailHref();
        const responseHref = linkedBidId 
          ? (opportunityType === 'Rate Contract' ? sellerRoutes.respond('RATE_CONTRACT', linkedBidId) : `/bids/${linkedBidId}/participate`)
          : (opportunityType === 'Rate Contract' ? sellerRoutes.respond('RATE_CONTRACT', canonicalReqId) : detailHref);
        const opportunity: SellerOpportunity = {
          id: `req-${req.id}`,
          type: opportunityType,
          title: req.title || req.description || 'Procurement requirement',
          buyer: req.buyerOrganization?.organizationName || req.organization?.organizationName || req.buyerName || 'Verified Buyer',
          category: req.category?.name || req.category || 'General Sourcing',
          location: req.location || req.deliveryLocation || 'Location not specified',
          closingDate: req.lastDate || req.requiredBy,
          estimatedValue: toNumber(req.budgetMax || req.estimatedValue),
          eligibility: req.verifiedSellersOnly ? 'Verified sellers only' : 'All eligible sellers',
          status: req.status || 'OPEN',
          actionLabel: req.responsesCount > 0 ? 'View Response' : (opportunityType === 'Rate Contract' ? 'Submit Rate' : 'Submit Quotation'),
          href: responseHref,
          detailsHref: detailHref,
          sourceRef: formatRefId(opportunityType === 'Rate Contract' ? 'RC' : 'REQ', req.sourceId || req.id, req.requirementNumber),
          publishedAt: req.approvedAt || req.createdAt,
          quantity: formatQuantity(req.quantity, req.unit),
          description: req.description,
          documents,
          responseCount: req.responsesCount || 0,
          buyerType: req.buyerOrganization?.type || req.buyerType,
          department: req.departmentName,
          deliveryLocation: req.deliveryLocation,
          procurementType: req.procurementMethod || req.canonicalMethod,
          documentsCount: documents.length,
          terms: asTextList(req.terms),
          nextAction: '',
          isInvitation: isReqPrivate,
          detailRows: [
            { label: 'Category', value: req.category?.name || req.category || 'General' },
            { label: 'Sourcing Method', value: req.procurementMethod || req.canonicalMethod || 'RFQ' },
            { label: 'Delivery Location', value: req.deliveryLocation || req.location || 'Not specified' },
            { label: 'Visibility', value: req.visibility || 'Public' },
          ],
          events: opportunityEvents(req.status, req.createdAt),
        };
        opportunity.nextAction = nextActionFor(opportunity);
        next.push(opportunity);
      });
      applyChunk(next);
    }).catch(() => {});

    const p3 = fetchQuoteRequests({ pageSize: 50 }).then(res => {
      if (!alive) return;
      const next: SellerOpportunity[] = [];
      const quoteRequests = (res as any)?.items || (res as any)?.quoteRequests || res || [];
      (Array.isArray(quoteRequests) ? quoteRequests : []).forEach((qr: any) => {
        if (!qr) return;

        const isQrPrivate = qr.visibility === 'PRIVATE' || qr.visibility === 'INVITED_SUPPLIERS';
        if (isQrPrivate) {
          const invitedSellers = Array.isArray(qr.invitedSellers) ? qr.invitedSellers : [];
          const isInvited = invitedSellers.includes(user?.id) || invitedSellers.includes(user?.organizationId) || qr.responsesCount > 0;
          if (!isInvited) return;
        }

        const upperQrTitle = String(qr.title || '').toUpperCase();
        const upperQrNumber = String(qr.quoteNumber || qr.id || '').toUpperCase();

        const isQrRateContract = upperQrTitle.includes('RATE CONTRACT') || upperQrNumber.startsWith('RC-');

        let opportunityType: OpportunityType = 'RFQ';
        if (isQrRateContract) opportunityType = 'Rate Contract';
        else if (upperQrTitle.includes('RFP') || upperQrTitle.includes('PROPOSAL')) opportunityType = 'RFP';
        else if (isQrPrivate) opportunityType = 'Limited Tender';

        const documents = asTextList(qr.requiredDocuments);
        const opportunity: SellerOpportunity = {
          id: `qr-${qr.id}`,
          type: opportunityType,
          title: qr.title || qr.itemName || 'Request for Quotation',
          buyer: qr.buyerOrganizationName || qr.buyer?.name || 'Verified Buyer',
          category: qr.category || 'Direct RFQ',
          location: qr.deliveryLocation || 'Location not specified',
          closingDate: qr.deadlineDate || qr.endDate,
          estimatedValue: toNumber(qr.estimatedValue),
          eligibility: isQrPrivate ? 'Invited Sellers Only' : 'Open Sourcing',
          status: qr.status || 'OPEN',
          actionLabel: 'Submit Quote',
          href: sellerRoutes.detail('RFQ', qr.id),
          detailsHref: sellerRoutes.detail('RFQ', qr.id),
          sourceRef: qr.quoteNumber || `RFQ-${qr.id}`,
          publishedAt: qr.createdAt,
          quantity: qr.quantity,
          description: qr.description,
          documents,
          responseCount: qr.responsesCount || 0,
          buyerType: qr.buyerType,
          deliveryLocation: qr.deliveryLocation,
          procurementType: 'RFQ',
          documentsCount: documents.length,
          terms: asTextList(qr.terms),
          nextAction: 'Open details, review documents, and submit quote.',
          isInvitation: isQrPrivate,
          detailRows: [
            { label: 'RFQ Number', value: qr.quoteNumber || `RFQ-${qr.id}` },
            { label: 'Sourcing Method', value: 'Request for Quotation' },
            { label: 'Delivery Location', value: qr.deliveryLocation || 'Not specified' },
          ],
          events: opportunityEvents(qr.status, qr.createdAt),
        };
        opportunity.nextAction = nextActionFor(opportunity);
        next.push(opportunity);
      });
      applyChunk(next);
    }).catch(() => {});

    const p4 = reverseAuctionApi.list({ pageSize: 50 }).then(res => {
      if (!alive) return;
      const next: SellerOpportunity[] = [];
      const auctions = (res as any)?.items || (res as any)?.auctions || res || [];
      (Array.isArray(auctions) ? auctions : []).forEach((auction: any) => {
        if (!auction) return;
        const documents = asTextList(auction.documents);
        const opportunity: SellerOpportunity = {
          id: `ra-${auction.id}`,
          type: 'Reverse Auction',
          title: auction.title || auction.itemName || 'Reverse Auction Opportunity',
          buyer: auction.buyerOrgName || auction.buyerName || 'Verified Buyer',
          category: 'Negotiate Price',
          closingDate: auction.endTime,
          estimatedValue: toNumber(auction.currentLowestAmount || auction.startPrice),
          eligibility: 'Check invitation',
          status: auction.statusEnum || auction.status || 'Scheduled',
          actionLabel: 'Join Auction',
          href: sellerRoutes.auctionLive(auction.id),
          detailsHref: sellerRoutes.detail('REVERSE_AUCTION', auction.id),
          sourceRef: auction.auctionCode || `RA-${auction.id}`,
          publishedAt: auction.startTime,
          description: auction.description,
          documents,
          responseCount: auction.participantsCount || auction.invitedSellersCount,
          procurementType: 'Reverse Auction',
          documentsCount: documents.length,
          terms: asTextList(auction.terms),
          nextAction: '',
          isInvitation: auction.visibilityMode === 'INVITED_SELLERS_ONLY' || auction.isInvited || auction.invitedSellers?.some((v: any) => (v?.sellerOrgId || v) === user?.organizationId),
          detailRows: [
            { label: 'Auction start', value: formatDate(auction.startTime) },
            { label: 'Auction end', value: formatDate(auction.endTime) },
            { label: 'Start price', value: formatMoney(toNumber(auction.startPrice)) },
            { label: 'Current L1', value: auction.currentLowestAmount ? formatMoney(toNumber(auction.currentLowestAmount)) : 'Not available' },
            { label: 'Minimum decrement', value: auction.minDecrementAmount ? formatMoney(toNumber(auction.minDecrementAmount)) : 'Not shown' },
            { label: 'Participants', value: auction.participantsCount !== undefined ? Number(auction.participantsCount).toLocaleString('en-IN') : 'Not shown' },
          ],
          events: opportunityEvents(auction.statusEnum || auction.status, auction.startTime),
        };
        opportunity.nextAction = nextActionFor(opportunity);
        next.push(opportunity);
      });
      applyChunk(next);
    }).catch(() => {});

    const p5 = fetchRateContracts({ pageSize: 50 }).then(res => {
      if (!alive) return;
      const next: SellerOpportunity[] = [];
      const rateContracts = (res as any)?.rateContracts || (res as any)?.items || res || [];
      (Array.isArray(rateContracts) ? rateContracts : []).forEach((rc: any) => {
        if (!rc) return;
        const meta = rc.metadata || {};
        const hasReqId = Boolean(meta.requirementId);
        const rawRef = rc.contractNumber || meta.requirementNumber || `RC-${rc.id}`;
        const refNo = formatRefId('RC', rc.id, rawRef);

        const reqTitle = meta.requirementTitle || meta.basics?.title || meta.contractTitle || meta.title || rc.title;
        const buyerName = meta.buyerOrganizationName || meta.buyerOrganization?.organizationName || meta.buyerName || meta.orgName || rc.buyerOrganizationName || 'Verified Buyer';
        const catName = meta.contractCategory || meta.category || 'Facility Management & Canteen Services';
        const rawVal = toNumber(meta.estimatedValue || meta.budgetMax || (toNumber(rc.value) > 50000000 ? 1000000 : rc.value));

        const opportunity: SellerOpportunity = {
          id: `rc-${rc.id}`,
          type: 'Rate Contract',
          title: reqTitle && reqTitle.length > 5 ? reqTitle : (rc.title || 'Rate Contract Opportunity'),
          buyer: buyerName,
          category: catName,
          location: meta.deliveryLocation || meta.deliverySla || 'Location not specified',
          closingDate: rc.endDate || meta.periodEndDate,
          estimatedValue: rawVal,
          eligibility: 'Open Rate Contract',
          status: rc.status || meta.activeState || 'ACTIVE',
          actionLabel: 'Submit Quote',
          href: hasReqId
            ? sellerRoutes.respond('RATE_CONTRACT', meta.requirementId)
            : sellerRoutes.respond('RATE_CONTRACT', rc.id),
          detailsHref: hasReqId
            ? sellerRoutes.detail('RATE_CONTRACT', meta.requirementId)
            : sellerRoutes.detail('RATE_CONTRACT', rc.id),
          sourceRef: refNo,
          publishedAt: rc.startDate || rc.createdAt,
          quantity: meta.minimumOrderQuantity ? `${meta.minimumOrderQuantity} min qty` : undefined,
          description: meta.contractDescription || rc.title,
          documents: meta.contractDocument ? [meta.contractDocument.fileName] : [],
          responseCount: Number(rc.participantsCount || rc.responsesCount || 0),
          buyerType: meta.buyerType || meta.buyerOrganizationType || undefined,
          deliveryLocation: meta.deliverySla,
          procurementType: 'RATE_CONTRACT',
          documentsCount: meta.contractDocument ? 1 : 0,
          terms: meta.penaltyClause ? [meta.penaltyClause] : [],
          nextAction: 'Open details, review rate terms, then submit quotation.',
          isInvitation: false,
          detailRows: [
            { label: 'Contract No.', value: refNo },
            { label: 'Sourcing Method', value: 'Rate Contract' },
            { label: 'Validity Period', value: meta.rateValidityPeriod || '1 Year' },
            { label: 'Min Order Qty', value: meta.minimumOrderQuantity ? String(meta.minimumOrderQuantity) : 'Not specified' },
          ],
          events: opportunityEvents(rc.status || 'ACTIVE', rc.startDate || rc.createdAt),
        };
        next.push(opportunity);
      });
      applyChunk(next);
    }).catch(() => {});

    return Promise.allSettled([p1, p2, p3, p4, p5]).finally(() => {
      if (alive) setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    globalOpportunitiesCache = null;
    try {
      await load(true);
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['navigation-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard', 'summary'] }),
      ]);
      toast.success('Opportunities refreshed successfully');
    } catch {
      toast.error('Failed to refresh opportunities');
    } finally {
      setRefreshing(false);
    }
  };

  const queryType = typeFromQuery(searchParams?.get('type'));
  const [prevQueryType, setPrevQueryType] = useState(queryType);

  if (!subRouteType && queryType !== prevQueryType) {
    setPrevQueryType(queryType);
    setType(queryType);
  }

  const typeOptions = useMemo(() => Array.from(new Set(items.map(item => item.type))).sort(), [items]);
  const locationOptions = useMemo(() => Array.from(new Set(items.map(item => item.location).filter((value): value is string => Boolean(value)))).sort(), [items]);
  const categoryOptions = useMemo(() => Array.from(new Set(items.map(item => item.category).filter((value): value is string => Boolean(value)))).sort(), [items]);
  const buyerOptions = useMemo(() => Array.from(new Set(items.map(item => item.buyer).filter((value): value is string => Boolean(value)))).sort(), [items]);

  const baseFiltered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return items.filter(item => {
      const haystack = [
        item.title,
        item.buyer,
        item.category,
        item.location,
        item.status,
        item.type,
        item.sourceRef,
        item.description,
        item.procurementType
      ].join(' ').toLowerCase();

      if (text && !haystack.includes(text)) return false;

      if (type) {
        if (type === 'Limited Tender') {
          if (!item.isInvitation && item.type !== 'Limited Tender') return false;
        } else if (item.type !== type) {
          return false;
        }
      }

      if (status) {
        if (status === 'LIVE') {
          if (!isOpenOpportunity(item, nowMs)) return false;
        } else if (status === 'CLOSING_SOON') {
          if (!isClosingSoonOpportunity(item, nowMs)) return false;
        } else if (status === 'PARTICIPATED') {
          if (!isParticipatedOpportunity(item)) return false;
        } else if (status === 'UNDER_EVALUATION') {
          if (!isUnderEvaluationOpportunity(item, nowMs)) return false;
        } else if (status === 'CLOSED') {
          if (!isClosedStatus(item.status) && isOpenOpportunity(item, nowMs)) return false;
        } else if (item.status !== status) {
          return false;
        }
      }

      if (location && item.location !== location) return false;
      if (category && item.category !== category) return false;
      if (buyerFilter && item.buyer !== buyerFilter) return false;

      if (valueRange) {
        const val = item.estimatedValue || 0;
        if (valueRange === '5l' && val >= 500000) return false;
        if (valueRange === '25l' && (val < 500000 || val >= 2500000)) return false;
        if (valueRange === '1cr' && (val < 2500000 || val >= 10000000)) return false;
        if (valueRange === 'above1cr' && val < 10000000) return false;
      }

      if (startDate || endDate) {
        const rawDate = item.publishedAt || item.closingDate;
        if (!rawDate) return false;
        const d = new Date(rawDate);
        if (Number.isNaN(d.getTime())) return false;
        const itemYear = d.getFullYear();
        const itemMonth = String(d.getMonth() + 1).padStart(2, '0');
        const itemDay = String(d.getDate()).padStart(2, '0');
        const itemDateStr = `${itemYear}-${itemMonth}-${itemDay}`;

        if (startDate && itemDateStr < startDate) return false;
        if (endDate && itemDateStr > endDate) return false;
      }

      return true;
    });
  }, [startDate, endDate, items, location, query, status, type, category, buyerFilter, valueRange, nowMs]);

  const kpis = useMemo(() => {
    let live = 0;
    let liveValue = 0;
    let closingSoon = 0;
    let closingSoonValue = 0;
    let highValueCount = 0;
    let highValueTotal = 0;
    let participated = 0;
    let evaluation = 0;

    items.forEach(item => {
      const isLive = isOpenOpportunity(item, nowMs);
      const val = Number(item.estimatedValue) || 0;

      if (isLive) {
        live++;
        liveValue += val;
      }
      if (isClosingSoonOpportunity(item, nowMs)) {
        closingSoon++;
        closingSoonValue += val;
      }
      if (isLive && val >= 2500000) {
        highValueCount++;
        highValueTotal += val;
      }
      if (isParticipatedOpportunity(item)) participated++;
      if (isUnderEvaluationOpportunity(item, nowMs)) evaluation++;
    });

    return {
      live,
      liveValue,
      closingSoon,
      closingSoonValue,
      highValueCount,
      highValueTotal,
      participated,
      evaluation
    };
  }, [items, nowMs]);

  const filtered = useMemo(() => {
    const list = baseFiltered.filter(item => {
      if (kpiFilter === 'live') {
        return isOpenOpportunity(item, nowMs);
      }
      if (kpiFilter === 'dueSoon') {
        return isClosingSoonOpportunity(item, nowMs);
      }
      if (kpiFilter === 'highValue') {
        return (Number(item.estimatedValue) || 0) >= 2500000 && isOpenOpportunity(item, nowMs);
      }
      if (kpiFilter === 'participated') {
        return isParticipatedOpportunity(item);
      }
      if (kpiFilter === 'evaluation') {
        return isUnderEvaluationOpportunity(item, nowMs);
      }
      return true;
    });

    if (sortField) {
      list.sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];

        if (sortField === 'estimatedValue') {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        } else if (sortField === 'publishedAt' || sortField === 'closingDate') {
          valA = valA ? new Date(valA).getTime() : 0;
          valB = valB ? new Date(valB).getTime() : 0;
        } else {
          valA = String(valA || '').toLowerCase();
          valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [baseFiltered, kpiFilter, sortField, sortDirection, nowMs]);

  // Reset KPI filter and pagination when filters change (render-pass adjustment, no cascading renders)
  const filterKey = `${query}|${type}|${status}|${location}|${startDate}|${endDate}|${category}|${buyerFilter}|${valueRange}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  const pageFilterKey = `${filterKey}|${viewMode}|${kpiFilter}`;
  const [prevPageFilterKey, setPrevPageFilterKey] = useState(pageFilterKey);

  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setKpiFilter('all');
  }

  if (pageFilterKey !== prevPageFilterKey) {
    setPrevPageFilterKey(pageFilterKey);
    setPage(1);
    setExpandedId(null);
  }

  const pageRows = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const reset = () => {
    setQuery('');
    setType('');
    setStatus('');
    setLocation('');
    setStartDate('');
    setEndDate('');
    setCategory('');
    setBuyerFilter('');
    setValueRange('');
    setKpiFilter('all');
    setSortField('');
    setSortDirection('asc');
    setPage(1);
  };

  const headerContent = useMemo(() => {
    switch (subRouteType) {
      case 'RFQ':
        return {
          title: 'Requests for Quotation (RFQs)',
          desc: 'Submit quick pricing quotes for standard goods and materials requested by buyers.'
        };
      case 'RFP':
        return {
          title: 'Requests for Proposal (RFPs)',
          desc: 'Review detailed requirements and submit proposals for complex services, projects, and custom solutions.'
        };
      case 'Open Tender':
        return {
          title: 'Open Competitive Tenders',
          desc: 'Participate in public procurement tenders and high-value competitive bidding opportunities.'
        };
      case 'Limited Tender':
        return {
          title: 'Restricted Sourcing & Limited Tenders',
          desc: 'View limited tenders specifically restricted to authorized sellers.'
        };
      case 'Reverse Auction':
        return {
          title: 'Live Reverse Auctions',
          desc: 'Compete in real-time dynamic bidding events to secure contracts by offering competitive pricing.'
        };
      case 'Rate Contract':
        return {
          title: 'Annual Rate Contracts',
          desc: 'Supply goods and services at pre-negotiated rates across scheduled institutional procurement cycles.'
        };
      default:
        return {
          title: 'New Bidding Opportunities',
          desc: 'One place to review requests for quotations (RFQs), public tenders, auctions, and direct buyer requirements.'
        };
    }
  }, [subRouteType]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      RFQ: 0,
      'Open Tender': 0,
      RFP: 0,
      'Limited Tender': 0,
      'Reverse Auction': 0,
      'Rate Contract': 0,
    };

    items.forEach(item => {
      if (!isClosedStatus(item.status)) {
        counts.all++;
        if (item.type && counts[item.type] !== undefined) {
          counts[item.type]++;
        } else if (item.isInvitation) {
          counts['Limited Tender']++;
        }
      }
    });

    return counts;
  }, [items]);

  const opportunityCategories: Array<{ label: string; typeVal: OpportunityType | ''; countKey: string; icon: any }> = useMemo(() => [
    { label: 'All Opportunities', typeVal: '', countKey: 'all', icon: Globe },
    { label: 'RFQs', typeVal: 'RFQ', countKey: 'RFQ', icon: FileText },
    { label: 'Open Tenders', typeVal: 'Open Tender', countKey: 'Open Tender', icon: ClipboardList },
    { label: 'RFPs', typeVal: 'RFP', countKey: 'RFP', icon: Layers },
    { label: 'Limited Tenders', typeVal: 'Limited Tender', countKey: 'Limited Tender', icon: Users },
    { label: 'Reverse Auctions', typeVal: 'Reverse Auction', countKey: 'Reverse Auction', icon: Gavel },
    { label: 'Rate Contracts', typeVal: 'Rate Contract', countKey: 'Rate Contract', icon: RotateCcw }
  ], []);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-12 pt-4">
      {/* Title Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950 tracking-tight">{headerContent.title}</h1>
          <p className="text-xs font-semibold text-slate-500 mt-0.5">{headerContent.desc}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="h-10 rounded-xl border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-all flex items-center shrink-0 cursor-pointer"
            aria-label="Refresh opportunities"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4 text-[#12335f]", (refreshing || loading) && "animate-spin")} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Live Opportunity Pool"
          value={formatCurrency(kpis.liveValue)}
          subtext={`${kpis.live} active sourcing events`}
          icon={IndianRupee}
          tone="blue"
          active={kpiFilter === 'live'}
          onClick={() => setKpiFilter(kpiFilter === 'live' ? 'all' : 'live')}
        />
        <KpiCard
          label="Closing in ≤7 Days"
          value={kpis.closingSoon}
          subtext={`${formatCurrency(kpis.closingSoonValue)} expiring soon`}
          icon={Clock}
          tone="red"
          active={kpiFilter === 'dueSoon'}
          onClick={() => setKpiFilter(kpiFilter === 'dueSoon' ? 'all' : 'dueSoon')}
        />
        <KpiCard
          label="High-Value Tenders (≥₹25L)"
          value={kpis.highValueCount}
          subtext={`${formatCurrency(kpis.highValueTotal)} strategic volume`}
          icon={TrendingUp}
          tone="purple"
          active={kpiFilter === 'highValue'}
          onClick={() => setKpiFilter(kpiFilter === 'highValue' ? 'all' : 'highValue')}
        />
        <KpiCard
          label="My Active Submissions"
          value={kpis.participated}
          subtext={`${kpis.evaluation} awaiting award decision`}
          icon={CheckCircle2}
          tone="indigo"
          active={kpiFilter === 'participated'}
          onClick={() => setKpiFilter(kpiFilter === 'participated' ? 'all' : 'participated')}
        />
      </div>

      {/* ── Opportunity Type Segmented Filter Pills ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mt-1 scrollbar-none" role="tablist" aria-label="Opportunity Types">
        {opportunityCategories.map(tab => {
          const isActive = (type === tab.typeVal) || (!type && !tab.typeVal);
          const count = typeCounts[tab.countKey] || 0;
          const Icon = tab.icon;

          return (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setType(tab.typeVal);
                setPage(1);
              }}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border cursor-pointer",
                isActive
                  ? "bg-[#12335f] text-white border-[#12335f] shadow-sm shadow-[#12335f]/20 ring-2 ring-[#12335f]/15"
                  : "bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 shadow-2xs"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-[#c8a45c]" : "text-slate-400")} />
              <span>{tab.label}</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-black min-w-[18px] text-center transition-colors",
                  isActive
                    ? "bg-white/20 text-white"
                    : count > 0 ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-400"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search + Filter + View Toggle Toolbar ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 sm:p-4 shadow-sm">
        <ResponsiveFilterBar
          singleRowDesktop={false}
          activeFilterCount={(query ? 1 : 0) + (type ? 1 : 0) + (status ? 1 : 0) + (category ? 1 : 0) + (buyerFilter ? 1 : 0) + (location ? 1 : 0) + (startDate ? 1 : 0) + (endDate ? 1 : 0) + (kpiFilter !== 'all' ? 1 : 0)}
          searchInput={
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={event => { setQuery(event.target.value); setPage(1); }}
                placeholder="Search opportunities by title, ref no, buyer, category..."
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-9 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setPage(1); }}
                  aria-label="Clear search input"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          }
          filters={
            <>
              {/* Type Dropdown */}
              {!subRouteType && (
                <div className="w-full sm:w-auto sm:min-w-[110px] sm:max-w-[135px]">
                  <select
                    value={type}
                    onChange={e => { setType(e.target.value as OpportunityType | ''); setPage(1); }}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer truncate"
                    aria-label="Filter by type"
                  >
                    <option value="">All Types</option>
                    {typeOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                  </select>
                </div>
              )}

              {/* Status Dropdown */}
              <div className="w-full sm:w-auto sm:min-w-[115px] sm:max-w-[145px]">
                <select
                  value={status}
                  onChange={e => { setStatus(e.target.value); setPage(1); }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer truncate"
                  aria-label="Filter by status"
                >
                  <option value="">All Statuses</option>
                  <option value="LIVE">Live / Open</option>
                  <option value="CLOSING_SOON">Closing Soon (≤7d)</option>
                  <option value="PARTICIPATED">My Submissions</option>
                  <option value="UNDER_EVALUATION">Under Evaluation</option>
                  <option value="CLOSED">Closed / Concluded</option>
                </select>
              </div>

              {/* Category Dropdown */}
              <div className="w-full sm:w-auto sm:min-w-[120px] sm:max-w-[150px]">
                <select
                  value={category}
                  onChange={e => { setCategory(e.target.value); setPage(1); }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer truncate"
                  aria-label="Filter by category"
                >
                  <option value="">All Categories</option>
                  {categoryOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Buyer Dropdown */}
              <div className="w-full sm:w-auto sm:min-w-[115px] sm:max-w-[140px]">
                <select
                  value={buyerFilter}
                  onChange={e => { setBuyerFilter(e.target.value); setPage(1); }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer truncate"
                  aria-label="Filter by buyer"
                >
                  <option value="">All Buyers</option>
                  {buyerOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Location Dropdown */}
              <div className="w-full sm:w-auto sm:min-w-[115px] sm:max-w-[140px]">
                <select
                  value={location}
                  onChange={e => { setLocation(e.target.value); setPage(1); }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-xs cursor-pointer truncate"
                  aria-label="Filter by location"
                >
                  <option value="">All Locations</option>
                  {locationOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Unified Date Range Group (From - To) */}
              <div className="flex items-center h-10 rounded-xl border border-slate-200 bg-white px-2.5 sm:px-3 hover:border-slate-300 focus-within:border-[#12335f] focus-within:ring-2 focus-within:ring-[#12335f]/10 transition-colors shadow-xs w-full sm:w-auto">
                <Calendar className="h-3.5 w-3.5 text-slate-400 mr-1.5 shrink-0" />
                <span className="text-[10px] font-bold text-slate-400 mr-1 uppercase select-none shrink-0">From</span>
                <input
                  id="filter-start-date"
                  type="date"
                  value={startDate}
                  max={endDate && endDate <= todayStr ? endDate : todayStr}
                  onChange={e => handleStartDateChange(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer w-[110px]"
                  aria-label="Start date (From)"
                  title="Start Date (Published on or after)"
                />
                <span className="text-slate-300 mx-1.5 font-bold select-none">–</span>
                <span className="text-[10px] font-bold text-slate-400 mr-1 uppercase select-none shrink-0">To</span>
                <input
                  id="filter-end-date"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  max={todayStr}
                  onChange={e => handleEndDateChange(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer w-[110px]"
                  aria-label="End date (To)"
                  title="End Date (Published on or before)"
                />
              </div>

              {/* Reset Trigger */}
              {(query || type || status || category || buyerFilter || location || startDate || endDate || kpiFilter !== 'all') && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={reset}
                  className="h-10 px-3.5 rounded-xl border-rose-200 bg-rose-50/70 text-xs font-extrabold text-rose-700 hover:bg-rose-100 flex items-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                  aria-label="Reset all filters"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </Button>
              )}
            </>
          }
          endContent={<ViewModeToggle value={viewMode} onChange={setViewMode} />}
        />
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(item => (
            <div key={item} className="h-32 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm animate-pulse flex items-center justify-between">
              <div className="space-y-2 flex-1"><div className="h-4 w-48 rounded bg-slate-100" /><div className="h-3 w-32 rounded bg-slate-100" /></div>
              <div className="h-8 w-24 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm font-black text-slate-950">No opportunities match your filter criteria.</p>
          <p className="text-xs font-semibold text-slate-500 mt-1">Try resetting the filters or typing a different search term.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pageRows.map((item, index) => {
                const isLiveAuction = item.type === 'Reverse Auction' && String(item.status).toUpperCase() === 'OPEN';
                const isClosingSoon = item.closingDate && (new Date(item.closingDate).getTime() - nowMs) <= 2 * 86400000 && (new Date(item.closingDate).getTime() - nowMs) >= 0;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-2xl border bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 border-slate-200/80 hover:border-slate-350 flex flex-col justify-between min-h-[220px] animate-in fade-in duration-200",
                      isLiveAuction && "border-blue-400 bg-blue-50/5 ring-1 ring-blue-400/25 shadow-blue-50/20",
                      isClosingSoon && !isLiveAuction && "border-amber-400/80 bg-amber-50/10 ring-1 ring-amber-400/30"
                    )}
                  >
                    <div className="space-y-3">
                      {/* Top row: Badges */}
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "inline-flex rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border",
                          item.type === 'Reverse Auction' ? "border-red-200 bg-red-50 text-red-600" :
                          item.type === 'RFQ' ? "border-orange-200 bg-orange-50 text-orange-600" :
                          item.type === 'RFP' ? "border-purple-200 bg-purple-50 text-purple-600" :
                          item.type === 'Open Tender' ? "border-emerald-200 bg-emerald-50 text-emerald-600" :
                          "border-amber-200 bg-amber-50 text-amber-600"
                        )}>
                          {item.type}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                        {item.title}
                      </h3>

                      {/* Source Ref & Buyer */}
                      <div className="text-[11px] text-slate-500 font-bold space-y-1">
                        <p className="font-mono text-slate-400">Ref: {item.sourceRef}</p>
                        <p>Buyer: {item.buyer || 'Buyer details controlled'}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 mt-4 space-y-3">
                      {/* Timeline & Commercials */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">Closing Date</p>
                          {isLiveAuction ? (
                            <div className="mt-1 space-y-1">
                              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 tracking-wider">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                                Live
                              </span>
                              <CountdownTimer endDate={item.closingDate} />
                            </div>
                          ) : (
                            <div className="mt-1">
                              <span className="text-xs font-black text-slate-700 block">{formatDate(item.closingDate)}</span>
                              <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider">
                                {getDaysLeftText(item.closingDate)}
                              </span>
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none">Est. Value</p>
                          <div className="mt-1">
                            <span className="text-xs font-extrabold text-slate-900 block">
                              {formatMoney(item.estimatedValue)}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                              {item.type === 'Reverse Auction' ? 'Negotiate Price' : 
                               item.type === 'RFP' ? 'Negotiable' : 'Fixed Price'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="flex justify-end pt-1">
                        <Link
                          href={item.detailsHref}
                          className="inline-flex h-8 w-full items-center justify-center rounded-lg bg-blue-600 px-3 text-center text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all duration-200"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-slate-50/20 p-2 shadow-sm">
              <table className="w-full min-w-[950px] border-separate border-spacing-y-2 text-left">
                <thead>
                  <tr className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3 text-center w-16 select-none">Sr. No.</th>
                    <th onClick={() => handleSort('type')} className="px-4 py-3 w-28 cursor-pointer select-none hover:text-[#12335f] transition-colors group">
                      <div className="flex items-center">
                        Type {renderSortIcon('type')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('title')} className="px-4 py-3 w-80 cursor-pointer select-none hover:text-[#12335f] transition-colors group">
                      <div className="flex items-center">
                        Title & Reference {renderSortIcon('title')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('buyer')} className="px-4 py-3 w-64 cursor-pointer select-none hover:text-[#12335f] transition-colors group">
                      <div className="flex items-center">
                        Buyer & Location {renderSortIcon('buyer')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('publishedAt')} className="px-4 py-3 w-32 cursor-pointer select-none hover:text-[#12335f] transition-colors group">
                      <div className="flex items-center">
                        Published Date {renderSortIcon('publishedAt')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('closingDate')} className="px-4 py-3 w-36 cursor-pointer select-none hover:text-[#12335f] transition-colors group">
                      <div className="flex items-center">
                        Closing Date {renderSortIcon('closingDate')}
                      </div>
                    </th>
                    <th onClick={() => handleSort('estimatedValue')} className="px-4 py-3 w-40 cursor-pointer select-none hover:text-[#12335f] transition-colors group">
                      <div className="flex items-center">
                        Est. Value {renderSortIcon('estimatedValue')}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-right w-32 select-none">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((item, index) => {
                    const isLiveAuction = item.type === 'Reverse Auction' && String(item.status).toUpperCase() === 'OPEN';
                    
                    return (
                      <tr
                        key={item.id}
                        className={cn(
                          "bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)] transition hover:shadow-md align-middle",
                          isLiveAuction && "bg-blue-50/5 hover:bg-blue-50/10"
                        )}
                      >
                        {/* Serial Number */}
                        <td className="rounded-l-xl px-4 py-4 text-xs font-black text-slate-400 text-center">
                          {String((page - 1) * pageSize + index + 1).padStart(2, '0')}
                        </td>

                        {/* Opportunity Type Badge */}
                        <td className="px-4 py-4">
                          <span className={cn(
                            "inline-flex rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border whitespace-nowrap",
                            item.type === 'Reverse Auction' ? "border-red-200 bg-red-50 text-red-600" :
                            item.type === 'RFQ' ? "border-orange-200 bg-orange-50 text-orange-600" :
                            item.type === 'RFP' ? "border-purple-200 bg-purple-50 text-purple-600" :
                            item.type === 'Open Tender' ? "border-emerald-200 bg-emerald-50 text-emerald-600" :
                            "border-amber-200 bg-amber-50 text-amber-600"
                          )}>
                            {item.type}
                          </span>
                        </td>

                        {/* Title and Reference */}
                        <td className="px-4 py-4 space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {item.sourceRef}
                            </span>
                            {item.category && (
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                {item.category}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                            {item.title}
                          </p>
                          {cleanOpportunitySummary(item.description) && (
                            <p className="text-[10px] font-semibold text-slate-400 line-clamp-1">
                              {cleanOpportunitySummary(item.description)}
                            </p>
                          )}
                        </td>

                        {/* Buyer and Location */}
                        <td className="px-4 py-4 space-y-1">
                          <p className="text-xs font-bold text-slate-800 leading-tight">
                            {item.buyer || 'Buyer details controlled'}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            {item.buyerType && 
                             item.buyerType.toUpperCase() !== item.type.toUpperCase() && 
                             item.buyerType.toUpperCase() !== 'RATE CONTRACT' && (
                              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">
                                {item.buyerType}
                              </span>
                            )}
                            {item.location && (
                              <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-slate-400">
                                <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                                {item.location}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Published Date */}
                        <td className="px-4 py-4 text-xs font-bold text-slate-600">
                          {formatDate(item.publishedAt)}
                        </td>

                        {/* Closing Date / Countdown */}
                        <td className="px-4 py-4 text-xs">
                          {isLiveAuction ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600 tracking-wider">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                                Live
                              </span>
                              <div className="block leading-none">
                                <CountdownTimer endDate={item.closingDate} />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-700 block">{formatDate(item.closingDate)}</span>
                              <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider block">
                                {getDaysLeftText(item.closingDate)}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Estimated Value */}
                        <td className="px-4 py-4 space-y-0.5">
                          <span className="text-xs font-extrabold text-slate-900 block">
                            {formatMoney(item.estimatedValue)}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                            {item.type === 'Reverse Auction' ? 'Negotiate Price' : 
                             item.type === 'RFP' ? 'Negotiable' : 'Fixed Price'}
                          </span>
                        </td>

                        {/* Action Link */}
                        <td className="rounded-r-xl px-4 py-4 text-right">
                          <Link
                            href={item.detailsHref}
                            className="inline-flex h-8 min-w-[90px] items-center justify-center rounded-lg bg-blue-600 px-3 text-center text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all duration-200"
                          >
                            View Details
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              label="opportunities"
            />
          </div>
        </div>
      )}
      {selectedItem && <OpportunityDetailsDialog item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  );
}

function shortActionLabel(label: string) {
  if (!label || typeof label !== 'string') return '';
  const normalized = label.toLowerCase();
  if (normalized.includes('auction')) return 'Join';
  if (normalized.includes('respond')) return 'Respond';
  if (normalized.includes('track')) return 'Track';
  if (normalized.includes('quote')) return 'Quote';
  if (normalized.includes('information')) return 'Info';
  if (normalized.includes('rate')) return 'Rates';
  if (normalized.includes('submit')) return 'Submit';
  return label.length > 12 ? `${label.slice(0, 10)}...` : label;
}

function OpportunityDetailPanel({ item }: { item: SellerOpportunity }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
      <section className="rounded-[22px] bg-white/95 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Opportunity Details</p>
            <h3 className="mt-1 text-base font-black text-slate-950 text-wrap-anywhere">{item.title}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">{item.sourceRef} / {item.type}</p>
          </div>
          <TypeBadge type={item.type} />
        </div>

        {cleanOpportunitySummary(item.description) && (
          <p className="mt-3 line-clamp-3 text-xs font-semibold leading-relaxed text-slate-600 text-wrap-anywhere">{cleanOpportunitySummary(item.description)}</p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Metric label="Buyer" value={item.buyer || 'Buyer details controlled'} />
          <Metric label="Category" value={item.category || 'General procurement'} />
          <Metric label="Quantity" value={item.quantity || 'Not specified'} />
          <Metric label="Commercial value" value={formatMoney(item.estimatedValue)} />
          <Metric label="Published" value={formatDate(item.publishedAt)} />
          <Metric label="Closing" value={formatDate(item.closingDate)} />
          <Metric label="Responses" value={item.responseCount !== undefined ? item.responseCount.toLocaleString('en-IN') : 'Not shown'} />
          <Metric label="Eligibility" value={item.eligibility} />
        </div>

        <div className="mt-4 rounded-[18px] bg-blue-50 p-3 ring-1 ring-blue-100">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#12335f]" />
            <p className="text-xs font-semibold leading-relaxed text-slate-700">{item.nextAction}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={item.detailsHref} className="inline-flex h-9 items-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:border-[#12335f] hover:text-[#12335f]">
            <Eye className="mr-1.5 h-4 w-4" /> View Details
          </Link>
          <Link href={item.href} className="inline-flex h-9 items-center rounded-2xl bg-[#12335f] px-3 text-xs font-black text-white">{item.actionLabel}</Link>
        </div>
      </section>

      <ProcurementLifecycleTracker
        events={item.events}
        currentStage="PROCUREMENT_CREATED"
        nextAction={item.nextAction}
        role="seller"
        sourceType={item.type}
        showTechnicalStatus
      />
    </div>
  );
}

function OpportunityDetailsDialog({ item, onClose }: { item: SellerOpportunity; onClose: () => void }) {
  const detailRows = item.detailRows || [];
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="opportunity-dialog-title">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] bg-white/95 shadow-2xl ring-1 ring-slate-200/70">
        <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={item.type} />
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[#c86413]">{item.sourceRef}</span>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">{item.status}</span>
              </div>
              <h2 id="opportunity-dialog-title" className="mt-2 text-xl font-black text-slate-950 text-wrap-anywhere">{item.title}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">{[item.buyer || 'Buyer details controlled', item.category || 'General procurement', item.location || 'Location not specified'].join(' / ')}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-[#12335f] hover:text-[#12335f]"
              aria-label="Close opportunity details"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <section className="rounded-[22px] bg-white p-4 ring-1 ring-slate-200/70">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Procurement Brief</p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700 text-wrap-anywhere">
                  {cleanOpportunitySummary(item.description) || 'No detailed description was provided by the buyer for this opportunity.'}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric label="Published" value={formatDate(item.publishedAt)} />
                  <Metric label="Closing" value={formatDate(item.closingDate)} />
                  <Metric label="Estimated value" value={formatMoney(item.estimatedValue)} />
                  <Metric label="Quantity" value={item.quantity || 'Not specified'} />
                </div>
              </section>

              <section className="rounded-[22px] bg-white p-4 ring-1 ring-slate-200/70">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Commercial And Buyer Information</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Metric label="Buyer" value={item.buyer || 'Buyer details controlled'} />
                  <Metric label="Buyer type" value={item.buyerType || 'Not specified'} />
                  <Metric label="Department" value={item.department || 'Not specified'} />
                  <Metric label="Procurement type" value={item.procurementType || item.type} />
                  <Metric label="Delivery location" value={item.deliveryLocation || item.location || 'Not specified'} />
                  <Metric label="Responses" value={item.responseCount !== undefined ? item.responseCount.toLocaleString('en-IN') : 'Not shown'} />
                </div>
                {detailRows.length > 0 && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {detailRows.map(row => <Metric key={`${row.label}-${row.value}`} label={row.label} value={row.value} />)}
                  </div>
                )}
              </section>

              <section className="rounded-[22px] bg-white p-4 ring-1 ring-slate-200/70">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Documents, Terms And Compliance</p>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <ListBlock title={`Required documents (${item.documentsCount || item.documents?.length || 0})`} items={item.documents || []} fallback="No mandatory documents are listed in this feed." />
                  <ListBlock title="Terms and buyer notes" items={item.terms || []} fallback="No separate terms are listed in this feed." />
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-[22px] bg-blue-50 p-4 ring-1 ring-blue-100">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#12335f]" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Seller Next Step</p>
                    <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-700">{item.nextAction}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={item.href} className="inline-flex h-9 items-center rounded-2xl bg-[#12335f] px-3 text-xs font-black text-white">{item.actionLabel}</Link>
                  <Link href={item.detailsHref} className="inline-flex h-9 items-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:border-[#12335f] hover:text-[#12335f]">Open source page</Link>
                </div>
              </section>
              <ProcurementLifecycleTracker
                events={item.events}
                currentStage="PROCUREMENT_CREATED"
                nextAction={item.nextAction}
                role="seller"
                sourceType={item.type}
                compact
                showTechnicalStatus
              />
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListBlock({ title, items, fallback }: { title: string; items: string[]; fallback: string }) {
  return (
    <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-200/70">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {items.map(item => (
            <li key={item} className="flex gap-2 text-xs font-semibold leading-relaxed text-slate-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#12335f]" />
              <span className="text-wrap-anywhere">{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">{fallback}</p>
      )}
    </div>
  );
}

function SelectFilter({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <select value={value} onChange={event => onChange(event.target.value)} className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none transition focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10">
      <option value="">{placeholder}</option>
      {options.map(option => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function TypeBadge({ type }: { type: OpportunityType }) {
  const tone = type === 'RFQ'
    ? 'border-orange-200 bg-orange-50 text-orange-700'
    : type === 'RFP'
      ? 'border-indigo-200 bg-indigo-50 text-indigo-750'
      : type === 'Open Tender'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : type === 'Limited Tender'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : type === 'Direct Purchase'
            ? 'border-teal-200 bg-teal-50 text-teal-700'
            : 'border-rose-200 bg-rose-50 text-rose-700';
  return <Badge className={cn('rounded-md', tone)}>{type}</Badge>;
}

function OpportunityCard({ item, serial, onView }: { item: SellerOpportunity; serial: number; onView: () => void }) {
  return (
    <article className="rounded-[22px] bg-white/95 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/70 transition hover:shadow-md">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-[10px] font-black text-slate-500">#{serial}</span>
            <button type="button" onClick={onView} className="text-[10px] font-black uppercase tracking-widest text-[#c86413] underline-offset-4 hover:underline">{item.sourceRef}</button>
            <TypeBadge type={item.type} />
          </div>
          <h2 className="mt-2 text-base font-black text-slate-950 text-wrap-anywhere">{item.title}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">{[item.buyer || 'Buyer details controlled', item.category || 'General procurement', item.quantity].filter(Boolean).join(' / ')}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={onView} className="inline-flex h-9 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:border-[#12335f] hover:text-[#12335f]">
            <Eye className="mr-1.5 h-4 w-4" /> View
          </button>
          <Link href={item.href} className="inline-flex h-9 items-center justify-center rounded-2xl bg-[#12335f] px-3 text-xs font-black text-white">
            {item.actionLabel}
          </Link>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <Metric label="Location" value={item.location || 'Not specified'} />
        <Metric label="Published" value={formatDate(item.publishedAt)} />
        <Metric label="Closing" value={formatDate(item.closingDate)} />
        <Metric label="Value" value={formatMoney(item.estimatedValue)} />
        <Metric label="Eligibility" value={item.eligibility} />
      </div>
      <div className="mt-4">
        <ProcurementLifecycleTracker
          events={item.events}
          currentStage="PROCUREMENT_CREATED"
          role="seller"
          sourceType={item.type}
          compact
        />
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-slate-50 p-3 ring-1 ring-slate-200/70">
      <p className="text-[9px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-black text-slate-800 text-wrap-anywhere">{value}</p>
    </div>
  );
}
