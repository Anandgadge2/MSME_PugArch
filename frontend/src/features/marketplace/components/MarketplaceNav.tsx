'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
    ChevronDown, 
    Menu, 
    Briefcase, 
    Users, 
    Layers, 
    ClipboardList,
    Store,
    Building2
} from 'lucide-react';
import type { MarketplaceCategory } from '../api';

const CATEGORY_GROUPING: Record<string, string[]> = {
    'Electrical & Electronics': [
        'IT & Computer Equipment',
        'Electrical Cables & Power Equipment',
        'Telecom & Communication Equipment',
        'Power & Energy Equipment'
    ],
    'Mechanical & Engineering': [
        'Industrial Machinery & Spare Parts',
        'Automation & Robotics',
        'Bearings & Mechanical Components',
        'Tools & Industrial Hardware',
        'Conveyor & Material Handling Equipment',
        'Pumps, Motors & Hydraulics',
        'Industrial Seals & Gaskets',
        'Welding & Cutting Equipment',
        'Industrial Fasteners & Components',
        'Hydraulics & Pneumatics'
    ],
    'Construction & Building Materials': [
        'Cement & Concrete Products',
        'Pipes, Tiles & Hardware',
        'Construction & Civil Work Services',
        'Furniture & Interior Supplies'
    ],
    'Industrial Chemicals': [
        'Refractories',
        'Polymer & Plastic Products',
        'Laboratory Equipment & Chemicals',
        'Gas Equipment & Cylinders'
    ],
    'Automobile Parts & Services': [
        'Tyres & Rubber Products',
        'Fuel, Oil & Gas'
    ],
    'Trading & Distribution': [
        'Logistics & Supply Services',
        'Retail & Commercial Supply',
        'FMCG & Daily Utility Supply',
        'Textile & Garments Supply'
    ],
    'General Industrial Supplier': [
        'Medical & Healthcare Supplies',
        'Safety Equipment & Industrial Safety',
        'Office Equipment & Stationery',
        'Agriculture & Nursery',
        'Steel & Metal Products',
        'Industrial Consumables',
        'Packaging & Printing',
        'Engineering Consultancy Services',
        'Industrial Maintenance Services',
        'Environmental & Waste Management',
        'Mining & Coal Equipment',
        'OEM / Manufacturing Vendor',
        'Repair & Service Provider',
        'Multi-category Industrial Vendor',
        'Fabrication & Welding Services'
    ]
};

const buildMegaMenu = (categories: MarketplaceCategory[]) => {
    const assignedIds = new Set<number>();
    const groups: { parent: MarketplaceCategory; children: MarketplaceCategory[] }[] = [];
    
    Object.entries(CATEGORY_GROUPING).forEach(([parentName, childNames]) => {
        const parent = categories.find(c => c.name === parentName);
        if (!parent) return;
        assignedIds.add(parent.id);
        
        const children = childNames
            .map(name => categories.find(c => c.name === name))
            .filter((c): c is MarketplaceCategory => c !== undefined);
            
        children.forEach(c => assignedIds.add(c.id));
        groups.push({ parent, children });
    });
    
    const unassigned = categories.filter(c => !assignedIds.has(c.id));
    if (unassigned.length > 0) {
        groups.push({
            parent: { id: 0, name: 'More Categories', slug: 'more', type: 'OTHER' } as MarketplaceCategory,
            children: unassigned
        });
    }
    
    const columns: typeof groups[] = [[], [], [], [], []];
    let colIndex = 0;
    groups.forEach(group => {
        columns[colIndex].push(group);
        colIndex = (colIndex + 1) % 5;
    });
    
    return columns;
};

interface MarketplaceNavProps {
    categories: MarketplaceCategory[];
}

