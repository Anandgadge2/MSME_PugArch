'use client';
import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { MarketplaceHeader } from '../components/MarketplaceHeader';
import { MarketplaceFooter } from '../components/MarketplaceFooter';
import { BuyerRequirementsList } from '../components/BuyerRequirementsList';

export default function BuyerRequirementListPage() {
    const { user } = useAuth();

    return (
        <div className="flex min-h-dvh flex-col bg-[#f8fafc]">
            <main className="mx-auto w-full max-w-[1680px] flex-1 px-4 py-6 sm:px-6 2xl:px-8">
                {/* ── Page header ── */}
                <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-3">
                        <Link href="/" className="hover:text-[#0b2447] transition-colors">Home</Link>
                        <ChevronRight className="h-3.5 w-3.5" />
                        <span className="font-bold text-slate-800">Public Procurement &amp; Bids</span>
                    </div>
                    <div>
                        <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-800 shadow-2xs">
                            🏛️ Public Procurement Portal
                        </span>
                        <h1 className="text-2xl sm:text-3xl font-black text-[#0b2447] tracking-tight">Latest Buyer Requirements &amp; Bids</h1>
                        <p className="mt-1.5 text-sm text-slate-500 font-medium">
                            Open public procurement opportunities, government e-tenders, and verified buyer requisitions.
                        </p>
                    </div>
                </div>

                <BuyerRequirementsList 
                    buyerOrganizationId="all"
                    showFilters={true}
                    showSearch={true}
                    showTabs={true}
                    showPagination={true}
                />
            </main>

            <MarketplaceFooter />
        </div>
    );
}

