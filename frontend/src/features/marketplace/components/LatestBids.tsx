'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowRight, CheckCircle, ChevronRight, Clock, Eye,
    Flame, Grid2X2, Landmark, List, MapPin, Package,
    ShieldAlert
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useResponsiveViewMode } from '../../shared/hooks';
import { SortableHeader, type SortDirection } from '../../shared/SortableHeader';
import type { MarketplaceBid, MarketplaceTender } from '../api';
import { resolveMediaUrl } from '../../../lib/api';
import { sellerRoutes } from '@/lib/routes';
import { 
    formatSingleBudget, 
    formatDateIN, 
    getProcurementStatus, 
    getStatusBadgeClass,
    type ProcurementStatusCode
} from '../utils/procurementDisplay';
import { cn } from '../../../lib/utils';
import { formatRefId } from '../../../utils/refIdUtils';

function BuyerLogoIcon({ name, logoUrl }: { name?: string; logoUrl?: string | null }) {
    const [imgErr, setImgErr] = useState(false);
    const resolvedUrl = logoUrl ? resolveMediaUrl(logoUrl) : null;

    if (resolvedUrl && !imgErr) {
        return (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-0.5 border border-slate-200 shadow-2xs">
                <img
                    src={resolvedUrl}
                    alt={`${name || 'Buyer'} logo`}
                    onError={() => setImgErr(true)}
                    className="h-full w-full object-contain rounded-full"
                    loading="lazy"
                />
            </span>
        );
    }

    return (
        <Landmark className="h-3.5 w-3.5 text-slate-400 shrink-0" />
    );
}

interface OpportunityData {
    id: number;
    sourceKey: string;
    displayId: string;
    title: string;
    description: string;
    category: string;
    budget: number | string | null;
    buyerName: string;
    location: string;
    startDate?: string | null;
    endDate?: string | null;
    participantsCount?: number;
    isTender: boolean;
    link: string;
    daysRemaining: number;
    deadlineLabel: string;
    statusCode: ProcurementStatusCode;
    statusLabel: string;
    rawDescription?: string | null;
}

const formatMethodLabel = (method: string) => {
    const m = method.replace(/^[|\s]+|[|\s]+$/g, '').trim().toUpperCase().replace(/_/g, ' ');
    if (m === 'RFQ') return 'RFQ';
    if (m === 'RFP') return 'RFP';
    return m.replace(/\b\w/g, c => c.toUpperCase());
};

const parseDescription = (desc?: string | null) => {
    if (!desc) return { method: '', value: '', urgency: '', text: '' };
    const cleanedDesc = desc.replace(/\r/g, '');
    const methodMatch = cleanedDesc.match(/Sourcing Method:\s*(.*?)(?=(?:Value:|Urgency:|$))/i);
    const valueMatch = cleanedDesc.match(/Value:\s*(.*?)(?=(?:Urgency:|$))/i);
    const urgencyMatch = cleanedDesc.match(/Urgency:\s*(.*?)(?=$)/i);
    let cleanText = cleanedDesc;
    if (methodMatch) {
        cleanText = cleanText.replace(/Sourcing Method:\s*(.*?)(?=(?:Value:|Urgency:|$))/i, '');
    }
    if (valueMatch) {
        cleanText = cleanText.replace(/Value:\s*(.*?)(?=(?:Urgency:|$))/i, '');
    }
    if (urgencyMatch) {
        cleanText = cleanText.replace(/Urgency:\s*(.*?)(?=$)/i, '');
    }
    cleanText = cleanText.replace(/[\n\r|]+/g, ' ').replace(/\s+/g, ' ').trim();

    let method = methodMatch ? methodMatch[1].trim() : '';
    let value = valueMatch ? valueMatch[1].trim() : '';
    let urgency = urgencyMatch ? urgencyMatch[1].trim() : '';

    // Clean up trailing and leading pipe characters and spaces
    method = method.replace(/^[|\s]+|[|\s]+$/g, '').trim();
    value = value.replace(/^[|\s]+|[|\s]+$/g, '').trim();
    urgency = urgency.replace(/^[|\s]+|[|\s]+$/g, '').trim();

    if (method) {
        method = formatMethodLabel(method);
    }

    return {
        method,
        value,
        urgency,
        text: cleanText
    };
};

