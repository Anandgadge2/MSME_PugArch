'use client';

import React, { useState, useMemo } from 'react';
import {
    SlidersHorizontal,
    ChevronDown,
    Search,
    RotateCcw,
    X,
    Star,
    Check,
    Tag,
    IndianRupee,
    Store,
    MapPin,
    ShieldCheck,
    Zap,
    Percent,
    Layers,
    Sparkles,
    Boxes
} from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface MarketplaceFilterPanelProps {
    categories: any[];
    selectedCategoryIds: string[];
    onSelectCategory: (categoryId: string) => void;
    onClearCategories: () => void;
    
    availableSubcategories: string[];
    selectedSubcategories: string[];
    onToggleSubcategory: (sub: string) => void;
    onClearSubcategories: () => void;
    
    canViewPrice: boolean;
    priceFilter: string;
    onPriceChange: (val: string) => void;
    
    availableSellers: string[];
    brandSearchFilter: string;
    onBrandChange: (brand: string) => void;
    
    districtFilter: string;
    onDistrictChange: (district: string) => void;
    availableLocations?: string[];
    
    discountFilter: string;
    onDiscountToggle: (active: boolean) => void;
    
    msmeOnlyFilter: boolean;
    onMsmeToggle: (active: boolean) => void;
    
    fastDispatchFilter: boolean;
    onFastDispatchToggle: (active: boolean) => void;
    
    minRatingFilter: number;
    onRatingChange: (rating: number) => void;
    
    verificationFilter: string;
    onVerificationToggle: (val: string) => void;
    
    conditionFilter?: string;
    onConditionChange?: (condition: string) => void;
    
    bulkDealFilter?: boolean;
    onBulkDealToggle?: (active: boolean) => void;
    
    activeFiltersCount: number;
    totalResults: number;
    onClearAll: () => void;
    isServices?: boolean;
    isMobileDrawer?: boolean;
    onCloseMobileDrawer?: () => void;
}

