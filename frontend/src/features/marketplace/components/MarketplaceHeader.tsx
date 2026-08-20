'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useMarketplaceCart } from '../hooks/useMarketplaceCart';
import {
    Search, ShoppingCart, User, Phone, Mail, Globe,
    HelpCircle, LogIn, Store, Building2, ChevronDown,
    Sun, Moon, X
} from 'lucide-react';
import { cn } from '../../../lib/utils';

interface Props { user: any; }

const signupOptions = [
    { href: '/seller/register', label: 'Sign Up as Seller', icon: <Store className="h-4 w-4" /> },
    { href: '/buyer/register', label: 'Sign Up as Buyer', icon: <Building2 className="h-4 w-4" /> },
    { href: '/hershg/register', label: 'Sign Up as SHG', icon: <User className="h-4 w-4" /> }
];

function SignupMenu({ onSelect }: { onSelect: () => void }) {
    return (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-52 sm:w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150" role="menu">
            {signupOptions.map(option => (
                <Link
                    key={option.href}
                    href={option.href}
                    onClick={onSelect}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    role="menuitem"
                >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0b2447]/5 text-[#0b2447]">{option.icon}</span>
                    {option.label}
                </Link>
            ))}
        </div>
    );
}

/* ── Persisted font-size ─────────────────────────────────────────────────── */
function useFontSize() {
    const [size, setSize] = useState(100);

    useEffect(() => {
        const saved = Number(localStorage.getItem('jsg_font_size') || 100);
        setSize(saved);
        document.documentElement.style.fontSize = `${saved}%`;
    }, []);

    const adjust = useCallback((delta: number) => {
        setSize(prev => {
            const next = Math.max(80, Math.min(130, prev + delta));
            document.documentElement.style.fontSize = `${next}%`;
            localStorage.setItem('jsg_font_size', String(next));
            return next;
        });
    }, []);

    const reset = useCallback(() => {
        setSize(100);
        document.documentElement.style.fontSize = '100%';
        localStorage.setItem('jsg_font_size', '100');
    }, []);

    return { size, adjust, reset };
}

/* ── Persisted high-contrast ─────────────────────────────────────────────── */
function useContrast() {
    const [on, setOn] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('jsg_high_contrast') === 'true';
        setOn(saved);
        if (saved) document.documentElement.classList.add('high-contrast');
    }, []);

    const toggle = useCallback(() => {
        setOn(prev => {
            const next = !prev;
            next
                ? document.documentElement.classList.add('high-contrast')
                : document.documentElement.classList.remove('high-contrast');
            localStorage.setItem('jsg_high_contrast', String(next));
            return next;
        });
    }, []);

    return { on, toggle };
}