const getFormattedDescription = (desc?: string | null): string => {
    if (!desc) return 'No description provided.';
    const parsed = parseDescription(desc);
    if (!parsed.method && !parsed.urgency) {
        return desc;
    }
    const parts: string[] = [];
    if (parsed.method) parts.push(`Sourcing Method: ${parsed.method}`);
    if (parsed.urgency) parts.push(`Urgency: ${parsed.urgency}`);
    if (parsed.text) parts.push(parsed.text);
    return parts.join(' | ');
};

function mapTender(t: MarketplaceTender): OpportunityData {
    const status = getProcurementStatus({ status: t.status, dueDate: t.closesAt });
    const days = Math.max(0, Math.ceil((new Date(t.closesAt || '').getTime() - Date.now()) / 86400000));
    return {
        id: t.id,
        sourceKey: `tender-${t.id}`,
        displayId: formatRefId('TND', t.id, t.tenderId, 'TENDER'),
        title: t.title,
        description: getFormattedDescription(t.description),
        category: t.category,
        budget: t.budget ?? null,
        buyerName: t.buyer?.buyerProfile?.organizationName || t.buyer?.name || 'Government Buyer',
        location: [t.buyer?.buyerProfile?.district, t.buyer?.buyerProfile?.state].filter(Boolean).join(', ') || 'Odisha, IN',
        startDate: t.publishedAt || t.createdAt,
        endDate: t.closesAt,
        isTender: true,
        link: `/tenders?tender=${t.id}`,
        daysRemaining: days,
        deadlineLabel: status.deadlineLabel,
        statusCode: status.code,
        statusLabel: status.label,
        participantsCount: t.bidsCount || 0,
        rawDescription: t.description
    };
}

function mapBid(b: MarketplaceBid): OpportunityData {
    const status = getProcurementStatus({ status: b.status || b.lifecycleStage || b.approvalStatus, dueDate: b.endDate });
    const days = Math.max(0, Math.ceil((new Date(b.endDate || '').getTime() - Date.now()) / 86400000));
    const isTenderActivity = b.sourceModel === 'TENDER';
    return {
        id: b.id,
        sourceKey: `bid-${b.sourceModel || 'PROCUREMENT_BID'}-${b.id}`,
        displayId: formatRefId('BID', b.id, b.bidNumber, (b as any).methodSlug || (b as any).procurementMethod || (b as any).bidType),
        title: b.title,
        description: getFormattedDescription(b.description),
        category: b.category,
        budget: b.estimatedValue ?? null,
        buyerName: b.buyerOrganizationName || 'Verified Buyer',
        location: [b.district, b.state].filter(Boolean).join(', ') || b.deliveryLocation || 'Jharsuguda, Odisha',
        startDate: b.startDate || b.createdAt,
        endDate: b.endDate,
        isTender: false,
        link: isTenderActivity && b.sourceId ? `/tenders?tender=${b.sourceId}` : `/bids/${b.bidNumber}`,
        daysRemaining: days,
        deadlineLabel: status.deadlineLabel,
        statusCode: status.code,
        statusLabel: isTenderActivity ? 'Tender Bids' : status.label,
        participantsCount: b.participantsCount || 0,
        rawDescription: b.description
    };
}

function useFadeIn() {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setVisible(true);
                observer.disconnect();
            }
        }, { threshold: 0.08 });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return { ref, visible };
}

function OpportunitySkeleton() {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="h-4 w-28 rounded bg-slate-100" />
                <div className="h-4 w-16 rounded bg-slate-100" />
            </div>
            <div className="space-y-2">
                <div className="h-4 w-5/6 rounded bg-slate-100" />
                <div className="h-3 w-2/3 rounded bg-slate-100" />
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-50">
                <div className="h-3 w-1/2 rounded bg-slate-100" />
                <div className="h-3 w-1/3 rounded bg-slate-100" />
            </div>
            <div className="flex justify-between items-center pt-2">
                <div className="h-4 w-20 rounded bg-slate-100" />
                <div className="h-8 w-24 rounded bg-slate-100" />
            </div>
        </div>
    );
}

