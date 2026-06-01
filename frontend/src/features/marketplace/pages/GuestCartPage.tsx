'use client';
import React, { useMemo } from 'react';
import Link from 'next/link';
import { FileText, LockKeyhole, ShoppingCart, Trash2, Plus, Minus } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { marketplaceApi } from '../api';
import { MarketplaceHeader } from '../components/MarketplaceHeader';
import { MarketplaceFooter } from '../components/MarketplaceFooter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function GuestCartPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Share the exact same query cache key with MarketplaceHeader so counts badge updates in real-time
    const { data: cart, isLoading } = useQuery<any>({
        queryKey: ['guestCart'],
        queryFn: marketplaceApi.getGuestCart,
    });

    const totals = useMemo(() => {
        const items = cart?.items || [];
        return items.reduce((sum: number, item: any) => sum + Number(item.priceSnapshot || 0) * Number(item.quantity || 1), 0);
    }, [cart]);

    const handleUpdateQuantity = async (productId: number | undefined, serviceId: number | undefined, currentQty: number, change: number) => {
        const newQty = currentQty + change;
        if (newQty < 1) return;

        const previousCart = queryClient.getQueryData(['guestCart']);

        // Optimistic cache update for a 100% instant, lag-free UI response
        queryClient.setQueryData(['guestCart'], (prev: any) => {
            if (!prev) return prev;
            const updatedItems = prev.items.map((it: any) => {
                const matchProduct = productId && it.productId === productId;
                const matchService = serviceId && it.serviceId === serviceId;
                if (matchProduct || matchService) {
                    return { ...it, quantity: newQty };
                }
                return it;
            });
            return { ...prev, items: updatedItems };
        });

        try {
            const res = await marketplaceApi.updateGuestCartItem({
                productId,
                serviceId,
                quantity: newQty
            });
            queryClient.setQueryData(['guestCart'], res.cart);
        } catch (err) {
            console.error('Failed to update guest cart item quantity:', err);
            queryClient.setQueryData(['guestCart'], previousCart);
            toast.error('Failed to update quantity.');
        }
    };

    const handleDeleteItem = async (productId: number | undefined, serviceId: number | undefined) => {
        const previousCart = queryClient.getQueryData(['guestCart']);

        // Optimistic item removal
        queryClient.setQueryData(['guestCart'], (prev: any) => {
            if (!prev) return prev;
            const updatedItems = prev.items.filter((it: any) => {
                const matchProduct = productId && it.productId === productId;
                const matchService = serviceId && it.serviceId === serviceId;
                return !(matchProduct || matchService);
            });
            return { ...prev, items: updatedItems };
        });

        try {
            const res = await marketplaceApi.updateGuestCartItem({
                productId,
                serviceId,
                quantity: 0
            });
            queryClient.setQueryData(['guestCart'], res.cart);
            toast.success('Item removed from cart.');
        } catch (err) {
            console.error('Failed to delete guest cart item:', err);
            queryClient.setQueryData(['guestCart'], previousCart);
            toast.error('Failed to remove item.');
        }
    };

    return (
        <div className="flex min-h-dvh flex-col bg-white">
            <div className="brand-tricolor-strip w-full" />
            <MarketplaceHeader user={user} />
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a6a2f]">Procurement Cart</p>
                        <h1 className="mt-1 text-2xl font-black text-[#0b2447]">Cart</h1>
                        <p className="mt-1 text-sm font-medium text-slate-600">Add products and services freely. Login is required only when you checkout, submit inquiry, or continue procurement.</p>
                    </div>
                    <Link href="/marketplace/products" className="rounded-md border border-[#0b2447] px-4 py-2 text-xs font-black text-[#0b2447] hover:bg-[#0b2447] hover:text-white">Browse Marketplace</Link>
                </div>

                {isLoading && !cart ? (
                    <div className="h-40 animate-pulse rounded-md bg-slate-100" />
                ) : !cart?.items?.length ? (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-10 text-center">
                        <ShoppingCart className="mx-auto h-12 w-12 text-slate-300" />
                        <h2 className="mt-3 text-lg font-black text-slate-900">Cart is empty</h2>
                        <p className="mt-1 text-sm text-slate-500">Browse products or services and add items without signing in.</p>
                    </div>
                ) : (
                    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                        <section className="space-y-3">
                            {cart.items.map((item: any) => {
                                const entity = item.product || item.service;
                                return (
                                    <div key={item.id} className="flex gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm items-center">
                                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-slate-100">
                                            <FileText className="h-6 w-6 text-[#0b2447]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-slate-950">{entity?.name || 'Marketplace Item'}</p>
                                            <p className="mt-1 text-xs font-bold text-slate-400">{item.itemType}</p>
                                            <p className="mt-1 text-xs text-slate-500">{item.sellerOrganization?.organizationName || 'Verified seller'}</p>
                                            
                                            {/* Sleek Plus / Minus Controls */}
                                            <div className="mt-2 flex items-center gap-2">
                                                <button
                                                    onClick={() => handleUpdateQuantity(item.productId, item.serviceId, Number(item.quantity), -1)}
                                                    disabled={Number(item.quantity) <= 1}
                                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-slate-50 transition-colors"
                                                    title="Decrease quantity"
                                                >
                                                    <Minus className="h-3.5 w-3.5" />
                                                </button>
                                                <span className="w-8 text-center text-xs font-black text-slate-800">{Number(item.quantity)}</span>
                                                <button
                                                    onClick={() => handleUpdateQuantity(item.productId, item.serviceId, Number(item.quantity), 1)}
                                                    className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
                                                    title="Increase quantity"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end justify-between self-stretch">
                                            <div className="text-right">
                                                <p className="text-sm font-black text-[#0b2447]">
                                                    {item.priceSnapshot ? `Rs ${Number(item.priceSnapshot * item.quantity).toLocaleString('en-IN')}` : 'Quote Based'}
                                                </p>
                                                {item.priceSnapshot && (
                                                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                                                        Rs {Number(item.priceSnapshot).toLocaleString('en-IN')} each
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleDeleteItem(item.productId, item.serviceId)}
                                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors"
                                                title="Remove item"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </section>
                        <aside className="h-fit rounded-md border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Cart Summary</p>
                            <div className="mt-3 flex justify-between text-sm font-bold"><span>Items</span><span>{cart.items.length}</span></div>
                            <div className="mt-2 flex justify-between text-sm font-bold"><span>Estimated Total</span><span>{totals ? `Rs ${totals.toLocaleString('en-IN')}` : 'Quote Based'}</span></div>
                            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                                <LockKeyhole className="mr-1 inline h-3.5 w-3.5" /> Login is required for checkout, inquiry, request quote, or procurement continuation.
                            </div>
                            <Link href="/login" className="mt-3 flex h-10 items-center justify-center rounded-md bg-[#0b2447] text-xs font-black uppercase tracking-wide text-white hover:bg-[#12335f]">Checkout / Submit Inquiry</Link>
                            <div className="mt-2 grid grid-cols-2 gap-2">
                                <Link href="/buyer/register" className="rounded-md border border-slate-200 bg-white px-2 py-2 text-center text-[11px] font-bold text-slate-700 hover:bg-slate-50">Buyer Signup</Link>
                                <Link href="/buyer/onboarding" className="rounded-md border border-slate-200 bg-white px-2 py-2 text-center text-[11px] font-bold text-slate-700 hover:bg-slate-50">Onboarding</Link>
                            </div>
                        </aside>
                    </div>
                )}
            </main>
            <MarketplaceFooter />
        </div>
    );
}
