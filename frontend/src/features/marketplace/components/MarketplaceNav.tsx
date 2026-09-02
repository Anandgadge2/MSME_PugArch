'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { 
    ChevronDown, 
    ChevronRight,
    Briefcase, 
    Users, 
    Layers, 
    ClipboardList,
    Store,
    Building2,
    Zap,
    Cog,
    FlaskConical,
    Car,
    Truck,
    Wrench,
    ShieldCheck,
    ArrowRight,
    Sparkles,
    Boxes
} from 'lucide-react';
import type { MarketplaceCategory } from '../api';
import { getCategoryImageUrl } from '../utils/categoryImages';

// Domain visual styling metadata for dynamic sector classification
interface DomainVisualConfig {
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    bgAccent: string;
    borderAccent: string;
    keywords: string[];
}

const DOMAIN_CONFIGS: Record<string, DomainVisualConfig> = {
    electrical: {
        icon: Zap,
        accentColor: 'text-amber-600',
        bgAccent: 'bg-amber-500/10',
        borderAccent: 'border-amber-500/20',
        keywords: ['electrical', 'electronic', 'power', 'cable', 'telecom', 'computer', 'it &', 'energy', 'transformer', 'solar']
    },
    mechanical: {
        icon: Cog,
        accentColor: 'text-blue-600',
        bgAccent: 'bg-blue-500/10',
        borderAccent: 'border-blue-500/20',
        keywords: ['mechanical', 'machinery', 'automation', 'robot', 'bearing', 'tool', 'hardware', 'conveyor', 'pump', 'motor', 'seal', 'gasket', 'welding', 'fastener', 'hydraulic', 'pneumatic']
    },
    construction: {
        icon: Building2,
        accentColor: 'text-orange-600',
        bgAccent: 'bg-orange-500/10',
        borderAccent: 'border-orange-500/20',
        keywords: ['construction', 'building', 'cement', 'concrete', 'pipe', 'tile', 'civil', 'furniture', 'interior', 'structural']
    },
    chemicals: {
        icon: FlaskConical,
        accentColor: 'text-emerald-600',
        bgAccent: 'bg-emerald-500/10',
        borderAccent: 'border-emerald-500/20',
        keywords: ['chemical', 'refractor', 'polymer', 'plastic', 'laboratory', 'gas', 'cylinder', 'petrochemical', 'paint', 'fertilizer']
    },
    automotive: {
        icon: Car,
        accentColor: 'text-rose-600',
        bgAccent: 'bg-rose-500/10',
        borderAccent: 'border-rose-500/20',
        keywords: ['auto', 'vehicle', 'tyre', 'rubber', 'fuel', 'oil', 'gas', 'battery', 'engine', 'transport']
    },
    trading: {
        icon: Truck,
        accentColor: 'text-indigo-600',
        bgAccent: 'bg-indigo-500/10',
        borderAccent: 'border-indigo-500/20',
        keywords: ['trading', 'distribution', 'logistics', 'supply', 'retail', 'fmcg', 'textile', 'garment', 'packaging']
    },
    services: {
        icon: Wrench,
        accentColor: 'text-cyan-600',
        bgAccent: 'bg-cyan-500/10',
        borderAccent: 'border-cyan-500/20',
        keywords: ['service', 'consultancy', 'maintenance', 'environment', 'waste', 'mining', 'coal', 'oem', 'repair', 'fabrication', 'engineering']
    },
    supplies: {
        icon: ShieldCheck,
        accentColor: 'text-teal-600',
        bgAccent: 'bg-teal-500/10',
        borderAccent: 'border-teal-500/20',
        keywords: ['safety', 'mro', 'medical', 'health', 'stationery', 'office', 'agriculture', 'steel', 'metal', 'consumable']
    }
};

const DEFAULT_DOMAIN_CONFIG: DomainVisualConfig = {
    icon: Boxes,
    accentColor: 'text-slate-700',
    bgAccent: 'bg-slate-500/10',
    borderAccent: 'border-slate-500/20',
    keywords: []
};

// Helper to filter out corrupt test strings (e.g. single character spam like "teeeeeee")
const isLegitimateCategory = (name: string) => {
    if (!name || typeof name !== 'string') return false;
    const clean = name.trim().toLowerCase();
    if (clean.length < 2) return false;
    if (clean === 'test' || clean === 'testing' || clean === 'temp') return false;
    if (/(.)\1{3,}/.test(clean)) return false;
    return true;
};