export function MarketplaceFilterPanel({
    categories,
    selectedCategoryIds,
    onSelectCategory,
    onClearCategories,
    availableSubcategories,
    selectedSubcategories,
    onToggleSubcategory,
    onClearSubcategories,
    canViewPrice,
    priceFilter,
    onPriceChange,
    availableSellers,
    brandSearchFilter,
    onBrandChange,
    districtFilter,
    onDistrictChange,
    availableLocations = [],
    discountFilter,
    onDiscountToggle,
    msmeOnlyFilter,
    onMsmeToggle,
    fastDispatchFilter,
    onFastDispatchToggle,
    minRatingFilter,
    onRatingChange,
    verificationFilter,
    onVerificationToggle,
    conditionFilter,
    onConditionChange,
    bulkDealFilter,
    onBulkDealToggle,
    activeFiltersCount,
    totalResults,
    onClearAll,
    isServices = false,
    isMobileDrawer = false,
    onCloseMobileDrawer
}: MarketplaceFilterPanelProps) {
    // Collapsible accordion state - intuitive defaults
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        quick: true,
        categories: false,
        subcategories: false,
        price: false,
        rating: false,
        sellers: false,
        location: false,
        condition: false
    });

    const toggleSection = (key: string) => {
        setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Category search & show-more
    const [categorySearch, setCategorySearch] = useState('');
    const [showAllCategories, setShowAllCategories] = useState(false);

    const filteredCategories = useMemo(() => {
        if (!categorySearch.trim()) return categories;
        const query = categorySearch.toLowerCase().trim();
        return categories.filter(c => (c.name || '').toLowerCase().includes(query));
    }, [categories, categorySearch]);

    const displayedCategories = showAllCategories || categorySearch ? filteredCategories : filteredCategories.slice(0, 6);

    // Subcategory search & show-more
    const [subcategorySearch, setSubcategorySearch] = useState('');
    const [showAllSubcategories, setShowAllSubcategories] = useState(false);

    const filteredSubcategories = useMemo(() => {
        if (!subcategorySearch.trim()) return availableSubcategories;
        const query = subcategorySearch.toLowerCase().trim();
        return availableSubcategories.filter(s => s.toLowerCase().includes(query));
    }, [availableSubcategories, subcategorySearch]);

    const displayedSubcategories = showAllSubcategories || subcategorySearch ? filteredSubcategories : filteredSubcategories.slice(0, 6);

    // Seller search & show-more
    const [sellerSearch, setSellerSearch] = useState('');
    const [showAllSellers, setShowAllSellers] = useState(false);

    const filteredSellers = useMemo(() => {
        if (!sellerSearch.trim()) return availableSellers;
        const query = sellerSearch.toLowerCase().trim();
        return availableSellers.filter(s => s.toLowerCase().includes(query));
    }, [availableSellers, sellerSearch]);

    const displayedSellers = showAllSellers || sellerSearch ? filteredSellers : filteredSellers.slice(0, 6);

    // Dynamic Location search & show-more
    const [locationSearch, setLocationSearch] = useState('');
    const [showAllLocations, setShowAllLocations] = useState(false);

    const filteredLocations = useMemo(() => {
        if (!locationSearch.trim()) return availableLocations;
        const query = locationSearch.toLowerCase().trim();
        return availableLocations.filter(loc => loc.toLowerCase().includes(query));
    }, [availableLocations, locationSearch]);

    const displayedLocations = showAllLocations || locationSearch ? filteredLocations : filteredLocations.slice(0, 6);

    // Custom Min/Max price state
    const [minPriceInput, setMinPriceInput] = useState(() => {
        if (priceFilter && priceFilter.includes('-')) {
            const [min] = priceFilter.split('-');
            return min || '';
        }
        return '';
    });
    const [maxPriceInput, setMaxPriceInput] = useState(() => {
        if (priceFilter && priceFilter.includes('-')) {
            const [, max] = priceFilter.split('-');
            return max || '';
        }
        return '';
    });

    const handleApplyCustomPrice = (e: React.FormEvent) => {
        e.preventDefault();
        const min = minPriceInput ? parseInt(minPriceInput, 10) : 0;
        const max = maxPriceInput ? parseInt(maxPriceInput, 10) : '';
        if (minPriceInput || maxPriceInput) {
            onPriceChange(`${min || 0}-${max || ''}`);
        } else {
            onPriceChange('');
        }
    };

    const pricePresets = [
        { label: 'All Prices', val: '' },
        { label: 'Under ₹1,000', val: 'UNDER_1K' },
        { label: '₹1,000 – ₹5,000', val: '1K_5K' },
        { label: '₹5,000 – ₹20,000', val: '5K_20K' },
        { label: 'Above ₹20,000', val: 'ABOVE_20K' }
    ];

    return (
        <div className="flex flex-col gap-4 text-slate-800">
            {/* Header: Title + Active Count + Reset All */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                        <SlidersHorizontal className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-[#0b2447] tracking-tight">Filters</h3>
                    </div>
                    {activeFiltersCount > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-600 text-white shadow-xs animate-in fade-in zoom-in duration-200">
                            {activeFiltersCount} applied
                        </span>
                    )}
                </div>

                {activeFiltersCount > 0 && (
                    <button
                        type="button"
                        onClick={onClearAll}
                        className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-700 transition px-2 py-1 rounded-md hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:outline-none cursor-pointer"
                        title="Clear all active filters"
                    >
                        <RotateCcw className="h-3 w-3" />
                        <span>Reset All</span>
                    </button>
                )}
            </div>

            {/* Quick Filter Badges (1-Click Chips) */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        Quick Filters
                    </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {/* Fast Dispatch Toggle */}
                    {/* <button
                        type="button"
                        onClick={() => onFastDispatchToggle(!fastDispatchFilter)}
                        className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border select-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none cursor-pointer",
                            fastDispatchFilter
                                ? "bg-amber-50 text-amber-900 border-amber-300 shadow-xs"
                                : "bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900"
                        )}
                        aria-pressed={fastDispatchFilter}
                    >
                        <Zap className={cn("h-3.5 w-3.5", fastDispatchFilter ? "text-amber-600 fill-amber-500" : "text-slate-400")} />
                        <span>Fast Dispatch</span>
                        {fastDispatchFilter && <Check className="h-3 w-3 text-amber-700" />}
                    </button> */}

                    {/* MSME Assured Toggle */}
                    <button
                        type="button"
                        onClick={() => onMsmeToggle(!msmeOnlyFilter)}
                        className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border select-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none cursor-pointer",
                            msmeOnlyFilter
                                ? "bg-blue-50 text-blue-900 border-blue-300 shadow-xs"
                                : "bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900"
                        )}
                        aria-pressed={msmeOnlyFilter}
                    >
                        <ShieldCheck className={cn("h-3.5 w-3.5", msmeOnlyFilter ? "text-blue-600" : "text-slate-400")} />
                        <span>MSME Assured</span>
                        {msmeOnlyFilter && <Check className="h-3 w-3 text-blue-700" />}
                    </button>

                    {/* Active Discounts Toggle */}
                    {canViewPrice && (
                        <button
                            type="button"
                            onClick={() => onDiscountToggle(discountFilter !== 'active')}
                            className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border select-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:outline-none cursor-pointer",
                                discountFilter === 'active'
                                    ? "bg-orange-50 text-orange-900 border-orange-300 shadow-xs"
                                    : "bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900"
                            )}
                            aria-pressed={discountFilter === 'active'}
                        >
                            <Percent className={cn("h-3.5 w-3.5", discountFilter === 'active' ? "text-orange-600" : "text-slate-400")} />
                            <span>On Sale</span>
                            {discountFilter === 'active' && <Check className="h-3 w-3 text-orange-700" />}
                        </button>
                    )}

                    {/* Top Rated Toggle (4.0+ Stars) */}
                    <button
                        type="button"
                        onClick={() => onRatingChange(minRatingFilter >= 4 ? 0 : 4)}
                        className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border select-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-none cursor-pointer",
                            minRatingFilter >= 4
                                ? "bg-emerald-50 text-emerald-900 border-emerald-300 shadow-xs"
                                : "bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900"
                        )}
                        aria-pressed={minRatingFilter >= 4}
                    >
                        <Star className={cn("h-3.5 w-3.5", minRatingFilter >= 4 ? "text-emerald-600 fill-emerald-500" : "text-slate-400")} />
                        <span>4.0+ Stars</span>
                        {minRatingFilter >= 4 && <Check className="h-3 w-3 text-emerald-700" />}
                    </button>

                    {/* Verified Sellers Toggle */}
                    {/* <button
                        type="button"
                        onClick={() => onVerificationToggle(verificationFilter === 'VERIFIED' ? '' : 'VERIFIED')}
                        className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border select-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none cursor-pointer",
                            verificationFilter === 'VERIFIED'
                                ? "bg-indigo-50 text-indigo-900 border-indigo-300 shadow-xs"
                                : "bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900"
                        )}
                        aria-pressed={verificationFilter === 'VERIFIED'}
                    >
                        <Store className={cn("h-3.5 w-3.5", verificationFilter === 'VERIFIED' ? "text-indigo-600" : "text-slate-400")} />
                        <span>Verified Vendors</span>
                        {verificationFilter === 'VERIFIED' && <Check className="h-3 w-3 text-indigo-700" />}
                    </button> */}
                </div>
            </div>

            {/* Accordion 1: Categories */}
            <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                    <button
                        type="button"
                        onClick={() => toggleSection('categories')}
                        className="flex-1 flex items-center justify-between text-left py-1 text-xs font-black uppercase tracking-wider text-slate-900 hover:text-blue-700 transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none rounded cursor-pointer"
                        aria-expanded={openSections.categories}
                    >
                        <span className="flex items-center gap-2">
                            <Layers className="h-3.5 w-3.5 text-blue-600" />
                            <span>Categories</span>
                            {selectedCategoryIds.length > 0 && (
                                <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                                    {selectedCategoryIds.length}
                                </span>
                            )}
                        </span>
                        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", openSections.categories && "rotate-180")} />
                    </button>
                    {selectedCategoryIds.length > 0 && (
                        <button
                            type="button"
                            onClick={onClearCategories}
                            className="text-[10px] font-bold text-slate-400 hover:text-red-600 transition ml-2 px-1 py-0.5 rounded cursor-pointer"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {openSections.categories && (
                    <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                        {/* Search in categories if > 5 categories */}
                        {categories.length > 5 && (
                            <div className="relative mb-2">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    value={categorySearch}
                                    onChange={(e) => setCategorySearch(e.target.value)}
                                    placeholder="Search categories..."
                                    className="w-full h-8 pl-8 pr-7 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
                                />
                                {categorySearch && (
                                    <button
                                        type="button"
                                        onClick={() => setCategorySearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="space-y-1 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                            {/* All Categories Master Option */}
                            {!categorySearch && (
                                <label className={cn(
                                    "flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition select-none border",
                                    selectedCategoryIds.length === 0
                                        ? "bg-blue-50/80 border-blue-200 text-blue-900 font-bold"
                                        : "border-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-100"
                                )}>
                                    <input
                                        type="checkbox"
                                        checked={selectedCategoryIds.length === 0}
                                        onChange={() => onClearCategories()}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                    />
                                    <span className="flex-1">All Categories</span>
                                    <span className="text-[10px] font-semibold text-slate-400 px-1.5 py-0.5 rounded-md bg-slate-100">
                                        {totalResults}
                                    </span>
                                </label>
                            )}

                            {displayedCategories.map((cat: any) => {
                                const catIdStr = String(cat.id);
                                const isChecked = selectedCategoryIds.includes(catIdStr);
                                return (
                                    <label
                                        key={cat.id}
                                        className={cn(
                                            "flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition select-none border",
                                            isChecked
                                                ? "bg-blue-50/90 border-blue-200 text-blue-900 font-bold shadow-2xs"
                                                : "border-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-100"
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => onSelectCategory(catIdStr)}
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                        />
                                        <span title={cat.name} className="truncate flex-1">
                                            {cat.name}
                                        </span>
                                    </label>
                                );
                            })}

                            {displayedCategories.length === 0 && (
                                <p className="text-xs text-slate-400 py-2 text-center">No categories matching "{categorySearch}"</p>
                            )}
                        </div>

                        {/* Show More / Less Toggle */}
                        {filteredCategories.length > 6 && !categorySearch && (
                            <button
                                type="button"
                                onClick={() => setShowAllCategories(!showAllCategories)}
                                className="w-full text-left text-[11px] font-bold text-blue-600 hover:text-blue-800 transition pt-1 pl-1 cursor-pointer"
                            >
                                {showAllCategories ? '− Show fewer categories' : `+ View ${filteredCategories.length - 6} more categories`}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Accordion 2: Product Types / Subcategories */}
            {availableSubcategories.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between mb-2">
                        <button
                            type="button"
                            onClick={() => toggleSection('subcategories')}
                            className="flex-1 flex items-center justify-between text-left py-1 text-xs font-black uppercase tracking-wider text-slate-900 hover:text-blue-700 transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none rounded cursor-pointer"
                            aria-expanded={openSections.subcategories}
                        >
                            <span className="flex items-center gap-2">
                                <Boxes className="h-3.5 w-3.5 text-indigo-600" />
                                <span>Product Type</span>
                                {selectedSubcategories.length > 0 && (
                                    <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                        {selectedSubcategories.length}
                                    </span>
                                )}
                            </span>
                            <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", openSections.subcategories && "rotate-180")} />
                        </button>
                        {selectedSubcategories.length > 0 && (
                            <button
                                type="button"
                                onClick={onClearSubcategories}
                                className="text-[10px] font-bold text-slate-400 hover:text-red-600 transition ml-2 px-1 py-0.5 rounded cursor-pointer"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {openSections.subcategories && (
                        <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                            {availableSubcategories.length > 6 && (
                                <div className="relative mb-2">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={subcategorySearch}
                                        onChange={(e) => setSubcategorySearch(e.target.value)}
                                        placeholder="Search product types..."
                                        className="w-full h-8 pl-8 pr-7 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
                                    />
                                    {subcategorySearch && (
                                        <button
                                            type="button"
                                            onClick={() => setSubcategorySearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="space-y-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                                {displayedSubcategories.map((sub: string) => {
                                    const isChecked = selectedSubcategories.includes(sub);
                                    return (
                                        <label
                                            key={sub}
                                            className={cn(
                                                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition select-none border",
                                                isChecked
                                                    ? "bg-indigo-50/90 border-indigo-200 text-indigo-900 font-bold shadow-2xs"
                                                    : "border-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-100"
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => onToggleSubcategory(sub)}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                            />
                                            <span title={sub} className="truncate flex-1">{sub}</span>
                                        </label>
                                    );
                                })}
                            </div>

                            {filteredSubcategories.length > 6 && !subcategorySearch && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllSubcategories(!showAllSubcategories)}
                                    className="w-full text-left text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition pt-1 pl-1 cursor-pointer"
                                >
                                    {showAllSubcategories ? '− Show fewer' : `+ View ${filteredSubcategories.length - 6} more`}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Accordion 3: Price Range (₹) */}
            {canViewPrice && (
                <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between mb-2">
                        <button
                            type="button"
                            onClick={() => toggleSection('price')}
                            className="flex-1 flex items-center justify-between text-left py-1 text-xs font-black uppercase tracking-wider text-slate-900 hover:text-blue-700 transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none rounded cursor-pointer"
                            aria-expanded={openSections.price}
                        >
                            <span className="flex items-center gap-2">
                                <IndianRupee className="h-3.5 w-3.5 text-emerald-600" />
                                <span>Price Range</span>
                                {priceFilter && (
                                    <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                        Active
                                    </span>
                                )}
                            </span>
                            <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", openSections.price && "rotate-180")} />
                        </button>
                        {priceFilter && (
                            <button
                                type="button"
                                onClick={() => {
                                    onPriceChange('');
                                    setMinPriceInput('');
                                    setMaxPriceInput('');
                                }}
                                className="text-[10px] font-bold text-slate-400 hover:text-red-600 transition ml-2 px-1 py-0.5 rounded cursor-pointer"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {openSections.price && (
                        <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                            {/* Preset Radio list */}
                            <div className="space-y-1">
                                {pricePresets.map(preset => {
                                    const isSelected = priceFilter === preset.val;
                                    return (
                                        <label
                                            key={preset.val}
                                            className={cn(
                                                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition select-none border",
                                                isSelected
                                                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-900 font-bold"
                                                    : "border-transparent text-slate-700 hover:bg-slate-50"
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="priceFilterPreset"
                                                checked={isSelected}
                                                onChange={() => {
                                                    onPriceChange(preset.val);
                                                    setMinPriceInput('');
                                                    setMaxPriceInput('');
                                                }}
                                                className="text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                                            />
                                            <span className="flex-1">{preset.label}</span>
                                        </label>
                                    );
                                })}
                            </div>

                            {/* Custom Price Range Inputs */}
                            <form onSubmit={handleApplyCustomPrice} className="pt-2 border-t border-slate-100">
                                <span className="text-[10.5px] font-bold text-slate-500 block mb-1.5">Custom Price (₹)</span>
                                <div className="flex items-center gap-1.5">
                                    <div className="relative flex-1">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                                        <input
                                            type="number"
                                            value={minPriceInput}
                                            onChange={(e) => setMinPriceInput(e.target.value)}
                                            placeholder="Min"
                                            min="0"
                                            className="w-full h-8 pl-6 pr-2 text-xs rounded-xl border border-slate-200 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                    <span className="text-slate-400 text-xs font-bold">–</span>
                                    <div className="relative flex-1">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                                        <input
                                            type="number"
                                            value={maxPriceInput}
                                            onChange={(e) => setMaxPriceInput(e.target.value)}
                                            placeholder="Max"
                                            min="0"
                                            className="w-full h-8 pl-6 pr-2 text-xs rounded-xl border border-slate-200 bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="h-8 px-3 rounded-xl bg-[#0b2447] text-white text-xs font-bold hover:bg-[#12335f] transition active:scale-95 shadow-xs cursor-pointer"
                                    >
                                        Go
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            )}

            {/* Accordion 4: Customer Ratings */}
            <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                    <button
                        type="button"
                        onClick={() => toggleSection('rating')}
                        className="flex-1 flex items-center justify-between text-left py-1 text-xs font-black uppercase tracking-wider text-slate-900 hover:text-blue-700 transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none rounded cursor-pointer"
                        aria-expanded={openSections.rating}
                    >
                        <span className="flex items-center gap-2">
                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                            <span>Customer Rating</span>
                            {minRatingFilter > 0 && (
                                <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    ★ {minRatingFilter}+
                                </span>
                            )}
                        </span>
                        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", openSections.rating && "rotate-180")} />
                    </button>
                    {minRatingFilter > 0 && (
                        <button
                            type="button"
                            onClick={() => onRatingChange(0)}
                            className="text-[10px] font-bold text-slate-400 hover:text-red-600 transition ml-2 px-1 py-0.5 rounded cursor-pointer"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {openSections.rating && (
                    <div className="space-y-1.5 pt-1 animate-in fade-in duration-200">
                        {[
                            { label: 'All Ratings', stars: 0, val: 0 },
                            { label: '4.5 & above', stars: 5, val: 4.5 },
                            { label: '4.0 & above', stars: 4, val: 4.0 },
                            { label: '3.5 & above', stars: 3, val: 3.5 }
                        ].map(rating => {
                            const isSelected = minRatingFilter === rating.val;
                            return (
                                <button
                                    key={rating.val}
                                    type="button"
                                    onClick={() => onRatingChange(rating.val)}
                                    className={cn(
                                        "w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition select-none border text-left",
                                        isSelected
                                            ? "bg-amber-50/90 border-amber-200 text-amber-900 font-bold"
                                            : "border-transparent text-slate-700 hover:bg-slate-50"
                                    )}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex items-center">
                                            {rating.val > 0 ? (
                                                Array.from({ length: 5 }).map((_, idx) => (
                                                    <Star
                                                        key={idx}
                                                        className={cn(
                                                            "h-3.5 w-3.5",
                                                            idx < Math.floor(rating.val)
                                                                ? "text-amber-400 fill-amber-400"
                                                                : "text-slate-200 fill-slate-200"
                                                        )}
                                                    />
                                                ))
                                            ) : (
                                                <span className="text-slate-500 font-medium">All Ratings</span>
                                            )}
                                        </div>
                                        {rating.val > 0 && <span className="text-slate-700 ml-1">{rating.label}</span>}
                                    </div>
                                    {isSelected && <Check className="h-3.5 w-3.5 text-amber-700" />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Accordion 5: Verified Sellers & Brands */}
            {availableSellers.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between mb-2">
                        <button
                            type="button"
                            onClick={() => toggleSection('sellers')}
                            className="flex-1 flex items-center justify-between text-left py-1 text-xs font-black uppercase tracking-wider text-slate-900 hover:text-blue-700 transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none rounded cursor-pointer"
                            aria-expanded={openSections.sellers}
                        >
                            <span className="flex items-center gap-2">
                                <Store className="h-3.5 w-3.5 text-purple-600" />
                                <span>Vendors & Brands</span>
                                {brandSearchFilter && (
                                    <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                                        1
                                    </span>
                                )}
                            </span>
                            <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", openSections.sellers && "rotate-180")} />
                        </button>
                        {brandSearchFilter && (
                            <button
                                type="button"
                                onClick={() => onBrandChange('')}
                                className="text-[10px] font-bold text-slate-400 hover:text-red-600 transition ml-2 px-1 py-0.5 rounded cursor-pointer"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {openSections.sellers && (
                        <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                            {availableSellers.length > 4 && (
                                <div className="relative mb-2">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        value={sellerSearch}
                                        onChange={(e) => setSellerSearch(e.target.value)}
                                        placeholder="Search vendor name..."
                                        className="w-full h-8 pl-8 pr-7 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
                                    />
                                    {sellerSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setSellerSearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="space-y-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                                {displayedSellers.map((sellerName: string) => {
                                    const isChecked = brandSearchFilter === sellerName;
                                    return (
                                        <label
                                            key={sellerName}
                                            className={cn(
                                                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition select-none border",
                                                isChecked
                                                    ? "bg-purple-50/90 border-purple-200 text-purple-900 font-bold shadow-2xs"
                                                    : "border-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-100"
                                            )}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => onBrandChange(isChecked ? '' : sellerName)}
                                                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 h-4 w-4"
                                            />
                                            <span title={sellerName} className="truncate flex-1">{sellerName}</span>
                                        </label>
                                    );
                                })}
                            </div>

                            {filteredSellers.length > 6 && !sellerSearch && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllSellers(!showAllSellers)}
                                    className="w-full text-left text-[11px] font-bold text-purple-600 hover:text-purple-800 transition pt-1 pl-1 cursor-pointer"
                                >
                                    {showAllSellers ? '− Show fewer' : `+ View ${filteredSellers.length - 6} more`}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Accordion 6: Location / District */}
            <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                    <button
                        type="button"
                        onClick={() => toggleSection('location')}
                        className="flex-1 flex items-center justify-between text-left py-1 text-xs font-black uppercase tracking-wider text-slate-900 hover:text-blue-700 transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none rounded cursor-pointer"
                        aria-expanded={openSections.location}
                    >
                        <span className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-rose-600" />
                            <span>Location & District</span>
                            {districtFilter && (
                                <span className="inline-flex items-center justify-center px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                    {districtFilter}
                                </span>
                            )}
                        </span>
                        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", openSections.location && "rotate-180")} />
                    </button>
                    {districtFilter && (
                        <button
                            type="button"
                            onClick={() => onDistrictChange('')}
                            className="text-[10px] font-bold text-slate-400 hover:text-red-600 transition ml-2 px-1 py-0.5 rounded cursor-pointer"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {openSections.location && (
                    <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                        {availableLocations.length > 4 && (
                            <div className="relative mb-2">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    value={locationSearch}
                                    onChange={(e) => setLocationSearch(e.target.value)}
                                    placeholder="Search location..."
                                    className="w-full h-8 pl-8 pr-7 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-slate-400"
                                />
                                {locationSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setLocationSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="space-y-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                            {/* All Locations option */}
                            <label
                                className={cn(
                                    "flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition select-none border",
                                    !districtFilter
                                        ? "bg-rose-50/80 border-rose-200 text-rose-900 font-bold shadow-2xs"
                                        : "border-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-100"
                                )}
                            >
                                <input
                                    type="radio"
                                    name="districtFilterOption"
                                    checked={!districtFilter}
                                    onChange={() => onDistrictChange('')}
                                    className="text-rose-600 focus:ring-rose-500 h-4 w-4"
                                />
                                <span className="flex-1">All Locations</span>
                            </label>

                            {displayedLocations.map((locName: string) => {
                                const isSelected = districtFilter.toLowerCase() === locName.toLowerCase();
                                return (
                                    <label
                                        key={locName}
                                        className={cn(
                                            "flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition select-none border",
                                            isSelected
                                                ? "bg-rose-50/80 border-rose-200 text-rose-900 font-bold shadow-2xs"
                                                : "border-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-100"
                                        )}
                                    >
                                        <input
                                            type="radio"
                                            name="districtFilterOption"
                                            checked={isSelected}
                                            onChange={() => onDistrictChange(isSelected ? '' : locName)}
                                            className="text-rose-600 focus:ring-rose-500 h-4 w-4"
                                        />
                                        <span title={locName} className="truncate flex-1">{locName}</span>
                                    </label>
                                );
                            })}

                            {displayedLocations.length === 0 && (
                                <p className="text-[11px] text-slate-400 italic py-1 px-2.5">
                                    {availableLocations.length === 0 ? 'No location records found' : 'No locations matching search'}
                                </p>
                            )}
                        </div>

                        {filteredLocations.length > 6 && !locationSearch && (
                            <button
                                type="button"
                                onClick={() => setShowAllLocations(!showAllLocations)}
                                className="w-full text-left text-[11px] font-bold text-rose-600 hover:text-rose-800 transition pt-1 pl-1 cursor-pointer"
                            >
                                {showAllLocations ? '− Show fewer' : `+ View ${filteredLocations.length - 6} more`}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Accordion 7: Procurement & Condition (if applicable) */}
            {(!isServices && (conditionFilter !== undefined || bulkDealFilter !== undefined)) && (
                <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between mb-2">
                        <button
                            type="button"
                            onClick={() => toggleSection('condition')}
                            className="flex-1 flex items-center justify-between text-left py-1 text-xs font-black uppercase tracking-wider text-slate-900 hover:text-blue-700 transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none rounded cursor-pointer"
                            aria-expanded={openSections.condition}
                        >
                            <span className="flex items-center gap-2">
                                <Tag className="h-3.5 w-3.5 text-cyan-600" />
                                <span>Condition & Procurement</span>
                            </span>
                            <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform duration-200", openSections.condition && "rotate-180")} />
                        </button>
                    </div>

                    {openSections.condition && (
                        <div className="space-y-2 pt-1 animate-in fade-in duration-200">
                            {onBulkDealToggle && (
                                <label className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer hover:bg-slate-50 transition border border-transparent">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(bulkDealFilter)}
                                        onChange={(e) => onBulkDealToggle(e.target.checked)}
                                        className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 h-4 w-4"
                                    />
                                    <span className="flex-1">Bulk Volume Pricing Available</span>
                                </label>
                            )}

                            {onConditionChange && (
                                <div className="space-y-1 pt-1 border-t border-slate-100">
                                    {[
                                        { label: 'All Conditions', val: '' },
                                        { label: 'Brand New', val: 'NEW' },
                                        { label: 'Refurbished / Certified', val: 'REFURBISHED' }
                                    ].map(cond => (
                                        <label
                                            key={cond.val}
                                            className={cn(
                                                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition border",
                                                conditionFilter === cond.val
                                                    ? "bg-cyan-50/80 border-cyan-200 text-cyan-900 font-bold"
                                                    : "border-transparent text-slate-700 hover:bg-slate-50"
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="conditionRadio"
                                                checked={conditionFilter === cond.val}
                                                onChange={() => onConditionChange(cond.val)}
                                                className="text-cyan-600 focus:ring-cyan-500 h-4 w-4"
                                            />
                                            <span>{cond.label}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Bottom Actions for Filter Panel */}
            <div className="border-t border-slate-100 pt-4 mt-2">
                <button
                    type="button"
                    onClick={onClearAll}
                    disabled={activeFiltersCount === 0}
                    className={cn(
                        "w-full h-10 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer",
                        activeFiltersCount > 0
                            ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 active:scale-98"
                            : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                    )}
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Clear All Filters</span>
                    {activeFiltersCount > 0 && <span>({activeFiltersCount})</span>}
                </button>
            </div>
        </div>
    );
}
