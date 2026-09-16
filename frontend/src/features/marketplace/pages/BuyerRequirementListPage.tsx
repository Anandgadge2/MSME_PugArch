'use client';
import React from 'react';
import { MarketplaceFooter } from '../components/MarketplaceFooter';
import { BuyerRequirementsList } from '../components/BuyerRequirementsList';

export default function BuyerRequirementListPage() {
    return (
        <div className="flex min-h-dvh flex-col bg-[#f8fafc]">
            <main className="mx-auto w-full max-w-[1680px] flex-1 px-4 py-4 sm:px-6 2xl:px-8">
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