export interface DynamicCategoryGroup {
    id: string;
    name: string;
    parentCategory?: MarketplaceCategory;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    bgAccent: string;
    borderAccent: string;
    items: MarketplaceCategory[];
}

/**
 * Builds dynamic category groups directly from DB records.
 * Supports explicit parent-child DB relationships (parentId) as well as dynamic domain classification.
 */
function buildDynamicCategoryGroups(dbCategories: MarketplaceCategory[]): DynamicCategoryGroup[] {
    const valid = dbCategories.filter(c => isLegitimateCategory(c.name));
    if (valid.length === 0) return [];

    // Check if database has explicit parent-child relations
    const hasParentIds = valid.some(c => c.parentId != null && c.parentId > 0);

    if (hasParentIds) {
        // 1. Explicit DB Hierarchy
        const parentMap = new Map<number, MarketplaceCategory>();
        const childrenByParentId = new Map<number, MarketplaceCategory[]>();
        const topLevelOrphan: MarketplaceCategory[] = [];

        valid.forEach(c => {
            if (!c.parentId) {
                parentMap.set(c.id, c);
            }
        });

        valid.forEach(c => {
            if (c.parentId && parentMap.has(c.parentId)) {
                const list = childrenByParentId.get(c.parentId) || [];
                list.push(c);
                childrenByParentId.set(c.parentId, list);
            } else if (!parentMap.has(c.id)) {
                topLevelOrphan.push(c);
            }
        });

        const groups: DynamicCategoryGroup[] = [];

        parentMap.forEach(parent => {
            const domainKey = classifyDomainKey(parent.name, parent.slug);
            const style = DOMAIN_CONFIGS[domainKey] || DEFAULT_DOMAIN_CONFIG;
            const items = childrenByParentId.get(parent.id) || [];
            groups.push({
                id: `parent-${parent.id}`,
                name: parent.name,
                parentCategory: parent,
                icon: style.icon,
                accentColor: style.accentColor,
                bgAccent: style.bgAccent,
                borderAccent: style.borderAccent,
                items
            });
        });

        if (topLevelOrphan.length > 0) {
            groups.push({
                id: 'other-categories',
                name: 'Additional Categories',
                icon: DEFAULT_DOMAIN_CONFIG.icon,
                accentColor: DEFAULT_DOMAIN_CONFIG.accentColor,
                bgAccent: DEFAULT_DOMAIN_CONFIG.bgAccent,
                borderAccent: DEFAULT_DOMAIN_CONFIG.borderAccent,
                items: topLevelOrphan
            });
        }

        return groups.filter(g => g.items.length > 0 || g.parentCategory);
    }

    // 2. Dynamic Domain Clustering from Flat DB Categories
    const domainBuckets: Record<string, MarketplaceCategory[]> = {
        electrical: [],
        mechanical: [],
        construction: [],
        chemicals: [],
        automotive: [],
        trading: [],
        services: [],
        supplies: [],
        other: []
    };

    const domainTitles: Record<string, string> = {
        electrical: 'Electrical & Electronics',
        mechanical: 'Mechanical & Engineering',
        construction: 'Construction & Materials',
        chemicals: 'Industrial Chemicals',
        automotive: 'Automobile & Fuel',
        trading: 'Trading & Logistics',
        services: 'Industrial Services & Maintenance',
        supplies: 'Safety, MRO & Supplies',
        other: 'Specialized Industrial Categories'
    };

    valid.forEach(category => {
        const domainKey = classifyDomainKey(category.name, category.slug);
        domainBuckets[domainKey].push(category);
    });

    const groups: DynamicCategoryGroup[] = [];

    Object.entries(domainBuckets).forEach(([key, items]) => {
        if (items.length === 0) return; // Only show non-empty groups from DB
        const style = DOMAIN_CONFIGS[key] || DEFAULT_DOMAIN_CONFIG;
        
        // Find if any item in this bucket is the designated parent/umbrella category
        const parentCandidate = items.find(i => 
            i.name.toLowerCase().trim() === domainTitles[key]?.toLowerCase().trim()
        );

        // Filter out the umbrella category from subcategory list if present
        const subItems = parentCandidate ? items.filter(i => i.id !== parentCandidate.id) : items;

        groups.push({
            id: `domain-${key}`,
            name: parentCandidate ? parentCandidate.name : domainTitles[key] || 'Categories',
            parentCategory: parentCandidate,
            icon: style.icon,
            accentColor: style.accentColor,
            bgAccent: style.bgAccent,
            borderAccent: style.borderAccent,
            items: subItems.length > 0 ? subItems : (parentCandidate ? [parentCandidate] : [])
        });
    });

    return groups;
}

