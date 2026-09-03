'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowDown,
    ArrowUp,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    Eye,
    EyeOff,
    FileText,
    HelpCircle,
    Info,
    Layers,
    LayoutList,
    Loader2,
    MapPin,
    Package,
    RefreshCw,
    RotateCcw,
    Save,
    Search,
    ShieldCheck,
    ShoppingBag,
    SlidersHorizontal,
    Sparkles,
    Tag,
    Undo2,
    Users,
    Wrench,
    AlertTriangle,
    X,
    EyeIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { KpiCard } from '../../shared/KpiCard';
import { ViewModeToggle, type ViewMode } from '../../shared/ViewModeToggle';
import { marketplaceApi, type MarketplaceHomeSectionConfig } from '../api';

const ruleOptions = [
    'AUTO_POPULAR',
    'AUTO_MOST_PURCHASED',
    'AUTO_DISCOUNTED',
    'LOCAL_MSME',
    'HERSHG',
    'SERVICES',
    'BUYER_REQUIREMENTS',
    'MANUAL_FEATURED',
] as const;

interface RuleMeta {
    label: string;
    description: string;
    badge: string;
    badgeColor: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    contentType: string;
}

const ruleMetadata: Record<string, RuleMeta> = {
    AUTO_POPULAR: {
        label: 'Popular Picks',
        description: 'Auto-selected top products and services weighted by buyer inquiries, orders, and ratings.',
        badge: 'Products & Services',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200/80',
        accentColor: 'text-blue-600 bg-blue-50 border-blue-200',
        contentType: 'Mixed Catalogue',
        icon: Sparkles,
    },
    AUTO_MOST_PURCHASED: {
        label: 'Mostly Purchased Items',
        description: 'Products with authentic procurement history calculated from completed and delivered purchase orders.',
        badge: 'Purchase Orders',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        accentColor: 'text-emerald-600 bg-emerald-50 border-emerald-200',
        contentType: 'Products Only',
        icon: ShoppingBag,
    },
    AUTO_DISCOUNTED: {
        label: 'Discounted Products & Offers',
        description: 'Active seller promotional listings offering legitimate rate reductions against catalog baseline.',
        badge: 'Promotions',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200/80',
        accentColor: 'text-amber-600 bg-amber-50 border-amber-200',
        contentType: 'Active Offers',
        icon: Tag,
    },
    LOCAL_MSME: {
        label: 'Local MSME Products',
        description: 'Prioritizes verified MSME manufacturers and suppliers in Jharsuguda and Odisha districts.',
        badge: 'District Focus',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        accentColor: 'text-indigo-600 bg-indigo-50 border-indigo-200',
        contentType: 'Local Suppliers',
        icon: MapPin,
    },
    HERSHG: {
        label: 'HerSHG / Women SHG Products',
        description: 'Curated showcase of verified Self-Help Groups and women entrepreneur collective enterprises.',
        badge: 'SHG Empowerment',
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200/80',
        accentColor: 'text-rose-600 bg-rose-50 border-rose-200',
        contentType: 'SHG Listings',
        icon: Users,
    },
    SERVICES: {
        label: 'Services You May Need',
        description: 'Verified professional, engineering, fabrication, and maintenance service providers.',
        badge: 'Services',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200/80',
        accentColor: 'text-purple-600 bg-purple-50 border-purple-200',
        contentType: 'Industrial Services',
        icon: Wrench,
    },
    BUYER_REQUIREMENTS: {
        label: 'Trending Buyer Requirements',
        description: 'Public procurement requirements, active RFQs, and buyer quotation demand cards.',
        badge: 'Procurements',
        badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
        accentColor: 'text-cyan-600 bg-cyan-50 border-cyan-200',
        contentType: 'Active RFQs',
        icon: FileText,
    },
    MANUAL_FEATURED: {
        label: 'Manual Featured Showcase',
        description: 'Special verified listings highlighted for official government and industrial focus.',
        badge: 'Featured',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        accentColor: 'text-slate-700 bg-slate-100 border-slate-200',
        contentType: 'Curated Showcase',
        icon: ShieldCheck,
    },
};

function getRuleMeta(ruleType: string): RuleMeta {
    return (
        ruleMetadata[ruleType] || {
            label: ruleType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
            description: 'Custom rule configuration for marketplace discovery.',
            badge: 'Custom Rule',
            badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
            accentColor: 'text-slate-600 bg-slate-50 border-slate-200',
            contentType: 'Custom',
            icon: SlidersHorizontal,
        }
    );
}

