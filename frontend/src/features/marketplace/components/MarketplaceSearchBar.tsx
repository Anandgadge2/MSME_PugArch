'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Search,
    X,
    Clock,
    Store,
    Package,
    Wrench,
    Layers,
    ChevronDown,
    Loader2,
    ShieldCheck,
    ArrowRight
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { marketplaceApi, type MarketplaceSearchResult } from '../api';
import { resolveMarketplaceImage } from '../utils/marketplaceImages';

export interface MarketplaceSearchBarProps {
    initialQuery?: string;
    isServices?: boolean;
    onSearch: (query: string, scope?: 'all' | 'products' | 'services') => void;
    onSelectCategory?: (categoryId: string) => void;
    onSelectSeller?: (sellerName: string) => void;
    className?: string;
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
    if (!query.trim() || !text) return <span>{text}</span>;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return (
        <span>
            {parts.map((part, i) =>
                regex.test(part) ? (
                    <strong key={i} className="font-extrabold text-[#0b2447] underline decoration-blue-300 underline-offset-2 bg-blue-50/90 px-0.5 rounded">
                        {part}
                    </strong>
                ) : (
                    part
                )
            )}
        </span>
    );
}

export function MarketplaceSearchBar({
    initialQuery = '',
    isServices = false,
    onSearch,
    onSelectCategory,
    onSelectSeller,
    className
}: MarketplaceSearchBarProps) {
    const router = useRouter();
    const [query, setQuery] = useState(initialQuery);
    const [scope, setScope] = useState<'all' | 'products' | 'services'>(isServices ? 'services' : 'all');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'products' | 'services' | 'sellers' | 'categories'>('all');
    const [suggestions, setSuggestions] = useState<MarketplaceSearchResult>({
        products: [],
        services: [],
        sellers: [],
        categories: []
    });
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync input when initialQuery changes
    useEffect(() => {
        setQuery(initialQuery);
    }, [initialQuery]);

    // Load recent searches from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem('jsg_marketplace_recent_searches');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) setRecentSearches(parsed.slice(0, 6));
            }
        } catch {
            // ignore localStorage error
        }
    }, []);

    const saveRecentSearch = useCallback((item: string) => {
        const trimmed = item.trim();
        if (!trimmed || trimmed.length < 2) return;
        setRecentSearches(prev => {
            const next = [trimmed, ...prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 6);
            try {
                localStorage.setItem('jsg_marketplace_recent_searches', JSON.stringify(next));
            } catch {
                // ignore
            }
            return next;
        });
    }, []);

    const removeRecentSearch = (item: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setRecentSearches(prev => {
            const next = prev.filter(s => s !== item);
            try {
                localStorage.setItem('jsg_marketplace_recent_searches', JSON.stringify(next));
            } catch {}
            return next;
        });
    };

    const clearAllRecentSearches = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setRecentSearches([]);
        try {
            localStorage.removeItem('jsg_marketplace_recent_searches');
        } catch {}
    };

    // Live search suggestions fetcher (debounced)
    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < 2) {
            setSuggestions({ products: [], services: [], sellers: [], categories: [] });
            setIsSearching(false);
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
            } catch {
                setSuggestions({ products: [], services: [], sellers: [], categories: [] });
            } finally {
                setIsSearching(false);
            }
        }, 220);

        return () => clearTimeout(timer);
    }, [query]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
                setScopeDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSearchSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = query.trim();
        if (trimmed) {
            saveRecentSearch(trimmed);
        }
        setIsDropdownOpen(false);
        setScopeDropdownOpen(false);
        onSearch(trimmed, scope);
    };

    const handleClear = () => {
        setQuery('');
        setSuggestions({ products: [], services: [], sellers: [], categories: [] });
        setIsDropdownOpen(false);
        onSearch('', scope);
        inputRef.current?.focus();
    };

    const handleSelectProduct = (prod: any) => {
        setIsDropdownOpen(false);
        saveRecentSearch(prod.name);
        router.push(`/marketplace/products/${prod.id}`);
    };

    const handleSelectService = (serv: any) => {
        setIsDropdownOpen(false);
        saveRecentSearch(serv.name);
        router.push(`/marketplace/services/${serv.id}`);
    };

    const handleCategoryClick = (cat: any) => {
        setIsDropdownOpen(false);
        saveRecentSearch(cat.name);
        if (onSelectCategory) {
            onSelectCategory(String(cat.id));
        } else {
            router.push(`/marketplace/products?categoryId=${cat.id}`);
        }
    };

    const handleSellerClick = (seller: any) => {
        setIsDropdownOpen(false);
        const sName = seller.organizationName || seller.name;
        saveRecentSearch(sName);
        if (onSelectSeller) {
            onSelectSeller(sName);
        } else {
            router.push(`/marketplace/products?brand=${encodeURIComponent(sName)}`);
        }
    };

    const totalSuggestions = suggestions.products.length + suggestions.services.length + suggestions.sellers.length + suggestions.categories.length;
    const hasSuggestions = totalSuggestions > 0;
    const showRecent = query.trim().length < 2 && recentSearches.length > 0;

    return (
        <div ref={containerRef} className={cn("relative w-full z-40", className)}>
            {/* Main Search Bar Form */}
            <form
                onSubmit={handleSearchSubmit}
                className="flex items-stretch rounded-2xl bg-white border-2 border-slate-200/90 shadow-sm hover:border-slate-300 focus-within:border-[#0b2447] focus-within:ring-3 focus-within:ring-[#0b2447]/10 transition-all overflow-hidden"
                role="search"
            >
                {/* Scope selector (Amazon style: All / Products / Services) */}
                <div className="relative shrink-0 border-r border-slate-200 bg-slate-50/80">
                    <button
                        type="button"
                        onClick={() => setScopeDropdownOpen(!scopeDropdownOpen)}
                        className="h-full px-3 sm:px-4 py-2 text-xs font-bold text-slate-700 hover:text-[#0b2447] flex items-center gap-1.5 transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:bg-slate-100"
                        aria-expanded={scopeDropdownOpen}
                        aria-label="Select search category scope"
                    >
                        {scope === 'all' && <Layers className="h-3.5 w-3.5 text-slate-500" />}
                        {scope === 'products' && <Package className="h-3.5 w-3.5 text-blue-600" />}
                        {scope === 'services' && <Wrench className="h-3.5 w-3.5 text-indigo-600" />}
                        <span className="hidden sm:inline">
                            {scope === 'all' ? 'All' : scope === 'products' ? 'Products' : 'Services'}
                        </span>
                        <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform duration-150", scopeDropdownOpen && "rotate-180")} />
                    </button>

                    {scopeDropdownOpen && (
                        <div className="absolute left-0 top-full mt-1.5 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                            {[
                                { id: 'all', label: 'All Offerings', icon: <Layers className="h-3.5 w-3.5 text-slate-500" /> },
                                { id: 'products', label: 'Products', icon: <Package className="h-3.5 w-3.5 text-blue-600" /> },
                                { id: 'services', label: 'Services', icon: <Wrench className="h-3.5 w-3.5 text-indigo-600" /> }
                            ].map(item => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                        setScope(item.id as any);
                                        setScopeDropdownOpen(false);
                                        inputRef.current?.focus();
                                    }}
                                    className={cn(
                                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-colors cursor-pointer",
                                        scope === item.id ? "bg-blue-50 text-[#0b2447] font-bold" : "text-slate-700 hover:bg-slate-50"
                                    )}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Search Text Input */}
                <div className="relative flex-1 flex items-center min-w-0">
                    <Search className="absolute left-3.5 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => {
                            setQuery(e.target.value);
                            setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                        placeholder={
                            scope === 'services'
                                ? "Search services, scope of work, vendors, or specifications..."
                                : scope === 'products'
                                ? "Search products, brands, model numbers, vendors, or specs..."
                                : "Search products, services, verified vendors, specifications, brands..."
                        }
                        className="w-full h-11 sm:h-12 pl-10 pr-9 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent border-none focus:outline-none"
                        role="combobox"
                        aria-expanded={isDropdownOpen}
                        aria-autocomplete="list"
                        aria-label="Search marketplace for products, services, or vendors"
                    />

                    {/* Clear Button or Spinner */}
                    {isSearching ? (
                        <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-blue-600" />
                    ) : query ? (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Clear search"
                            aria-label="Clear search input"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    ) : null}
                </div>

                {/* Submit Search Button (Amazon / Flipkart Style) */}
                <button
                    type="submit"
                    className="shrink-0 px-4 sm:px-6 bg-[#0b2447] text-white hover:bg-[#12335f] active:scale-[0.98] transition-all font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    aria-label="Execute search"
                >
                    <Search className="h-4 w-4" />
                    <span className="hidden sm:inline">Search</span>
                </button>
            </form>

            {/* Suggestions & Recent Searches Dropdown Modal */}
            {isDropdownOpen && (hasSuggestions || showRecent || (query.trim().length >= 2 && !isSearching)) && (
                <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl z-50 max-h-[75vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 animate-in fade-in zoom-in-98 duration-150">
                    
                    {/* Recent Searches */}
                    {showRecent && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between px-2 py-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                                    Recent Searches
                                </span>
                                <button
                                    type="button"
                                    onClick={clearAllRecentSearches}
                                    className="text-[11px] font-bold text-slate-400 hover:text-red-600 transition cursor-pointer"
                                >
                                    Clear History
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5 px-1">
                                {recentSearches.map(term => (
                                    <div
                                        key={term}
                                        onClick={() => {
                                            setQuery(term);
                                            saveRecentSearch(term);
                                            setIsDropdownOpen(false);
                                            onSearch(term, scope);
                                        }}
                                        className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-[#0b2447] transition cursor-pointer"
                                    >
                                        <Clock className="h-3 w-3 text-slate-400 group-hover:text-blue-600" />
                                        <span>{term}</span>
                                        <button
                                            type="button"
                                            onClick={(e) => removeRecentSearch(term, e)}
                                            className="ml-1 text-slate-400 hover:text-red-600 transition p-0.5 rounded cursor-pointer"
                                            title={`Remove ${term}`}
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Query Match Quick Actions */}
                    {query.trim().length >= 2 && (
                        <div className="pb-2 mb-2 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => handleSearchSubmit()}
                                className="inline-flex items-center gap-2 text-xs font-bold text-[#0b2447] hover:text-blue-700 transition px-2 py-1 rounded-lg hover:bg-blue-50 cursor-pointer"
                            >
                                <Search className="h-3.5 w-3.5 text-blue-600" />
                                <span>Search for "<strong>{query.trim()}</strong>" across all categories</span>
                                <ArrowRight className="h-3 w-3 text-blue-600" />
                            </button>

                            {/* Section Filter Pills */}
                            {hasSuggestions && (
                                <div className="flex items-center gap-1">
                                    {(['all', 'products', 'services', 'sellers', 'categories'] as const).map(tab => {
                                        let count = 0;
                                        if (tab === 'all') count = totalSuggestions;
                                        if (tab === 'products') count = suggestions.products.length;
                                        if (tab === 'services') count = suggestions.services.length;
                                        if (tab === 'sellers') count = suggestions.sellers.length;
                                        if (tab === 'categories') count = suggestions.categories.length;

                                        if (count === 0 && tab !== 'all') return null;
                                        return (
                                            <button
                                                key={tab}
                                                type="button"
                                                onClick={() => setActiveTab(tab)}
                                                className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-bold capitalize transition cursor-pointer",
                                                    activeTab === tab
                                                        ? "bg-[#0b2447] text-white"
                                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                                )}
                                            >
                                                {tab} ({count})
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* No Results Message */}
                    {query.trim().length >= 2 && !hasSuggestions && !isSearching && (
                        <div className="py-6 text-center">
                            <Package className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-700">No exact matches for "{query}"</p>
                            <p className="text-[11px] text-slate-400 mt-1">Press Enter or click Search to view all related catalogue results</p>
                        </div>
                    )}

                    {/* Suggestions Content */}
                    {hasSuggestions && (
                        <div className="space-y-4 pt-1">
                            
                            {/* Products Section */}
                            {(activeTab === 'all' || activeTab === 'products') && suggestions.products.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-1.5 px-2 mb-1.5">
                                        <Package className="h-3.5 w-3.5 text-blue-600" />
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Products</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {suggestions.products.map((prod: any) => {
                                            const imgUrl = resolveMarketplaceImage(prod, 'product');
                                            return (
                                                <div
                                                    key={prod.id}
                                                    onClick={() => handleSelectProduct(prod)}
                                                    className="flex items-center gap-3 p-2 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-blue-50/60 hover:border-blue-200 transition cursor-pointer group"
                                                >
                                                    <img
                                                        src={imgUrl}
                                                        alt={prod.name}
                                                        className="h-11 w-11 rounded-lg object-contain bg-white border border-slate-100 shrink-0 p-0.5"
                                                        onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-bold text-slate-800 group-hover:text-[#0b2447] truncate">
                                                            <HighlightMatch text={prod.name} query={query} />
                                                        </p>
                                                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                                                            {prod.category?.name && (
                                                                <span className="truncate max-w-[110px] px-1.5 py-0.2 rounded bg-slate-100 font-semibold text-slate-600">
                                                                    {prod.category.name}
                                                                </span>
                                                            )}
                                                            {prod.organization?.organizationName && (
                                                                <span className="truncate text-slate-400">
                                                                    By {prod.organization.organizationName}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {prod.price > 0 && (
                                                        <div className="text-right shrink-0">
                                                            <span className="text-xs font-black text-emerald-700">₹{Number(prod.price).toLocaleString('en-IN')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Services Section */}
                            {(activeTab === 'all' || activeTab === 'services') && suggestions.services.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-1.5 px-2 mb-1.5">
                                        <Wrench className="h-3.5 w-3.5 text-indigo-600" />
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Services</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {suggestions.services.map((serv: any) => {
                                            const imgUrl = resolveMarketplaceImage(serv, 'service');
                                            return (
                                                <div
                                                    key={serv.id}
                                                    onClick={() => handleSelectService(serv)}
                                                    className="flex items-center gap-3 p-2 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50/60 hover:border-indigo-200 transition cursor-pointer group"
                                                >
                                                    <img
                                                        src={imgUrl}
                                                        alt={serv.name}
                                                        className="h-11 w-11 rounded-lg object-contain bg-white border border-slate-100 shrink-0 p-0.5"
                                                        onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-950 truncate">
                                                            <HighlightMatch text={serv.name} query={query} />
                                                        </p>
                                                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                                                            {serv.category?.name && (
                                                                <span className="truncate max-w-[110px] px-1.5 py-0.2 rounded bg-indigo-50 font-semibold text-indigo-700">
                                                                    {serv.category.name}
                                                                </span>
                                                            )}
                                                            {serv.pricingModel && (
                                                                <span className="text-slate-400 capitalize">
                                                                    {serv.pricingModel.toLowerCase().replace('_', ' ')}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {serv.basePrice > 0 && (
                                                        <div className="text-right shrink-0">
                                                            <span className="text-xs font-black text-emerald-700">₹{Number(serv.basePrice).toLocaleString('en-IN')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Verified Vendors Section */}
                            {(activeTab === 'all' || activeTab === 'sellers') && suggestions.sellers.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-1.5 px-2 mb-1.5">
                                        <Store className="h-3.5 w-3.5 text-purple-600" />
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Verified Vendors</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {suggestions.sellers.map((seller: any) => {
                                            const sName = seller.organizationName || seller.name;
                                            return (
                                                <button
                                                    key={seller.id}
                                                    type="button"
                                                    onClick={() => handleSellerClick(seller)}
                                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-purple-100 bg-purple-50/60 hover:bg-purple-100 hover:border-purple-300 transition text-left cursor-pointer group"
                                                >
                                                    <Store className="h-4 w-4 text-purple-600 shrink-0" />
                                                    <div>
                                                        <p className="text-xs font-bold text-purple-950 group-hover:text-purple-900 flex items-center gap-1">
                                                            <HighlightMatch text={sName} query={query} />
                                                            <ShieldCheck className="h-3 w-3 text-emerald-600" />
                                                        </p>
                                                        {seller.district && (
                                                            <p className="text-[10px] text-purple-600/80">{seller.district}</p>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Categories Section */}
                            {(activeTab === 'all' || activeTab === 'categories') && suggestions.categories.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-1.5 px-2 mb-1.5">
                                        <Layers className="h-3.5 w-3.5 text-amber-600" />
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Categories</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {suggestions.categories.map((cat: any) => (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => handleCategoryClick(cat)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-200/80 bg-amber-50/70 hover:bg-amber-100 transition text-xs font-bold text-amber-950 cursor-pointer"
                                            >
                                                <span>Category:</span>
                                                <HighlightMatch text={cat.name} query={query} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