function classifyDomainKey(name: string, slug?: string): string {
    const text = `${name || ''} ${slug || ''}`.toLowerCase();
    
    for (const [key, config] of Object.entries(DOMAIN_CONFIGS)) {
        if (config.keywords.some(kw => text.includes(kw))) {
            return key;
        }
    }
    return 'other';
}

interface MarketplaceNavProps {
    categories: MarketplaceCategory[];
}

export function MarketplaceNav({ categories }: MarketplaceNavProps) {
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [hoveredCategory, setHoveredCategory] = useState<MarketplaceCategory | null>(null);
    
    const navRef = useRef<HTMLDivElement>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Filter valid categories directly from database prop
    const dbCategories = useMemo(() => {
        return (categories || []).filter(c => isLegitimateCategory(c.name));
    }, [categories]);

    // Build dynamic groups directly from database records
    const dynamicGroups = useMemo(() => {
        return buildDynamicCategoryGroups(dbCategories);
    }, [dbCategories]);

    // Balance active groups across 4 columns dynamically
    const balancedColumns = useMemo(() => {
        const cols: DynamicCategoryGroup[][] = [[], [], [], []];
        if (dynamicGroups.length === 0) return cols;

        // Distribute groups across 4 columns based on item count weight
        const colItemCounts = [0, 0, 0, 0];

        dynamicGroups.forEach(group => {
            let minColIndex = 0;
            let minCount = colItemCounts[0];
            for (let i = 1; i < 4; i++) {
                if (colItemCounts[i] < minCount) {
                    minCount = colItemCounts[i];
                    minColIndex = i;
                }
            }

            cols[minColIndex].push(group);
            colItemCounts[minColIndex] += (group.items.length + 2);
        });

        return cols;
    }, [dynamicGroups]);

    // Default spotlight category from DB
    const activeSpotlight = useMemo(() => {
        if (hoveredCategory) return hoveredCategory;
        return dbCategories.find(c => (c.productCount || 0) > 0) || dbCategories[0] || null;
    }, [hoveredCategory, dbCategories]);

    // Trending categories dynamically from DB
    const trendingCategories = useMemo(() => {
        return dbCategories.slice(0, 5);
    }, [dbCategories]);

    // Debounced hover handlers
    const handleMouseEnter = useCallback((name: string) => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        setActiveDropdown(name);
    }, []);

    const handleMouseLeave = useCallback(() => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        hoverTimeoutRef.current = setTimeout(() => {
            setActiveDropdown(null);
            setHoveredCategory(null);
        }, 180);
    }, []);

    const toggleDropdown = useCallback((name: string) => {
        setActiveDropdown(prev => (prev === name ? null : name));
    }, []);

    const handleLinkClick = useCallback(() => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setActiveDropdown(null);
        setHoveredCategory(null);
    }, []);

    // Close on click outside & Escape key
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(e.target as Node)) {
                setActiveDropdown(null);
                setHoveredCategory(null);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && activeDropdown) {
                setActiveDropdown(null);
                setHoveredCategory(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        };
    }, [activeDropdown]);

    return (
        <nav 
            ref={navRef} 
            aria-label="Marketplace Navigation"
            className="hidden md:block relative z-40 w-full bg-white border-b border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(15,23,42,0.04)]"
        >
            {/* Desktop Navigation Bar */}
            <div className="mx-auto max-w-[1680px] h-12 items-center px-4 sm:px-6 2xl:px-8 flex gap-5">
                
                {/* 1. SELLER DROPDOWN */}
                <div 
                    className="relative h-full flex items-center"
                    onMouseEnter={() => handleMouseEnter('seller')}
                    onMouseLeave={handleMouseLeave}
                >
                    <button 
                        type="button"
                        onClick={() => toggleDropdown('seller')}
                        aria-expanded={activeDropdown === 'seller'}
                        aria-haspopup="true"
                        className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-[11px] uppercase tracking-wider font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2447] ${
                            activeDropdown === 'seller' 
                                ? 'bg-slate-100 text-[#0b2447]' 
                                : 'text-slate-600 hover:text-[#0b2447] hover:bg-slate-50'
                        }`}
                    >
                        <Store className="h-4 w-4 text-slate-500" aria-hidden="true" />
                        <span>Seller</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${activeDropdown === 'seller' ? 'rotate-180 text-[#0b2447]' : 'text-slate-400'}`} aria-hidden="true" />
                    </button>
                    
                    {activeDropdown === 'seller' && (
                        <div 
                            role="menu"
                            aria-label="Seller Actions"
                            className="absolute top-full left-0 mt-0.5 w-60 rounded-xl border border-slate-200/90 bg-white/98 backdrop-blur-md shadow-xl p-2 animate-in fade-in slide-in-from-top-2 duration-150 z-50 before:content-[''] before:absolute before:-top-2 before:left-0 before:right-0 before:h-2"
                        >
                            <Link 
                                href="/marketplace/requirements" 
                                onClick={handleLinkClick}
                                role="menuitem"
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-blue-50/80 hover:text-[#0b2447] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2447]"
                            >
                                <div className="p-1 rounded-md bg-blue-100 text-blue-700">
                                    <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="leading-tight">Active Procurement</p>
                                    <p className="text-[10px] text-slate-400 font-normal">View open RFQs & tenders</p>
                                </div>
                            </Link>

                            <Link 
                                href="/#verified-buyers" 
                                onClick={handleLinkClick}
                                role="menuitem"
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-blue-50/80 hover:text-[#0b2447] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2447]"
                            >
                                <div className="p-1 rounded-md bg-amber-100 text-amber-700">
                                    <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="leading-tight">Verified Buyers</p>
                                    <p className="text-[10px] text-slate-400 font-normal">PSUs, Large Corporates</p>
                                </div>
                            </Link>

                            <Link 
                                href="/marketplace/buyers" 
                                onClick={handleLinkClick}
                                role="menuitem"
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-blue-50/80 hover:text-[#0b2447] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2447]"
                            >
                                <div className="p-1 rounded-md bg-emerald-100 text-emerald-700">
                                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="leading-tight">Publish Requirements</p>
                                    <p className="text-[10px] text-slate-400 font-normal">Post tender demands</p>
                                </div>
                            </Link>
                        </div>
                    )}
                </div>

                {/* 2. BUYER DROPDOWN */}
                <div 
                    className="relative h-full flex items-center"
                    onMouseEnter={() => handleMouseEnter('buyer')}
                    onMouseLeave={handleMouseLeave}
                >
                    <button 
                        type="button"
                        onClick={() => toggleDropdown('buyer')}
                        aria-expanded={activeDropdown === 'buyer'}
                        aria-haspopup="true"
                        className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-[11px] uppercase tracking-wider font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2447] ${
                            activeDropdown === 'buyer' 
                                ? 'bg-slate-100 text-[#0b2447]' 
                                : 'text-slate-600 hover:text-[#0b2447] hover:bg-slate-50'
                        }`}
                    >
                        <Briefcase className="h-4 w-4 text-slate-500" aria-hidden="true" />
                        <span>Buyer</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${activeDropdown === 'buyer' ? 'rotate-180 text-[#0b2447]' : 'text-slate-400'}`} aria-hidden="true" />
                    </button>
                    
                    {activeDropdown === 'buyer' && (
                        <div 
                            role="menu"
                            aria-label="Buyer Actions"
                            className="absolute top-full left-0 mt-0.5 w-60 rounded-xl border border-slate-200/90 bg-white/98 backdrop-blur-md shadow-xl p-2 animate-in fade-in slide-in-from-top-2 duration-150 z-50 before:content-[''] before:absolute before:-top-2 before:left-0 before:right-0 before:h-2"
                        >
                            <Link 
                                href="/marketplace/products" 
                                onClick={handleLinkClick}
                                role="menuitem"
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-blue-50/80 hover:text-[#0b2447] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2447]"
                            >
                                <div className="p-1 rounded-md bg-blue-100 text-blue-700">
                                    <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="leading-tight">All Categories</p>
                                    <p className="text-[10px] text-slate-400 font-normal">Explore full catalogue</p>
                                </div>
                            </Link>

                            <Link 
                                href="/#verified-sellers" 
                                onClick={handleLinkClick}
                                role="menuitem"
                                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-blue-50/80 hover:text-[#0b2447] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2447]"
                            >
                                <div className="p-1 rounded-md bg-emerald-100 text-emerald-700">
                                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="leading-tight">Verified Partners</p>
                                    <p className="text-[10px] text-slate-400 font-normal">ZED Certified Suppliers</p>
                                </div>
                            </Link>
                        </div>
                    )}
                </div>

                {/* 3. CLEAN DYNAMIC CATEGORIES MEGA MENU TRAY (NO DARK HEADER, NO SEARCH BAR) */}
                <div 
                    className="static h-full flex items-center"
                    onMouseEnter={() => handleMouseEnter('categories')}
                    onMouseLeave={handleMouseLeave}
                >
                    <button 
                        type="button"
                        onClick={() => toggleDropdown('categories')}
                        aria-expanded={activeDropdown === 'categories'}
                        aria-haspopup="dialog"
                        aria-controls="category-mega-tray"
                        className={`flex items-center gap-2 h-9 px-3.5 rounded-lg text-[11px] uppercase tracking-wider font-extrabold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2447] ${
                            activeDropdown === 'categories' 
                                ? 'bg-slate-100 text-[#0b2447]' 
                                : 'text-slate-600 hover:text-[#0b2447] hover:bg-slate-50'   }`}
                    >
                        <Layers className={`h-4 w-4 ${activeDropdown === 'categories' ? 'text-amber-400' : 'text-[#0b2447]'}`} aria-hidden="true" />
                        <span>Categories</span>
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${activeDropdown === 'categories' ? 'rotate-180 text-amber-400' : 'text-slate-500'}`} aria-hidden="true" />
                    </button>
                    
                    {/* MEGA MENU CONTAINER */}
                    {activeDropdown === 'categories' && (
                        <div 
                            id="category-mega-tray"
                            role="dialog"
                            aria-label="Category Catalogue Explorer"
                            className="absolute top-full left-2 right-2 sm:left-4 sm:right-4 mt-0.5 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50 before:content-[''] before:absolute before:-top-3 before:left-0 before:right-0 before:h-3"
                        >
                            {/* DYNAMIC BALANCED DB GRID + SPOTLIGHT SHOWCASE */}
                            <div className="p-6 grid grid-cols-12 gap-6 max-h-[580px] overflow-y-auto">
                                {/* 4 BALANCED COLUMNS (Takes 9 of 12 grid spans) */}
                                <div className="col-span-12 lg:col-span-9 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                                    {balancedColumns.map((col, colIdx) => (
                                        <div key={colIdx} className="flex flex-col gap-6">
                                            {col.map((group) => {
                                                const GroupIcon = group.icon;
                                                return (
                                                    <div 
                                                        key={group.id} 
                                                        className="flex flex-col rounded-xl p-3 border border-slate-100 bg-slate-50/40 hover:bg-slate-50/80 transition-colors"
                                                    >
                                                        {/* GROUP HEADER */}
                                                        <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-slate-200/70">
                                                            <div className={`p-1.5 rounded-lg ${group.bgAccent} ${group.accentColor} shrink-0`}>
                                                                <GroupIcon className="h-4 w-4" aria-hidden="true" />
                                                            </div>
                                                            {group.parentCategory ? (
                                                                <Link
                                                                    href={`/marketplace/products?categoryId=${group.parentCategory.id}`}
                                                                    onClick={handleLinkClick}
                                                                    onMouseEnter={() => setHoveredCategory(group.parentCategory || null)}
                                                                    className="text-xs font-black text-[#0b2447] hover:text-blue-600 transition-colors uppercase tracking-tight leading-snug line-clamp-1"
                                                                >
                                                                    {group.name}
                                                                </Link>
                                                            ) : (
                                                                <span className="text-xs font-black text-[#0b2447] uppercase tracking-tight leading-snug line-clamp-1">
                                                                    {group.name}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* DATABASE SUBCATEGORIES LIST */}
                                                        <div className="flex flex-col gap-1">
                                                            {group.items.map(item => (
                                                                <Link
                                                                    key={item.id}
                                                                    href={`/marketplace/products?categoryId=${item.id}`}
                                                                    onClick={handleLinkClick}
                                                                    onMouseEnter={() => setHoveredCategory(item)}
                                                                    className="group flex items-center justify-between px-2 py-1.5 rounded-md text-[12px] font-medium text-slate-600 hover:text-blue-700 hover:bg-white transition-all duration-150"
                                                                >
                                                                    <span className="truncate group-hover:font-semibold">{item.name}</span>
                                                                    <ChevronRight className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-blue-600 transition-opacity shrink-0 ml-1" aria-hidden="true" />
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>

                                {/* RIGHT SPOTLIGHT SHOWCASE PANEL */}
                                <div className="col-span-12 lg:col-span-3 flex flex-col justify-between rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 via-white to-blue-50/40 p-4 shadow-sm">
                                    {activeSpotlight ? (
                                        <div className="flex flex-col">
                                            {/* <div className="flex items-center justify-between mb-3">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                                    Spotlight Preview
                                                </span>
                                            </div> */}

                                            {/* CATEGORY PHOTO */}
                                            <div className="relative aspect-auto w-full rounded-xl overflow-hidden border border-slate-200/80 bg-slate-100 shadow-inner mb-3">
                                                <img 
                                                    src={getCategoryImageUrl(activeSpotlight)} 
                                                    alt="" 
                                                    className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex items-end p-3">
                                                    <p className="text-xs font-bold text-white leading-tight">
                                                        {activeSpotlight.name}
                                                    </p>
                                                </div>
                                            </div>

                                            <p className="text-[11px] text-slate-500 line-clamp-3 mb-4">
                                                {activeSpotlight.description || `Discover verified MSME manufacturers, suppliers, and genuine industrial components under ${activeSpotlight.name}.`}
                                            </p>

                                            {/* SPOTLIGHT ACTIONS */}
                                            <div className="flex flex-col gap-2">
                                                <Link
                                                    href={`/marketplace/products?categoryId=${activeSpotlight.id}`}
                                                    onClick={handleLinkClick}
                                                    className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg bg-[#0b2447] hover:bg-[#12335f] text-white text-xs font-bold transition-colors shadow-sm"
                                                >
                                                    <span>Explore Products</span>
                                                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                                                </Link>

                                                <Link
                                                    href="/marketplace/buyers"
                                                    onClick={handleLinkClick}
                                                    className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-xs font-semibold transition-colors"
                                                >
                                                    <ClipboardList className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                                                    <span>Post Requirement (RFQ)</span>
                                                </Link>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-6 text-center text-slate-400">
                                            <Layers className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                            <p className="text-xs">Hover over any category to preview industrial catalog</p>
                                        </div>
                                    )}

                                   
                                </div>
                            </div>

                            {/* BOTTOM SHORTCUTS BAR (DYNAMIC FROM DB CATEGORIES) */}
                            <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Trending:</span>
                                    {trendingCategories.map(cat => (
                                        <Link 
                                            key={cat.id}
                                            href={`/marketplace/products?categoryId=${cat.id}`}
                                            onClick={handleLinkClick}
                                            className="px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-700 text-[11px] font-medium transition-colors"
                                        >
                                            {cat.name}
                                        </Link>
                                    ))}
                                </div>

                                <Link 
                                    href="/marketplace/products" 
                                    onClick={handleLinkClick}
                                    className="font-bold text-[#0b2447] hover:text-blue-700 flex items-center gap-1.5 transition-colors"
                                >
                                    <span>Explore Full Catalogue ({dbCategories.length} Categories)</span>
                                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-4 w-px bg-slate-200 mx-1" aria-hidden="true" />

                {/* 4. DIRECT LINKS */}
                <div className="flex items-center gap-5">
                    <Link 
                        href="/marketplace/sellers" 
                        className="text-[11px] uppercase tracking-wider font-bold text-slate-600 hover:text-[#0b2447] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2447] rounded px-1"
                    >
                        Top Sellers
                    </Link>
                    <Link 
                        href="/marketplace/buyers" 
                        className="text-[11px] uppercase tracking-wider font-bold text-slate-600 hover:text-[#0b2447] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2447] rounded px-1"
                    >
                        Top Buyers
                    </Link>
                    <Link 
                        href="/marketplace/products?sort=most_purchased" 
                        className="text-[11px] uppercase tracking-wider font-bold text-slate-600 hover:text-[#0b2447] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2447] rounded px-1"
                    >
                        Top Bought Items
                    </Link>
                    <Link 
                        href="/marketplace/benefits" 
                        className="text-[11px] uppercase tracking-wider font-bold text-slate-600 hover:text-[#0b2447] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2447] rounded px-1"
                    >
                        Benefits
                    </Link>
                    <Link 
                        href="/marketplace/services" 
                        className="text-[11px] uppercase tracking-wider font-bold text-slate-600 hover:text-[#0b2447] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2447] rounded px-1"
                    >
                        Active Services
                    </Link>
                </div>
            </div>
        </nav>
    );
}


