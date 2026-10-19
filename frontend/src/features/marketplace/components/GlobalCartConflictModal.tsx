'use client';

import React from 'react';
import { useCartConflict, useMarketplaceCart } from '../hooks/useMarketplaceCart';
import { SingleSellerConflictModal } from './SingleSellerConflictModal';

export function GlobalCartConflictModal() {
    const conflictState = useCartConflict();
    const { resolveConflict } = useMarketplaceCart();

    if (!conflictState.isOpen) return null;

    return (
        <SingleSellerConflictModal
            isOpen={conflictState.isOpen}
            currentSeller={conflictState.currentSeller}
            newSeller={conflictState.newSeller}
            pendingItemName={conflictState.pendingItem?.name}
            cartItemCount={conflictState.cartItemCount}
            isReplacing={conflictState.isReplacing}
            onKeepCurrent={() => resolveConflict('keep')}
            onReplaceCart={() => resolveConflict('replace')}
        />
    );
}
