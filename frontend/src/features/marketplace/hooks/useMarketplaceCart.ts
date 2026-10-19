'use client';

import React, { useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useActiveCart, useAddToCart, useUpdateCartItem, useRemoveCartItem, useClearCart } from '../../cart/hooks';
import { removeCartItem, addItemToCart, fetchActiveCart, clearActiveCart, type CartDto } from '../../cart/api';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useGuestCart } from './useGuestCart';
import { resolveMarketplaceImage } from '../utils/marketplaceImages';
import { marketplaceApi } from '../api';
import { toast } from 'sonner';

export interface UnifiedCartItem {
    id: number; // product.id or service.id
    name: string;
    price?: number;
    unit?: string;
    imageUrl?: string;
    category?: string;
    quantity: number;
    type: 'product' | 'service';
    dbCartItemId?: number; // DB cart item primary key if authenticated
    sellerId?: number;
    sellerName?: string;
}

export interface CartConflictState {
    isOpen: boolean;
    currentSeller?: { id: number; name: string };
    newSeller?: { id: number; name: string };
    pendingItem?: Omit<UnifiedCartItem, 'quantity' | 'dbCartItemId'> & { quantity?: number };
    options?: { source?: string; showToast?: boolean; replaceCart?: boolean };
    cartItemCount?: number;
    isReplacing?: boolean;
}

let _conflictState: CartConflictState = { isOpen: false };
const conflictListeners = new Set<() => void>();

export function getCartConflictState(): CartConflictState {
    return _conflictState;
}

export function setCartConflictState(state: CartConflictState) {
    _conflictState = state;
    conflictListeners.forEach(fn => fn());
}

const DEFAULT_CONFLICT_STATE: CartConflictState = { isOpen: false };

export function useCartConflict(): CartConflictState {
    return React.useSyncExternalStore(
        (listener) => {
            conflictListeners.add(listener);
            return () => { conflictListeners.delete(listener); };
        },
        () => _conflictState,
        () => DEFAULT_CONFLICT_STATE
    );
}

