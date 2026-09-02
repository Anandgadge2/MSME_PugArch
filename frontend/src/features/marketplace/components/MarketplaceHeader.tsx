'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMarketplaceCart } from '../hooks/useMarketplaceCart';
import {
    Search, User, LogIn, Store, Building2, ChevronDown,
    Menu, X, ArrowRight, ShieldCheck, Layers, Briefcase, FileText, ShoppingBag,
    Wrench, Clock, Sparkles, Loader2, Tag, ChevronRight, Package
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { marketplaceApi, type MarketplaceSearchResult } from '../api';
import { resolveMediaUrl } from '../../../lib/api';
import { resolveMarketplaceImage } from '../utils/marketplaceImages';

interface Props { user?: any; }

const POPULAR_SEARCH_CHIPS = [
    'Electric Motors',
    'Safety Equipment',
    'Industrial Valves',
    'Welding Electrodes',
    'Machining Services',
    'Bearings',
    'Pipes & Fittings'
];

const signupOptions = [
    { href: '/seller/register', label: 'Sign Up as Seller', desc: 'List products & reach enterprise buyers', icon: <Store className="h-4 w-4" /> },
    { href: '/buyer/register', label: 'Sign Up as Buyer', desc: 'Procure verified products & post RFQs', icon: <Building2 className="h-4 w-4" /> },
    { href: '/hershg/register', label: 'Sign Up as SHG', desc: 'Empower local women artisans & groups', icon: <User className="h-4 w-4" /> }
];

function HighlightMatch({ text, query }: { text: string; query: string }) {
    if (!query.trim() || !text) return <span>{text}</span>;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <strong key={i} className="font-extrabold text-[#0b2447] underline decoration-blue-300 underline-offset-2 bg-blue-50/80 px-0.5 rounded">
                        {part}
                    </strong>
                ) : (
                    part
                )
            )}
        </span>
    );
}

