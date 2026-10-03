'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { sellerRoutes } from '@/lib/routes';
import { useSearchParams, useRouter } from 'next/navigation';
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
  Lock,
  ShoppingBag,
  type LucideIcon
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import { marketplaceApi } from '../../marketplace/api';
import { procurementBidApi } from '../../procurementBid/api';
import { fetchQuoteRequests } from '../../rfq/api';
import { reverseAuctionApi } from '../../reverseAuctions/api';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { ResponsiveFilterBar } from '../../../components/ui/ResponsiveFilterBar';
import { useResponsiveViewMode } from '../../shared/hooks';
import { formatDate as formatPureDate, formatTime, formatDisplayDate as formatSharedDate, hasExplicitTime, formatCleanLocation } from '../../shared/format';
import { Pagination } from '../../shared/Pagination';
import { KpiCard } from '../../shared/KpiCard';
import { DataTable, ColumnDef } from '../../../components/ui/data-table';
import ProcurementLifecycleTracker from '../../procurementLifecycle/components/ProcurementLifecycleTracker';
import type { ProcurementLifecycleEvent } from '../../procurementLifecycle/statusMapper';
import { useAuth } from '../../../hooks/useAuth';
import { getSellerOpportunityAdapter } from '../adapters';
import { formatRefId } from '../../../utils/refIdUtils';
import { TypeBadge, type OpportunityType } from '../../shared/TypeBadge';
export { TypeBadge, type OpportunityType };

interface SellerOpportunity {
  id: string;
  type: OpportunityType;
  title: string;
  buyer?: string;
  category?: string;
  location?: string;
  closingDate?: string;
  estimatedValue?: number;
  discloseEstimatedCost?: boolean;
  eligibility: string;
  status: string;
  actionLabel: string;
  href: string;
  detailsHref: string;
  sourceRef: string;
  isInvitation?: boolean;
  publishedAt?: string;
  createdAt?: string;
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

const formatDate = (value?: string | Date | null, forceTime = false) => {
  if (!value) return 'Not set';
  const formatted = formatSharedDate(value, { forceTime });
  return formatted === '—' ? 'Not set' : formatted;
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
 * Accurately resolves the closing timestamp for any date string.
 * For pure calendar dates (YYYY-MM-DD), sets the deadline to the end of that day (23:59:59.999)
 * so opportunities do not prematurely expire at UTC midnight (05:30 AM IST).
 */
export const getClosingTimestamp = (closingDate?: string | Date | null): number | null => {
  if (!closingDate) return null;
  if (closingDate instanceof Date) return Number.isFinite(closingDate.getTime()) ? closingDate.getTime() : null;
  const s = String(closingDate).trim();
  if (!s) return null;

  // Pure calendar date: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
  }

  // UTC midnight zero timestamp (e.g. 2026-09-13T00:00:00.000Z) without explicit time
  if (/T00:00:00(\.000)?(Z|[+-]00:00)?$/i.test(s)) {
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 23, 59, 59, 999).getTime();
    }
  }

  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

/**
 * Helper to identify closed / dead / concluded opportunity status
 */
const isClosedStatus = (status?: string) => {
  const s = String(status || '').toLowerCase();
  return (
    s.includes('closed') ||
    s.includes('awarded') ||
    s.includes('cancelled') ||
    s.includes('expired') ||
    s.includes('completed') ||
    s.includes('rejected') ||
    s.includes('po_generated') ||
    s.includes('ordered') ||
    s.includes('fulfilled') ||
    s.includes('terminated') ||
    s.includes('disqualified')
  );
};

/**
 * Helper to test if an opportunity is open and active for bidding
 */
const isOpenOpportunity = (item: SellerOpportunity, now: number) => {
  if (isClosedStatus(item.status)) return false;
  if (item.closingDate) {
    const closingTime = getClosingTimestamp(item.closingDate);
    if (closingTime !== null && closingTime < now) return false;
  }
  return true;
};

/**
 * Helper to test if an opportunity closes within the next 7 days
 */
const isClosingSoonOpportunity = (item: SellerOpportunity, now: number) => {
  if (!isOpenOpportunity(item, now)) return false;
  if (!item.closingDate) return false;
  const closingTime = getClosingTimestamp(item.closingDate);
  if (closingTime === null) return false;
  const diff = (closingTime - now) / 86400000;
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
    const closingTime = getClosingTimestamp(item.closingDate);
    if (closingTime !== null && closingTime < now && !stat.includes('awarded') && !stat.includes('cancelled') && !stat.includes('completed')) {
      return true;
    }
  }
  return false;
};

/**
 * Helper to test if opportunity or seller's participation is disqualified or not selected
 */
const isDisqualifiedOrNotSelected = (item: SellerOpportunity) => {
  const statusUpper = String(item.status || '').toUpperCase();
  const eligUpper = String(item.eligibility || '').toUpperCase();
  const actionUpper = String(item.actionLabel || '').toUpperCase();
  const nextUpper = String(item.nextAction || '').toUpperCase();

  return (
    statusUpper === 'DISQUALIFIED' ||
    statusUpper.includes('DISQUALIF') ||
    statusUpper === 'NOT_SELECTED' ||
    statusUpper === 'NOT SELECTED' ||
    statusUpper === 'REJECTED' ||
    eligUpper.includes('DISQUALIF') ||
    eligUpper.includes('NOT SELECTED') ||
    eligUpper.includes('NOT_SELECTED') ||
    eligUpper.includes('REJECTED') ||
    nextUpper.includes('DISQUALIF') ||
    nextUpper.includes('NOT SELECTED')
  );
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

export const getPublishedTimestamp = (opp: Partial<SellerOpportunity> | null | undefined): number => {
  if (!opp) return 0;
  const raw = opp.publishedAt || opp.createdAt;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : 0;
};

let globalOpportunitiesCache: SellerOpportunity[] | null = null;

const getInitialOpportunitiesCache = (): SellerOpportunity[] => {
  if (globalOpportunitiesCache && globalOpportunitiesCache.length > 0) {
    return globalOpportunitiesCache;
  }
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('seller_opportunities_cached_list');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          globalOpportunitiesCache = parsed;
          return parsed;
        }
      }
    } catch { /* ignore */ }
  }
  return [];
};

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
  const closingTime = getClosingTimestamp(closingDate);
  if (closingTime === null) return '';
  const diffMs = closingTime - Date.now();
  if (diffMs < 0) return 'Closed';

  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 24) {
    const hours = Math.floor(diffHours);
    if (hours >= 1) {
      return `${hours} hr${hours > 1 ? 's' : ''} left`;
    }
    const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `${mins} min${mins > 1 ? 's' : ''} left`;
  }
  const days = Math.ceil(diffMs / 86400000);
  return `${days} Day${days > 1 ? 's' : ''} Left`;
};

const formatOrganizationType = (type?: string): string => {
  if (!type) return 'Not specified';
  const cleanType = type.trim().toUpperCase();
  if (cleanType === 'PRIVATE_BUYER' || cleanType === 'PRIVATE ENTERPRISE' || cleanType === 'PRIVATE') {
    return 'Private Enterprise';
  }
  if (cleanType === 'GOVERNMENT_BUYER' || cleanType === 'GOVERNMENT' || cleanType === 'GOVT') {
    return 'Government / Department';
  }
  if (cleanType === 'PSU_BUYER' || cleanType === 'PSU' || cleanType.includes('PUBLIC SECTOR')) {
    return 'Public Sector Undertaking (PSU)';
  }
  if (cleanType === 'PUBLIC_BUYER' || cleanType === 'PUBLIC_LIMITED' || cleanType === 'PUBLIC') {
    return 'Public Enterprise';
  }
  if (cleanType === 'ENTERPRISE') {
    return 'Enterprise';
  }
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
};

const formatBuyerType = formatOrganizationType;

const formatLocation = (loc?: string): string => {
  if (!loc) return 'Location not specified';
  const cleaned = formatCleanLocation(loc);
  return cleaned || 'Location not specified';
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
      const days = Math.floor(diff / 86400000);
      const hrs = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      
      const pad = (n: number) => String(n).padStart(2, '0');
      setTimeLeft(days > 0 ? `${days}d ${pad(hrs)}h : ${pad(mins)}m : ${pad(secs)}s` : `${pad(hrs)}h : ${pad(mins)}m : ${pad(secs)}s`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [endDate]);

  return <span className="font-mono text-xs font-black text-red-600 animate-pulse">{timeLeft}</span>;
}