export function MarketplaceHeader({ user }: Props) {
    const router = useRouter();
    const { size, adjust, reset } = useFontSize();
    const { on: highContrast, toggle: toggleContrast } = useContrast();
    const { count: cartCount } = useMarketplaceCart();

    const [searchQ, setSearchQ] = useState('');
    const [showSignup, setShowSignup] = useState(false);
    const [showMobileSearch, setShowMobileSearch] = useState(false);

    const signupRef = useRef<HTMLDivElement>(null);
    const mobileSearchInputRef = useRef<HTMLInputElement>(null);

    /* Close dropdowns on outside click */
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (signupRef.current && !signupRef.current.contains(e.target as Node)) setShowSignup(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    /* Focus search input on mobile when opened */
    useEffect(() => {
        if (showMobileSearch) {
            mobileSearchInputRef.current?.focus();
        }
    }, [showMobileSearch]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQ.trim()) {
            setShowMobileSearch(false);
            router.push(`/marketplace/products?q=${encodeURIComponent(searchQ.trim())}`);
        }
    };

    return (
        <header className="liquid-glass-header">
            {/* ════════════════════════════════════════════════════════════════════
          MAIN NAVBAR (Header with Logo, Search, Login, Sign Up, Cart)
          ════════════════════════════════════════════════════════════════════ */}
            <nav className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80" aria-label="Main navigation">
                <div className="mx-auto flex h-16 sm:h-18 max-w-[1680px] items-center justify-between gap-2 px-3 sm:px-6 2xl:px-8">

                    {/* Logo ── Left */}
                    <Link href="/" className="flex shrink-0 items-center gap-2 sm:gap-2.5 group">
                        <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center overflow-hidden transition-all group-hover:scale-105 rounded-full border border-slate-200/80 bg-white p-0.5 shadow-sm">
                            <img src="/logoo.png" alt="SMiLE MSME Logo" className="h-full w-full object-contain" />
                        </div>
                        <div className="min-w-0 leading-tight">
                            <p className="truncate text-base sm:text-lg font-bold text-[#0b2447] tracking-tight">JsgSMILE</p>
                            <p className="mt-0.5 hidden text-[10px] font-medium text-slate-400 sm:block">MSME Marketplace Portal</p>
                        </div>
                    </Link>

                    {/* Desktop Search bar ── Center (hidden on mobile, inline on md+) */}
                    <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl mx-4 items-center h-10 sm:h-11 rounded-xl border border-slate-200 bg-slate-50 focus-within:ring-2 focus-within:ring-[#0b2447]/20 focus-within:border-[#0b2447] transition-colors overflow-hidden">
                        <Search className="h-4 w-4 text-slate-400 shrink-0 ml-3.5 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQ}
                            onChange={e => setSearchQ(e.target.value)}
                            placeholder="Search products, services, sellers…"
                            className="flex-1 min-w-0 h-full bg-transparent text-sm pl-2.5 pr-2 outline-none text-slate-800 placeholder:text-slate-400"
                        />
                        <button
                            type="submit"
                            className="h-full px-5 rounded-none bg-[#0b2447] text-white text-sm font-semibold hover:bg-[#12335f] transition-colors shrink-0 flex items-center gap-1.5 [&:not(:disabled):hover]:translate-y-0 [&:not(:disabled):hover]:filter-none"
                        >
                            Search
                        </button>
                    </form>

                    {/* Right action cluster ── Always visible on mobile & desktop */}
                    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">

                        {/* Mobile Search Button Toggle */}
                        <button
                            type="button"
                            onClick={() => setShowMobileSearch(v => !v)}
                            className={cn(
                                "md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors shadow-sm active:scale-95 [&:not(:disabled):hover]:translate-y-0",
                                showMobileSearch
                                    ? "border-[#0b2447] bg-[#0b2447] text-white"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                            )}
                            title="Search"
                            aria-label="Search"
                        >
                            {showMobileSearch ? <X className="h-4 w-4" /> : <Search className="h-4 w-4 text-slate-700" />}
                        </button>

                        {!user ? (
                            <>
                                {/* Login Button */}
                                <Link
                                    href="/login"
                                    className="inline-flex h-10 items-center gap-1.5 sm:gap-2 rounded-xl border border-slate-200 bg-white px-3 sm:px-4 text-xs sm:text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 active:scale-95 shadow-sm shrink-0 [&:not(:disabled):hover]:translate-y-0"
                                >
                                    <LogIn className="h-4 w-4 shrink-0 text-slate-700" />
                                    <span>Login</span>
                                </Link>

                                {/* Sign Up dropdown */}
                                <div ref={signupRef} className="relative shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setShowSignup(v => !v)}
                                        className="inline-flex h-10 items-center gap-1 sm:gap-1.5 rounded-xl bg-[#0b2447] px-3 sm:px-4 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[#12335f] active:scale-95 shadow-sm [&:not(:disabled):hover]:translate-y-0"
                                        aria-haspopup="menu"
                                        aria-expanded={showSignup}
                                    >
                                        <User className="h-4 w-4 shrink-0 text-white" />
                                        <span>Sign Up</span>
                                        <ChevronDown className={cn("h-3.5 w-3.5 text-white/90 transition-transform duration-200", showSignup && "rotate-180")} />
                                    </button>
                                    {showSignup && <SignupMenu onSelect={() => setShowSignup(false)} />}
                                </div>
                            </>
                        ) : (
                            /* Dashboard (logged in) */
                            <Link
                                href="/dashboard"
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0b2447] px-3.5 sm:px-4 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[#12335f] active:scale-95 shadow-sm shrink-0 [&:not(:disabled):hover]:translate-y-0"
                            >
                                <User className="h-4 w-4 shrink-0" />
                                <span>Dashboard</span>
                            </Link>
                        )}

                        {/* Help (desktop only) */}
                        <button
                            onClick={() => router.push('/help')}
                            className="hidden lg:inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 active:scale-95 transition-colors shadow-sm [&:not(:disabled):hover]:translate-y-0"
                        >
                            <HelpCircle className="h-4 w-4 shrink-0 text-slate-500" />
                            <span>Help</span>
                        </button>

                        {/* Cart Button */}
                        <button
                            onClick={() => {
                                if (user) {
                                    router.push('/cart');
                                } else {
                                    router.push('/marketplace/cart');
                                }
                            }}
                            className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-95 transition-colors shadow-sm [&:not(:disabled):hover]:translate-y-0"
                            aria-label={`Cart${cartCount > 0 ? ` (${cartCount} items)` : ''}`}
                            title="Cart"
                        >
                            <ShoppingCart className="h-4 w-4 text-slate-700" />
                            {cartCount > 0 && (
                                <span className="absolute -right-1.5 -top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ef4444] px-1.5 text-[10px] font-black leading-none text-white shadow ring-2 ring-white tabular-nums">
                                    {cartCount > 99 ? '99+' : cartCount}
                                </span>
                            )}
                        </button>

                    </div>
                </div>

                {/* Mobile Expandable Search Bar */}
                {showMobileSearch && (
                    <div className="md:hidden border-t border-slate-200/80 bg-slate-50/95 px-3 py-2.5 shadow-md animate-in slide-in-from-top-2 duration-150">
                        <form onSubmit={handleSearch} className="flex items-center gap-2">
                            <div className="flex flex-1 items-center h-10 rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-[#0b2447]/20 focus-within:border-[#0b2447] overflow-hidden px-3 shadow-sm">
                                <Search className="h-4 w-4 text-slate-400 shrink-0" />
                                <input
                                    ref={mobileSearchInputRef}
                                    type="text"
                                    value={searchQ}
                                    onChange={e => setSearchQ(e.target.value)}
                                    placeholder="Search products, services, sellers…"
                                    className="flex-1 min-w-0 h-full bg-transparent text-sm pl-2 pr-1 outline-none text-slate-800 placeholder:text-slate-400"
                                />
                                {searchQ && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQ('')}
                                        className="text-slate-400 hover:text-slate-600 text-xs px-1"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                            <button
                                type="submit"
                                className="h-10 px-4 rounded-xl bg-[#0b2447] text-white text-sm font-semibold hover:bg-[#12335f] shrink-0 active:scale-95 transition-all shadow-sm flex items-center gap-1"
                            >
                                <span>Search</span>
                            </button>
                        </form>
                    </div>
                )}
            </nav>
        </header>
    );
}