export function MarketplaceNav({ categories }: MarketplaceNavProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const navRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(e.target as Node)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggleDropdown = (name: string) => {
        setActiveDropdown(prev => (prev === name ? null : name));
    };

    const handleLinkClick = () => {
        setActiveDropdown(null);
        setMobileMenuOpen(false);
    };

    const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
        handleLinkClick();
        if (typeof window !== 'undefined' && window.location.pathname === '/') {
            const el = document.getElementById(targetId);
            if (el) {
                e.preventDefault();
                el.scrollIntoView({ behavior: 'smooth' });
                window.history.pushState(null, '', `/#${targetId}`);
            }
        }
    };

    const megaMenuColumns = useMemo(() => buildMegaMenu(categories), [categories]);

    return (
        <div ref={navRef} className="hidden md:block relative z-40 w-full bg-white border-b border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(15,23,42,0.04)]">
            {/* Desktop Navigation */}
            <div className="hidden md:flex mx-auto max-w-[1680px] h-12 items-center px-3 sm:px-6 2xl:px-8 gap-6">
                
                {/* SELLER DROPDOWN */}
                <div 
                    className="relative h-full flex items-center group"
                    onMouseEnter={() => setActiveDropdown('seller')}
                    onMouseLeave={() => setActiveDropdown(null)}
                >
                    <button 
                        onClick={() => toggleDropdown('seller')}
                        className={`flex items-center gap-1.5 h-full text-[11px] uppercase tracking-wider font-bold transition-colors ${activeDropdown === 'seller' ? 'text-[#0b2447]' : 'text-slate-600 hover:text-[#0b2447]'}`}
                    >
                        <Store className="h-4 w-4" />
                        <span>Seller</span>
                        <ChevronDown className={`h-3 w-3 transition-transform ${activeDropdown === 'seller' ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {activeDropdown === 'seller' && (
                        <div className="absolute top-full left-0 mt-0 w-56 rounded-xl border border-slate-200 bg-white shadow-xl p-2 animate-in fade-in slide-in-from-top-2">
                            <Link href="/marketplace/requirements" onClick={handleLinkClick} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0b2447] transition-colors">
                                <ClipboardList className="h-4 w-4 text-slate-400" /> Active Procurement
                            </Link>
                            <Link href="/#verified-buyers" onClick={(e) => handleAnchorClick(e, 'verified-buyers')} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0b2447] transition-colors">
                                <Building2 className="h-4 w-4 text-slate-400" />Verified Buyers
                            </Link>
                              <Link href="/marketplace/buyers" onClick={handleLinkClick} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0b2447] transition-colors">
                                <ClipboardList className="h-4 w-4 text-slate-400" /> Publish Requirements
                            </Link>
                        </div>
                    )}
                </div>

                {/* BUYER DROPDOWN */}
                <div 
                    className="relative h-full flex items-center group"
                    onMouseEnter={() => setActiveDropdown('buyer')}
                    onMouseLeave={() => setActiveDropdown(null)}
                >
                    <button 
                        onClick={() => toggleDropdown('buyer')}
                        className={`flex items-center gap-1.5 h-full text-[11px] uppercase tracking-wider font-bold transition-colors ${activeDropdown === 'buyer' ? 'text-[#0b2447]' : 'text-slate-600 hover:text-[#0b2447]'}`}
                    >
                        <Briefcase className="h-4 w-4" />
                        <span>Buyer</span>
                        <ChevronDown className={`h-3 w-3 transition-transform ${activeDropdown === 'buyer' ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {activeDropdown === 'buyer' && (
                        <div className="absolute top-full left-0 mt-0 w-60 rounded-xl border border-slate-200 bg-white shadow-xl p-2 animate-in fade-in slide-in-from-top-2">
                            <Link href="/marketplace/products" onClick={handleLinkClick} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0b2447] transition-colors">
                                <Layers className="h-4 w-4 text-slate-400" /> All Categories
                            </Link>
                            <Link href="/#verified-sellers" onClick={(e) => handleAnchorClick(e, 'verified-sellers')} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0b2447] transition-colors">
                                <Users className="h-4 w-4 text-slate-400" /> Verified Partners
                            </Link>
                          
                        </div>
                    )}
                </div>

                {/* CATEGORIES MEGA MENU */}
                <div 
                    className="static h-full flex items-center group"
                    onMouseEnter={() => setActiveDropdown('categories')}
                    onMouseLeave={() => setActiveDropdown(null)}
                >
                    <button 
                        onClick={() => toggleDropdown('categories')}
                        className={`flex items-center gap-1.5 h-full text-[11px] uppercase tracking-wider font-bold transition-colors ${activeDropdown === 'categories' ? 'text-[#0b2447]' : 'text-slate-600 hover:text-[#0b2447]'}`}
                    >
                        <Layers className="h-4 w-4" />
                        <span>Categories</span>
                        <ChevronDown className={`h-3 w-3 transition-transform ${activeDropdown === 'categories' ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {activeDropdown === 'categories' && (
                        <div className="absolute top-full left-4 right-4 mt-0 rounded-b-xl border border-t-0 border-slate-200 bg-white shadow-2xl p-6 animate-in fade-in slide-in-from-top-2 z-50">
                            <div className="grid grid-cols-5 gap-6">
                                {megaMenuColumns.map((col, colIdx) => (
                                    <div key={colIdx} className="flex flex-col gap-8">
                                        {col.map((group, groupIdx) => (
                                            <div key={groupIdx} className="flex flex-col">
                                                {group.parent.id === 0 ? (
                                                    <span className="text-[13px] font-black text-[#0b2447] mb-2.5 uppercase tracking-wider">
                                                        {group.parent.name}
                                                    </span>
                                                ) : (
                                                    <Link 
                                                        href={`/marketplace/products?categoryId=${group.parent.id}`}
                                                        onClick={handleLinkClick}
                                                        className="text-[13px] font-black text-[#0b2447] mb-2.5 hover:text-blue-600 transition-colors uppercase tracking-wider"
                                                    >
                                                        {group.parent.name}
                                                    </Link>
                                                )}
                                                <div className="flex flex-col gap-2">
                                                    {group.children.map(child => (
                                                        <Link
                                                            key={child.id}
                                                            href={`/marketplace/products?categoryId=${child.id}`}
                                                            onClick={handleLinkClick}
                                                            className="text-[13px] font-medium text-slate-500 hover:text-[#0b2447] hover:underline transition-colors truncate"
                                                        >
                                                            {child.name}
                                                        </Link>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end">
                                <Link 
                                    href="/marketplace/products" 
                                    onClick={handleLinkClick}
                                    className="text-xs font-black text-[#0b2447] hover:underline flex items-center gap-1"
                                >
                                    Browse All Categories & Products &rarr;
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                <div className="h-4 w-px bg-slate-200 mx-2"></div>

                {/* DIRECT LINKS */}
                <div className="flex items-center gap-6">
                    {/* <Link href="/marketplace/requirements" className="text-[11px] uppercase tracking-wider font-bold text-slate-600 hover:text-[#0b2447] transition-colors">
                        Active Requirements
                    </Link> */}
                    <Link href="/marketplace/sellers" className="text-[11px] uppercase tracking-wider font-bold text-slate-600 hover:text-[#0b2447] transition-colors">
                        Top Sellers
                    </Link>
                    <Link href="/marketplace/buyers" className="text-[11px] uppercase tracking-wider font-bold text-slate-600 hover:text-[#0b2447] transition-colors">
                        Top Buyers
                    </Link>
                    <Link href="/marketplace/products?sort=most_purchased" className="text-[11px] uppercase tracking-wider font-bold text-slate-600 hover:text-[#0b2447] transition-colors">
                        Top Bought Items
                    </Link>
                    <Link href="/marketplace/benifits" className="text-[11px] uppercase tracking-wider font-bold text-slate-600 hover:text-[#0b2447] transition-colors">
                        Benifits
                    </Link>
                    <Link href="/marketplace/services" className="text-[11px] uppercase tracking-wider font-bold text-slate-600 hover:text-[#0b2447] transition-colors">
                        Active services
                    </Link>
                </div>
            </div>
        </div>
    );
}
