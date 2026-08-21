'use client';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

export type CompareItemRef = { type: 'product' | 'service'; id: number; categoryId?: number | null };

const key = 'jsg_marketplace_compare';
const EMPTY_ITEMS: CompareItemRef[] = [];

const readStored = (): CompareItemRef[] => {
  if (typeof window === 'undefined') return EMPTY_ITEMS;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY_ITEMS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 4) : EMPTY_ITEMS;
  } catch {
    return EMPTY_ITEMS;
  }
};

let _compareItems: CompareItemRef[] = EMPTY_ITEMS;
let _compareInitialized = false;
type Listener = () => void;
const compareListeners = new Set<Listener>();

const ensureLoaded = (): CompareItemRef[] => {
  if (!_compareInitialized && typeof window !== 'undefined') {
    _compareItems = readStored();
    _compareInitialized = true;
  }
  return _compareItems;
};

const broadcast = (next: CompareItemRef[]) => {
  _compareItems = next;
  _compareInitialized = true;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch { /* ignore */ }
    window.dispatchEvent(new Event('marketplace:compare-updated'));
  }
  compareListeners.forEach(fn => fn());
};

const subscribe = (callback: () => void) => {
  compareListeners.add(callback);
  const sync = () => {
    _compareItems = readStored();
    _compareInitialized = true;
    callback();
  };
  const handleStorage = (e: StorageEvent) => {
    if (e.key === key) {
      sync();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('marketplace:compare-updated', sync);
    window.addEventListener('storage', handleStorage);
  }
  return () => {
    compareListeners.delete(callback);
    if (typeof window !== 'undefined') {
      window.removeEventListener('marketplace:compare-updated', sync);
      window.removeEventListener('storage', handleStorage);
    }
  };
};

const getClientSnapshot = (): CompareItemRef[] => ensureLoaded();
const getServerSnapshot = (): CompareItemRef[] => EMPTY_ITEMS;

export const useCompare = () => {
  const items = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  const ids = useMemo(() => items.map(item => `${item.type}:${item.id}`), [items]);
  const has = useCallback((type: CompareItemRef['type'], id: number) => items.some(item => item.type === type && item.id === id), [items]);

  const commit = useCallback((next: CompareItemRef[]) => {
    const limited = next.slice(0, 4);
    broadcast(limited);
  }, []);

  const add = useCallback((item: CompareItemRef) => {
    const current = ensureLoaded();
    if (current.some(existing => existing.type === item.type && existing.id === item.id)) {
      return;
    }
    if (current.length >= 4) {
      return;
    }
    commit([...current, item]);
  }, [commit]);

  const remove = useCallback((type: CompareItemRef['type'], id: number) => {
    const next = ensureLoaded().filter(item => item.type !== type || item.id !== id);
    commit(next);
  }, [commit]);

  const toggle = useCallback((item: CompareItemRef) => {
    const current = ensureLoaded();
    if (current.some(existing => existing.type === item.type && existing.id === item.id)) remove(item.type, item.id);
    else add(item);
  }, [add, remove]);

  const clear = useCallback(() => {
    commit(EMPTY_ITEMS);
  }, [commit]);

  return { items, ids, has, add, remove, toggle, clear, limit: 4 };
};