function SignupMenu({ onSelect }: { onSelect: () => void }) {
    return (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150" role="menu">
            <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Account Type</p>
            </div>
            {signupOptions.map(option => (
                <Link
                    key={option.href}
                    href={option.href}
                    onClick={onSelect}
                    className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 active:scale-98"
                    role="menuitem"
                >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0b2447]/10 text-[#0b2447] transition-colors group-hover:bg-[#0b2447] group-hover:text-white">
                        {option.icon}
                    </span>
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 group-hover:text-[#0b2447]">{option.label}</p>
                        <p className="text-[10px] text-slate-500 truncate">{option.desc}</p>
                    </div>
                </Link>
            ))}
        </div>
    );
}

export function MarketplaceHeader({ user }: Props) {
    const router = useRouter();
    const pathname = usePathname() || '';
    const searchParams = useSearchParams();
    const { count: cartCount } = useMarketplaceCart();

    const [searchQ, setSearchQ] = useState('');
    const [showSignup, setShowSignup] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    // Live search states
    const [isInputFocused, setIsInputFocused] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [suggestions, setSuggestions] = useState<MarketplaceSearchResult>({ products: [], services: [], sellers: [], categories: [] });
    const [activeTab, setActiveTab] = useState<'all' | 'products' | 'services' | 'sellers' | 'categories'>('all');
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

    const searchContainerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const signupRef = useRef<HTMLDivElement>(null);

    // Initial mount & load recent searches
    useEffect(() => {
        setMounted(true);
        try {
            const stored = localStorage.getItem('jsg_recent_searches');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) setRecentSearches(parsed.slice(0, 6));
            }
        } catch {
            // ignore localStorage parsing error
        }
    }, []);

    // Sync input with URL search param
    useEffect(() => {
        setSearchQ(searchParams?.get('q') || '');
    }, [searchParams]);

    // Save recent search helper
    const saveRecentSearch = useCallback((query: string) => {
        const trimmed = query.trim();
        if (!trimmed || trimmed.length < 2) return;
        setRecentSearches(prev => {
            const next = [trimmed, ...prev.filter(item => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6);
            try {
                localStorage.setItem('jsg_recent_searches', JSON.stringify(next));
            } catch {
                // ignore localStorage write errors
            }
            return next;
        });
    }, []);

    const removeRecentSearch = useCallback((itemToRemove: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setRecentSearches(prev => {
            const next = prev.filter(item => item !== itemToRemove);
            try {
                localStorage.setItem('jsg_recent_searches', JSON.stringify(next));
            } catch {
                // ignore
            }
            return next;
        });
    }, []);

    const clearAllRecentSearches = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setRecentSearches([]);
        try {
            localStorage.removeItem('jsg_recent_searches');
        } catch {
            // ignore
        }
    }, []);

    // Debounced search autocomplete fetcher
    useEffect(() => {
        const trimmed = searchQ.trim();
        if (trimmed.length < 2) {
            setSuggestions({ products: [], services: [], sellers: [], categories: [] });
            setIsSearching(false);
            setHighlightedIndex(-1);
            return;
        }

        setIsSearching(true);
        const timer = setTimeout(async () => {
            try {
                const data = await marketplaceApi.search(trimmed);
                setSuggestions({
                    products: data?.products || [],
                    services: data?.services || [],
                    sellers: data?.sellers || [],
                    categories: data?.categories || []
                });
            } catch (err) {
                console.error('[Search Suggestions Error]', err);
                setSuggestions({ products: [], services: [], sellers: [], categories: [] });
            } finally {
                setIsSearching(false);
            }
        }, 220);

        return () => clearTimeout(timer);
    }, [searchQ]);

    /* Close dropdowns on outside click */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (signupRef.current && !signupRef.current.contains(e.target as Node)) {
                setShowSignup(false);
            }
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
                setIsInputFocused(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    /* Prevent body scrolling when mobile drawer is open */
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [mobileMenuOpen]);

    const executeSearch = useCallback((query: string, targetType?: 'products' | 'services' | 'sellers') => {
        const trimmed = query.trim();
        if (trimmed) {
            saveRecentSearch(trimmed);
        }

        setIsInputFocused(false);
        setMobileMenuOpen(false);

        // Determine destination path based on targetType or current route
        let dest = '/marketplace/products';
        if (targetType === 'services' || (!targetType && pathname.includes('/services'))) {
            dest = '/marketplace/services';
        } else if (targetType === 'sellers') {
            dest = '/marketplace/sellers';
        }

        if (trimmed) {
            router.push(`${dest}?q=${encodeURIComponent(trimmed)}`);
        } else {
            router.push(dest);
        }
    }, [pathname, router, saveRecentSearch]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        executeSearch(searchQ);
    };

    const handleClearSearch = () => {
        setSearchQ('');
        setSuggestions({ products: [], services: [], sellers: [], categories: [] });
        inputRef.current?.focus();

        if (pathname === '/marketplace/products' || pathname === '/marketplace/services') {
            const params = new URLSearchParams(searchParams?.toString() || '');
            params.delete('q');
            params.set('page', '1');
            const qs = params.toString();
            router.push(qs ? `${pathname}?${qs}` : pathname);
        }
    };

    const totalSuggestions = useMemo(() => {
        return suggestions.products.length + suggestions.services.length + suggestions.sellers.length + suggestions.categories.length;
    }, [suggestions]);

    // Flat list of selectable items for keyboard navigation
    const flatItems = useMemo(() => {
        const items: Array<{ id: string; type: 'product' | 'service' | 'seller' | 'category' | 'recent' | 'view_all'; label: string; url?: string; action?: () => void }> = [];

        if (searchQ.trim().length < 2) {
            recentSearches.forEach(recent => {
                items.push({
                    id: `recent-${recent}`,
                    type: 'recent',
                    label: recent,
                    action: () => {
                        setSearchQ(recent);
                        executeSearch(recent);
                    }
                });
            });
            return items;
        }

        // Add Categories
        if (activeTab === 'all' || activeTab === 'categories') {
            suggestions.categories.forEach(c => {
                items.push({
                    id: `cat-${c.id}`,
                    type: 'category',
                    label: c.name,
                    url: c.type === 'SERVICE' ? `/marketplace/services?categoryId=${c.id}` : `/marketplace/products?categoryId=${c.id}`
                });
            });
        }

        // Add Products
        if (activeTab === 'all' || activeTab === 'products') {
            suggestions.products.forEach(p => {
                items.push({
                    id: `prod-${p.id}`,
                    type: 'product',
                    label: p.name,
                    url: `/marketplace/products/${p.id}`
                });
            });
        }

        // Add Services
        if (activeTab === 'all' || activeTab === 'services') {
            suggestions.services.forEach(s => {
                items.push({
                    id: `serv-${s.id}`,
                    type: 'service',
                    label: s.name,
                    url: `/marketplace/services/${s.id}`
                });
            });
        }

        // Add Sellers
        if (activeTab === 'all' || activeTab === 'sellers') {
            suggestions.sellers.forEach(s => {
                items.push({
                    id: `sell-${s.id}`,
                    type: 'seller',
                    label: s.organizationName,
                    url: `/marketplace/sellers/${s.id}`
                });
            });
        }

        // View All item
        items.push({
            id: 'view-all',
            type: 'view_all',
            label: `View all results for "${searchQ.trim()}"`,
            action: () => executeSearch(searchQ)
        });

        return items;
    }, [searchQ, suggestions, activeTab, recentSearches, executeSearch]);

    // Keyboard navigation handler
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isInputFocused) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev < flatItems.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : flatItems.length - 1));
        } else if (e.key === 'Enter') {
            if (highlightedIndex >= 0 && flatItems[highlightedIndex]) {
                e.preventDefault();
                const selected = flatItems[highlightedIndex];
                if (selected.action) {
                    selected.action();
                } else if (selected.url) {
                    saveRecentSearch(searchQ);
                    setIsInputFocused(false);
                    router.push(selected.url);
                }
            } else {
                handleSearch(e);
            }
        } else if (e.key === 'Escape') {
            setIsInputFocused(false);
        }
    };

    const isDropdownOpen = isInputFocused && mounted;

    return (
        <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(15,23,42,0.05)]">
            {/* Screen Reader Status Live Region for Accessibility */}
            <div role="status" aria-live="polite" className="sr-only">
                {isSearching
                    ? 'Searching marketplace...'
                    : totalSuggestions > 0
                    ? `${totalSuggestions} search results found. Use up and down arrows to review.`
                    : ''}
            </div>

            {/* ════════════════════════════════════════════════════════════════════
                MAIN NAVBAR
            ════════════════════════════════════════════════════════════════════ */}
            <nav className="relative" aria-label="Main navigation">
                <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-3 px-3 sm:px-6 2xl:px-8">

                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:border-[#0b2447]/30 group-hover:shadow-md">
                            <img src="/logoo.png" alt="Jharsuguda SMiLE MSME Marketplace Logo" className="h-full w-full object-contain" />
                        </div>
                        <div className="min-w-0 leading-tight">
                            <p className="truncate text-base font-black tracking-tight text-[#0b2447] transition-colors group-hover:text-blue-900">JsgSMILE</p>
                            <p className="truncate text-[9.5px] font-bold text-slate-400">MSME Marketplace Portal</p>
                        </div>
                    </Link>

                    {/* Search Bar (Desktop - with Live Suggestions & Keyboard Combobox) */}
                    <div ref={searchContainerRef} className="hidden md:block flex-1 max-w-2xl mx-2 lg:mx-6 relative">
                        <form
                            role="search"
                            onSubmit={handleSearch}
                            className={cn(
                                "flex items-center h-10.5 rounded-xl border bg-slate-50/90 transition-all duration-200 shadow-inner overflow-hidden",
                                isInputFocused
                                    ? "bg-white border-[#0b2447] ring-3 ring-[#0b2447]/15 shadow-md"
                                    : "border-slate-200/90 hover:border-slate-300 hover:bg-slate-50"
                            )}
                        >
                            <label htmlFor="header-marketplace-search" className="sr-only">
                                Search verified products, services, sellers, and categories
                            </label>

                            <div className="flex items-center pl-3.5 pr-1 shrink-0 text-slate-400">
                                {isSearching ? (
                                    <Loader2 className="h-4 w-4 text-[#0b2447] animate-spin" aria-hidden="true" />
                                ) : (
                                    <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
                                )}
                            </div>

                            <input
                                ref={inputRef}
                                id="header-marketplace-search"
                                type="text"
                                role="combobox"
                                aria-autocomplete="list"
                                aria-expanded={isDropdownOpen}
                                aria-haspopup="listbox"
                                aria-controls="header-search-results-list"
                                aria-activedescendant={highlightedIndex >= 0 ? `suggestion-opt-${highlightedIndex}` : undefined}
                                value={searchQ}
                                onChange={e => setSearchQ(e.target.value)}
                                onFocus={() => setIsInputFocused(true)}
                                onKeyDown={handleKeyDown}
                                placeholder="Search verified products, services, sellers..."
                                autoComplete="off"
                                spellCheck="false"
                                className="flex-1 min-w-0 h-full bg-transparent text-xs sm:text-sm pl-2 pr-2 outline-none font-medium text-slate-900 placeholder:text-slate-400"
                            />

                            {/* Clear Search button */}
                            {searchQ && (
                                <button
                                    type="button"
                                    onClick={handleClearSearch}
                                    className="h-6 w-6 mr-1.5 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 active:scale-90 transition text-xs font-bold"
                                    title="Clear search"
                                    aria-label="Clear search query"
                                >
                                    ✕
                                </button>
                            )}

                            {/* Search Submit button */}
                            <button
                                type="submit"
                                aria-label="Search"
                                className="h-full px-5 bg-[#0b2447] text-white text-xs font-bold hover:bg-[#12335f] active:scale-95 transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
                            >
                                <span>Search</span>
                            </button>
                        </form>

                        {/* ════════════════════════════════════════════════════════════
                            DESKTOP SEARCH AUTOCOMPLETE DROPDOWN PANEL
                        ════════════════════════════════════════════════════════════ */}
                        {isDropdownOpen && (
                            <div
                                id="header-search-results-list"
                                role="listbox"
                                aria-label="Search suggestions"
                                className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 max-h-[82vh] flex flex-col"
                            >
                                {/* Case 1: Search query is empty or < 2 characters (Recent Searches & Popular Tags) */}
                                {searchQ.trim().length < 2 ? (
                                    <div className="p-4 space-y-4 overflow-y-auto">
                                        {/* Recent Searches Section */}
                                        {recentSearches.length > 0 && (
                                            <div>
                                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                                                    <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                                                        Recent Searches
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={clearAllRecentSearches}
                                                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                                                    >
                                                        Clear history
                                                    </button>
                                                </div>
                                                <div className="space-y-1">
                                                    {recentSearches.map((term, idx) => (
                                                        <div
                                                            key={term}
                                                            role="option"
                                                            id={`suggestion-opt-${idx}`}
                                                            aria-selected={highlightedIndex === idx}
                                                            onClick={() => {
                                                                setSearchQ(term);
                                                                executeSearch(term);
                                                            }}
                                                            className={cn(
                                                                "group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors",
                                                                highlightedIndex === idx
                                                                    ? "bg-blue-50 text-[#0b2447]"
                                                                    : "text-slate-700 hover:bg-slate-50 hover:text-[#0b2447]"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-2.5 truncate">
                                                                <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0 group-hover:text-[#0b2447]" />
                                                                <span className="truncate">{term}</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => removeRecentSearch(term, e)}
                                                                className="h-5 w-5 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                                                                title="Remove search from history"
                                                                aria-label={`Remove ${term} from search history`}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Popular / Recommended Category Chips */}
                                        <div>
                                            <div className="flex items-center gap-1.5 pb-2 mb-2 border-b border-slate-100">
                                                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Popular Categories</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {POPULAR_SEARCH_CHIPS.map(chip => (
                                                    <button
                                                        key={chip}
                                                        type="button"
                                                        onClick={() => {
                                                            setSearchQ(chip);
                                                            executeSearch(chip);
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 bg-slate-50 text-xs font-semibold text-slate-700 hover:border-[#0b2447] hover:bg-blue-50/50 hover:text-[#0b2447] active:scale-95 transition-all shadow-2xs"
                                                    >
                                                        <Search className="h-3 w-3 text-slate-400" />
                                                        <span>{chip}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                                            <span>💡 Type at least 2 characters for live suggestions</span>
                                            <span>Press <strong>Enter</strong> to search</span>
                                        </div>
                                    </div>
                                ) : (
                                    /* Case 2: Query has >= 2 characters -> Live Results & Tabs */
                                    <div className="flex flex-col max-h-[75vh]">
                                        {/* Filter Tabs Header */}
                                        <div className="flex items-center gap-1 p-2 bg-slate-50/90 border-b border-slate-100 shrink-0 overflow-x-auto no-scrollbar">
                                            <button
                                                type="button"
                                                onClick={() => setActiveTab('all')}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0",
                                                    activeTab === 'all'
                                                        ? "bg-[#0b2447] text-white shadow-xs"
                                                        : "text-slate-600 hover:bg-slate-200/60"
                                                )}
                                            >
                                                All Matches ({totalSuggestions})
                                            </button>
                                            {suggestions.products.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTab('products')}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1",
                                                        activeTab === 'products'
                                                            ? "bg-[#0b2447] text-white shadow-xs"
                                                            : "text-slate-600 hover:bg-slate-200/60"
                                                    )}
                                                >
                                                    <ShoppingBag className="h-3 w-3" />
                                                    Products ({suggestions.products.length})
                                                </button>
                                            )}
                                            {suggestions.services.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTab('services')}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1",
                                                        activeTab === 'services'
                                                            ? "bg-[#0b2447] text-white shadow-xs"
                                                            : "text-slate-600 hover:bg-slate-200/60"
                                                    )}
                                                >
                                                    <Wrench className="h-3 w-3" />
                                                    Services ({suggestions.services.length})
                                                </button>
                                            )}
                                            {suggestions.sellers.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTab('sellers')}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1",
                                                        activeTab === 'sellers'
                                                            ? "bg-[#0b2447] text-white shadow-xs"
                                                            : "text-slate-600 hover:bg-slate-200/60"
                                                    )}
                                                >
                                                    <Store className="h-3 w-3" />
                                                    Suppliers ({suggestions.sellers.length})
                                                </button>
                                            )}
                                            {suggestions.categories.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveTab('categories')}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1",
                                                        activeTab === 'categories'
                                                            ? "bg-[#0b2447] text-white shadow-xs"
                                                            : "text-slate-600 hover:bg-slate-200/60"
                                                    )}
                                                >
                                                    <Tag className="h-3 w-3" />
                                                    Categories ({suggestions.categories.length})
                                                </button>
                                            )}
                                        </div>

                                        {/* Scrollable Results List */}
                                        <div className="flex-1 overflow-y-auto p-3 space-y-4 divide-y divide-slate-100">

                                            {/* Categories Match */}
                                            {(activeTab === 'all' || activeTab === 'categories') && suggestions.categories.length > 0 && (
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center gap-1.5 px-2">
                                                        <Tag className="h-3.5 w-3.5 text-blue-600" />
                                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Categories</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                        {suggestions.categories.map((cat) => {
                                                            const itemIndex = flatItems.findIndex(item => item.id === `cat-${cat.id}`);
                                                            const isHighlighted = highlightedIndex === itemIndex;
                                                            const targetUrl = cat.type === 'SERVICE' ? `/marketplace/services?categoryId=${cat.id}` : `/marketplace/products?categoryId=${cat.id}`;

                                                            return (
                                                                <Link
                                                                    key={cat.id}
                                                                    href={targetUrl}
                                                                    id={`suggestion-opt-${itemIndex}`}
                                                                    role="option"
                                                                    aria-selected={isHighlighted}
                                                                    onClick={() => {
                                                                        saveRecentSearch(searchQ);
                                                                        setIsInputFocused(false);
                                                                    }}
                                                                    className={cn(
                                                                        "flex items-center justify-between p-2 rounded-xl border transition-all text-xs",
                                                                        isHighlighted
                                                                            ? "bg-blue-50 border-blue-300 ring-2 ring-blue-500/20 shadow-xs"
                                                                            : "border-slate-100 bg-slate-50/50 hover:bg-blue-50/50 hover:border-blue-200"
                                                                    )}
                                                                >
                                                                    <div className="flex items-center gap-2 truncate">
                                                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-100/70 text-[#0b2447] text-[10px] font-black">
                                                                            #
                                                                        </span>
                                                                        <span className="font-bold text-slate-800 truncate">
                                                                            <HighlightMatch text={cat.name} query={searchQ} />
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[9.5px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200 shrink-0">
                                                                        {cat.type}
                                                                    </span>
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Products Match */}
                                            {(activeTab === 'all' || activeTab === 'products') && suggestions.products.length > 0 && (
                                                <div className="space-y-1.5 pt-3">
                                                    <div className="flex items-center justify-between px-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <ShoppingBag className="h-3.5 w-3.5 text-[#0b2447]" />
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Products</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => executeSearch(searchQ, 'products')}
                                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5"
                                                        >
                                                            <span>View all</span>
                                                            <ChevronRight className="h-3 w-3" />
                                                        </button>
                                                    </div>

                                                    <div className="space-y-1">
                                                        {suggestions.products.map(prod => {
                                                            const itemIndex = flatItems.findIndex(item => item.id === `prod-${prod.id}`);
                                                            const isHighlighted = highlightedIndex === itemIndex;
                                                            const imgUrl = prod.images?.[0]?.fileAsset?.url ? resolveMediaUrl(prod.images[0].fileAsset.url) : resolveMarketplaceImage(prod, 'product');
                                                            const effectivePrice = Number(prod.discountPrice || prod.price || 0);

                                                            return (
                                                                <Link
                                                                    key={prod.id}
                                                                    href={`/marketplace/products/${prod.id}`}
                                                                    id={`suggestion-opt-${itemIndex}`}
                                                                    role="option"
                                                                    aria-selected={isHighlighted}
                                                                    onClick={() => {
                                                                        saveRecentSearch(searchQ);
                                                                        setIsInputFocused(false);
                                                                    }}
                                                                    className={cn(
                                                                        "group flex items-center gap-3 p-2 rounded-xl transition-all",
                                                                        isHighlighted
                                                                            ? "bg-blue-50 ring-2 ring-blue-500/20 shadow-xs"
                                                                            : "hover:bg-slate-50"
                                                                    )}
                                                                >
                                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white p-0.5">
                                                                        {imgUrl ? (
                                                                            <img src={imgUrl} alt="" className="h-full w-full object-contain" />
                                                                        ) : (
                                                                            <Package className="h-5 w-5 text-slate-300" />
                                                                        )}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-bold text-slate-900 group-hover:text-[#0b2447] truncate">
                                                                            <HighlightMatch text={prod.name} query={searchQ} />
                                                                        </p>
                                                                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                                                                            {prod.category && (
                                                                                <span className="font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                                                                    {prod.category.name}
                                                                                </span>
                                                                            )}
                                                                            {prod.organization && (
                                                                                <span className="truncate">{prod.organization.organizationName}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        {effectivePrice > 0 ? (
                                                                            <p className="text-xs font-black text-[#0b2447]">
                                                                                ₹{effectivePrice.toLocaleString('en-IN')}
                                                                            </p>
                                                                        ) : (
                                                                            <p className="text-[10.5px] font-bold text-blue-600">Quote</p>
                                                                        )}
                                                                    </div>
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Services Match */}
                                            {(activeTab === 'all' || activeTab === 'services') && suggestions.services.length > 0 && (
                                                <div className="space-y-1.5 pt-3">
                                                    <div className="flex items-center justify-between px-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <Wrench className="h-3.5 w-3.5 text-[#0b2447]" />
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Services</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => executeSearch(searchQ, 'services')}
                                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5"
                                                        >
                                                            <span>View all</span>
                                                            <ChevronRight className="h-3 w-3" />
                                                        </button>
                                                    </div>

                                                    <div className="space-y-1">
                                                        {suggestions.services.map(serv => {
                                                            const itemIndex = flatItems.findIndex(item => item.id === `serv-${serv.id}`);
                                                            const isHighlighted = highlightedIndex === itemIndex;
                                                            const basePrice = Number(serv.basePrice || 0);

                                                            return (
                                                                <Link
                                                                    key={serv.id}
                                                                    href={`/marketplace/services/${serv.id}`}
                                                                    id={`suggestion-opt-${itemIndex}`}
                                                                    role="option"
                                                                    aria-selected={isHighlighted}
                                                                    onClick={() => {
                                                                        saveRecentSearch(searchQ);
                                                                        setIsInputFocused(false);
                                                                    }}
                                                                    className={cn(
                                                                        "group flex items-center gap-3 p-2 rounded-xl transition-all",
                                                                        isHighlighted
                                                                            ? "bg-blue-50 ring-2 ring-blue-500/20 shadow-xs"
                                                                            : "hover:bg-slate-50"
                                                                    )}
                                                                >
                                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-blue-50/80 text-blue-700">
                                                                        <Wrench className="h-5 w-5" />
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-xs font-bold text-slate-900 group-hover:text-[#0b2447] truncate">
                                                                            <HighlightMatch text={serv.name} query={searchQ} />
                                                                        </p>
                                                                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                                                                            {serv.pricingModel && (
                                                                                <span className="font-semibold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200/60">
                                                                                    {serv.pricingModel}
                                                                                </span>
                                                                            )}
                                                                            {serv.organization && (
                                                                                <span className="truncate">{serv.organization.organizationName}</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        {basePrice > 0 ? (
                                                                            <p className="text-xs font-black text-[#0b2447]">
                                                                                ₹{basePrice.toLocaleString('en-IN')}
                                                                            </p>
                                                                        ) : (
                                                                            <p className="text-[10.5px] font-bold text-blue-600">Custom</p>
                                                                        )}
                                                                    </div>
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Sellers / Suppliers Match */}
                                            {(activeTab === 'all' || activeTab === 'sellers') && suggestions.sellers.length > 0 && (
                                                <div className="space-y-1.5 pt-3">
                                                    <div className="flex items-center justify-between px-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <Store className="h-3.5 w-3.5 text-emerald-600" />
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Verified Suppliers</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => executeSearch(searchQ, 'sellers')}
                                                            className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-0.5"
                                                        >
                                                            <span>View all</span>
                                                            <ChevronRight className="h-3 w-3" />
                                                        </button>
                                                    </div>

                                                    <div className="space-y-1">
                                                        {suggestions.sellers.map(seller => {
                                                            const itemIndex = flatItems.findIndex(item => item.id === `sell-${seller.id}`);
                                                            const isHighlighted = highlightedIndex === itemIndex;
                                                            const rawLogo = seller.logoFile?.url || seller.profile?.logoUrl || null;
                                                            const logoUrl = resolveMediaUrl(rawLogo);

                                                            return (
                                                                <Link
                                                                    key={seller.id}
                                                                    href={`/marketplace/sellers/${seller.id}`}
                                                                    id={`suggestion-opt-${itemIndex}`}
                                                                    role="option"
                                                                    aria-selected={isHighlighted}
                                                                    onClick={() => {
                                                                        saveRecentSearch(searchQ);
                                                                        setIsInputFocused(false);
                                                                    }}
                                                                    className={cn(
                                                                        "group flex items-center gap-3 p-2 rounded-xl transition-all",
                                                                        isHighlighted
                                                                            ? "bg-blue-50 ring-2 ring-blue-500/20 shadow-xs"
                                                                            : "hover:bg-slate-50"
                                                                    )}
                                                                >
                                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-0.5">
                                                                        {logoUrl ? (
                                                                            <img src={logoUrl} alt="" className="h-full w-full object-contain rounded-lg" />
                                                                        ) : (
                                                                            <span className="flex h-full w-full items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 text-xs font-black">
                                                                                {seller.organizationName[0]?.toUpperCase()}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <p className="text-xs font-extrabold text-slate-900 group-hover:text-[#0b2447] truncate">
                                                                                <HighlightMatch text={seller.organizationName} query={searchQ} />
                                                                            </p>
                                                                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                                                                        </div>
                                                                        <p className="text-[10px] text-slate-400 truncate">
                                                                            {seller.district || seller.city || 'Jharsuguda'}, {seller.state || 'Odisha'}
                                                                        </p>
                                                                    </div>
                                                                    <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0">
                                                                        Verified
                                                                    </span>
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Empty State when no results found */}
                                            {totalSuggestions === 0 && !isSearching && (
                                                <div className="p-6 text-center space-y-2">
                                                    <div className="flex h-10 w-10 mx-auto items-center justify-center rounded-full bg-slate-100 text-slate-400">
                                                        <Search className="h-5 w-5" />
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-700">No direct suggestions for "{searchQ}"</p>
                                                    <p className="text-[11px] text-slate-400">You can still search the entire catalog for matching listings.</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => executeSearch(searchQ)}
                                                        className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0b2447] text-white text-xs font-bold shadow hover:bg-[#12335f] active:scale-95 transition"
                                                    >
                                                        <span>Search All Products for "{searchQ}"</span>
                                                        <ArrowRight className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )}

                                        </div>

                                        {/* Dropdown Footer Action Bar */}
                                        <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => executeSearch(searchQ)}
                                                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0b2447] hover:text-blue-800 hover:underline px-2 py-1"
                                            >
                                                <span>View full search results for "{searchQ}"</span>
                                                <ArrowRight className="h-3.5 w-3.5" />
                                            </button>
                                            <div className="hidden sm:flex items-center gap-2 text-[10.5px] text-slate-400 font-semibold">
                                                <span>Use <strong>↑</strong> <strong>↓</strong> to navigate</span>
                                                <span>·</span>
                                                <span><strong>Enter</strong> to select</span>
                                                <span>·</span>
                                                <span><strong>Esc</strong> to close</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Desktop Action Cluster */}
                    <div className="hidden md:flex items-center gap-2 shrink-0">
                        {!user ? (
                            <>
                                {/* Login Button */}
                                <Link
                                    href="/login"
                                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 active:scale-95"
                                >
                                    <LogIn className="h-3.5 w-3.5 text-slate-500" />
                                    <span>Login</span>
                                </Link>

                                {/* Sign Up dropdown */}
                                <div ref={signupRef} className="relative shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setShowSignup(v => !v)}
                                        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#0b2447] px-3.5 text-xs font-bold text-white shadow-md shadow-[#0b2447]/15 transition-all hover:bg-[#12335f] active:scale-95"
                                        aria-haspopup="menu"
                                        aria-expanded={showSignup}
                                    >
                                        <User className="h-3.5 w-3.5" />
                                        <span>Sign Up</span>
                                        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${showSignup ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showSignup && <SignupMenu onSelect={() => setShowSignup(false)} />}
                                </div>
                            </>
                        ) : (
                            /* Dashboard (logged in) */
                            <Link
                                href="/dashboard"
                                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#0b2447] text-white text-xs font-bold shadow-md shadow-[#0b2447]/15 hover:bg-[#12335f] active:scale-95 transition-all"
                            >
                                <User className="h-3.5 w-3.5" />
                                Dashboard
                            </Link>
                        )}
                    </div>

                    {/* Mobile Controls (Menu Toggle) */}
                    <div className="flex items-center gap-1.5 md:hidden shrink-0">
                        <button
                            onClick={() => setMobileMenuOpen(true)}
                            className="flex h-9.5 w-9.5 items-center justify-center rounded-xl bg-[#0b2447] text-white shadow-md shadow-[#0b2447]/20 active:scale-95 transition-all"
                            aria-label="Open Navigation Menu"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </nav>

            {/* ════════════════════════════════════════════════════════════════════
                MOBILE SLIDE-OVER NAVIGATION DRAWER (Portal Mounted)
            ════════════════════════════════════════════════════════════════════ */}
            {mounted && mobileMenuOpen && createPortal(
                <div className="fixed inset-0 z-[99999] md:hidden flex justify-end">
                    {/* Dark frosted backdrop */}
                    <div
                        onClick={() => setMobileMenuOpen(false)}
                        className="fixed inset-0 bg-[#07172e]/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
                        aria-hidden="true"
                    />

                    {/* Sliding Sheet Panel */}
                    <div className="relative w-[88vw] max-w-[340px] bg-white h-full shadow-2xl flex flex-col z-10 overflow-hidden animate-in slide-in-from-right duration-300 ease-out">
                        {/* Branded Drawer Header */}
                        <div className="bg-gradient-to-r from-[#07172e] via-[#0b2447] to-[#12335f] p-4 text-white flex items-center justify-between shadow-md shrink-0">
                            <Link href="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2.5 min-w-0">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-sm">
                                    <img src="/logoo.png" alt="SMiLE Logo" className="h-full w-full object-contain" />
                                </div>
                                <div className="min-w-0 leading-tight">
                                    <p className="truncate text-sm font-black tracking-tight text-white">JsgSMILE</p>
                                    <p className="truncate text-[9px] font-bold text-slate-300">MSME Marketplace</p>
                                </div>
                            </Link>
                            <button
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-md active:scale-90 transition-all"
                                aria-label="Close menu"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Drawer Search with Live Suggestion Chips */}
                        <div className="p-3 bg-slate-50/95 border-b border-slate-100 shrink-0 space-y-2">
                            <form
                                role="search"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    executeSearch(searchQ);
                                }}
                                className="flex items-center h-10 rounded-full border border-slate-200 bg-white px-3 shadow-2xs focus-within:ring-2 focus-within:ring-[#0b2447]/20 focus-within:border-[#0b2447] transition-all"
                            >
                                <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                                <input
                                    type="text"
                                    value={searchQ}
                                    onChange={e => setSearchQ(e.target.value)}
                                    placeholder="Search products, services, sellers..."
                                    className="flex-1 min-w-0 bg-transparent text-xs font-medium outline-none text-slate-800 placeholder:text-slate-400"
                                    aria-label="Mobile marketplace search"
                                />
                                {searchQ && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQ('')}
                                        className="h-5 w-5 mr-1 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700"
                                    >
                                        ✕
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="h-7 px-3 rounded-full bg-[#0b2447] text-white text-[10px] font-black uppercase hover:bg-[#12335f] transition-all shrink-0 shadow-xs"
                                >
                                    Go
                                </button>
                            </form>

                            {/* Quick Category Suggestions on Mobile */}
                            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                                {POPULAR_SEARCH_CHIPS.slice(0, 4).map(chip => (
                                    <button
                                        key={chip}
                                        type="button"
                                        onClick={() => {
                                            setSearchQ(chip);
                                            executeSearch(chip);
                                        }}
                                        className="shrink-0 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-[10px] font-semibold text-slate-600 active:bg-blue-50"
                                    >
                                        {chip}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Drawer Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {!user ? (
                                <div className="space-y-2.5">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">Account Access</p>
                                    
                                    {/* Primary Login Card */}
                                    <Link
                                        href="/login"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-[#0b2447] to-[#12335f] text-white text-xs font-bold shadow-md shadow-[#0b2447]/15 hover:shadow-lg transition-all active:scale-98"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/15 text-white">
                                                <LogIn className="h-3.5 w-3.5 text-amber-300" />
                                            </span>
                                            <span>Login to Account</span>
                                        </div>
                                        <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                                    </Link>

                                    {/* Registration Section */}
                                    <div className="space-y-1.5 pt-1.5">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">New Registration</p>
                                        {signupOptions.map((opt, idx) => {
                                            const iconColor = idx === 0
                                                ? 'bg-blue-50 text-blue-600 border border-blue-100'
                                                : idx === 1
                                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                                : 'bg-purple-50 text-purple-600 border border-purple-100';

                                            return (
                                                <Link
                                                    key={opt.href}
                                                    href={opt.href}
                                                    onClick={() => setMobileMenuOpen(false)}
                                                    className="flex items-center gap-3 p-2.5 rounded-2xl border border-slate-100 bg-white hover:bg-slate-50/80 hover:border-slate-200 transition-all active:scale-98 shadow-2xs"
                                                >
                                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${iconColor}`}>
                                                        {opt.icon}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-extrabold text-slate-900 truncate">{opt.label}</p>
                                                        <p className="text-[10px] font-medium text-slate-400 truncate">{opt.desc}</p>
                                                    </div>
                                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-blue-100/60 flex items-center gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0b2447] text-white font-black text-sm">
                                            {user.name ? user.name[0]?.toUpperCase() : 'U'}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-black text-slate-900 truncate">{user.name || 'Account User'}</p>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{user.role || 'Member'}</p>
                                        </div>
                                    </div>
                                    <Link
                                        href="/dashboard"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center justify-between p-3 rounded-2xl bg-[#0b2447] text-white text-xs font-bold shadow-md shadow-[#0b2447]/15"
                                    >
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-amber-300" />
                                            <span>Go to Dashboard</span>
                                        </div>
                                        <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                                    </Link>
                                </div>
                            )}

                            {/* Navigation Quick Links */}
                            <div className="space-y-1 pt-3 border-t border-slate-100">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1 mb-1.5">Explore Marketplace</p>
                                
                                <Link
                                    href="/marketplace/products"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold text-slate-700 hover:bg-blue-50/60 hover:text-[#0b2447] transition-all group"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[#0b2447] group-hover:bg-[#0b2447] group-hover:text-white transition-colors">
                                            <Layers className="h-3.5 w-3.5" />
                                        </span>
                                        <span>All Products & Categories</span>
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#0b2447] transition-colors" />
                                </Link>

                                <Link
                                    href="/marketplace/products"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold text-slate-700 hover:bg-blue-50/60 hover:text-[#0b2447] transition-all group"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[#0b2447] group-hover:bg-[#0b2447] group-hover:text-white transition-colors">
                                            <ShoppingBag className="h-3.5 w-3.5" />
                                        </span>
                                        <span>Browse Products</span>
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#0b2447] transition-colors" />
                                </Link>

                                <Link
                                    href="/marketplace/services"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold text-slate-700 hover:bg-blue-50/60 hover:text-[#0b2447] transition-all group"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[#0b2447] group-hover:bg-[#0b2447] group-hover:text-white transition-colors">
                                            <Building2 className="h-3.5 w-3.5" />
                                        </span>
                                        <span>Browse Services</span>
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#0b2447] transition-colors" />
                                </Link>

                                <Link
                                    href="/marketplace/sellers"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold text-slate-700 hover:bg-blue-50/60 hover:text-[#0b2447] transition-all group"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[#0b2447] group-hover:bg-[#0b2447] group-hover:text-white transition-colors">
                                            <Store className="h-3.5 w-3.5" />
                                        </span>
                                        <span>Verified Suppliers</span>
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#0b2447] transition-colors" />
                                </Link>

                                <Link
                                    href="/marketplace/buyers"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold text-slate-700 hover:bg-blue-50/60 hover:text-[#0b2447] transition-all group"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[#0b2447] group-hover:bg-[#0b2447] group-hover:text-white transition-colors">
                                            <Briefcase className="h-3.5 w-3.5" />
                                        </span>
                                        <span>Enterprise Buyers</span>
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#0b2447] transition-colors" />
                                </Link>

                                <Link
                                    href="/marketplace/requirements"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center justify-between p-2.5 rounded-2xl text-xs font-bold text-slate-700 hover:bg-blue-50/60 hover:text-[#0b2447] transition-all group"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-[#0b2447] group-hover:bg-[#0b2447] group-hover:text-white transition-colors">
                                            <FileText className="h-3.5 w-3.5" />
                                        </span>
                                        <span>Active Requirements</span>
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#0b2447] transition-colors" />
                                    </div>
                                </Link>
                            </div>
                        </div>

                        {/* Drawer Footer */}
                        <div className="p-3.5 border-t border-slate-100 bg-slate-50/90 text-center shrink-0">
                            <p className="text-[10px] font-bold text-slate-500">Official MSME Portal · Jharsuguda District</p>
                            <p className="text-[9px] text-slate-400 mt-0.5">Government of Odisha Initiative</p>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </header>
    );
}
