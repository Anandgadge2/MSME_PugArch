'use client';
/**
 * useGuestCart — lightweight in-memory cart for unauthenticated marketplace visitors.
 *
 * Stored in localStorage so it survives page refreshes.
 * Uses useSyncExternalStore with server snapshot to avoid Next.js hydration mismatches.
 * On login, the items can be transferred to the real org cart.
 */
import { useSyncExternalStore, useCallback } from 'react';

export interface GuestCartItem {
    id: number;          // product.id
    name: string;
    price?: number;
    unit?: string;
    imageUrl?: string;
    category?: string;
    quantity: number;
    type: 'product' | 'service';
}

const STORAGE_KEY = 'jsg_guest_cart';
const EMPTY_ITEMS: GuestCartItem[] = [];

function loadCart(): GuestCartItem[] {
    if (typeof window === 'undefined') return EMPTY_ITEMS;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return EMPTY_ITEMS;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : EMPTY_ITEMS;
    } catch {
        return EMPTY_ITEMS;
    }
}

function saveCart(items: GuestCartItem[]) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
        /* ignore */
    }
}

// Module-level listeners so all hook instances stay in sync
type Listener = () => void;
const listeners = new Set<Listener>();
let _items: GuestCartItem[] = EMPTY_ITEMS;
let _initialized = false;

function ensureLoaded(): GuestCartItem[] {
    if (!_initialized && typeof window !== 'undefined') {
        _items = loadCart();
        _initialized = true;
    }
    return _items;
}

function broadcast(items: GuestCartItem[]) {
    _items = items;
    _initialized = true;
    saveCart(items);
    listeners.forEach(fn => fn());
}

export function addGuestItem(item: Omit<GuestCartItem, 'quantity'>) {
    const current = ensureLoaded();
    const existing = current.findIndex(i => i.id === item.id && i.type === item.type);
    if (existing >= 0) {
        const next = current.map((i, idx) => idx === existing ? { ...i, quantity: i.quantity + 1 } : i);
        broadcast(next);
    } else {
        broadcast([...current, { ...item, quantity: 1 }]);
    }
}

export function removeGuestItem(id: number, type: 'product' | 'service') {
    const current = ensureLoaded();
    broadcast(current.filter(i => !(i.id === id && i.type === type)));
}

export function updateGuestItemQty(id: number, type: 'product' | 'service', quantity: number) {
    if (quantity <= 0) {
        removeGuestItem(id, type);
        return;
    }
    const current = ensureLoaded();
    broadcast(current.map(i => i.id === id && i.type === type ? { ...i, quantity } : i));
}

export function clearGuestCart() {
    broadcast(EMPTY_ITEMS);
}

export function getGuestCartCount(): number {
    const current = ensureLoaded();
    return current.reduce((sum, i) => sum + i.quantity, 0);
}

function subscribe(callback: () => void) {
    listeners.add(callback);
    const handleStorage = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) {
            _items = loadCart();
            _initialized = true;
            callback();
        }
    };
    if (typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorage);
    }
    return () => {
        listeners.delete(callback);
        if (typeof window !== 'undefined') {
            window.removeEventListener('storage', handleStorage);
        }
    };
}

function getSnapshot(): GuestCartItem[] {
    return ensureLoaded();
}

function getServerSnapshot(): GuestCartItem[] {
    return EMPTY_ITEMS;
}

export function useGuestCart() {
    const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const add = useCallback((item: Omit<GuestCartItem, 'quantity'>) => addGuestItem(item), []);
    const remove = useCallback((id: number, type: 'product' | 'service') => removeGuestItem(id, type), []);
    const update = useCallback((id: number, type: 'product' | 'service', qty: number) => updateGuestItemQty(id, type, qty), []);
    const clear = useCallback(() => clearGuestCart(), []);
    const count = items.reduce((s, i) => s + i.quantity, 0);

    return { items, count, add, remove, update, clear };
}
