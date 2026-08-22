'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
    ChevronDown, 
    Menu, 
    Briefcase, 
    Users, 
    Layers, 
    ClipboardList,
    Award,
    TrendingUp,
    Store,
    Building2
} from 'lucide-react';
import type { MarketplaceCategory } from '../api';

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

    const topCategories = categories.slice(0, 12);

    return (
        <div ref={navRef} className="relative z-40 w-full bg-white border-b border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(15,23,42,0.04)]">
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
                            <Link href="/marketplace/buyers" onClick={handleLinkClick} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0b2447] transition-colors">
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
                            <Link href="/marketplace/categories" onClick={handleLinkClick} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0b2447] transition-colors">
                                <Layers className="h-4 w-4 text-slate-400" /> Categories
                            </Link>
                            <Link href="/" onClick={handleLinkClick} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0b2447] transition-colors">
                                <Users className="h-4 w-4 text-slate-400" /> Verified Partners
                            </Link>
                          
                        </div>
                    )}
                </div>

                {/* CATEGORIES MEGA MENU */}
                <div 
                    className="relative h-full flex items-center group"
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
                        <div className="absolute top-full left-0 mt-0 w-[600px] rounded-xl border border-slate-200 bg-white shadow-xl p-5 animate-in fade-in slide-in-from-top-2">
                            <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                                {topCategories.map(cat => (
                                    <Link 
                                        key={cat.id} 
                                        href={`/marketplace/products?categoryId=${cat.id}`}
                                        onClick={handleLinkClick}
                                        className="flex items-center text-xs font-semibold text-slate-600 hover:text-[#0b2447] truncate transition-colors hover:bg-slate-50 p-2 rounded-lg"
                                    >
                                        <span className="truncate">{cat.name}</span>
                                    </Link>
                                ))}
                            </div>
                            <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
                                <Link 
                                    href="/marketplace/categories" 
                                    onClick={handleLinkClick}
                                    className="text-xs font-black text-[#0b2447] hover:underline"
                                >
                                    View All Categories &rarr;
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

            {/* Mobile Navigation Toggle */}
            <div className="md:hidden flex items-center justify-between px-3 h-12 bg-slate-50 border-b border-slate-100">
                <span className="text-xs font-black text-[#0b2447] tracking-tight uppercase">Marketplace Menu</span>
                <button 
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-white border border-slate-200 text-[#0b2447] text-[10px] font-black uppercase tracking-wider shadow-sm transition active:scale-95"
                >
                    <Menu className="h-3.5 w-3.5" />
                    <span>Menu</span>
                </button>
            </div>

            {/* Mobile Dropdown Menu */}
            {mobileMenuOpen && (
                <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-slate-200 shadow-xl overflow-hidden animate-in slide-in-from-top-2">
                    <div className="flex flex-col p-2 space-y-1 max-h-[70vh] overflow-y-auto">
                        
                        <div className="p-2 bg-slate-50 rounded-lg">
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-2 px-2">Seller</p>
                            <Link href="/tenders" onClick={handleLinkClick} className="block px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white rounded-md">
                                Active Tenders
                            </Link>
                            <Link href="/marketplace/buyers" onClick={handleLinkClick} className="block px-3 py-2 text-xs font-bold text-slate-700 hover:bg-white rounded-md">
                                Buyers
                            </Link>
                        </div>

                        <div className="p-2">
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-2 px-2">Buyer</p>
                            <Link href="/marketplace/categories" onClick={handleLinkClick} className="block px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-md">
                                Categories
                            </Link>
                            <Link href="/marketplace/requirements" onClick={handleLinkClick} className="block px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-md">
                                Active Requirements
                            </Link>
                            <Link href="/marketplace/sellers" onClick={handleLinkClick} className="block px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-md">
                                Top Sellers
                            </Link>
                            <Link href="/marketplace/buyers" onClick={handleLinkClick} className="block px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-md">
                                Top Buyers
                            </Link>
                            <Link href="/marketplace/products?sort=most_purchased" onClick={handleLinkClick} className="block px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-md">
                                Top Bought Items
                            </Link>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
