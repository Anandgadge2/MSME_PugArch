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
        <div className="flex min-h-dvh flex-col bg-[#f1f3f6]">
            <div className="brand-tricolor-strip w-full" />
            <MarketplaceHeader user={user} />

            <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
                {/* ── Page header ── */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-2">
                        <Link href="/" className="hover:text-[#0b2447]">Home</Link>
                        <ChevronRight className="h-3 w-3" />
                        <span className="font-semibold text-slate-700">Buyer Requirements &amp; Bids</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[#0b2447]">Latest Buyer Requirements &amp; Bids</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Open procurement requirements from verified buyers. Public can view — sellers can respond.
                    </p>
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