export function useMarketplaceCart() {
    const { user } = useAuth();
    const isBuyer = user?.role === 'buyer';

    // 1. Guest cart hooks
    const guestCart = useGuestCart();

    // 2. Authenticated cart hooks (React Query)
    const activeCartQuery = useActiveCart({ enabled: isBuyer });
    const qc = useQueryClient();
    const addToCartMut = useAddToCart();
    const updateCartItemMut = useUpdateCartItem();
    const removeCartItemMut = useRemoveCartItem();
    const clearCartMut = useClearCart();
    const pendingUpdatesRef = useRef<Map<string, number>>(new Map());
    const debounceUpdateTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

    if (isBuyer) {
        const dbItems = activeCartQuery.data?.items || [];
        const mappedItems: UnifiedCartItem[] = dbItems.map(item => {
            const type = item.productId ? 'product' : 'service';
            const itemId = item.productId || item.serviceId || 0;
            const subItem = type === 'product' ? item.product : item.service;
            
            return {
                id: itemId,
                name: item.itemName,
                price: Number(item.unitPrice),
                unit: item.unitOfMeasure,
                imageUrl: resolveMarketplaceImage(subItem || item, type),
                category: (subItem as any)?.category?.name || (item as any).product?.category?.name || (item as any).service?.category?.name,
                quantity: Number(item.quantity),
                type,
                dbCartItemId: item.id,
                sellerId: item.sellerId,
                sellerName: item.seller?.name
            };
        });

        const count = mappedItems.reduce((sum, item) => sum + item.quantity, 0);

        const getQuantity = (itemId: number, type: 'product' | 'service') => {
            return mappedItems.find(i => Number(i.id) === Number(itemId) && i.type === type)?.quantity || 0;
        };

        const add = (
            item: Omit<UnifiedCartItem, 'quantity' | 'dbCartItemId'> & { quantity?: number },
            options?: { source?: string; showToast?: boolean; replaceCart?: boolean }
        ) => {
            const itemKey = `${item.type}-${item.id}`;
            const targetQty = item.quantity && item.quantity > 0 ? item.quantity : 1;
            addToCartMut.mutate(
                {
                    productId: item.type === 'product' ? item.id : undefined,
                    serviceId: item.type === 'service' ? item.id : undefined,
                    quantity: targetQty,
                    replaceCart: options?.replaceCart,
                    itemName: item.name,
                    unitPrice: item.price,
                    unitOfMeasure: item.unit
                },
                {
                    onSuccess: (createdCart: any) => {
                        api.invalidate('/api/cart');
                        setCartConflictState({ isOpen: false });
                        const pendingQty = pendingUpdatesRef.current.get(itemKey);
                        pendingUpdatesRef.current.delete(itemKey);
                        if (options?.showToast !== false) {
                            if (options?.replaceCart) {
                                toast.success(`Cart updated with ${item.name}`);
                            } else {
                                toast.success(`${item.name} added to cart`);
                            }
                        }
                        if (pendingQty !== undefined) {
                            const dbItem = createdCart?.items?.find((i: any) =>
                                (item.type === 'product' && i.productId === item.id) ||
                                (item.type === 'service' && i.serviceId === item.id)
                            );
                            if (dbItem && dbItem.id > 0) {
                                if (pendingQty <= 0) {
                                    removeCartItemMut.mutate(dbItem.id);
                                } else if (pendingQty !== Number(dbItem.quantity)) {
                                    updateCartItemMut.mutate({ id: dbItem.id, quantity: pendingQty });
                                }
                            }
                        }
                    },
                    onError: (err: any) => {
                        pendingUpdatesRef.current.delete(itemKey);
                        const isConflict = err?.code === 'DIFFERENT_SELLER_CONFLICT' || err?.body?.code === 'DIFFERENT_SELLER_CONFLICT';
                        if (isConflict) {
                            const conflictData = err?.body?.data || err?.body || {};
                            setCartConflictState({
                                isOpen: true,
                                currentSeller: conflictData.currentSeller,
                                newSeller: conflictData.newSeller,
                                pendingItem: item,
                                options,
                                cartItemCount: conflictData.cartItemCount || mappedItems.length || 1,
                                isReplacing: false
                            });
                            return;
                        }
                        toast.error(err?.message || `Failed to add ${item.name} to cart`);
                    }
                }
            );

            // Track interactions
            marketplaceApi.trackInteraction({
                itemId: item.id,
                itemType: item.type === 'service' ? 'SERVICE' : 'PRODUCT',
                action: 'ADD_TO_CART',
                metadata: { source: options?.source || 'marketplace' }
            }).catch(() => undefined);
        };

        const update = (itemId: number, type: 'product' | 'service', qty: number) => {
            const mappedItem = mappedItems.find(i => Number(i.id) === Number(itemId) && i.type === type);
            if (!mappedItem) return;

            const itemKey = `${type}-${itemId}`;

            // Cancel any pending debounced mutation for this item
            const existingTimer = debounceUpdateTimerRef.current.get(itemKey);
            if (existingTimer) {
                clearTimeout(existingTimer);
                debounceUpdateTimerRef.current.delete(itemKey);
            }

            if (qty <= 0) {
                remove(itemId, type);
                return;
            }

            if (mappedItem.dbCartItemId) {
                // Optimistically update React Query cache immediately so UI reflects the new quantity instantly
                qc.setQueryData<CartDto>(['cart', 'active'], (old) => {
                    if (!old) return old;
                    return {
                        ...old,
                        items: old.items.map(i => {
                            const isTarget = (type === 'product' && i.productId === itemId) ||
                                             (type === 'service' && i.serviceId === itemId) ||
                                             i.id === mappedItem.dbCartItemId;
                            return isTarget ? { ...i, quantity: qty } : i;
                        })
                    };
                });

                if (mappedItem.dbCartItemId < 0) {
                    // Item is optimistic (add request in flight).
                    pendingUpdatesRef.current.set(itemKey, qty);
                    return;
                }

                // Debounce the backend network call by 300ms
                const timer = setTimeout(() => {
                    debounceUpdateTimerRef.current.delete(itemKey);
                    updateCartItemMut.mutate(
                        { id: mappedItem.dbCartItemId!, quantity: qty },
                        {
                            onSuccess: () => {
                                api.invalidate('/api/cart');
                            },
                            onError: (err: any) => {
                                toast.error(err?.message || 'Failed to update quantity');
                            }
                        }
                    );
                }, 300);
                debounceUpdateTimerRef.current.set(itemKey, timer);
            }
        };

        const remove = (itemId: number, type: 'product' | 'service') => {
            const mappedItem = mappedItems.find(i => Number(i.id) === Number(itemId) && i.type === type);
            const itemKey = `${type}-${itemId}`;

            const existingTimer = debounceUpdateTimerRef.current.get(itemKey);
            if (existingTimer) {
                clearTimeout(existingTimer);
                debounceUpdateTimerRef.current.delete(itemKey);
            }
            if (mappedItem?.dbCartItemId) {
                if (mappedItem.dbCartItemId < 0) {
                    pendingUpdatesRef.current.set(itemKey, 0);
                    qc.setQueryData<CartDto>(['cart', 'active'], (old) => {
                        if (!old) return old;
                        return {
                            ...old,
                            items: old.items.filter(i => {
                                const isTarget = (type === 'product' && i.productId === itemId) ||
                                                 (type === 'service' && i.serviceId === itemId) ||
                                                 i.id === mappedItem.dbCartItemId;
                                return !isTarget;
                            })
                        };
                    });
                    return;
                }
                removeCartItemMut.mutate(mappedItem.dbCartItemId, {
                    onSuccess: () => {
                        api.invalidate('/api/cart');
                        toast.info(`${mappedItem.name} removed from cart`);
                    },
                    onError: (err: any) => {
                        toast.error(err?.message || 'Failed to remove item');
                    }
                });
            }
        };

        const resolveConflict = (action: 'keep' | 'replace') => {
            if (action === 'keep') {
                setCartConflictState({ isOpen: false });
                return;
            }
            if (!_conflictState.pendingItem) {
                setCartConflictState({ isOpen: false });
                return;
            }
            const itemToReplace = _conflictState.pendingItem;
            const itemOptions = _conflictState.options;
            setCartConflictState({ ..._conflictState, isReplacing: true });
            add(itemToReplace, { ...itemOptions, replaceCart: true, showToast: true });
        };

        const clear = () => {
            clearCartMut.mutate(undefined, {
                onSuccess: () => {
                    api.invalidate('/api/cart');
                    toast.info('Cart cleared');
                },
                onError: () => {
                    toast.error('Failed to clear cart');
                }
            });
        };

        const buyNow = async (
            item: Omit<UnifiedCartItem, 'quantity' | 'dbCartItemId'>,
            options?: { source?: string; showToast?: boolean }
        ) => {
            await qc.cancelQueries({ queryKey: ['cart'] });

            let finalCart: CartDto;
            try {
                // In Direct Purchase, buy now atomically replaces cart with target item for instant single-seller checkout
                finalCart = await addItemToCart({
                    productId: item.type === 'product' ? item.id : undefined,
                    serviceId: item.type === 'service' ? item.id : undefined,
                    quantity: 1,
                    replaceCart: true
                });
            } catch (err: any) {
                console.error('Failed in buyNow', err);
                finalCart = await fetchActiveCart();
            }

            // Directly update the query cache with the final cart returned from the server (which has real positive IDs)
            qc.setQueryData(['cart', 'active'], finalCart);
            await qc.invalidateQueries({ queryKey: ['cart'] });

            // Clear the custom API fetch cache so that page navigation doesn't fetch stale cached data
            api.invalidate('/api/cart');

            marketplaceApi.trackInteraction({
                itemId: item.id,
                itemType: item.type === 'service' ? 'SERVICE' : 'PRODUCT',
                action: 'ADD_TO_CART',
                metadata: { source: options?.source || 'marketplace-buy-now', buyNow: true },
            }).catch(() => undefined);

            if (options?.showToast !== false) {
                toast.success(`${item.name} ready for checkout`);
            }
        };

        const currentSeller = mappedItems[0]?.sellerId ? {
            id: mappedItems[0].sellerId,
            name: mappedItems[0].sellerName || `Seller #${mappedItems[0].sellerId}`
        } : undefined;

        return {
            items: mappedItems,
            count,
            getQuantity,
            add,
            update,
            remove,
            clear,
            buyNow,
            resolveConflict,
            currentSeller,
            isLoading: activeCartQuery.isLoading
        };
    }

    // Guest cart mapping
    const mappedGuestItems: UnifiedCartItem[] = guestCart.items.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        unit: item.unit,
        imageUrl: item.imageUrl,
        category: item.category,
        quantity: item.quantity,
        type: item.type
    }));

    const getQuantity = (itemId: number, type: 'product' | 'service') => {
        return guestCart.items.find(i => Number(i.id) === Number(itemId) && i.type === type)?.quantity || 0;
    };

    const guestAdd = (
        item: Omit<UnifiedCartItem, 'quantity' | 'dbCartItemId'> & { quantity?: number },
        options?: { source?: string; showToast?: boolean }
    ) => {
        guestCart.add({
            id: item.id,
            name: item.name,
            price: item.price,
            unit: item.unit,
            imageUrl: item.imageUrl,
            category: item.category,
            type: item.type,
            quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
        });

        if (options?.showToast !== false) {
            toast.success(`${item.name} added to cart`);
        }

        // Track interactions
        marketplaceApi.trackInteraction({
            itemId: item.id,
            itemType: item.type === 'service' ? 'SERVICE' : 'PRODUCT',
            action: 'ADD_TO_CART',
            metadata: { source: options?.source || 'marketplace' }
        }).catch(() => undefined);
    };

    const guestUpdate = (itemId: number, type: 'product' | 'service', qty: number) => {
        const item = guestCart.items.find(i => i.id === itemId && i.type === type);
        if (!item) return;

        guestCart.update(itemId, type, qty);

        if (qty <= 0) {
            toast.info(`${item.name} removed from cart`);
        }
    };

    const guestRemove = (itemId: number, type: 'product' | 'service') => {
        const item = guestCart.items.find(i => i.id === itemId && i.type === type);
        if (item) {
            guestCart.remove(itemId, type);
            toast.info(`${item.name} removed from cart`);
        }
    };

    const guestBuyNow = async (
        item: Omit<UnifiedCartItem, 'quantity' | 'dbCartItemId'>,
        options?: { source?: string; showToast?: boolean }
    ) => {
        guestCart.clear();
        guestCart.add({
            id: item.id,
            name: item.name,
            price: item.price,
            unit: item.unit,
            imageUrl: item.imageUrl,
            category: item.category,
            type: item.type,
        });

        marketplaceApi.trackInteraction({
            itemId: item.id,
            itemType: item.type === 'service' ? 'SERVICE' : 'PRODUCT',
            action: 'ADD_TO_CART',
            metadata: { source: options?.source || 'marketplace-buy-now', buyNow: true },
        }).catch(() => undefined);

        if (options?.showToast !== false) {
            toast.success(`${item.name} ready for checkout`);
        }
    };

    return {
        items: mappedGuestItems,
        count: guestCart.count,
        getQuantity,
        add: guestAdd,
        update: guestUpdate,
        remove: guestRemove,
        clear: guestCart.clear,
        buyNow: guestBuyNow,
        resolveConflict: () => {},
        currentSeller: undefined,
        isLoading: false
    };
}
