'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMarketplaceCart } from '../hooks/useMarketplaceCart';
import {
    Search, ShoppingCart, User, Phone, Mail,
    HelpCircle, LogIn, Store, Building2, ChevronDown,
    Menu, X, ArrowRight, ShieldCheck, Layers, ClipboardList, Briefcase, Users, FileText, ShoppingBag
} from 'lucide-react';
import { cn } from '../../../lib/utils';

interface Props { user?: any; }

const signupOptions = [
    { href: '/seller/register', label: 'Sign Up as Seller', desc: 'List products & reach enterprise buyers', icon: <Store className="h-4 w-4" /> },
    { href: '/buyer/register', label: 'Sign Up as Buyer', desc: 'Procure verified products & post RFQs', icon: <Building2 className="h-4 w-4" /> },
    { href: '/hershg/register', label: 'Sign Up as SHG', desc: 'Empower local women artisans & groups', icon: <User className="h-4 w-4" /> }
];

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

    const [searchQ, setSearchQ] = useState(searchParams?.get('q') || '');
    const [showSignup, setShowSignup] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const signupRef = useRef<HTMLDivElement>(null);

    // Sync input with URL search param
    useEffect(() => {
        setSearchQ(searchParams?.get('q') || '');
    }, [searchParams]);

    /* Close dropdowns on outside click */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (signupRef.current && !signupRef.current.contains(e.target as Node)) setShowSignup(false);
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

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = searchQ.trim();
        if (trimmed) {
            router.push(`/marketplace/products?q=${encodeURIComponent(trimmed)}`);
        } else {
            router.push('/marketplace/products');
        }
        setMobileMenuOpen(false);
    };

    const handleClearSearch = () => {
        setSearchQ('');
        if (pathname === '/marketplace/products') {
            const params = new URLSearchParams(searchParams?.toString() || '');
            params.delete('q');
            params.set('page', '1');
            const qs = params.toString();
            router.push(qs ? `/marketplace/products?${qs}` : '/marketplace/products');
        }
    };

    return (
        <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(15,23,42,0.04)] back">


            {/* ════════════════════════════════════════════════════════════════════
                MAIN NAVBAR
            ════════════════════════════════════════════════════════════════════ */}
            <nav className="relative" aria-label="Main navigation">
                <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-2 px-3 sm:px-6 2xl:px-8">

                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-white p-1 shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:border-[#0b2447]/30 group-hover:shadow-md">
                            <img src="/logoo.png" alt="SMiLE MSME Logo" className="h-full w-full object-contain" />
                        </div>
                        <div className="min-w-0 leading-tight">
                            <p className="truncate text-base font-black tracking-tight text-[#0b2447] transition-colors group-hover:text-blue-900">JsgSMILE</p>
                            <p className="truncate text-[9.5px] font-bold text-slate-400">MSME Marketplace Portal</p>
                        </div>
                    </Link>

                    {/* Search Bar (Desktop - hidden on mobile) */}
                    <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl mx-4 items-center h-10 rounded-xl border border-slate-200/90 bg-slate-50/80 shadow-inner focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0b2447]/20 focus-within:border-[#0b2447] transition-all overflow-hidden">
                        <Search className="h-4 w-4 text-slate-400 shrink-0 ml-3.5 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQ}
                            onChange={e => setSearchQ(e.target.value)}
                            placeholder="Search verified products, services, sellers…"
                            className="flex-1 min-w-0 h-full bg-transparent text-xs sm:text-sm pl-2.5 pr-2 outline-none font-medium text-slate-800 placeholder:text-slate-400"
                        />
                        {searchQ && (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="h-5 w-5 mr-1 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition text-xs font-bold"
                                title="Clear search"
                            >
                                ✕
                            </button>
                        )}
                        <button
                            type="submit"
                            className="h-full px-5 bg-[#0b2447] text-white text-xs font-bold hover:bg-[#12335f] active:scale-95 transition-all shrink-0 flex items-center gap-1.5"
                        >
                            <span>Search</span>
                        </button>
                    </form>

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

                        {/* Cart Button */}
                        {/* <button
                            onClick={() => {
                                if (user) {
                                    router.push('/cart');
                                } else {
                                    router.push('/marketplace/cart');
                                }
                            }}
                            className="relative inline-flex items-center justify-center h-9 w-9 rounded-xl border border-slate-200/90 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all"
                            aria-label={`Cart${cartCount > 0 ? ` (${cartCount} items)` : ''}`}
                            title="Cart"
                        >
                            <ShoppingCart className="h-4 w-4" />
                            {cartCount > 0 && (
                                <span className="absolute -right-1.5 -top-1.5 z-10 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 text-[9.5px] font-black text-white shadow-sm ring-2 ring-white animate-pulse">
                                    {cartCount > 99 ? '99+' : cartCount}
                                </span>
                            )}
                        </button> */}

                        {/* Help button */}
                        {/* <button
                            onClick={() => router.push('/help')}
                            className="hidden xl:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100/80 hover:bg-slate-200/80 active:scale-95 transition-all"
                        >
                            <HelpCircle className="h-3.5 w-3.5 text-slate-500" />
                            <span>Help</span>
                        </button> */}
                    </div>

                    {/* Mobile Controls (Cart + Menu Toggle) */}
                    <div className="flex items-center gap-1.5 md:hidden shrink-0">
                        {/* Hamburger Menu Toggle */}
                        <button
                            onClick={() => setMobileMenuOpen(v => !v)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b2447] text-white shadow-md active:scale-95 transition-all"
                            aria-label="Toggle Navigation Menu"
                        >
                            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </nav>

            {/* ════════════════════════════════════════════════════════════════════
                MOBILE FULL-WIDTH DROPDOWN MENU
            ════════════════════════════════════════════════════════════════════ */}
            {mobileMenuOpen && (
                <div className="absolute top-full left-0 w-full max-h-[calc(100dvh-64px)] overflow-y-auto bg-white shadow-2xl border-t border-slate-200 md:hidden z-40 animate-in slide-in-from-top-2 flex flex-col pb-safe">
                    {/* Drawer Search */}
                    <div className="p-3.5 bg-slate-50 border-b border-slate-100">
                            <form onSubmit={handleSearch} className="flex items-center h-10 rounded-xl border border-slate-200 bg-white px-3 shadow-inner focus-within:ring-2 focus-within:ring-[#0b2447]/20 focus-within:border-[#0b2447] transition-all">
                                <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
                                <input
                                    type="text"
                                    value={searchQ}
                                    onChange={e => setSearchQ(e.target.value)}
                                    placeholder="Search products, services..."
                                    className="flex-1 min-w-0 bg-transparent text-sm font-medium outline-none text-slate-800 placeholder:text-slate-400"
                                />
                                <button type="submit" className="text-xs font-black uppercase text-[#0b2447] px-1.5 py-1 rounded hover:bg-slate-100">
                                    Go
                                </button>
                            </form>
                        </div>

                        {/* Drawer Body */}
                        <div className="flex-1 p-4 space-y-4">
                            {!user ? (
                                <div className="space-y-2.5">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">Account Access</p>
                                    <Link
                                        href="/login"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-[#0b2447] text-white text-xs font-bold shadow-sm hover:bg-[#12335f] transition-all active:scale-98"
                                    >
                                        <LogIn className="h-4 w-4 text-[#c8a45c]" />
                                        Login to Account
                                    </Link>

                                    <div className="space-y-1.5 pt-2">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">New Registration</p>
                                        {signupOptions.map(opt => (
                                             <Link
                                                key={opt.href}
                                                href={opt.href}
                                                onClick={() => setMobileMenuOpen(false)}
                                                className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200/80 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-98"
                                            >
                                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0b2447]/10 text-[#0b2447]">
                                                    {opt.icon}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-900 truncate">{opt.label}</p>
                                                    <p className="text-[10px] font-medium text-slate-400 truncate">{opt.desc}</p>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">Signed in as {user.name}</p>
                                    <Link
                                        href="/dashboard"
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-[#0b2447] text-white text-xs font-bold shadow-sm"
                                    >
                                        <User className="h-4 w-4 text-[#c8a45c]" />
                                        Go to Dashboard
                                    </Link>
                                </div>
                            )}

                            <div className="space-y-1.5 pt-3 border-t border-slate-100">
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">Quick Links</p>
                                <Link
                                    href="/marketplace/categories"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center justify-between p-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-[#0b2447]" /> All Categories
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                                </Link>
                                <Link
                                    href="/marketplace/products"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center justify-between p-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <ShoppingBag className="h-4 w-4 text-[#0b2447]" /> Browse Products
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                                </Link>
                                <Link
                                    href="/marketplace/services"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center justify-between p-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-[#0b2447]" /> Browse Services
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                                </Link>
                                <Link
                                    href="/marketplace/sellers"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center justify-between p-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <Store className="h-4 w-4 text-[#0b2447]" /> Top Sellers
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                                </Link>
                                <Link
                                    href="/marketplace/buyers"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center justify-between p-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <Briefcase className="h-4 w-4 text-[#0b2447]" /> Top Buyers
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                                </Link>
                                <Link
                                    href="/marketplace/requirements"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center justify-between p-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-[#0b2447]" /> Active Requirements
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                                </Link>
                            </div>
                        </div>

                        {/* Drawer Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-400 text-center shrink-0">
                            Official MSME Portal · Jharsuguda District
                        </div>
                </div>
            )}
        </header>
    );
}