export default function SellerOpportunitiesPage({ subRouteType = '' }: { subRouteType?: OpportunityType | '' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<SellerOpportunity[]>(() => getInitialOpportunitiesCache());
  const [loading, setLoading] = useState(() => getInitialOpportunitiesCache().length === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [prevSubRouteType, setPrevSubRouteType] = useState(subRouteType);
  const [type, setType] = useState<OpportunityType | ''>(() => subRouteType || typeFromQuery(searchParams?.get('type')));

  if (subRouteType !== prevSubRouteType) {
    setPrevSubRouteType(subRouteType);
    setType(subRouteType);
  }
  const [status, setStatus] = useState('ALL');
  const [location, setLocation] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<SellerOpportunity | null>(null);
  const [viewMode, setViewMode] = useResponsiveViewMode('seller:opportunities:view-mode');
  const [kpiFilter, setKpiFilter] = useState<'all' | 'live' | 'dueSoon' | 'highValue' | 'participated' | 'evaluation'>('all');
  const [category, setCategory] = useState('');
  const [valueRange, setValueRange] = useState('');
  const [sortOption, setSortOption] = useState<'newest' | 'closing_soon' | 'value_high' | 'value_low' | 'title_asc'>('newest');
  const [sortField, setSortField] = useState<'type' | 'title' | 'buyer' | 'publishedAt' | 'closingDate' | 'estimatedValue' | ''>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [nowMs] = useState(() => Date.now());

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
    // Always clear stale cache before fetching — prevents sessionStorage
    // ghost data from persisting when the backend returns 0 records.
    globalOpportunitiesCache = null;
    if (typeof window !== 'undefined') {
      try { sessionStorage.removeItem('seller_opportunities_cached_list'); } catch { /* ignore */ }
    }
    setItems([]);
    setLoading(true);

    const dedupeAndSort = (opportunities: SellerOpportunity[]): SellerOpportunity[] => {
      const deduped: SellerOpportunity[] = [];

      const cleanCoreTitle = (str: string) => {
        const cleaned = (str || '')
          .toLowerCase()
          .replace(/^procurement of\s+/, '')
          .replace(/\b(annual|rate|contract|contracts|for|service|services|1|year|years|supply|supplies|procurement|of|reverse|auction|live|negotiation)\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return cleaned || (str || '').trim().toLowerCase();
      };

      const extractRefKeys = (opp: SellerOpportunity) => {
        const keys: string[] = [];
        if (opp.sourceRef) {
          const parts = String(opp.sourceRef).toUpperCase().split(/[•\s]+/);
          parts.forEach(p => {
            const cleanP = p.trim();
            if (cleanP) keys.push(cleanP);
          });
        }

        const searchStr = `${opp.id || ''} ${opp.title || ''} ${opp.sourceRef || ''} ${opp.href || ''} ${opp.detailsHref || ''} ${JSON.stringify(opp.detailRows || [])}`;
        const reqIdMatches = searchStr.match(/requirementId=(\d+)/gi) || [];
        const bidIdMatches = searchStr.match(/linkedBidId=(\d+)/gi) || searchStr.match(/bid-(\d+)/gi) || searchStr.match(/PBID-\d+/gi) || [];
        const reqNoMatches = searchStr.match(/REQ-[\w-]+/gi) || [];
        const rfqNoMatches = searchStr.match(/RFQ-[\w-]+/gi) || [];
        const rfpNoMatches = searchStr.match(/RFP-[\w-]+/gi) || [];
        const rcNoMatches = searchStr.match(/RC-[\w-]+/gi) || [];
        const raNoMatches = searchStr.match(/RA-[\w-]+/gi) || [];
        const bidNoMatches = searchStr.match(/BID-[\w-]+/gi) || [];
        const tndNoMatches = searchStr.match(/TND-[\w-]+/gi) || [];

        for (const m of [...reqIdMatches, ...bidIdMatches, ...reqNoMatches, ...rfqNoMatches, ...rfpNoMatches, ...rcNoMatches, ...raNoMatches, ...bidNoMatches, ...tndNoMatches]) {
          keys.push(m.toUpperCase().trim());
        }
        return Array.from(new Set(keys));
      };

      const getBaseType = (typeStr: string): string => {
        return (typeStr || '').replace(/(\s*\+\s*RA)+$/gi, '').trim();
      };

      opportunities.forEach(opportunity => {
        const oppIsAuction = opportunity.type === 'Reverse Auction' || /(\s*\+\s*RA)/i.test(opportunity.type);
        const coreTitle = cleanCoreTitle(opportunity.title);
        const refKeys = extractRefKeys(opportunity);

        const existingIndex = deduped.findIndex(item => {
          const itemRefKeys = extractRefKeys(item);

          // 1. Shared reference keys across records (e.g., parent RC or bid number shared with reverse auction)
          const sharedRef = refKeys.length > 0 && refKeys.some(r => itemRefKeys.includes(r));
          if (sharedRef) return true;

          // 2. Exact sourceRef match (e.g. same RFQ or Tender)
          if (item.sourceRef && opportunity.sourceRef && item.sourceRef.trim().toUpperCase() === opportunity.sourceRef.trim().toUpperCase()) {
            return true;
          }

          // 3. If both have explicit sourceRefs and they differ (and share no reference keys), they are strictly different
          if (item.sourceRef && opportunity.sourceRef && item.sourceRef.trim().toUpperCase() !== opportunity.sourceRef.trim().toUpperCase()) {
            return false;
          }

          // Never merge two separate procurements by title alone — separate procurements can share a title
          return false;
        });

        if (existingIndex === -1) {
          deduped.push(opportunity);
        } else {
          const existing = deduped[existingIndex];
          const existingIsAuction = existing.type === 'Reverse Auction' || /(\s*\+\s*RA)/i.test(existing.type);

          let mergedType = existing.type;
          const baseOpp = getBaseType(opportunity.type);
          const baseExisting = getBaseType(existing.type);

          if (existing.type === 'Reverse Auction' && opportunity.type !== 'Reverse Auction') {
            mergedType = `${baseOpp} + RA` as OpportunityType;
          } else if (existing.type !== 'Reverse Auction' && opportunity.type === 'Reverse Auction') {
            mergedType = `${baseExisting} + RA` as OpportunityType;
          } else if (existing.type.includes('+ RA') || opportunity.type.includes('+ RA')) {
            const base = existing.type !== 'Reverse Auction' ? baseExisting : baseOpp;
            mergedType = `${base} + RA` as OpportunityType;
          }

          const titleA = existing.title || '';
          const titleB = opportunity.title || '';
          const bestTitle = titleB.length > titleA.length ? titleB : titleA;

          const buyerA = existing.buyer || '';
          const buyerB = opportunity.buyer || '';
          const isGenericBuyer = (b: string) => !b || b.trim().toLowerCase() === 'verified buyer' || b.trim().toLowerCase() === 'buyer organization' || b.trim().toLowerCase() === 'buyer details controlled';
          const bestBuyer = isGenericBuyer(buyerA) && !isGenericBuyer(buyerB) ? buyerB : (isGenericBuyer(buyerB) ? buyerA : buyerB);

          const categoryA = existing.category || '';
          const categoryB = opportunity.category || '';
          const isGenericCat = (c: string) => !c || c === 'Rate Contract' || c === 'General Sourcing' || c === 'Negotiate Price';
          const bestCategory = isGenericCat(categoryA) && !isGenericCat(categoryB) ? categoryB : categoryA;

          const locA = existing.location || '';
          const locB = opportunity.location || '';
          const isGenericLoc = (l: string) => !l || l.toLowerCase().includes('not specified') || l.toLowerCase().includes('agreed sla') || l.toLowerCase().includes('delivery within') || l.toLowerCase().includes('call-off');
          const bestLoc = isGenericLoc(locA) && !isGenericLoc(locB) ? locB : locA;

          const auctionOpp = oppIsAuction ? opportunity : (existingIsAuction ? existing : null);
          const parentOpp = (existing.type !== 'Reverse Auction' && !existing.type.endsWith('+ RA'))
            ? existing
            : ((opportunity.type !== 'Reverse Auction' && !opportunity.type.endsWith('+ RA')) ? opportunity : null);

          const valA = existing.estimatedValue || 0;
          const valB = opportunity.estimatedValue || 0;
          let bestVal = (parentOpp?.estimatedValue && parentOpp.estimatedValue > 0)
            ? parentOpp.estimatedValue
            : (auctionOpp?.estimatedValue || valA || valB);

          const discloseA = existing.discloseEstimatedCost;
          const discloseB = opportunity.discloseEstimatedCost;
          const bestDisclose = discloseB !== undefined ? discloseB : discloseA;

          const pubA = existing.publishedAt || '';
          const pubB = opportunity.publishedAt || '';
          let bestPublishedAt = pubA || pubB;
          if (pubA && pubB) {
            const hasExplicitA = hasExplicitTime(pubA);
            const hasExplicitB = hasExplicitTime(pubB);
            if (hasExplicitA && !hasExplicitB) {
              bestPublishedAt = pubA;
            } else if (!hasExplicitA && hasExplicitB) {
              bestPublishedAt = pubB;
            } else {
              const tsA = new Date(pubA).getTime();
              const tsB = new Date(pubB).getTime();
              if (Number.isFinite(tsA) && Number.isFinite(tsB)) {
                bestPublishedAt = tsA >= tsB ? pubA : pubB;
              } else {
                bestPublishedAt = pubA || pubB;
              }
            }
          }

          const closeA = existing.closingDate || '';
          const closeB = opportunity.closingDate || '';
          let bestClosingDate = auctionOpp?.closingDate || closeA || closeB;
          if (!auctionOpp?.closingDate) {
            const isBetterClosing = (cand: string, other: string) => {
              if (!cand) return false;
              if (!other) return true;
              const candHasZ = cand.includes('Z');
              const otherHasZ = other.includes('Z');
              if (!candHasZ && otherHasZ) return true;
              if (candHasZ && !otherHasZ) return false;
              return hasExplicitTime(cand);
            };
            bestClosingDate = isBetterClosing(closeB, closeA) ? closeB : (isBetterClosing(closeA, closeB) ? closeA : (closeB || closeA));
          }

          let bestActionLabel = parentOpp?.actionLabel || existing.actionLabel;
          let bestHref = parentOpp?.href || existing.href;
          let bestDetailsHref = parentOpp?.detailsHref || existing.detailsHref;

          if (auctionOpp) {
            const auctionStatusUpper = String(auctionOpp.status).toUpperCase();
            const isAuctionActive = auctionStatusUpper === 'OPEN' || auctionStatusUpper === 'SCHEDULED' || auctionStatusUpper === 'LIVE';
            if (isAuctionActive) {
              bestActionLabel = 'Enter Live Auction Floor →';
              bestHref = auctionOpp.href;
            }
          }

          const parentRef = parentOpp?.sourceRef || existing.sourceRef;
          const auctionRef = auctionOpp ? (auctionOpp.sourceRef.includes('•') ? auctionOpp.sourceRef.split('•')[1].trim() : auctionOpp.sourceRef) : '';
          const bestSourceRef = parentRef && auctionRef && !parentRef.includes(auctionRef)
            ? `${parentRef} • ${auctionRef}`
            : (parentRef || existing.sourceRef);

          const mergedStatus = auctionOpp && ['LIVE', 'SCHEDULED', 'OPEN'].includes(String(auctionOpp.status).toUpperCase())
            ? (String(auctionOpp.status).toUpperCase() === 'LIVE' ? 'e-RA Live' : 'e-RA Scheduled')
            : (parentOpp?.status || existing.status);

          deduped[existingIndex] = {
            ...existing,
            ...parentOpp,
            type: mergedType as OpportunityType,
            title: bestTitle,
            buyer: bestBuyer,
            category: bestCategory,
            location: bestLoc,
            estimatedValue: bestVal,
            discloseEstimatedCost: bestDisclose,
            publishedAt: bestPublishedAt,
            closingDate: bestClosingDate,
            actionLabel: bestActionLabel,
            href: bestHref,
            detailsHref: bestDetailsHref,
            sourceRef: bestSourceRef,
            status: mergedStatus,
            events: (existing.events && existing.events.length > 0) ? existing.events : opportunity.events,
          };
        }
      });

      return deduped.sort((a, b) => {
        const pubA = getPublishedTimestamp(a);
        const pubB = getPublishedTimestamp(b);
        if (pubB !== pubA) return pubB - pubA;
        return (getClosingTimestamp(a.closingDate) || 0) - (getClosingTimestamp(b.closingDate) || 0);
      });
    };

    const applyChunk = (newOpportunities: SellerOpportunity[]) => {
      if (!alive) return;
      setItems(prev => {
        const sorted = dedupeAndSort([...prev, ...newOpportunities]);
        globalOpportunitiesCache = sorted;
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('seller_opportunities_cached_list', JSON.stringify(sorted.slice(0, 100)));
          } catch { /* ignore quota */ }
        }
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
        const method = String(bid.canonicalMethod || bid.procurementType || bid.bidType || '').toUpperCase();
        const upperBidNumber = String(bid.bidNumber || bid.id || bid.sourceId || '').toUpperCase();
        const allowedMethods = ['RFQ', 'RFP', 'OPEN_TENDER', 'LIMITED_TENDER', 'REVERSE_AUCTION', 'TENDER', 'REPEAT_ORDER', 'RATE_CONTRACT', 'DIRECT_PURCHASE', 'DIRECT', 'DP'];
        const hasCanonicalPrefix = ['RFQ-', 'RFP-', 'TND-', 'LTND-', 'LIM-', 'RC-', 'DP-', 'DIR-', 'RA-'].some(pfx => upperBidNumber.startsWith(pfx));
        if (!allowedMethods.includes(method) && !method.startsWith('RFQ') && !hasCanonicalPrefix) return;

        const documents = asTextList(bid.requiredDocuments);
        const terms = asTextList(bid.terms);

        const upperTitle = String(bid.title || bid.itemName || '').toUpperCase();
        const upperMethod = method;

        const isExplicitBidRfq = upperBidNumber.startsWith('RFQ-') || method === 'RFQ' || bid.canonicalMethod === 'RFQ' || bid.procurementType === 'RFQ' || bid.bidType === 'RFQ';
        const isExplicitBidRfp = upperBidNumber.startsWith('RFP-') || method === 'RFP' || bid.canonicalMethod === 'RFP' || bid.procurementType === 'RFP' || bid.bidType === 'RFP';
        const isExplicitBidLimited = upperBidNumber.startsWith('LTND-') || upperBidNumber.startsWith('LIM-') || method === 'LIMITED_TENDER' || method === 'LIMITED' || method.includes('LIMITED') || String(bid.procurementType || '').includes('LIMITED');
        const isExplicitBidTender = !isExplicitBidLimited && (upperBidNumber.startsWith('TND-') || method.includes('TENDER') || String(bid.procurementType || '').includes('TENDER') || method === 'OPEN_TENDER');

        const isBidRateContract = !isExplicitBidRfq && !isExplicitBidRfp && !isExplicitBidLimited && !isExplicitBidTender && (
          upperBidNumber.startsWith('RC-') ||
          upperMethod.includes('RATE') ||
          upperTitle.includes('RATE CONTRACT') ||
          bid.sourceModel === 'RATE_CONTRACT' ||
          bid.procurementType === 'RATE_CONTRACT' ||
          bid.bidType === 'RATE_CONTRACT'
        );
        const isBidDirectPurchase = upperBidNumber.startsWith('DP-') || upperBidNumber.startsWith('DIR-') || method === 'DIRECT_PURCHASE' || upperMethod.includes('DIRECT') || method === 'DP';

        let opportunityType: OpportunityType = 'RFQ';
        if (isExplicitBidRfq) opportunityType = 'RFQ';
        else if (isExplicitBidRfp || method === 'RFP' || upperMethod.includes('RFP')) opportunityType = 'RFP';
        else if (isExplicitBidLimited) opportunityType = 'Limited Tender';
        else if (isExplicitBidTender) opportunityType = 'Open Tender';
        else if (isBidRateContract) opportunityType = 'Rate Contract';
        else if (method === 'REVERSE_AUCTION' || upperBidNumber.startsWith('RA-') || upperMethod.includes('AUCTION')) opportunityType = 'Reverse Auction';
        else if (isBidDirectPurchase) opportunityType = 'Direct Purchase';
        else if (method === 'REPEAT_ORDER') opportunityType = 'Repeat Order';

        const canonicalBidId = bid.bidNumber || bid.referenceNumber || bid.id;
        let actionLabel = bid.participated ? 'Track Status' : 'Submit Bid';
        let href = `/bids/${canonicalBidId}/participate`;
        let detailsHref = `/bids/${canonicalBidId}`;

        if (opportunityType === 'Rate Contract') {
          href = sellerRoutes.respond('RATE_CONTRACT', canonicalBidId);
          detailsHref = sellerRoutes.detail('RATE_CONTRACT', canonicalBidId);
          actionLabel = bid.participated ? 'Track Status' : 'Submit Rate';
        } else if (bid.sourceModel === 'TENDER' && bid.sourceId) {
          href = `/seller/tenders/${bid.sourceId}/bid`;
          detailsHref = `/bids/${bid.sourceId}?type=OPEN_TENDER`;
          actionLabel = bid.participated ? 'Track Status' : 'Submit Quote';
        } else if (method === 'RFP' || opportunityType === 'RFP') {
          href = sellerRoutes.detail('RFP', canonicalBidId);
          detailsHref = sellerRoutes.detail('RFP', canonicalBidId);
          actionLabel = bid.participated ? 'Track Status' : 'Submit Proposal';
        } else if (opportunityType === 'Open Tender') {
          href = sellerRoutes.detail('OPEN_TENDER', canonicalBidId);
          detailsHref = sellerRoutes.detail('OPEN_TENDER', canonicalBidId);
          actionLabel = bid.participated ? 'Track Status' : 'Submit Bid';
        } else if (opportunityType === 'Limited Tender') {
          href = sellerRoutes.detail('LIMITED_TENDER', canonicalBidId);
          detailsHref = sellerRoutes.detail('LIMITED_TENDER', canonicalBidId);
          actionLabel = bid.participated ? 'Track Status' : 'Submit Bid';
        } else if (opportunityType === 'Reverse Auction') {
          href = sellerRoutes.auctionLive(bid.id);
          detailsHref = sellerRoutes.detail('REVERSE_AUCTION', bid.id);
          actionLabel = 'Join Auction';
        } else if (opportunityType === 'Direct Purchase') {
          href = `/bids/${canonicalBidId}`;
          detailsHref = `/bids/${canonicalBidId}`;
          actionLabel = 'View Purchase';
        } else {
          href = bid.participated ? sellerRoutes.respond('RFQ', canonicalBidId) : sellerRoutes.detail('RFQ', canonicalBidId);
          detailsHref = sellerRoutes.detail('RFQ', canonicalBidId);
          actionLabel = bid.participated ? 'View Quotation' : 'Submit Quote';
        }

        const bidSchedule = bid.technicalPacket?.schedule || (bid as any).schedule || {};
        const effectiveClosingDate = bidSchedule.submissionDate
          || bidSchedule.submissionDeadline
          || bidSchedule.submissionEndDate
          || bidSchedule.bidClosingDate
          || bid.rawEndDate
          || bid.endDate;
        const myParticipation = bid.myParticipation || (Array.isArray(bid.participations) && user?.id
          ? bid.participations.find((p: any) => Number(p.sellerId || p.sellerUserId) === Number(user.id))
          : null);
        const myTechStatus = String(myParticipation?.technicalStatus || '').toUpperCase();
        const myFinalStatus = String(myParticipation?.finalStatus || '').toUpperCase();
        const isBidDisqualified = myTechStatus === 'DISQUALIFIED' || myFinalStatus === 'DISQUALIFIED';
        const isBidNotSelected = myFinalStatus === 'NOT_SELECTED' || myFinalStatus === 'REJECTED';

        const bidEligibility = isBidDisqualified
          ? 'Disqualified'
          : isBidNotSelected
          ? 'Not Selected'
          : bid.participated
          ? 'Already participated'
          : 'Check documents';

        const opportunity: SellerOpportunity = {
          id: `bid-${bid.id}`,
          type: opportunityType,
          title: bid.title || bid.itemName || 'Procurement opportunity',
          buyer: bid.buyerOrganizationName || bid.buyerOrganization?.organizationName || bid.buyerName || bid.organization?.organizationName || 'Verified Buyer',
          category: bid.category,
          location: bid.location || bid.deliveryLocation || [bid.district, bid.state].filter(Boolean).join(', ') || 'Location not specified',
          closingDate: effectiveClosingDate,
          estimatedValue: toNumber(bid.estimatedValue),
          discloseEstimatedCost: Boolean(bid.discloseEstimatedCost ?? bid.payload?.discloseEstimatedCost ?? bid.payload?.basics?.discloseEstimatedCost ?? false),
          eligibility: bidEligibility,
          status: bid.status || 'Open',
          actionLabel,
          href,
          detailsHref,
          sourceRef: bid.id || `BID-${bid.sourceId || ''}`,
          publishedAt: bid.publishedAt || bid.approvedAt || bid.createdAt || bid.rawStartDate || bid.startDate,
          createdAt: bid.createdAt,
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
          events: opportunityEvents(bid.status, bid.rawStartDate || bid.startDate || bid.createdAt),
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
        const reqMethod = String(req.canonicalMethod || req.procurementMethod || '').toUpperCase();
        const upperReqNumber = String(req.requirementNumber || req.referenceNumber || req.bidNumber || req.id || '').toUpperCase();
        const allowedMethods = ['RFQ', 'RFP', 'OPEN_TENDER', 'LIMITED_TENDER', 'REVERSE_AUCTION', 'TENDER', 'REPEAT_ORDER', 'RATE_CONTRACT', 'DIRECT_PURCHASE', 'DIRECT', 'DP'];
        const hasReqPrefix = ['RFQ-', 'RFP-', 'TND-', 'LTND-', 'LIM-', 'RC-', 'DP-', 'DIR-', 'RA-'].some(pfx => upperReqNumber.startsWith(pfx));
        if (reqMethod && !allowedMethods.includes(reqMethod) && !hasReqPrefix) return;

        // Sellers must only see approved/sourcing/active requirements, never buyer drafts
        const reqStat = String(req.status || '').toUpperCase();
        if (reqStat === 'DRAFT' || reqStat === 'PENDING_APPROVAL' || reqStat === 'REJECTED') return;

        const reqInvites = Array.isArray(req.payload?.vendors?.invitedSellers) 
          ? req.payload.vendors.invitedSellers 
          : (Array.isArray(req.invitedSellers) ? req.invitedSellers : []);
        
        const isReqPrivate = req.visibility === 'VERIFIED_SELLERS_ONLY' || req.visibility === 'INVITED_SUPPLIERS' || ['LIMITED_TENDER', 'REPEAT_ORDER'].includes(reqMethod) || upperReqNumber.startsWith('LTND-') || upperReqNumber.startsWith('LIM-');
        
        if (isReqPrivate) {
          const isInvited = reqInvites.includes(user?.id) || (user?.organizationId && reqInvites.includes(user?.organizationId));
          if (!isInvited) return;
        }

        const upperReqTitle = String(req.title || '').toUpperCase();
        const upperReqMethod = String(req.canonicalMethod || req.procurementMethod || req.payload?.fullProcurementMethod || req.payload?.type || req.payload?.basics?.procurementMethod || '').toUpperCase();

        const isExplicitReqRfq = upperReqNumber.startsWith('RFQ-') || reqMethod === 'RFQ' || req.procurementMethod === 'RFQ' || req.canonicalMethod === 'RFQ' || req.payload?.fullProcurementMethod === 'RFQ' || req.payload?.type === 'RFQ' || upperReqMethod === 'RFQ';
        const isExplicitReqRfp = upperReqNumber.startsWith('RFP-') || reqMethod === 'RFP' || req.procurementMethod === 'RFP' || req.canonicalMethod === 'RFP' || req.payload?.fullProcurementMethod === 'RFP' || req.payload?.type === 'RFP' || upperReqMethod === 'RFP';
        const isExplicitReqLimited = upperReqNumber.startsWith('LTND-') || upperReqNumber.startsWith('LIM-') || reqMethod === 'LIMITED_TENDER' || reqMethod === 'LIMITED' || reqMethod.includes('LIMITED') || upperReqMethod.includes('LIMITED');
        const isExplicitReqTender = !isExplicitReqLimited && (upperReqNumber.startsWith('TND-') || reqMethod.includes('TENDER') || String(req.procurementMethod || '').includes('TENDER') || String(req.canonicalMethod || '').includes('TENDER') || upperReqMethod.includes('TENDER'));

        const isReqRateContract = !isExplicitReqRfq && !isExplicitReqRfp && !isExplicitReqLimited && !isExplicitReqTender && (
          upperReqNumber.startsWith('RC-') ||
          upperReqMethod.includes('RATE') ||
          upperReqTitle.includes('RATE CONTRACT') ||
          req.procurementMethod === 'RATE_CONTRACT' ||
          req.canonicalMethod === 'RATE_CONTRACT' ||
          req.payload?.type === 'RATE_CONTRACT' ||
          req.payload?.fullProcurementMethod === 'RATE_CONTRACT'
        );
        const isReqDirectPurchase = upperReqNumber.startsWith('DP-') || upperReqNumber.startsWith('DIR-') || reqMethod === 'DIRECT_PURCHASE' || upperReqMethod.includes('DIRECT') || reqMethod === 'DP';

        let opportunityType: OpportunityType = 'RFQ';
        if (isExplicitReqRfq) opportunityType = 'RFQ';
        else if (isExplicitReqRfp || reqMethod === 'RFP' || upperReqMethod.includes('RFP')) opportunityType = 'RFP';
        else if (isExplicitReqLimited) opportunityType = 'Limited Tender';
        else if (isExplicitReqTender) opportunityType = 'Open Tender';
        else if (isReqRateContract) opportunityType = 'Rate Contract';
        else if (upperReqNumber.startsWith('RA-') || reqMethod === 'REVERSE_AUCTION' || upperReqMethod.includes('AUCTION')) opportunityType = 'Reverse Auction';
        else if (isReqDirectPurchase) opportunityType = 'Direct Purchase';
        else if (reqMethod === 'REPEAT_ORDER') opportunityType = 'Repeat Order';

        const documents = asTextList(req.requiredDocuments);
        const linkedBidId = req.payload?.linkedProcurementBidId;
        const canonicalReqId = req.referenceNumber || req.bidNumber || req.requirementNumber || req.sourceId || (typeof req.id === 'number' && req.id < 0 ? Math.abs(req.id) : req.id);
        const buildDetailHref = () => {
          if (opportunityType === 'Rate Contract') return sellerRoutes.detail('RATE_CONTRACT', canonicalReqId);
          if (opportunityType === 'RFQ') return sellerRoutes.detail('RFQ', canonicalReqId);
          if (opportunityType === 'RFP') return sellerRoutes.detail('RFP', canonicalReqId);
          if (opportunityType === 'Open Tender') return sellerRoutes.detail('OPEN_TENDER', canonicalReqId);
          if (opportunityType === 'Limited Tender') return sellerRoutes.detail('LIMITED_TENDER', canonicalReqId);
          if (opportunityType === 'Reverse Auction') return sellerRoutes.detail('REVERSE_AUCTION', req.sourceId || canonicalReqId);
          if (opportunityType === 'Direct Purchase') return `/bids/${canonicalReqId}`;
          return `/marketplace/requirements/${canonicalReqId}`;
        };
        const detailHref = buildDetailHref();
        const responseHref = linkedBidId 
          ? (opportunityType === 'Rate Contract' ? sellerRoutes.respond('RATE_CONTRACT', linkedBidId) : `/bids/${linkedBidId}/participate`)
          : (opportunityType === 'Rate Contract' ? sellerRoutes.respond('RATE_CONTRACT', canonicalReqId) : detailHref);

        const myReqParticipation = req.myParticipation || (Array.isArray(req.participations) && user?.id
          ? req.participations.find((p: any) => Number(p.sellerId || p.sellerUserId) === Number(user.id))
          : null);
        const myReqResponse = req.ownResponse || (Array.isArray(req.responses) && user?.id
          ? req.responses.find((r: any) => Number(r.sellerUserId || r.sellerId) === Number(user.id))
          : null);
        const reqTechStatus = String(myReqParticipation?.technicalStatus || myReqResponse?.technicalStatus || '').toUpperCase();
        const reqFinalStatus = String(myReqParticipation?.finalStatus || myReqResponse?.status || myReqResponse?.finalStatus || '').toUpperCase();
        const isReqDisqualified = reqTechStatus === 'DISQUALIFIED' || reqFinalStatus === 'DISQUALIFIED' || reqFinalStatus === 'REJECTED';
        const isReqNotSelected = reqFinalStatus === 'NOT_SELECTED';

        const isReqParticipated = Boolean(
          req.hasParticipated ||
          myReqParticipation ||
          myReqResponse ||
          (user?.id && (
            (Array.isArray(req.participations) && req.participations.some((p: any) => Number(p.sellerId || p.sellerUserId) === Number(user.id))) ||
            (Array.isArray(req.responses) && req.responses.some((r: any) => Number(r.sellerUserId || r.sellerId) === Number(user.id)))
          ))
        );

        const defaultReqAction = opportunityType === 'Rate Contract'
          ? 'Submit Rate'
          : opportunityType === 'RFP'
          ? 'Submit Proposal'
          : opportunityType === 'Open Tender' || opportunityType === 'Limited Tender'
          ? 'Participate'
          : 'Submit Quotation';

        const reqSchedule = req.payload?.schedule || req.schedule || {};
        const effectiveReqClosingDate = reqSchedule.submissionDate
          || reqSchedule.submissionDeadline
          || reqSchedule.submissionEndDate
          || reqSchedule.bidClosingDate
          || req.lastDate
          || req.requiredBy;

        const reqEligibility = isReqDisqualified
          ? 'Disqualified'
          : isReqNotSelected
          ? 'Not Selected'
          : isReqParticipated
          ? 'Already participated'
          : (req.verifiedSellersOnly ? 'Verified sellers only' : 'All eligible sellers');

        const opportunity: SellerOpportunity = {
          id: `req-${req.id}`,
          type: opportunityType,
          title: req.title || req.description || 'Procurement requirement',
          buyer: req.buyerOrganization?.organizationName || req.organization?.organizationName || req.buyerName || 'Verified Buyer',
          category: req.category?.name || req.category || 'General Sourcing',
          location: req.location || req.deliveryLocation || [req.district, req.state].filter(Boolean).join(', ') || 'Location not specified',
          closingDate: effectiveReqClosingDate,
          estimatedValue: toNumber(req.budgetMax || req.estimatedValue),
          discloseEstimatedCost: Boolean(req.discloseEstimatedCost ?? req.payload?.discloseEstimatedCost ?? req.payload?.basics?.discloseEstimatedCost ?? false),
          eligibility: reqEligibility,
          status: req.status || 'OPEN',
          actionLabel: isReqParticipated ? 'Track Status' : defaultReqAction,
          href: responseHref,
          detailsHref: detailHref,
          sourceRef: req.referenceNumber || req.bidNumber || formatRefId(opportunityType === 'Rate Contract' ? 'RC' : 'RFQ', req.sourceId || req.id, req.requirementNumber, req.procurementMethod || req.canonicalMethod || opportunityType),
          publishedAt: req.approvedAt || req.publishedAt || req.createdAt,
          createdAt: req.createdAt,
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
          events: opportunityEvents(req.status, req.approvedAt || req.createdAt),
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
          const isInvited = invitedSellers.includes(user?.id) || (user?.organizationId && invitedSellers.includes(user?.organizationId));
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
        const qrSchedule = qr.payload?.schedule || qr.schedule || {};
        const opportunity: SellerOpportunity = {
          id: `qr-${qr.id}`,
          type: opportunityType,
          title: qr.title || qr.itemName || 'Request for Quotation',
          buyer: qr.buyerOrganizationName || qr.buyer?.name || 'Verified Buyer',
          category: qr.category || 'Direct RFQ',
          location: qr.deliveryLocation || qr.location || [qr.district, qr.state].filter(Boolean).join(', ') || 'Location not specified',
          closingDate: qrSchedule.submissionDate || qrSchedule.submissionDeadline || qr.deadlineDate || qr.endDate,
          estimatedValue: toNumber(qr.estimatedValue),
          discloseEstimatedCost: Boolean(qr.discloseEstimatedCost ?? qr.payload?.discloseEstimatedCost ?? qr.payload?.basics?.discloseEstimatedCost ?? false),
          eligibility: isQrPrivate ? 'Invited Sellers Only' : 'Open Sourcing',
          status: qr.status || 'OPEN',
          actionLabel: 'Submit Quote',
          href: sellerRoutes.detail('RFQ', qr.id),
          detailsHref: sellerRoutes.detail('RFQ', qr.id),
          sourceRef: qr.quoteNumber || `RFQ-${qr.id}`,
          publishedAt: qr.createdAt,
          createdAt: qr.createdAt,
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
        const refNumber = auction.referenceNo || auction.auctionConfig?.parentRefNumber || (auction.linkedBidId ? `PBID-${auction.linkedBidId}` : null);
        const rawTitle = auction.title || auction.itemName || '';
        const resolvedTitle = rawTitle && rawTitle.length > 5
          ? rawTitle
          : (refNumber ? `${refNumber} — Live Reverse Auction` : 'Reverse Auction Opportunity');
        const sourceRef = refNumber ? `${refNumber} • ${auction.auctionCode || `RA-${auction.id}`}` : (auction.auctionCode || `RA-${auction.id}`);
        const auctionStatus = String(auction.statusEnum || auction.status || 'Scheduled').toUpperCase();
        const isLive = auctionStatus === 'LIVE' || auctionStatus === 'OPEN';

        let resolvedOppType: OpportunityType = 'Reverse Auction';
        const upperRef = String(refNumber || '').toUpperCase();
        const parentMethodStr = String(auction.parentProcurementMethod || auction.auctionConfig?.parentProcurementMethod || '').toUpperCase();

        if (upperRef.startsWith('LTND-') || parentMethodStr.includes('LIMITED')) {
          resolvedOppType = 'Limited Tender + RA';
        } else if (upperRef.startsWith('TND-') || parentMethodStr.includes('OPEN') || parentMethodStr.includes('TENDER')) {
          resolvedOppType = 'Open Tender + RA';
        } else if (upperRef.startsWith('RFQ-') || parentMethodStr.includes('RFQ')) {
          resolvedOppType = 'RFQ + RA';
        } else if (upperRef.startsWith('RFP-') || parentMethodStr.includes('RFP')) {
          resolvedOppType = 'RFP + RA';
        } else if (upperRef.startsWith('RC-') || parentMethodStr.includes('RATE')) {
          resolvedOppType = 'Rate Contract + RA';
        }

        const benchmarkVal = toNumber(auction.auctionConfig?.estimatedValue || auction.totalBudget || auction.estimatedValue || auction.startPrice || auction.currentLowestAmount);

        const opportunity: SellerOpportunity = {
          id: `ra-${auction.id}`,
          type: resolvedOppType,
          title: resolvedTitle,
          buyer: auction.buyerOrganizationName || auction.buyerOrgName || auction.buyerOrganization?.organizationName || auction.buyerName || auction.buyerUser?.name || 'Verified Buyer',
          category: auction.category || 'Negotiate Price',
          location: auction.deliveryLocation || auction.location || [auction.district, auction.state].filter(Boolean).join(', ') || 'Location not specified',
          closingDate: auction.endTime,
          estimatedValue: benchmarkVal,
          discloseEstimatedCost: Boolean(auction.discloseEstimatedCost ?? true),
          eligibility: 'Check invitation',
          status: isLive ? 'e-RA Live' : (auction.statusEnum || auction.status || 'Scheduled'),
          actionLabel: isLive ? 'Enter Live Auction Floor →' : 'View Auction Details',
          href: sellerRoutes.auctionLive(auction.id),
          detailsHref: sellerRoutes.detail('REVERSE_AUCTION', auction.id),
          sourceRef,
          publishedAt: auction.createdAt || auction.publishedAt || auction.startTime,
          createdAt: auction.createdAt || auction.startTime,
          description: auction.description,
          documents,
          responseCount: auction.participantsCount || auction.invitedSellersCount,
          procurementType: 'Reverse Auction',
          documentsCount: documents.length,
          terms: asTextList(auction.terms),
          nextAction: '',
          isInvitation: auction.visibilityMode === 'INVITED_SELLERS_ONLY' || auction.isInvited || auction.invitedSellers?.some((v: any) => (v?.sellerOrgId || v) === user?.organizationId),
          detailRows: [
            { label: 'Auction start', value: formatDate(auction.startTime, true) },
            { label: 'Auction end', value: formatDate(auction.endTime, true) },
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

    return Promise.allSettled([p1, p2, p3, p4]).finally(() => {
      if (alive) setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
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

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => {
      const cleaned = formatCleanLocation(item.location || item.deliveryLocation);
      if (cleaned && cleaned !== 'Location not specified') {
        set.add(cleaned);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);
  const categoryOptions = useMemo(() => Array.from(new Set(items.map(item => item.category).filter((value): value is string => Boolean(value)))).sort(), [items]);

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
          if (!item.isInvitation && item.type !== 'Limited Tender' && item.type !== 'Limited Tender + RA') return false;
        } else if (type === 'Reverse Auction') {
          if (item.type !== 'Reverse Auction' && !item.type.endsWith('+ RA')) return false;
        } else if (item.type !== type && item.type !== `${type} + RA`) {
          return false;
        }
      }

      // By default show all opportunities until seller is disqualified or not selected
      if (isDisqualifiedOrNotSelected(item)) {
        if (status !== 'DISQUALIFIED' && status !== 'NOT_SELECTED' && status !== 'REJECTED') {
          return false;
        }
      }

      if (status && status !== 'ALL') {
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

      if (location) {
        const itemCleanLoc = formatCleanLocation(item.location || item.deliveryLocation);
        const matchesClean = itemCleanLoc.toLowerCase() === location.toLowerCase();
        const matchesRaw = String(item.location || '').toLowerCase().includes(location.toLowerCase());
        if (!matchesClean && !matchesRaw) return false;
      }
      if (category && item.category !== category) return false;

      if (valueRange) {
        const isConfidential = item.discloseEstimatedCost === false && item.type !== 'Reverse Auction';
        if (valueRange === 'confidential') {
          if (!isConfidential) return false;
        } else {
          if (isConfidential || item.estimatedValue == null) return false;
          const val = Number(item.estimatedValue) || 0;
          if (valueRange === '5l' && val >= 500000) return false;
          if (valueRange === '25l' && (val < 500000 || val >= 2500000)) return false;
          if (valueRange === '1cr' && (val < 2500000 || val >= 10000000)) return false;
          if (valueRange === 'above1cr' && val < 10000000) return false;
        }
      }

      return true;
    });
  }, [items, location, query, status, type, category, valueRange, nowMs]);

  const kpiItems = useMemo(() => {
    if (!type) return items;
    if (type === 'Limited Tender') return items.filter(i => i.isInvitation || i.type === 'Limited Tender' || i.type === 'Limited Tender + RA');
    if (type === 'Reverse Auction') return items.filter(i => i.type === 'Reverse Auction' || i.type.endsWith('+ RA'));
    return items.filter(i => i.type === type || i.type === `${type} + RA`);
  }, [items, type]);

  const kpis = useMemo(() => {
    let live = 0;
    let liveValue = 0;
    let confidentialLive = 0;
    let closingSoon = 0;
    let closingSoonValue = 0;
    let confidentialClosingSoon = 0;
    let highValueCount = 0;
    let highValueTotal = 0;
    let participated = 0;
    let evaluation = 0;

    kpiItems.forEach(item => {
      const isLive = isOpenOpportunity(item, nowMs);
      const isConfidential = item.discloseEstimatedCost === false && item.type !== 'Reverse Auction';
      const val = isConfidential ? 0 : (Number(item.estimatedValue) || 0);

      if (isLive) {
        live++;
        if (isConfidential) {
          confidentialLive++;
        } else {
          liveValue += val;
        }
      }
      if (isClosingSoonOpportunity(item, nowMs)) {
        closingSoon++;
        if (isConfidential) {
          confidentialClosingSoon++;
        } else {
          closingSoonValue += val;
        }
      }
      if (isLive && !isConfidential && val >= 2500000) {
        highValueCount++;
        highValueTotal += val;
      }
      if (isParticipatedOpportunity(item)) {
        participated++;
        if (isUnderEvaluationOpportunity(item, nowMs)) evaluation++;
      }
    });

    return {
      live,
      liveValue,
      confidentialLive,
      closingSoon,
      closingSoonValue,
      confidentialClosingSoon,
      highValueCount,
      highValueTotal,
      participated,
      evaluation
    };
  }, [kpiItems, nowMs]);

  const filtered = useMemo(() => {
    const list = baseFiltered.filter(item => {
      if (kpiFilter === 'live') {
        return isOpenOpportunity(item, nowMs);
      }
      if (kpiFilter === 'dueSoon') {
        return isClosingSoonOpportunity(item, nowMs);
      }
      if (kpiFilter === 'highValue') {
        const isConfidential = item.discloseEstimatedCost === false && item.type !== 'Reverse Auction';
        return !isConfidential && (Number(item.estimatedValue) || 0) >= 2500000 && isOpenOpportunity(item, nowMs);
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
          const isConfA = a.discloseEstimatedCost === false && a.type !== 'Reverse Auction';
          const isConfB = b.discloseEstimatedCost === false && b.type !== 'Reverse Auction';
          if (isConfA && isConfB) return 0;
          if (isConfA) return 1;
          if (isConfB) return -1;
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        } else if (sortField === 'publishedAt') {
          valA = getPublishedTimestamp(a);
          valB = getPublishedTimestamp(b);
        } else if (sortField === 'closingDate') {
          valA = getClosingTimestamp(a.closingDate) ?? Infinity;
          valB = getClosingTimestamp(b.closingDate) ?? Infinity;
        } else {
          valA = String(valA || '').toLowerCase();
          valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      list.sort((a, b) => {
        if (sortOption === 'newest') {
          const pubDiff = getPublishedTimestamp(b) - getPublishedTimestamp(a);
          if (pubDiff !== 0) return pubDiff;
          return (getClosingTimestamp(a.closingDate) || 0) - (getClosingTimestamp(b.closingDate) || 0);
        }
        if (sortOption === 'closing_soon') {
          const closeA = getClosingTimestamp(a.closingDate) ?? Infinity;
          const closeB = getClosingTimestamp(b.closingDate) ?? Infinity;
          return closeA - closeB;
        }
        if (sortOption === 'value_high') {
          const valA = (a.discloseEstimatedCost === false && a.type !== 'Reverse Auction') ? -1 : (Number(a.estimatedValue) || 0);
          const valB = (b.discloseEstimatedCost === false && b.type !== 'Reverse Auction') ? -1 : (Number(b.estimatedValue) || 0);
          return valB - valA;
        }
        if (sortOption === 'value_low') {
          const valA = (a.discloseEstimatedCost === false && a.type !== 'Reverse Auction') ? Infinity : (Number(a.estimatedValue) || 0);
          const valB = (b.discloseEstimatedCost === false && b.type !== 'Reverse Auction') ? Infinity : (Number(b.estimatedValue) || 0);
          return valA - valB;
        }
        if (sortOption === 'title_asc') {
          return (a.title || '').localeCompare(b.title || '');
        }
        return 0;
      });
    }

    return list;
  }, [baseFiltered, kpiFilter, sortField, sortDirection, sortOption, nowMs]);

  // Reset KPI filter and pagination when filters change (render-pass adjustment, no cascading renders)
  const filterKey = `${query}|${type}|${status}|${location}|${category}|${valueRange}|${sortOption}`;
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

  const tableColumns = useMemo<ColumnDef<SellerOpportunity>[]>(() => [
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      sortKey: 'type',
      width: 'w-[12%]',
      cell: (item) => (
        <div className="flex flex-col gap-1 items-start min-w-0">
          <TypeBadge type={item.type} />
          {isParticipatedOpportunity(item) ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[8.5px] font-black uppercase text-emerald-800 shrink-0 whitespace-nowrap">
              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" /> Submitted
            </span>
          ) : (isClosedStatus(item.status) || !isOpenOpportunity(item, nowMs)) ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[8.5px] font-bold uppercase text-slate-500 shrink-0 whitespace-nowrap">
              <Lock className="h-2.5 w-2.5 text-slate-400" /> Closed
            </span>
          ) : null}
        </div>
      )
    },
    {
      key: 'title',
      header: 'Title & Reference',
      sortable: true,
      sortKey: 'title',
      width: 'w-[23%]',
      cell: (item) => (
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
              {item.sourceRef}
            </span>
            {item.category && (
              <span
                className="text-[9px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60 truncate max-w-[150px]"
                title={item.category}
              >
                {item.category}
              </span>
            )}
          </div>
          <p className="text-xs font-bold text-slate-900 leading-snug line-clamp-2" title={item.title}>
            {item.title}
          </p>
          {cleanOpportunitySummary(item.description) && (
            <p className="text-[10px] font-semibold text-slate-400 line-clamp-1" title={cleanOpportunitySummary(item.description)}>
              {cleanOpportunitySummary(item.description)}
            </p>
          )}
        </div>
      )
    },
    {
      key: 'buyer',
      header: 'Buyer & Location',
      sortable: true,
      sortKey: 'buyer',
      width: 'w-[15%]',
      cell: (item) => {
        const cleanLoc = formatLocation(item.location || item.deliveryLocation);
        return (
          <div className="space-y-0.5 min-w-0">
            <p className="text-xs font-bold text-slate-900 leading-tight truncate" title={item.buyer?.trim()}>
              {item.buyer?.trim() || 'Buyer details controlled'}
            </p>
            <div
              className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 truncate cursor-default hover:text-slate-800 transition-colors"
              title={item.location || item.deliveryLocation || cleanLoc}
            >
              <MapPin className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="truncate">{cleanLoc}</span>
            </div>
          </div>
        );
      }
    },
    {
      key: 'publishedAt',
      header: 'Published Date',
      sortable: true,
      sortKey: 'publishedAt',
      width: 'w-[10.5%]',
      cell: (item) => {
        const raw = item.publishedAt || item.createdAt;
        if (!raw) return <span className="text-xs font-semibold text-slate-400">—</span>;
        const hasTime = hasExplicitTime(raw);
        return (
          <div className="flex flex-col whitespace-nowrap leading-tight">
            <span className="text-xs font-bold text-slate-700">
              {formatPureDate(raw)}
            </span>
            {hasTime && (
              <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                {formatTime(raw)}
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'closingDate',
      header: 'Closing Date',
      sortable: true,
      sortKey: 'closingDate',
      width: 'w-[11.5%]',
      cell: (item) => {
        const isLiveAuction = item.type === 'Reverse Auction' && String(item.status).toUpperCase() === 'OPEN';
        if (isLiveAuction) {
          return (
            <div className="space-y-1 whitespace-nowrap">
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-emerald-600 tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live
              </span>
              <div className="block leading-none font-mono text-xs font-black text-rose-600">
                <CountdownTimer endDate={item.closingDate} />
              </div>
            </div>
          );
        }

        const raw = item.closingDate;
        if (!raw) return <span className="text-xs font-semibold text-slate-400">—</span>;
        const hasTime = hasExplicitTime(raw);
        const daysLeft = getDaysLeftText(raw);
        const isClosed = daysLeft.toLowerCase().includes('closed') || isClosedStatus(item.status);

        return (
          <div className="flex flex-col whitespace-nowrap leading-tight space-y-0.5">
            <span className="text-xs font-bold text-slate-700">
              {formatPureDate(raw)}
            </span>
            {hasTime && (
              <span className="text-[10px] font-semibold text-slate-400">
                {formatTime(raw)}
              </span>
            )}
            {daysLeft && (
              <span className={cn(
                "text-[9px] font-black uppercase tracking-wider block mt-0.5",
                isClosed ? "text-rose-600" : "text-amber-600"
              )}>
                {daysLeft}
              </span>
            )}
          </div>
        );
      }
    },
    {
      key: 'estimatedValue',
      header: 'Est. Value',
      sortable: true,
      sortKey: 'estimatedValue',
      width: 'w-[11%]',
      cell: (item) => {
        const isDisclosed = item.discloseEstimatedCost === true || item.type === 'Reverse Auction' || item.type.includes('+ RA');
        if (!isDisclosed) {
          return (
            <div className="space-y-0.5 whitespace-nowrap">
              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700">
                <span>Confidential</span>
                <Lock className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
              </span>
            </div>
          );
        }
        const isRaType = item.type === 'Reverse Auction' || item.type.includes('+ RA');
        return (
          <div className="space-y-0.5 whitespace-nowrap">
            <span className="text-xs font-extrabold text-slate-900 block">
              {formatMoney(item.estimatedValue)}
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              {isRaType ? 'Dynamic e-RA' : 
               item.type === 'RFP' ? 'Negotiable' : 'Fixed Price'}
            </span>
          </div>
        );
      }
    },
    {
      key: 'actions',
      header: 'Action',
      align: 'right',
      width: 'w-[13%]',
      cellClassName: 'text-right',
      headerClassName: 'text-right',
      cell: (item) => {
        const closed = isClosedStatus(item.status) || (!isOpenOpportunity(item, nowMs));
        const participated = isParticipatedOpportunity(item);

        return (
          <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
            {!closed && (
              <Link
                href={item.href}
                className={cn(
                  "inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-center text-xs font-bold shadow-2xs active:scale-95 transition-all duration-200 shrink-0",
                  participated
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                    : item.type === 'Reverse Auction'
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-[#12335f] text-white hover:bg-[#0b2445]"
                )}
                title={item.actionLabel}
              >
                {participated && <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />}
                <span>{item.actionLabel}</span>
              </Link>
            )}
            {/* {closed && participated && (
              <Link
                href={item.href}
                className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-center text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shadow-2xs shrink-0"
                title="Track submitted response"
              >
                <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                <span>Track Status</span>
              </Link>
            )} */}
            <Link
              href={item.detailsHref}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-center text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 transition-all duration-200 shrink-0"
              title="View complete specifications and terms"
            >
              Details
            </Link>
          </div>
        );
      }
    }
  ], []);

  const reset = () => {
    setQuery('');
    setType(subRouteType || '');
    setStatus('ALL');
    setLocation('');
    setCategory('');
    setValueRange('');
    setKpiFilter('all');
    setSortOption('newest');
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
      case 'Direct Purchase':
        return {
          title: 'Direct Purchase Orders',
          desc: 'Review direct purchasing requirements and order requests issued by buyers.'
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
      participated: 0,
      RFQ: 0,
      'Open Tender': 0,
      RFP: 0,
      'Limited Tender': 0,
      'Reverse Auction': 0,
      'Rate Contract': 0,
      'Direct Purchase': 0,
    };

    items.forEach(item => {
      if (isDisqualifiedOrNotSelected(item)) return;
      if (isParticipatedOpportunity(item)) {
        counts.participated++;
      }
      counts.all++;

      const isPlusRa = /(\s*\+\s*RA)/i.test(item.type);
      const baseType = item.type.replace(/(\s*\+\s*RA)+$/gi, '').trim();

      if (counts[baseType] !== undefined) {
        counts[baseType]++;
      } else if (item.isInvitation) {
        counts['Limited Tender']++;
      }

      if (item.type === 'Reverse Auction' || isPlusRa) {
        counts['Reverse Auction']++;
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
    { label: 'Rate Contracts', typeVal: 'Rate Contract', countKey: 'Rate Contract', icon: RotateCcw },
    { label: 'Direct Purchases', typeVal: 'Direct Purchase', countKey: 'Direct Purchase', icon: ShoppingBag }
  ], []);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-4 pb-12 pt-4">
      {/* Title Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950 tracking-tight">{headerContent.title}</h1>
          <p className="text-xs text-slate-500 mt-1">{headerContent.desc}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="rounded-xl border-slate-200 hover:bg-slate-50 h-9 font-bold text-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={type ? `Live ${type}s` : "Live Opportunities"}
          value={kpis.live}
          subtext="Available for quotation"
          icon={Globe}
          tone="blue"
          active={kpiFilter === 'live'}
          onClick={() => setKpiFilter(kpiFilter === 'live' ? 'all' : 'live')}
        />
        <KpiCard
          label="Closing Soon (≤7d)"
          value={kpis.closingSoon}
          subtext="Urgent response needed"
          icon={Clock}
          tone="red"
          active={kpiFilter === 'dueSoon'}
          onClick={() => setKpiFilter(kpiFilter === 'dueSoon' ? 'all' : 'dueSoon')}
        />
        <KpiCard
          label={type === 'Reverse Auction' ? "High-Value Auctions" : "High-Value Tenders"}
          value={kpis.highValueCount}
          subtext={
            kpis.highValueCount > 0
              ? `${formatCurrency(kpis.highValueTotal)} strategic volume`
              : (kpis.confidentialLive > 0 ? 'Disclosed bids ≥₹25L (sealed excluded)' : 'No high-value opportunities')
          }
          icon={TrendingUp}
          tone="purple"
          active={kpiFilter === 'highValue'}
          onClick={() => setKpiFilter(kpiFilter === 'highValue' ? 'all' : 'highValue')}
        />
        <KpiCard
          label="My Submissions (Bids)"
          value={kpis.participated}
          subtext="View tracking in My Bids →"
          icon={CheckCircle2}
          tone="indigo"
          active={false}
          onClick={() => router.push('/seller/bids/submitted')}
        />
      </div>

      {/* ── Opportunity Type Segmented Filter Pills (Wrapping, No Horizontal Scroll) ── */}
      <div className="flex flex-wrap items-center gap-2 -mt-1" role="tablist" aria-label="Opportunity Types">
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
                setType(tab.typeVal as any);
                setPage(1);
              }}
              className={cn(
                "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer",
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

      {/* ── Search + Filter + View Toggle Toolbar (Single Row Desktop, No Horizontal Scroll) ── */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-2.5 sm:p-3 shadow-sm">
        <ResponsiveFilterBar
          singleRowDesktop={true}
          searchWrapperClassName="flex-1 min-w-[170px] max-w-sm xl:max-w-md"
          onReset={reset}
          resetLabel="Reset All"
          activeFilterCount={(query ? 1 : 0) + (status !== 'ALL' ? 1 : 0) + (category ? 1 : 0) + (location ? 1 : 0) + (sortOption !== 'newest' ? 1 : 0) + (kpiFilter !== 'all' ? 1 : 0)}
          searchInput={
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={event => { setQuery(event.target.value); setPage(1); }}
                placeholder="Search opportunities by title, ref, buyer..."
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8.5 pr-8 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-[#12335f] focus:bg-white focus:ring-2 focus:ring-[#12335f]/10 shadow-inner"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setPage(1); }}
                  aria-label="Clear search input"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          }
          filters={
            <>
              {/* Status Dropdown */}
              <div className="w-full">
                <select
                  value={status}
                  onChange={e => { setStatus(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-2xs cursor-pointer truncate"
                  aria-label="Filter by status"
                >
                  <option value="ALL">All Opportunities (Default)</option>
                  <option value="LIVE">Live & Open Only</option>
                  <option value="CLOSING_SOON">Closing Soon</option>
                  <option value="PARTICIPATED">Submissions</option>
                  <option value="UNDER_EVALUATION">Evaluation</option>
                  <option value="CLOSED">Closed & Concluded</option>
                </select>
              </div>

              {/* Category Dropdown */}
              <div className="w-full">
                <select
                  value={category}
                  onChange={e => { setCategory(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-2xs cursor-pointer truncate"
                  aria-label="Filter by category"
                >
                  <option value="">All Categories</option>
                  {categoryOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Location Dropdown */}
              <div className="w-full">
                <select
                  value={location}
                  onChange={e => { setLocation(e.target.value); setPage(1); }}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-2xs cursor-pointer truncate"
                  aria-label="Filter by location"
                >
                  <option value="">All Locations</option>
                  {locationOptions.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                </select>
              </div>

              {/* Sort Filter Dropdown */}
              <div className="w-full">
                <select
                  value={sortOption}
                  onChange={e => {
                    setSortOption(e.target.value as any);
                    setSortField('');
                    setPage(1);
                  }}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 outline-none hover:border-slate-300 focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/10 transition-colors shadow-2xs cursor-pointer truncate"
                  aria-label="Sort opportunities"
                  title="Sort opportunities"
                >
                  <option value="newest">Newest First</option>
                  <option value="closing_soon">Closing Soon</option>
                  <option value="value_high">Highest Value</option>
                  <option value="value_low">Lowest Value</option>
                  <option value="title_asc">Title (A–Z)</option>
                </select>
              </div>
            </>
          }
          endContent={<ViewModeToggle value={viewMode} onChange={setViewMode} size="sm" />}
        />
      </div>

      {/* ── Active Filter Badges Bar ── */}
      {(kpiFilter !== 'all' || (status && status !== 'ALL') || type || category || location || query) && (
        <div className="flex flex-wrap items-center gap-2 px-1 -mt-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active Filters:</span>
          {kpiFilter === 'participated' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-900 shadow-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Participated ({kpis.participated})</span>
              <button
                type="button"
                onClick={() => setKpiFilter('all')}
                className="ml-1 rounded-full p-0.5 text-emerald-600 hover:bg-emerald-200/60 hover:text-emerald-950 transition-colors cursor-pointer"
                aria-label="Remove Participated filter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {kpiFilter === 'live' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-900 shadow-xs">
              <span>Live ({kpis.live})</span>
              <button type="button" onClick={() => setKpiFilter('all')} className="ml-1 rounded-full p-0.5 text-blue-600 hover:bg-blue-200/60 transition-colors cursor-pointer" aria-label="Remove Live filter"><X className="h-3 w-3" /></button>
            </span>
          )}
          {kpiFilter === 'dueSoon' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-black text-rose-900 shadow-xs">
              <span>Closing Soon ({kpis.closingSoon})</span>
              <button type="button" onClick={() => setKpiFilter('all')} className="ml-1 rounded-full p-0.5 text-rose-600 hover:bg-rose-200/60 transition-colors cursor-pointer" aria-label="Remove Closing Soon filter"><X className="h-3 w-3" /></button>
            </span>
          )}
          {kpiFilter === 'highValue' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-black text-purple-900 shadow-xs">
              <span>High Value (≥₹25L) ({kpis.highValueCount})</span>
              <button type="button" onClick={() => setKpiFilter('all')} className="ml-1 rounded-full p-0.5 text-purple-600 hover:bg-purple-200/60 transition-colors cursor-pointer" aria-label="Remove High Value filter"><X className="h-3 w-3" /></button>
            </span>
          )}
          {status && status !== 'ALL' && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 shadow-xs">
              <span>Status: {status === 'PARTICIPATED' ? 'My Submissions' : status === 'LIVE' ? 'Live Only' : status === 'CLOSED' ? 'Closed' : status === 'CLOSING_SOON' ? 'Closing Soon' : status === 'UNDER_EVALUATION' ? 'Evaluation' : status}</span>
              <button type="button" onClick={() => setStatus('ALL')} className="ml-1 rounded-full p-0.5 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer" aria-label="Reset Status to All"><X className="h-3 w-3" /></button>
            </span>
          )}
          {type && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 shadow-xs">
              <span>Type: {type}</span>
              <button type="button" onClick={() => setType('')} className="ml-1 rounded-full p-0.5 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer" aria-label="Remove Type filter"><X className="h-3 w-3" /></button>
            </span>
          )}
          {category && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 shadow-xs">
              <span>Category: {category}</span>
              <button type="button" onClick={() => setCategory('')} className="ml-1 rounded-full p-0.5 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer" aria-label="Remove Category filter"><X className="h-3 w-3" /></button>
            </span>
          )}
          {location && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 shadow-xs">
              <span>Location: {location}</span>
              <button type="button" onClick={() => setLocation('')} className="ml-1 rounded-full p-0.5 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer" aria-label="Remove Location filter"><X className="h-3 w-3" /></button>
            </span>
          )}
          {query && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 shadow-xs">
              <span>Search: &quot;{query}&quot;</span>
              <button type="button" onClick={() => setQuery('')} className="ml-1 rounded-full p-0.5 text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer" aria-label="Remove Query filter"><X className="h-3 w-3" /></button>
            </span>
          )}
          <button
            type="button"
            onClick={reset}
            className="text-xs font-extrabold text-rose-600 hover:text-rose-800 hover:underline transition-colors ml-1 cursor-pointer"
          >
            Clear all
          </button>
        </div>
      )}

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
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pageRows.map((item, index) => {
                const isLiveAuction = item.type === 'Reverse Auction' && String(item.status).toUpperCase() === 'OPEN';
                const closingTime = item.closingDate ? getClosingTimestamp(item.closingDate) : null;
                const isClosingSoon = closingTime !== null && (closingTime - nowMs) <= 2 * 86400000 && (closingTime - nowMs) >= 0;
                const closed = isClosedStatus(item.status) || (!isOpenOpportunity(item, nowMs));
                const participated = isParticipatedOpportunity(item);
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <TypeBadge type={item.type} />
                          {participated ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800 shadow-2xs">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              {closed ? "Submitted • Under Eval" : "Participated"}
                            </span>
                          ) : closed ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase text-slate-500 shadow-2xs">
                              <Lock className="h-3 w-3 text-slate-400" /> Missed Deadline
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Title */}
                      <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                        {item.title}
                      </h3>

                      {/* Source Ref & Buyer */}
                      <div className="text-[11px] text-slate-500 font-bold space-y-1">
                        <p className="font-mono text-slate-400">Ref: {item.sourceRef}</p>
                        <p className="text-slate-800 font-bold">Buyer: {item.buyer?.trim() || 'Buyer details controlled'}</p>
                        <p className="flex items-center gap-1 font-semibold text-slate-500 text-[10px]">
                          <MapPin className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                          <span>{formatLocation(item.location)}</span>
                        </p>
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
                            {item.discloseEstimatedCost === true || item.type === 'Reverse Auction' ? (
                              <>
                                <span className="text-xs font-extrabold text-slate-900 block">
                                  {formatMoney(item.estimatedValue)}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                  {item.type === 'Reverse Auction' ? 'Negotiate Price' : 
                                   item.type === 'RFP' ? 'Negotiable' : 'Fixed Price'}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 block">
                                  Confidential <Lock className="h-3 w-3 text-slate-400 inline" />
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                                  Competitive Bidding
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-1 flex items-center gap-2">
                        {!closed ? (
                          <Link
                            href={item.href}
                            className={cn(
                              "flex-1 flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-bold text-white shadow-2xs transition active:scale-[0.99]",
                              participated
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : item.type === 'Reverse Auction'
                                ? "bg-red-600 hover:bg-red-700"
                                : "bg-[#12335f] hover:bg-[#0b2445]"
                            )}
                          >
                            {participated && <CheckCircle2 className="h-3.5 w-3.5" />}
                            <span>{item.actionLabel}</span>
                            <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-white/70" />
                          </Link>
                        ) : participated ? (
                          <Link
                            href={item.href}
                            className="flex-1 flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Track Status</span>
                          </Link>
                        ) : null}
                        <Link
                          href={item.detailsHref}
                          className={cn(
                            "h-9 px-3 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-[0.99] transition shrink-0",
                            closed && !participated ? "w-full flex-1" : ""
                          )}
                          title="View complete specifications and terms"
                        >
                          Details
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
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
          ) : (
            <DataTable<SellerOpportunity>
              data={pageRows}
              columns={tableColumns}
              keyExtractor={(item) => item.id}
              showSrNo={true}
              srNoHeader="#"
              srNoWidth="w-[3.5%]"
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              sortKey={sortField}
              sortDirection={sortDirection}
              onSort={(field) => handleSort(field as any)}
              paginationLabel="opportunities"
              minWidth="min-w-[1120px] w-full"
            />
          )}
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
          <Metric label="Commercial value" value={item.discloseEstimatedCost === true || item.type === 'Reverse Auction' ? formatMoney(item.estimatedValue) : 'Confidential (Competitive Bidding)'} />
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
          {(!isClosedStatus(item.status) && isOpenOpportunity(item, Date.now())) ? (
            <Link href={item.href} className="inline-flex h-9 items-center rounded-2xl bg-[#12335f] px-3 text-xs font-black text-white">{item.actionLabel}</Link>
          ) : isParticipatedOpportunity(item) ? (
            <Link href={item.href} className="inline-flex h-9 items-center rounded-2xl bg-emerald-600 px-3 text-xs font-black text-white">Track Status</Link>
          ) : null}
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
              <p className="mt-1 text-sm font-semibold text-slate-600">{[item.buyer?.trim() || 'Buyer details controlled', item.category || 'General procurement', formatLocation(item.location)].join(' / ')}</p>
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
                  <Metric label="Estimated value" value={item.discloseEstimatedCost === true || item.type === 'Reverse Auction' ? formatMoney(item.estimatedValue) : 'Confidential (Competitive Bidding)'} />
                  <Metric label="Quantity" value={item.quantity || 'Not specified'} />
                </div>
              </section>

              <section className="rounded-[22px] bg-white p-4 ring-1 ring-slate-200/70">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Commercial And Buyer Information</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Metric label="Buyer" value={item.buyer?.trim() || 'Buyer details controlled'} />
                  <Metric label="Buyer type" value={formatBuyerType(item.buyerType)} />
                  <Metric label="Department" value={item.department || 'Not specified'} />
                  <Metric label="Procurement type" value={item.procurementType || item.type} />
                  <Metric label="Delivery location" value={formatLocation(item.deliveryLocation || item.location)} />
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
                  {(!isClosedStatus(item.status) && isOpenOpportunity(item, Date.now())) ? (
                    <Link href={item.href} className="inline-flex h-9 items-center rounded-2xl bg-[#12335f] px-3 text-xs font-black text-white">{item.actionLabel}</Link>
                  ) : isParticipatedOpportunity(item) ? (
                    <Link href={item.href} className="inline-flex h-9 items-center rounded-2xl bg-emerald-600 px-3 text-xs font-black text-white">Track Status</Link>
                  ) : null}
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
          <p className="mt-1 text-xs font-semibold text-slate-500">{[item.buyer?.trim() || 'Buyer details controlled', item.category || 'General procurement', item.quantity].filter(Boolean).join(' / ')}</p>
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
        <Metric label="Location" value={formatLocation(item.location)} />
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