function OpportunityCard({ item, index, visible }: { item: OpportunityData; index: number; visible: boolean }) {
    const isService = item.category.toLowerCase().includes('service');
    const badgeColor = getStatusBadgeClass(item.statusCode);
    const deadlineAlert = item.statusCode === 'CLOSING_TODAY' || item.statusCode === 'CLOSING_SOON' || item.daysRemaining <= 7;

    return (
        <article
            className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#0b2447]/30 hover:shadow-xl h-full"
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 0.5s ease ${80 + index * 70}ms, transform 0.5s ease ${80 + index * 70}ms`
            }}
        >
            <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <span className="inline-block text-[10px] font-mono font-bold text-slate-700 bg-slate-100/90 px-2.5 py-1 rounded-md border border-slate-200/70 shadow-2xs group-hover:border-blue-200 group-hover:bg-blue-50/40 transition-colors">
                            {item.displayId}
                        </span>
                        <h4 className="mt-2 line-clamp-2 text-sm font-black text-slate-900 leading-snug group-hover:text-[#0b2447] transition-colors">
                            {item.title}
                        </h4>
                    </div>
                    <span className={cn("shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider whitespace-nowrap shadow-2xs inline-flex items-center gap-1", badgeColor)}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {item.statusLabel}
                    </span>
                </div>

                 {(() => {
                    const parsed = parseDescription(item.rawDescription || item.description);
                    const showUrgency = parsed.urgency && !parsed.urgency.toLowerCase().includes('normal');
                    const hasBadges = parsed.method || showUrgency;
                    return (
                        <>
                            {hasBadges && (
                                <div className="flex flex-wrap gap-1.5">
                                    {parsed.method && (
                                        <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80 whitespace-nowrap shadow-2xs">
                                            {parsed.method}
                                        </span>
                                    )}
                                    {showUrgency && (
                                        <span className={cn(
                                            "px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border whitespace-nowrap shadow-2xs",
                                            parsed.urgency.toLowerCase().includes('urgent') || parsed.urgency.toLowerCase().includes('high')
                                                ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                                                : 'bg-amber-50 text-amber-700 border-amber-200/80'
                                        )}>
                                            {parsed.urgency} Urgency
                                        </span>
                                    )}
                                </div>
                            )}
                            {parsed.text ? (
                                <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 font-medium">
                                    {parsed.text}
                                </p>
                            ) : !hasBadges ? (
                                <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 font-medium">
                                    {item.description}
                                </p>
                            ) : null}
                        </>
                    );
                })()}

                <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs font-semibold text-slate-600">
                    <p className="flex items-center gap-2 truncate">
                        <BuyerLogoIcon name={item.buyerName} />
                        <span className="truncate text-slate-800 font-bold">{item.buyerName}</span>
                    </p>
                    <p className="flex items-center gap-1.5 truncate">
                        <Package className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{item.category}</span>
                    </p>
                    {item.location && (
                        <p className="flex items-center gap-1.5 truncate">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{item.location}</span>
                        </p>
                    )}
                </div>
            </div>

            <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-bold rounded-full px-2.5 py-1 border shadow-2xs",
                    deadlineAlert ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-600 border-slate-200/80'
                )}>
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    {item.deadlineLabel}
                </span>
                <Link 
                    href={item.link} 
                    className="inline-flex h-8.5 items-center gap-1.5 rounded-full bg-[#0b2447] px-3.5 text-xs font-black text-white hover:bg-[#12335f] active:scale-95 transition-all shadow-sm"
                >
                    View Details 
                    <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            </div>
        </article>
    );
}

function OpportunityListRow({ item, srNo }: { item: OpportunityData; srNo: number }) {
    const badgeColor = getStatusBadgeClass(item.statusCode);
    const deadlineAlert = item.statusCode === 'CLOSING_TODAY' || item.statusCode === 'CLOSING_SOON' || item.daysRemaining <= 7;

    return (
        <tr className="group hover:bg-slate-50/80 transition-all duration-200 border-b border-slate-100 last:border-0">
            <td className="px-4 py-3.5 sm:px-5 sm:py-4 font-black text-slate-400 text-xs group-hover:text-slate-600 transition-colors">{srNo}</td>
            <td className="px-4 py-3.5 sm:px-5 sm:py-4">
                <span className="inline-block text-[11px] font-mono font-bold text-slate-700 bg-slate-100/90 px-2.5 py-1 rounded-md border border-slate-200/70 whitespace-nowrap shadow-2xs group-hover:border-blue-200 group-hover:bg-blue-50/40 transition-colors">
                    {item.displayId}
                </span>
            </td>
            <td className="px-4 py-3.5 sm:px-5 sm:py-4">
                <div className="space-y-1">
                    <p className="font-extrabold text-slate-900 text-xs sm:text-sm leading-snug group-hover:text-[#0b2447] transition-colors">
                        {item.title}
                    </p>
                    {(() => {
                        const parsed = parseDescription(item.rawDescription || item.description);
                        const showUrgency = parsed.urgency && !parsed.urgency.toLowerCase().includes('normal');
                        const hasBadges = parsed.method || showUrgency;
                        return (
                            <div className="space-y-1">
                                {hasBadges && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {parsed.method && (
                                            <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80 whitespace-nowrap shadow-2xs">
                                                {parsed.method}
                                            </span>
                                        )}
                                        {showUrgency && (
                                            <span className={cn(
                                                "px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider border whitespace-nowrap shadow-2xs",
                                                parsed.urgency.toLowerCase().includes('urgent') || parsed.urgency.toLowerCase().includes('high')
                                                    ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                                                    : 'bg-amber-50 text-amber-700 border-amber-200/80'
                                            )}>
                                                {parsed.urgency} Urgency
                                            </span>
                                        )}
                                    </div>
                                )}
                                {parsed.text ? (
                                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                        {parsed.text}
                                    </p>
                                ) : !hasBadges && item.description ? (
                                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                        {item.description}
                                    </p>
                                ) : null}
                            </div>
                        );
                    })()}
                </div>
            </td>
            <td className="px-4 py-3.5 sm:px-5 sm:py-4 text-slate-800 text-xs sm:text-sm font-bold">
                <div className="flex items-center gap-2.5">
                    <BuyerLogoIcon name={item.buyerName} />
                    <span className="font-extrabold text-xs sm:text-sm text-slate-900 leading-snug">{item.buyerName}</span>
                </div>
            </td>
            <td className="px-4 py-3.5 sm:px-5 sm:py-4 text-slate-600 text-xs font-semibold">
                <span className="inline-block bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/60 text-slate-600 leading-snug">
                    {item.category}
                </span>
            </td>
            <td className="px-4 py-3.5 sm:px-5 sm:py-4 text-slate-600 text-xs font-semibold whitespace-nowrap">
                {item.startDate ? new Date(item.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
            </td>
            <td className="px-4 py-3.5 sm:px-5 sm:py-4 text-slate-800 text-xs whitespace-nowrap">
                <div className="space-y-0.5">
                    <p className="font-extrabold text-slate-900">{item.endDate ? new Date(item.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</p>
                    <span className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border",
                        deadlineAlert
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-100 text-[#0b2447] border-slate-200'
                    )}>
                        {item.deadlineLabel}
                    </span>
                </div>
            </td>
            <td className="px-4 py-3.5 sm:px-5 sm:py-4 whitespace-nowrap">
                <span className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider shadow-2xs",
                    badgeColor
                )}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {item.statusLabel}
                </span>
            </td>
            <td className="px-4 py-3.5 sm:px-5 sm:py-4 text-right whitespace-nowrap">
                <Link 
                    href={item.link} 
                    className="inline-flex h-8.5 items-center gap-1.5 rounded-full bg-[#0b2447] px-3.5 text-xs font-black text-white hover:bg-[#12335f] active:scale-95 transition-all duration-200 shadow-sm"
                >
                    View Details 
                    <ArrowRight className="h-3.5 w-3.5" />
                </Link>
            </td>
        </tr>
    );
}

interface Props {
    requirements?: any[];
    tenders?: MarketplaceTender[];
    bids?: MarketplaceBid[];
    loading?: boolean;
}

function extractCategoryName(r: any): string {
    if (!r) return 'Multi-category';
    
    // Check explicit category objects or string fields
    if (typeof r.category === 'object' && r.category?.name) return r.category.name;
    if (typeof r.category === 'string' && r.category.trim() && r.category !== 'Multi-category' && r.category !== 'General') return r.category.trim();
    if (r.categoryName) return r.categoryName;
    if (r.subCategory) return r.subCategory;
    if (r.procurementCategory) return r.procurementCategory;

    // Fallback: Infer category intelligently from Title / Description keywords if missing
    const text = `${r.title || ''} ${r.description || ''}`.toLowerCase();
    if (text.includes('vehicle') || text.includes('car') || text.includes('driver') || text.includes('transport')) return 'Automotive & Services';
    if (text.includes('television') || text.includes('tv') || text.includes('display') || text.includes('electronic')) return 'Consumer Electronics';
    if (text.includes('bag') || text.includes('luggage') || text.includes('backpack') || text.includes('textile')) return 'Textiles & Leather';
    if (text.includes('desktop') || text.includes('laptop') || text.includes('computer') || text.includes('monitor') || text.includes('it ')) return 'IT Hardware & Equipment';
    if (text.includes('stationery') || text.includes('paper') || text.includes('office') || text.includes('pen')) return 'Office Supplies & Stationery';
    if (text.includes('bucket') || text.includes('hotel') || text.includes('hospitality') || text.includes('cleaning')) return 'Hospitality & Supplies';

    return typeof r.category === 'string' && r.category ? r.category : 'Multi-category';
}

export function LatestBids({ requirements = [], tenders = [], bids = [], loading = false }: Props) {
    const { ref, visible } = useFadeIn();
    const [viewMode, setViewMode] = useResponsiveViewMode('phase7:marketplace-opportunities:view-mode');
    const { user } = useAuth();

    type OpportunitySortKey = 'id' | 'title' | 'buyerName' | 'category' | 'startDate' | 'budget' | 'endDate' | 'statusLabel';
    const [sortKey, setSortKey] = useState<OpportunitySortKey>('startDate');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    const toggleSort = (key: OpportunitySortKey) => {
        setSortDirection(prev => sortKey === key && prev === 'asc' ? 'desc' : 'asc');
        setSortKey(key);
    };

    const activeOpportunities = useMemo(() => {
        const mappedTenders = tenders.map(mapTender);
        const mappedBids = bids.map(mapBid);
        const mappedRequirements = (requirements || []).map((r: any) => {
            const status = getProcurementStatus({ status: r.status, dueDate: r.endDate || r.lastDate || r.requiredBy });
            const days = Math.max(0, Math.ceil((new Date(r.endDate || r.lastDate || r.requiredBy || '').getTime() - Date.now()) / 86400000));
            // Detect method from data fields, falling back to parsing it from the description
            let method = String(r.canonicalMethod || r.procurementMethod || '').toUpperCase();
            if (!method) {
                const parsed = parseDescription(r.description);
                if (parsed.method) {
                    method = parsed.method.replace(/\s+/g, '_').toUpperCase();
                }
            }
            const sourceId = r.sourceId || (r.id ? Math.abs(r.id) : null);
            
            // Link formatting based on authentication & procurement method
            let link = sourceId ? `/marketplace/requirements/${sourceId}` : '/marketplace/requirements';
            if (r.linkedAuctionId) {
                link = sellerRoutes.detail('REVERSE_AUCTION', r.linkedAuctionId);
            } else {
                const isLoggedIn = !!user;
                const isSeller = user?.role === 'seller';
                if (isLoggedIn && isSeller) {
                    if (['RFQ', 'DIRECT_PURCHASE', 'CATALOG_PURCHASE', 'REPEAT_ORDER', 'RATE_CONTRACT'].includes(method)) {
                        link = sellerRoutes.detail('RFQ', sourceId);
                    } else if (['RFP', 'SINGLE_SOURCE', 'PAC'].includes(method)) {
                        link = sellerRoutes.detail('RFP', sourceId);
                    } else if (['OPEN_TENDER', 'LIMITED_TENDER', 'TWO_STAGE_TENDER', 'EMERGENCY_PURCHASE'].includes(method)) {
                        if (r.requirementNumber) {
                            link = `/tenders?tender=${r.requirementNumber}`;
                        } else {
                            link = sellerRoutes.detail('RFQ', sourceId);
                        }
                    }
                }
            }

            return {
                id: r.id,
                sourceKey: `requirement-${r.sourceModel || 'BUYER_REQUIREMENT'}-${sourceId}-${r.id}`,
                displayId: formatRefId(r.sourceModel === 'BUYER_REQUIREMENT' ? 'REQ' : 'BID', sourceId || r.id, r.bidNumber || r.requirementNumber, method),
                title: r.title,
                description: getFormattedDescription(r.description),
                category: extractCategoryName(r),
                budget: r.estimatedValue || r.budgetMin || null,
                buyerName: r.buyerOrganization?.organizationName || r.buyerOrganizationName || r.buyerName || 'Verified Buyer',
                location: r.deliveryLocation || r.location || 'Jharsuguda, Odisha',
                startDate: r.startDate || r.createdAt,
                endDate: r.endDate || r.lastDate || r.requiredBy,
                isTender: false,
                link,
                daysRemaining: days,
                deadlineLabel: status.deadlineLabel,
                statusCode: status.code,
                statusLabel: r.statusLabel || status.label,
                participantsCount: r.participantsCount || r.responsesCount || 0,
                rawDescription: r.description
            };
        });

        const combined = [...mappedTenders, ...mappedBids, ...mappedRequirements];
        const seen = new Set<string>();
        const uniqueOpportunities: OpportunityData[] = [];

        for (const item of combined) {
            const key = `${(item.title || '').trim().toLowerCase()}-${(item.buyerName || '').trim().toLowerCase()}`;
            if (!seen.has(key) && !seen.has(item.displayId)) {
                seen.add(key);
                seen.add(item.displayId);
                uniqueOpportunities.push(item);
            }
        }

        return uniqueOpportunities.sort((a, b) => {
            let valA: any = '';
            let valB: any = '';
            if (sortKey === 'id') {
                valA = a.displayId || '';
                valB = b.displayId || '';
            } else if (sortKey === 'title') {
                valA = a.title || '';
                valB = b.title || '';
            } else if (sortKey === 'buyerName') {
                valA = a.buyerName || '';
                valB = b.buyerName || '';
            } else if (sortKey === 'category') {
                valA = a.category || '';
                valB = b.category || '';
            } else if (sortKey === 'startDate') {
                valA = a.startDate ? new Date(a.startDate).getTime() : 0;
                valB = b.startDate ? new Date(b.startDate).getTime() : 0;
            } else if (sortKey === 'budget') {
                valA = Number(a.budget || 0);
                valB = Number(b.budget || 0);
            } else if (sortKey === 'endDate') {
                valA = a.endDate ? new Date(a.endDate).getTime() : 0;
                valB = b.endDate ? new Date(b.endDate).getTime() : 0;
            } else if (sortKey === 'statusLabel') {
                valA = a.statusLabel || '';
                valB = b.statusLabel || '';
            }

            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortDirection === 'asc' ? valA - valB : valB - valA;
            }
            const strA = String(valA || '').toLowerCase();
            const strB = String(valB || '').toLowerCase();
            const res = strA.localeCompare(strB);
            return sortDirection === 'asc' ? res : -res;
        });
    }, [tenders, bids, requirements, sortDirection, sortKey]);

    const viewAllHref = user
        ? (user.role === 'seller' ? '/seller/opportunities' : '/marketplace/requirements')
        : '/marketplace/requirements';
    const emptyMessage = 'No active procurement opportunities found matching current records.';

    return (
        <section ref={ref} className="mt-0 py-8 bg-[#f8fafc]" aria-labelledby="opportunities-heading">
            <div className="mx-auto max-w-[1680px] px-4 sm:px-6 2xl:px-8">
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
                    {/* Header */}
                    <div
                        className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"
                        style={{ 
                            opacity: visible ? 1 : 0, 
                            transform: visible ? 'none' : 'translateY(-10px)', 
                            transition: 'opacity 0.5s, transform 0.5s' 
                        }}
                    >
                        <div>
                            {/* <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-blue-200/80 bg-blue-50/80 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#0b2447] shadow-2xs">
                                🏛️ Procurement Hub
                            </span> */}
                            <h2 id="opportunities-heading" className="text-xl font-black text-[#0b2447] sm:text-2xl md:text-3xl tracking-tight">
                                Active Procurement Opportunities
                            </h2>
                            <p className="mt-1 text-sm text-slate-500 font-medium">
                                Bid on active opportunities, view government e-tenders, or submit quotes for portal-native contracts.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* Layout grid/list switcher */}
                            <div className="inline-flex rounded-xl border border-slate-200/80 bg-slate-50 p-1 shadow-2xs">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('grid')}
                                    className={cn(
                                        "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black transition-all duration-200",
                                        viewMode === 'grid' ? 'bg-[#0b2447] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'
                                    )}
                                    title="Grid view"
                                >
                                    <Grid2X2 className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('list')}
                                    className={cn(
                                        "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-black transition-all duration-200",
                                        viewMode === 'list' ? 'bg-[#0b2447] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'
                                    )}
                                    title="List view"
                                >
                                    <List className="h-4 w-4" />
                                </button>
                            </div>

                            {/* View All Button */}
                            <Link 
                                href={viewAllHref} 
                                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-4 text-xs font-black text-[#0b2447] shadow-2xs hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-200"
                            >
                                View All <ChevronRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>

                    {/* Sourcing list rendering */}
                    {loading ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, index) => <OpportunitySkeleton key={index} />)}
                        </div>
                    ) : activeOpportunities.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-4 py-12 text-center shadow-2xs">
                            <ShieldAlert className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-800">{emptyMessage}</p>
                            <p className="mt-1 text-xs text-slate-500">Fresh records will appear here immediately after publication.</p>
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {activeOpportunities.slice(0, 8).map((item, index) => (
                                <OpportunityCard 
                                    key={item.sourceKey}
                                    item={item} 
                                    index={index} 
                                    visible={visible} 
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)] w-full">
                            <table data-ux-wrapped="true" className="w-full text-left text-sm table-auto border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-black uppercase tracking-wider text-slate-500">
                                        <th className="px-4 py-3.5 sm:px-5 sm:py-4 w-10">#</th>
                                        <th className="px-4 py-3.5 sm:px-5 sm:py-4 w-28">Ref ID</th>
                                        <th className="px-4 py-3.5 sm:px-5 sm:py-4 w-[32%]">Title / Description</th>
                                        <th className="px-4 py-3.5 sm:px-5 sm:py-4 w-[24%]">Buyer Organization</th>
                                        <th className="px-4 py-3.5 sm:px-5 sm:py-4 w-[16%]">Category</th>
                                        <th className="px-4 py-3.5 sm:px-5 sm:py-4 w-28">Published Date</th>
                                        <th className="px-4 py-3.5 sm:px-5 sm:py-4 w-28">Closes / Timeline</th>
                                        <th className="px-4 py-3.5 sm:px-5 sm:py-4 w-24">Status</th>
                                        <th className="px-4 py-3.5 sm:px-5 sm:py-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {activeOpportunities.slice(0, 8).map((item, index) => (
                                        <OpportunityListRow 
                                            key={item.sourceKey}
                                            item={item} 
                                            srNo={index + 1} 
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