export default function AdminMarketplaceHomeSectionsPage() {
    const queryClient = useQueryClient();

    const { data, isLoading, isError, refetch, isFetching } = useQuery({
        queryKey: ['admin-marketplace-home-sections'],
        queryFn: marketplaceApi.getAdminHomeSections,
        staleTime: 60_000,
    });

    const serverSections = useMemo(() => data?.sections || [], [data?.sections]);

    // Local drafts mapping by section key
    const [drafts, setDrafts] = useState<Record<string, MarketplaceHomeSectionConfig>>({});
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'HIDDEN' | 'UNSAVED'>('ALL');

    // Sync server sections to local drafts when loaded or reloaded
    useEffect(() => {
        if (serverSections.length > 0) {
            const initialDrafts: Record<string, MarketplaceHomeSectionConfig> = {};
            serverSections.forEach((s) => {
                initialDrafts[s.key] = { ...s };
            });
            setDrafts(initialDrafts);
        }
    }, [serverSections]);

    // Compute modified sections
    const dirtyKeys = useMemo(() => {
        return serverSections
            .filter((orig) => {
                const draft = drafts[orig.key];
                if (!draft) return false;
                return (
                    draft.title !== orig.title ||
                    draft.enabled !== orig.enabled ||
                    draft.displayOrder !== orig.displayOrder ||
                    draft.itemLimit !== orig.itemLimit ||
                    draft.ruleType !== orig.ruleType
                );
            })
            .map((s) => s.key);
    }, [serverSections, drafts]);

    const isDirty = dirtyKeys.length > 0;

    // Sorted list of sections reflecting live draft displayOrder
    const sortedDraftSections = useMemo(() => {
        const list = Object.values(drafts);
        if (list.length === 0) return serverSections;
        return [...list].sort((a, b) => {
            const orderDiff = Number(a.displayOrder || 0) - Number(b.displayOrder || 0);
            if (orderDiff !== 0) return orderDiff;
            return a.key.localeCompare(b.key);
        });
    }, [drafts, serverSections]);

    // Filtered list based on search and status tabs
    const visibleSections = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return sortedDraftSections.filter((section) => {
            const matchesQuery =
                !q ||
                section.title.toLowerCase().includes(q) ||
                section.key.toLowerCase().includes(q) ||
                section.ruleType.toLowerCase().includes(q) ||
                getRuleMeta(section.ruleType).label.toLowerCase().includes(q);

            if (!matchesQuery) return false;

            if (filterStatus === 'ACTIVE') return section.enabled;
            if (filterStatus === 'HIDDEN') return !section.enabled;
            if (filterStatus === 'UNSAVED') return dirtyKeys.includes(section.key);
            return true;
        });
    }, [sortedDraftSections, searchQuery, filterStatus, dirtyKeys]);

    // Stats
    const totalCount = sortedDraftSections.length;
    const enabledCount = sortedDraftSections.filter((s) => s.enabled).length;
    const disabledCount = totalCount - enabledCount;

    // Single section update mutation
    const updateSingleMutation = useMutation({
        mutationFn: async (key: string) => {
            const draft = drafts[key];
            if (!draft) throw new Error('Section draft not found');
            setSavingKey(key);
            return marketplaceApi.updateAdminHomeSection(key, {
                title: draft.title.trim(),
                enabled: draft.enabled,
                displayOrder: Number(draft.displayOrder || 0),
                itemLimit: Number(draft.itemLimit || 12),
                ruleType: draft.ruleType,
            });
        },
        onSuccess: (updatedSection) => {
            toast.success(`"${updatedSection.title}" saved successfully`);
            queryClient.invalidateQueries({ queryKey: ['admin-marketplace-home-sections'] });
            queryClient.invalidateQueries({ queryKey: ['marketplaceHomeLayout'] });
            queryClient.invalidateQueries({ queryKey: ['marketplaceHome'] });
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Unable to update section');
        },
        onSettled: () => {
            setSavingKey(null);
        },
    });

    // Save all dirty sections mutation
    const saveAllMutation = useMutation({
        mutationFn: async () => {
            const promises = dirtyKeys.map((key) => {
                const draft = drafts[key];
                return marketplaceApi.updateAdminHomeSection(key, {
                    title: draft.title.trim(),
                    enabled: draft.enabled,
                    displayOrder: Number(draft.displayOrder || 0),
                    itemLimit: Number(draft.itemLimit || 12),
                    ruleType: draft.ruleType,
                });
            });
            return Promise.all(promises);
        },
        onSuccess: (results) => {
            toast.success(`Saved all ${results.length} modified sections`);
            queryClient.invalidateQueries({ queryKey: ['admin-marketplace-home-sections'] });
            queryClient.invalidateQueries({ queryKey: ['marketplaceHomeLayout'] });
            queryClient.invalidateQueries({ queryKey: ['marketplaceHome'] });
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Failed to save all changes');
        },
    });

    // Reset to defaults mutation
    const resetMutation = useMutation({
        mutationFn: () => marketplaceApi.resetAdminHomeSections(),
        onSuccess: () => {
            toast.success('Marketplace sections restored to official defaults');
            setIsResetConfirmOpen(false);
            queryClient.invalidateQueries({ queryKey: ['admin-marketplace-home-sections'] });
            queryClient.invalidateQueries({ queryKey: ['marketplaceHomeLayout'] });
            queryClient.invalidateQueries({ queryKey: ['marketplaceHome'] });
        },
        onError: (err: any) => {
            toast.error(err?.message || 'Failed to reset sections');
        },
    });

    // Handle field updates
    const handleFieldChange = (key: string, field: keyof MarketplaceHomeSectionConfig, value: any) => {
        setDrafts((prev) => {
            const current = prev[key];
            if (!current) return prev;
            return {
                ...prev,
                [key]: {
                    ...current,
                    [field]: value,
                },
            };
        });
    };

    // Revert a single section
    const handleRevert = (key: string) => {
        const original = serverSections.find((s) => s.key === key);
        if (original) {
            setDrafts((prev) => ({
                ...prev,
                [key]: { ...original },
            }));
            toast.info(`Reverted changes for "${original.title}"`);
        }
    };

    // Move Section Up in sequence
    const handleMoveUp = (indexInSorted: number) => {
        if (indexInSorted <= 0) return;
        const currentItem = sortedDraftSections[indexInSorted];
        const prevItem = sortedDraftSections[indexInSorted - 1];
        if (!currentItem || !prevItem) return;

        let newCurrentOrder = Number(prevItem.displayOrder || 0);
        let newPrevOrder = Number(currentItem.displayOrder || 0);

        if (newCurrentOrder === newPrevOrder) {
            newCurrentOrder = Math.max(0, newCurrentOrder - 10);
        }

        setDrafts((prev) => ({
            ...prev,
            [currentItem.key]: { ...prev[currentItem.key], displayOrder: newCurrentOrder },
            [prevItem.key]: { ...prev[prevItem.key], displayOrder: newPrevOrder },
        }));

        toast.info(`Moved "${currentItem.title}" up to #${indexInSorted}`);
    };

    // Move Section Down in sequence
    const handleMoveDown = (indexInSorted: number) => {
        if (indexInSorted >= sortedDraftSections.length - 1) return;
        const currentItem = sortedDraftSections[indexInSorted];
        const nextItem = sortedDraftSections[indexInSorted + 1];
        if (!currentItem || !nextItem) return;

        let newCurrentOrder = Number(nextItem.displayOrder || 0);
        let newNextOrder = Number(currentItem.displayOrder || 0);

        if (newCurrentOrder === newNextOrder) {
            newCurrentOrder = newCurrentOrder + 10;
        }

        setDrafts((prev) => ({
            ...prev,
            [currentItem.key]: { ...prev[currentItem.key], displayOrder: newCurrentOrder },
            [nextItem.key]: { ...prev[nextItem.key], displayOrder: newNextOrder },
        }));

        toast.info(`Moved "${currentItem.title}" down to #${indexInSorted + 2}`);
    };

    // Clean up all orders to neat 10, 20, 30... increments
    const handleAutoBalanceOrders = () => {
        const updated: Record<string, MarketplaceHomeSectionConfig> = { ...drafts };
        sortedDraftSections.forEach((s, idx) => {
            const standardOrder = (idx + 1) * 10;
            updated[s.key] = {
                ...updated[s.key],
                displayOrder: standardOrder,
            };
        });
        setDrafts(updated);
        toast.success('Display orders normalized to clean 10, 20, 30 sequence');
    };

    return (
        <div className="mx-auto max-w-[1600px] space-y-6 pb-20 px-4 sm:px-6 lg:px-8">
            {/* Top Page Banner */}
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b2447] text-white shadow-xs">
                            <SlidersHorizontal className="h-4 w-4" />
                        </span>
                        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#0b2447]">
                            Homepage Section Controls
                        </h1>
                    </div>
                    <p className="mt-1.5 text-xs sm:text-sm font-medium text-slate-500 max-w-3xl">
                        Control the discovery carousels and requirement blocks shown on the public marketplace homepage. Reorder sections, toggle visibility, customize titles, and configure data filtering rules.
                    </p>
                </div>

                {/* Top Action Toolbar */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0b2447]/20 disabled:opacity-50"
                        title="Reload latest configuration from database"
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-[#0b2447]' : 'text-slate-500'}`} />
                        <span>Refresh</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsResetConfirmOpen(true)}
                        disabled={resetMutation.isPending}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50/60 px-3.5 text-xs font-bold text-rose-700 shadow-xs transition hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:opacity-50"
                        title="Restore 7 standard sections to default titles and rules"
                    >
                        <RotateCcw className="h-3.5 w-3.5 text-rose-600" />
                        <span>Reset Defaults</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setShowPreviewDrawer(!showPreviewDrawer)}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-xs font-bold shadow-xs transition focus:outline-none focus:ring-2 focus:ring-[#0b2447]/20 ${
                            showPreviewDrawer
                                ? 'border-[#0b2447] bg-[#0b2447] text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                        title="Toggle mini preview of homepage layout"
                    >
                        <EyeIcon className="h-3.5 w-3.5" />
                        <span>Flow Preview</span>
                    </button>

                    <Link
                        href="/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-xs font-bold text-[#0b2447] shadow-xs transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0b2447]/20"
                        title="Open live marketplace homepage in a new tab"
                    >
                        <span>Preview Live Homepage</span>
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                    </Link>

                    {isDirty && (
                        <Button
                            type="button"
                            onClick={() => saveAllMutation.mutate()}
                            disabled={saveAllMutation.isPending}
                            className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-black uppercase tracking-wide text-white shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                        >
                            {saveAllMutation.isPending ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Check className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Save All Changes ({dirtyKeys.length})
                        </Button>
                    )}
                </div>
            </div>

            {/* Standard Portal KPI Card Strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
                <KpiCard
                    label="Total Discovery Sections"
                    value={totalCount}
                    subtext="Available layout blocks"
                    tone="blue"
                    icon={Layers}
                />
                <KpiCard
                    label="Live on Homepage"
                    value={enabledCount}
                    subtext="Rendered in sequence"
                    tone="emerald"
                    icon={Eye}
                />
                <KpiCard
                    label="Hidden / Inactive"
                    value={disabledCount}
                    subtext="Omitted from discovery"
                    tone="slate"
                    icon={EyeOff}
                />
                <KpiCard
                    label={isDirty ? "Unsaved Edits" : "Sync Status"}
                    value={isDirty ? `${dirtyKeys.length} Pending` : "Synchronized"}
                    subtext={isDirty ? "Click Save to apply changes" : "Database & Redis live"}
                    tone={isDirty ? "amber" : "green"}
                    icon={isDirty ? AlertTriangle : CheckCircle2}
                />
            </div>

            {/* Filter and View Mode Bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs">
                {/* Search & Tabs */}
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    <div className="relative min-w-[220px] max-w-sm flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Filter by section title or rule..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#0b2447] focus:outline-none focus:ring-1 focus:ring-[#0b2447]"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                        {(['ALL', 'ACTIVE', 'HIDDEN', 'UNSAVED'] as const).map((status) => {
                            const count =
                                status === 'ALL'
                                    ? totalCount
                                    : status === 'ACTIVE'
                                    ? enabledCount
                                    : status === 'HIDDEN'
                                    ? disabledCount
                                    : dirtyKeys.length;

                            const isActive = filterStatus === status;

                            return (
                                <button
                                    key={status}
                                    type="button"
                                    onClick={() => setFilterStatus(status)}
                                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition ${
                                        isActive
                                            ? 'bg-white text-[#0b2447] shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <span>
                                        {status === 'ALL'
                                            ? 'All'
                                            : status === 'ACTIVE'
                                            ? 'Active'
                                            : status === 'HIDDEN'
                                            ? 'Hidden'
                                            : 'Unsaved'}
                                    </span>
                                    <span
                                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                                            isActive
                                                ? 'bg-[#0b2447]/10 text-[#0b2447]'
                                                : 'bg-slate-200/80 text-slate-600'
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Right controls: Normalize sequence & ViewMode toggle */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                        type="button"
                        onClick={handleAutoBalanceOrders}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
                        title="Normalize order weights to 10, 20, 30..."
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                        <span className="hidden sm:inline">Auto-Sequence</span>
                    </button>

                    <ViewModeToggle value={viewMode} onChange={setViewMode} size="sm" />
                </div>
            </div>

            {/* Layout Flow Preview Drawer (when opened) */}
            {showPreviewDrawer && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-5 shadow-xs transition-all animate-in fade-in">
                    <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                        <div className="flex items-center gap-2">
                            <EyeIcon className="h-4 w-4 text-[#0b2447]" />
                            <h2 className="text-sm font-black text-[#0b2447]">
                                Live Homepage Flow Preview
                            </h2>
                            <span className="text-xs font-semibold text-slate-500">
                                (Simulated vertical sequence as seen by marketplace visitors)
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowPreviewDrawer(false)}
                            className="rounded-lg p-1 text-slate-400 hover:bg-blue-100/50 hover:text-slate-700"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2.5">
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-400">
                            <span>Top: Hero Banner &amp; Category Strip</span>
                        </div>
                        <span className="text-slate-300 self-center">→</span>
                        {sortedDraftSections
                            .filter((s) => s.enabled)
                            .map((s, idx) => {
                                const meta = getRuleMeta(s.ruleType);
                                const RuleIcon = meta.icon;
                                return (
                                    <React.Fragment key={s.key}>
                                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold shadow-xs">
                                            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#0b2447] text-[10px] font-black text-white">
                                                {idx + 1}
                                            </span>
                                            <RuleIcon className="h-3.5 w-3.5 text-slate-500" />
                                            <span className="text-slate-900">{s.title}</span>
                                            <span className="text-[10px] text-slate-400">({s.itemLimit} items)</span>
                                        </div>
                                        {idx < enabledCount - 1 && (
                                            <span className="text-slate-300 self-center">→</span>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        <span className="text-slate-300 self-center">→</span>
                        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-400">
                            <span>Bottom: Seller Strip &amp; Footer</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Defaults Confirmation Modal */}
            {isResetConfirmOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="reset-modal-title"
                >
                    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                                <AlertTriangle className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 id="reset-modal-title" className="text-base font-black text-slate-900">
                                    Restore Default Sections?
                                </h2>
                                <p className="text-xs font-medium text-slate-500">
                                    This will reset titles, display orders, rules, and limits for all 7 standard sections back to official default settings.
                                </p>
                            </div>
                        </div>

                        <div className="mt-6 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setIsResetConfirmOpen(false)}
                                disabled={resetMutation.isPending}
                                className="h-9 rounded-lg border border-slate-200 px-4 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <Button
                                type="button"
                                onClick={() => resetMutation.mutate()}
                                disabled={resetMutation.isPending}
                                className="h-9 rounded-lg bg-rose-600 px-4 text-xs font-black uppercase text-white hover:bg-rose-700"
                            >
                                {resetMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
                                Confirm Reset
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Skeleton */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-xs" />
                    ))}
                </div>
            ) : isError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-xs">
                    <AlertTriangle className="mx-auto h-8 w-8 text-red-600" />
                    <h2 className="mt-2 text-sm font-black uppercase tracking-wide text-red-900">
                        Unable to connect to marketplace section service
                    </h2>
                    <p className="mt-1 text-xs text-red-700">
                        Failed to retrieve homepage layout records. Please verify administrator session and permissions.
                    </p>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-700 px-3.5 text-xs font-bold text-white shadow-xs hover:bg-red-800"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Retry
                    </button>
                </div>
            ) : visibleSections.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
                    <Package className="mx-auto h-10 w-10 text-slate-300" />
                    <h3 className="mt-3 text-sm font-black text-slate-800">No matching sections found</h3>
                    <p className="mt-1 text-xs text-slate-500">
                        Try adjusting your search keywords or filter tab.
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setSearchQuery('');
                            setFilterStatus('ALL');
                        }}
                        className="mt-4 inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                        Reset filters
                    </button>
                </div>
            ) : viewMode === 'list' ? (
                /* ─────────────────────────────────────────────────────────────
                   VIEW 1: SEQUENTIAL TIMELINE LIST VIEW (Linear, Easy to Use)
                   ───────────────────────────────────────────────────────────── */
                <div className="space-y-3">
                    {visibleSections.map((section) => {
                        const indexInSorted = sortedDraftSections.findIndex((s) => s.key === section.key);
                        const draft = drafts[section.key] || section;
                        const original = serverSections.find((s) => s.key === section.key) || section;
                        const ruleMeta = getRuleMeta(draft.ruleType);
                        const RuleIcon = ruleMeta.icon;

                        const hasChanges =
                            draft.title !== original.title ||
                            draft.enabled !== original.enabled ||
                            draft.displayOrder !== original.displayOrder ||
                            draft.itemLimit !== original.itemLimit ||
                            draft.ruleType !== original.ruleType;

                        const isSavingThis = savingKey === section.key;

                        return (
                            <div
                                key={section.key}
                                className={`flex flex-col lg:flex-row lg:items-center gap-4 rounded-xl border bg-white p-4 shadow-xs transition-all duration-200 hover:shadow-sm ${
                                    hasChanges
                                        ? 'border-amber-300 bg-amber-50/20 ring-2 ring-amber-400/50'
                                        : 'border-slate-200/90'
                                }`}
                            >
                                {/* Left Column: Position Rank + Up/Down Reorder */}
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="flex flex-col items-center">
                                        <button
                                            type="button"
                                            onClick={() => handleMoveUp(indexInSorted)}
                                            disabled={indexInSorted === 0}
                                            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-20"
                                            title="Move section up on homepage"
                                            aria-label={`Move ${draft.title} up`}
                                        >
                                            <ChevronUp className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleMoveDown(indexInSorted)}
                                            disabled={indexInSorted === sortedDraftSections.length - 1}
                                            className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-20"
                                            title="Move section down on homepage"
                                            aria-label={`Move ${draft.title} down`}
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div
                                        className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl border text-center shadow-2xs font-black ${
                                            indexInSorted === 0
                                                ? 'border-blue-600 bg-blue-600 text-white'
                                                : draft.enabled
                                                ? 'border-slate-200 bg-slate-50 text-slate-900'
                                                : 'border-slate-200 bg-slate-100 text-slate-400'
                                        }`}
                                        title={`Render position #${indexInSorted + 1} on homepage`}
                                    >
                                        <span className="text-[9px] uppercase font-bold tracking-tighter opacity-80">
                                            Pos
                                        </span>
                                        <span className="text-sm leading-none font-black">
                                            #{indexInSorted + 1}
                                        </span>
                                    </div>
                                </div>

                                {/* Rule Icon */}
                                <div
                                    className={`hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${ruleMeta.accentColor} shadow-2xs`}
                                >
                                    <RuleIcon className="h-5 w-5" />
                                </div>

                                {/* Main Details: Title Input + Rule Selector */}
                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            value={draft.title}
                                            onChange={(e) => handleFieldChange(section.key, 'title', e.target.value)}
                                            placeholder="Section Title"
                                            className="h-8 max-w-sm rounded-md border border-transparent px-2.5 text-sm font-black text-[#0b2447] transition hover:border-slate-200 focus:border-[#0b2447] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b2447]"
                                        />
                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${ruleMeta.badgeColor}`}>
                                            {ruleMeta.contentType}
                                        </span>
                                        {hasChanges && (
                                            <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                                                Unsaved Edits
                                            </span>
                                        )}
                                    </div>

                                    {/* Data Source Rule & Description */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <label htmlFor={`row-rule-${section.key}`} className="sr-only">Data rule</label>
                                        <select
                                            id={`row-rule-${section.key}`}
                                            value={draft.ruleType}
                                            onChange={(e) => handleFieldChange(section.key, 'ruleType', e.target.value)}
                                            className="h-7 rounded-md border border-slate-200 bg-slate-50/70 px-2 text-[11px] font-bold text-slate-700 focus:border-[#0b2447] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b2447]"
                                        >
                                            {ruleOptions.map((rule) => (
                                                <option key={rule} value={rule}>
                                                    Rule: {getRuleMeta(rule).label}
                                                </option>
                                            ))}
                                        </select>
                                        <span className="text-[11px] text-slate-500 truncate max-w-lg">
                                            {ruleMeta.description}
                                        </span>
                                    </div>
                                </div>

                                {/* Numerical Controls: Order Weight & Item Limit */}
                                <div className="flex items-center gap-3 shrink-0">
                                    {/* Item Limit */}
                                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                            Limit:
                                        </span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={24}
                                            value={draft.itemLimit}
                                            onChange={(e) => handleFieldChange(section.key, 'itemLimit', Math.min(24, Math.max(1, Number(e.target.value))))}
                                            className="h-6 w-12 rounded border border-slate-200 bg-white text-center text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0b2447]"
                                            title="Max items displayed in this carousel (1-24)"
                                        />
                                        <span className="text-[10px] font-semibold text-slate-400">items</span>
                                    </div>

                                    {/* Order Weight */}
                                    <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                            Order:
                                        </span>
                                        <input
                                            type="number"
                                            min={0}
                                            max={999}
                                            value={draft.displayOrder}
                                            onChange={(e) => handleFieldChange(section.key, 'displayOrder', Math.max(0, Number(e.target.value)))}
                                            className="h-6 w-12 rounded border border-slate-200 bg-white text-center text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#0b2447]"
                                            title="Sequence weight number (lower appears first)"
                                        />
                                    </div>

                                    {/* Enabled Switch */}
                                    <label
                                        htmlFor={`toggle-${section.key}`}
                                        className="inline-flex items-center gap-2 cursor-pointer select-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-2xs hover:bg-slate-50"
                                    >
                                        <input
                                            id={`toggle-${section.key}`}
                                            type="checkbox"
                                            role="switch"
                                            aria-checked={draft.enabled}
                                            checked={draft.enabled}
                                            onChange={(e) => handleFieldChange(section.key, 'enabled', e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-[#0b2447] focus:ring-[#0b2447]"
                                        />
                                        <span className={`text-xs font-black uppercase tracking-wider ${draft.enabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                                            {draft.enabled ? 'Active' : 'Hidden'}
                                        </span>
                                    </label>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-1.5">
                                        {hasChanges && (
                                            <button
                                                type="button"
                                                onClick={() => handleRevert(section.key)}
                                                disabled={isSavingThis}
                                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                                title="Undo pending changes"
                                            >
                                                <Undo2 className="h-3.5 w-3.5" />
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => updateSingleMutation.mutate(section.key)}
                                            disabled={isSavingThis || !hasChanges}
                                            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-black uppercase tracking-wide transition ${
                                                hasChanges
                                                    ? 'bg-[#0b2447] text-white shadow hover:bg-[#12335f]'
                                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            }`}
                                        >
                                            {isSavingThis ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Save className="h-3.5 w-3.5" />
                                            )}
                                            <span>Save</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* ─────────────────────────────────────────────────────────────
                   VIEW 2: REFINED CARD GRID VIEW (Compact & Elegant)
                   ───────────────────────────────────────────────────────────── */
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {visibleSections.map((section) => {
                        const indexInSorted = sortedDraftSections.findIndex((s) => s.key === section.key);
                        const draft = drafts[section.key] || section;
                        const original = serverSections.find((s) => s.key === section.key) || section;
                        const ruleMeta = getRuleMeta(draft.ruleType);
                        const RuleIcon = ruleMeta.icon;

                        const hasChanges =
                            draft.title !== original.title ||
                            draft.enabled !== original.enabled ||
                            draft.displayOrder !== original.displayOrder ||
                            draft.itemLimit !== original.itemLimit ||
                            draft.ruleType !== original.ruleType;

                        const isSavingThis = savingKey === section.key;

                        return (
                            <div
                                key={section.key}
                                className={`flex flex-col justify-between rounded-xl border bg-white p-5 shadow-xs transition-all duration-200 hover:shadow-sm ${
                                    hasChanges
                                        ? 'border-amber-300 ring-2 ring-amber-400/50 bg-amber-50/10'
                                        : 'border-slate-200/90'
                                }`}
                            >
                                <div className="space-y-4">
                                    {/* Card Header: Position & Status */}
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-black ${
                                                    indexInSorted === 0
                                                        ? 'bg-[#0b2447] text-white'
                                                        : 'bg-slate-100 text-slate-800'
                                                }`}
                                            >
                                                #{indexInSorted + 1} Position
                                            </span>
                                            {hasChanges && (
                                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800">
                                                    Unsaved
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => handleMoveUp(indexInSorted)}
                                                disabled={indexInSorted === 0}
                                                className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-20"
                                                title="Move up"
                                            >
                                                <ChevronUp className="h-4 w-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleMoveDown(indexInSorted)}
                                                disabled={indexInSorted === sortedDraftSections.length - 1}
                                                className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-20"
                                                title="Move down"
                                            >
                                                <ChevronDown className="h-4 w-4" />
                                            </button>

                                            <span
                                                className={`ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                                                    draft.enabled
                                                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                                                        : 'bg-slate-100 text-slate-500'
                                                }`}
                                            >
                                                <span className={`h-1.5 w-1.5 rounded-full ${draft.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                {draft.enabled ? 'Active' : 'Hidden'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Title Input */}
                                    <div>
                                        <label
                                            htmlFor={`card-title-${section.key}`}
                                            className="block text-[10px] font-black uppercase tracking-wider text-slate-400"
                                        >
                                            Section Title
                                        </label>
                                        <div className="mt-1 flex items-center gap-2">
                                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${ruleMeta.accentColor}`}>
                                                <RuleIcon className="h-4 w-4" />
                                            </div>
                                            <input
                                                id={`card-title-${section.key}`}
                                                value={draft.title}
                                                onChange={(e) => handleFieldChange(section.key, 'title', e.target.value)}
                                                className="h-8.5 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-900 focus:border-[#0b2447] focus:outline-none focus:ring-1 focus:ring-[#0b2447]"
                                            />
                                        </div>
                                    </div>

                                    {/* Data Source Rule */}
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <label
                                                htmlFor={`card-rule-${section.key}`}
                                                className="text-[10px] font-black uppercase tracking-wider text-slate-400"
                                            >
                                                Data Source Rule
                                            </label>
                                            <span className={`rounded border px-1.5 py-0.2 text-[9px] font-bold ${ruleMeta.badgeColor}`}>
                                                {ruleMeta.contentType}
                                            </span>
                                        </div>
                                        <select
                                            id={`card-rule-${section.key}`}
                                            value={draft.ruleType}
                                            onChange={(e) => handleFieldChange(section.key, 'ruleType', e.target.value)}
                                            className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2 text-xs font-bold text-slate-800 focus:border-[#0b2447] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b2447]"
                                        >
                                            {ruleOptions.map((rule) => (
                                                <option key={rule} value={rule}>
                                                    {getRuleMeta(rule).label}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                                            {ruleMeta.description}
                                        </p>
                                    </div>

                                    {/* Order and Limit Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label
                                                htmlFor={`card-order-${section.key}`}
                                                className="block text-[10px] font-black uppercase tracking-wider text-slate-400"
                                            >
                                                Sequence Order
                                            </label>
                                            <input
                                                id={`card-order-${section.key}`}
                                                type="number"
                                                min={0}
                                                max={999}
                                                value={draft.displayOrder}
                                                onChange={(e) => handleFieldChange(section.key, 'displayOrder', Math.max(0, Number(e.target.value)))}
                                                className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 text-xs font-bold text-slate-900 focus:border-[#0b2447] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b2447]"
                                            />
                                        </div>

                                        <div>
                                            <label
                                                htmlFor={`card-limit-${section.key}`}
                                                className="block text-[10px] font-black uppercase tracking-wider text-slate-400"
                                            >
                                                Item Limit
                                            </label>
                                            <input
                                                id={`card-limit-${section.key}`}
                                                type="number"
                                                min={1}
                                                max={24}
                                                value={draft.itemLimit}
                                                onChange={(e) => handleFieldChange(section.key, 'itemLimit', Math.min(24, Math.max(1, Number(e.target.value))))}
                                                className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 text-xs font-bold text-slate-900 focus:border-[#0b2447] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b2447]"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Card Footer: Toggle & Save */}
                                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
                                    <label
                                        htmlFor={`card-toggle-${section.key}`}
                                        className="inline-flex items-center gap-2 cursor-pointer select-none"
                                    >
                                        <input
                                            id={`card-toggle-${section.key}`}
                                            type="checkbox"
                                            role="switch"
                                            aria-checked={draft.enabled}
                                            checked={draft.enabled}
                                            onChange={(e) => handleFieldChange(section.key, 'enabled', e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-[#0b2447] focus:ring-[#0b2447]"
                                        />
                                        <span className={`text-xs font-black uppercase tracking-wider ${draft.enabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                                            {draft.enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </label>

                                    <div className="flex items-center gap-1.5">
                                        {hasChanges && (
                                            <button
                                                type="button"
                                                onClick={() => handleRevert(section.key)}
                                                disabled={isSavingThis}
                                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                title="Undo"
                                            >
                                                <Undo2 className="h-3.5 w-3.5" />
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => updateSingleMutation.mutate(section.key)}
                                            disabled={isSavingThis || !hasChanges}
                                            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-black uppercase tracking-wide transition ${
                                                hasChanges
                                                    ? 'bg-[#0b2447] text-white shadow hover:bg-[#12335f]'
                                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            }`}
                                        >
                                            {isSavingThis ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Save className="h-3.5 w-3.5" />
                                            )}
                                            Save
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
