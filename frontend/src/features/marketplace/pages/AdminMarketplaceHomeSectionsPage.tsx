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

function SectionControlRow({ section }: { section: MarketplaceHomeSectionConfig }) {
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

    return (
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1.3fr_0.8fr_0.5fr_0.5fr_auto] lg:items-end">
            <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Section title</span>
                <input
                    value={draft.title}
                    onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#12335f]/20"
                />
            </label>

            <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rule</span>
                <select
                    value={draft.ruleType}
                    onChange={(event) => setDraft((current) => ({ ...current, ruleType: event.target.value }))}
                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#12335f]/20"
                >
                    {ruleOptions.map((rule) => (
                        <option key={rule} value={rule}>{readableRule(rule)}</option>
                    ))}
                </select>
            </label>

            <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order</span>
                <input
                    type="number"
                    min={0}
                    max={999}
                    value={draft.displayOrder}
                    onChange={(event) => setDraft((current) => ({ ...current, displayOrder: Number(event.target.value) }))}
                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#12335f]/20"
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
                    className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#12335f]/20"
                />
            </label>

            <div className="flex items-center gap-2 lg:justify-end">
                <label className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700">
                    <input
                        type="checkbox"
                        checked={draft.enabled}
                        onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-[#12335f]"
                    />
                    Enabled
                </label>
                <Button
                    type="button"
                    onClick={() => updateMutation.mutate()}
                    disabled={updateMutation.isPending}
                    className="h-10 rounded-md bg-[#12335f] px-3 text-xs font-black uppercase tracking-wide text-white hover:bg-[#0b2445]"
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
        <div className="mx-auto max-w-6xl space-y-5 pb-8">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#12335f]">Marketplace Administration</p>
                    <h1 className="text-2xl font-extrabold uppercase tracking-tight text-slate-950">Home Section Controls</h1>
                    <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">Configure the official discovery blocks shown on the JsgSmile MSME marketplace homepage.</p>
                </div>
                <Link href="/marketplace/products">
                    <Button variant="outline" className="h-10 rounded-md px-4 text-xs font-black uppercase tracking-wide">
                        Preview Marketplace
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                </Link>
            </div>

            <Card className="rounded-lg border-slate-200 bg-white shadow-sm">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-[#12335f]">
                            <SlidersHorizontal className="h-5 w-5" />
                        </span>
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">Official procurement discovery layout</h2>
                            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">Sections remain data-driven: disabled sections disappear, order controls the homepage sequence, and item limit caps each carousel.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                        <div key={item} className="h-24 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="h-4 w-60 rounded bg-slate-100" />
                            <div className="mt-3 h-3 w-96 rounded bg-slate-100" />
                        </div>
                    ))}
                </div>
            ) : isError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">Unable to load marketplace home sections.</div>
            ) : (
                <div className="space-y-3">
                    {sections.map((section) => (
                        <SectionControlRow key={section.key} section={section} />
                    ))}
                </div>
            )}
        </div>
    );
}
