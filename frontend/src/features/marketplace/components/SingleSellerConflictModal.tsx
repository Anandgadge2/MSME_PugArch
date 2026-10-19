'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, ArrowRight, RefreshCw, ShoppingCart, Store, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';

export interface SingleSellerConflictModalProps {
    isOpen: boolean;
    currentSeller?: { id: number; name: string };
    newSeller?: { id: number; name: string };
    pendingItemName?: string;
    cartItemCount?: number;
    isReplacing?: boolean;
    onKeepCurrent: () => void;
    onReplaceCart: () => void;
}

export function SingleSellerConflictModal({
    isOpen,
    currentSeller,
    newSeller,
    pendingItemName = 'this item',
    cartItemCount = 1,
    isReplacing = false,
    onKeepCurrent,
    onReplaceCart,
}: SingleSellerConflictModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            previousFocusRef.current = document.activeElement as HTMLElement;
            // Focus primary cancel action first for defensive accessibility
            const timer = setTimeout(() => {
                cancelButtonRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        } else if (previousFocusRef.current) {
            previousFocusRef.current.focus();
        }
    }, [isOpen]);

    // Handle Escape and Tab Trapping for WCAG 2.1.1 & 2.1.2 Focus Trapping
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onKeepCurrent();
                return;
            }

            if (e.key === 'Tab' && dialogRef.current) {
                const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusableElements.length === 0) return;

                const firstEl = focusableElements[0];
                const lastEl = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === firstEl) {
                        e.preventDefault();
                        lastEl.focus();
                    }
                } else {
                    if (document.activeElement === lastEl) {
                        e.preventDefault();
                        firstEl.focus();
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onKeepCurrent]);

    if (!isOpen) return null;

    const currentName = currentSeller?.name || 'Current Seller';
    const newName = newSeller?.name || 'New Seller';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
            role="presentation"
            onClick={(e) => {
                if (e.target === e.currentTarget && !isReplacing) {
                    onKeepCurrent();
                }
            }}
        >
            <div
                ref={dialogRef}
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="single-seller-conflict-title"
                aria-describedby="single-seller-conflict-desc"
                className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150"
            >
                {/* Header Strip */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-amber-50/70 px-6 py-4">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                            <h2
                                id="single-seller-conflict-title"
                                className="text-base font-extrabold text-slate-900"
                            >
                                Start New Direct Purchase?
                            </h2>
                            <p className="text-xs font-semibold text-amber-800">
                                Single Seller Policy for Offline Payments
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onKeepCurrent}
                        disabled={isReplacing}
                        className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#12335f] transition-colors cursor-pointer"
                        aria-label="Close dialog and keep current cart"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Dialog Body */}
                <div className="px-6 py-5 space-y-4 text-slate-700">
                    <p id="single-seller-conflict-desc" className="text-xs leading-relaxed font-medium">
                        Your direct purchase cart already contains{' '}
                        <strong className="text-slate-900 font-bold">
                            {cartItemCount} item{cartItemCount !== 1 ? 's' : ''}
                        </strong>{' '}
                        from another supplier. Under direct procurement and offline bank transfer (NEFT/RTGS/Cheque) regulations, each order is legally issued to a single verified seller.
                    </p>

                    {/* Conflict Comparison Card */}
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
                                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    Currently in Cart ({cartItemCount} item{cartItemCount !== 1 ? 's' : ''})
                                </span>
                                <p className="text-xs font-extrabold text-slate-900 truncate">
                                    {currentName}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-center py-0.5">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                                <span className="h-px w-12 bg-slate-200" />
                                <span>Replace with</span>
                                <span className="h-px w-12 bg-slate-200" />
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                                <Store className="h-4 w-4" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                    New Item to Add
                                </span>
                                <p className="text-xs font-extrabold text-emerald-950 truncate">
                                    {pendingItemName}
                                </p>
                                <p className="text-[11px] font-semibold text-slate-600 truncate">
                                    Supplied by: <span className="font-bold text-slate-900">{newName}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg bg-blue-50/80 border border-blue-200/70 p-3 text-[11px] leading-snug font-medium text-blue-900">
                        <strong className="font-bold">Why this rule?</strong> Having a single seller per order ensures your official Purchase Order (PO), GST Tax Invoice, and offline bank transaction reference (UTR) remain legally isolated without cross-vendor payment entanglement.
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
                    <Button
                        ref={cancelButtonRef}
                        type="button"
                        variant="outline"
                        onClick={onKeepCurrent}
                        disabled={isReplacing}
                        className="w-full sm:w-auto h-10 px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 border-slate-300 cursor-pointer"
                    >
                        Keep Current Cart
                    </Button>
                    <Button
                        type="button"
                        onClick={onReplaceCart}
                        disabled={isReplacing}
                        className="w-full sm:w-auto h-10 px-4 text-xs font-extrabold bg-[#12335f] text-white hover:bg-[#0c2444] shadow-sm transition-all cursor-pointer"
                    >
                        {isReplacing ? (
                            <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                Replacing Cart...
                            </>
                        ) : (
                            <>
                                Replace Cart & Add Item
                                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
