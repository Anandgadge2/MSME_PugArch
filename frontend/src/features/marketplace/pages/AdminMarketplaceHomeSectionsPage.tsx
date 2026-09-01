'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { marketplaceApi, type MarketplaceHomeSectionConfig } from '../api';

const ruleOptions = [
    'AUTO_POPULAR',
    'AUTO_DISCOUNTED',
    'AUTO_MOST_PURCHASED',
    'MANUAL_FEATURED',
    'LOCAL_MSME',
    'HERSHG',
    'SERVICES',
    'BUYER_REQUIREMENTS',
] as const;

function readableRule(value: string) {
    return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function SectionControlRow({ section, index }: { section: MarketplaceHomeSectionConfig, index: number }) {
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState(section);

    const updateMutation = useMutation({
        mutationFn: () => marketplaceApi.updateAdminHomeSection(section.key, {
            title: draft.title,
            enabled: draft.enabled,
            displayOrder: Number(draft.displayOrder || 0),
            itemLimit: Number(draft.itemLimit || 1),
            ruleType: draft.ruleType,
        }),
        onSuccess: () => {
            toast.success('Marketplace section updated');
            queryClient.invalidateQueries({ queryKey: ['admin-marketplace-home-sections'] });
            queryClient.invalidateQueries({ queryKey: ['marketplaceHomeLayout'] });
        },
        onError: (error: any) => toast.error(error?.message || 'Unable to update section'),
    });

    const accents = [
        { border: 'border-t-blue-500', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
        { border: 'border-t-emerald-500', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
        { border: 'border-t-purple-500', iconBg: 'bg-purple-50', iconColor: 'text-purple-600' },
        { border: 'border-t-amber-500', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
        { border: 'border-t-indigo-500', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
        { border: 'border-t-rose-500', iconBg: 'bg-rose-50', iconColor: 'text-rose-600' },
    ];
    const accent = accents[index % accents.length];

    return (
        <div className={`flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm border-t-4 ${accent.border} transition-all hover:shadow-md`}>
            {/* Header: Icon + Title Input */}
            <div className="flex items-start gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${accent.iconBg} ${accent.iconColor}`}>
                    <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Section Title</span>
                    <input
                        value={draft.title}
                        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                        className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#12335f]/20"
                        placeholder="Section Name"
                    />
                </div>
            </div>

            {/* Rule Selector */}
            <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rule</span>
                <select
                    value={draft.ruleType}
                    onChange={(event) => setDraft((current) => ({ ...current, ruleType: event.target.value }))}
                    className="h-9 w-full rounded-md border border-slate-200 bg-slate-50/50 px-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#12335f]/20"
                >
                    {ruleOptions.map((rule) => (
                        <option key={rule} value={rule}>{readableRule(rule)}</option>
                    ))}
                </select>
            </label>

            {/* Order & Limit Grid */}
            <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order</span>
                    <input
                        type="number"
                        min={0}
                        max={999}
                        value={draft.displayOrder}
                        onChange={(event) => setDraft((current) => ({ ...current, displayOrder: Number(event.target.value) }))}
                        className="h-9 w-full rounded-md border border-slate-200 bg-slate-50/50 px-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#12335f]/20"
                    />
                </label>
                <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Limit</span>
                    <input
                        type="number"
                        min={1}
                        max={24}
                        value={draft.itemLimit}
                        onChange={(event) => setDraft((current) => ({ ...current, itemLimit: Number(event.target.value) }))}
                        className="h-9 w-full rounded-md border border-slate-200 bg-slate-50/50 px-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#12335f]/20"
                    />
                </label>
            </div>

            {/* Footer: Enabled Toggle & Save Button */}
            <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-[#12335f]"
                    />
                    <span className={`text-xs font-black uppercase tracking-wider ${draft.enabled ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {draft.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </label>
                <Button
                    type="button"
                    onClick={() => updateMutation.mutate()}
                    disabled={updateMutation.isPending}
                    className="h-9 rounded-md bg-[#12335f] px-4 text-xs font-black uppercase tracking-wide text-white hover:bg-[#0b2445]"
                >
                    {updateMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                    Save
                </Button>
            </div>
        </div>
    );
}

export default function AdminMarketplaceHomeSectionsPage() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ['admin-marketplace-home-sections'],
        queryFn: marketplaceApi.getAdminHomeSections,
        staleTime: 60_000,
    });

    const sections = data?.sections || [];

    return (
        <div className="mx-auto max-w-6xl space-y-6 pb-8">
            {/* <div className="flex flex-col gap-3 pb-2 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#12335f]">Marketplace Administration</p>
                    <h1 className="text-2xl font-extrabold uppercase tracking-tight text-slate-950">Home Section Controls</h1>
                    <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">Configure the official discovery blocks shown on the JsgSmile MSME marketplace homepage.</p>
                </div>
             
            </div> */}

            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                            <SlidersHorizontal className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">Official procurement discovery layout</h2>
                            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-600">Sections remain data-driven: disabled sections disappear, order controls the homepage sequence, and item limit caps each carousel.</p>
                        </div>
                    </div>

                    <Link href="/marketplace/products" className="shrink-0">
                        <Button variant="outline" className="h-9 w-full rounded-md bg-white px-4 text-xs font-black uppercase tracking-wide shadow-sm hover:bg-slate-50 sm:w-auto">
                            Preview Marketplace
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                        </Button>
                    </Link>
                </div>
            </div>

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((item) => (
                        <div key={item} className="h-[280px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="h-4 w-1/2 rounded bg-slate-100" />
                            <div className="mt-6 space-y-4">
                                <div className="h-10 w-full rounded bg-slate-50" />
                                <div className="h-10 w-full rounded bg-slate-50" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : isError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">Unable to load marketplace home sections.</div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {sections.map((section, idx) => (
                        <SectionControlRow key={section.key} section={section} index={idx} />
                    ))}
                </div>
            )}
        </div>
    );
}
