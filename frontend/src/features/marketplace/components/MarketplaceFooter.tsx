'use client';
import React from 'react';
import Link from 'next/link';
import {
    Mail,
    Phone,
    MapPin,
    ExternalLink,
    ChevronRight,
    ShieldCheck,
    Clock,
    HelpCircle,
    FileText,
    Building2,
    Lock,
    Headphones,
    CheckCircle2,
    ArrowUpRight,
    Sparkles,
    Globe
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

export function MarketplaceFooter() {
    let user: any = null;
    try {
        const auth = useAuth();
        user = auth ? auth.user : null;
    } catch (e) {
        // Safe fallback for static rendering
    }

    if (user) return null;

    return (
        <footer className="relative overflow-hidden bg-[#030d1c] text-white border-t border-slate-800/80" id="help">
            {/* Ambient Background Glows */}
            <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-blue-600/10 blur-[130px] pointer-events-none" />
            <div className="absolute -bottom-32 right-1/4 h-96 w-96 rounded-full bg-emerald-600/10 blur-[130px] pointer-events-none" />
            <div className="absolute top-1/2 right-10 h-80 w-80 rounded-full bg-indigo-600/5 blur-[120px] pointer-events-none" />

            {/* Top Quick Connect Callout Banner */}
            <div className="border-b border-white/[0.08] bg-gradient-to-r from-blue-950/40 via-slate-900/30 to-blue-950/40 backdrop-blur-md">
                <div className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6 2xl:px-8">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                        <div className="space-y-1">
                            {/* <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/10 border border-blue-400/20 px-3 py-1 text-xs font-bold text-sky-300">
                                <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
                                <span>Government-Grade B2B Digital Marketplace</span>
                            </div> */}
                            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                                Empowering Jharsuguda MSMEs & Enterprise Industry Buyers
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-300/80 max-w-2xl font-medium">
                                Direct procurement contracts, verified supplier profiles, GST/Udyam compliance, and transparent reverse auctions.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <Link
                                href="/seller/register"
                                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-white text-[#07172e] text-xs font-black hover:bg-slate-100 active:scale-95 transition-all shadow-lg shadow-black/30"
                            >
                                <span>Register as Seller / MSME</span>
                                <ArrowUpRight className="h-4 w-4 text-blue-700" />
                            </Link>
                            <Link
                                href="/buyer/register"
                                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold backdrop-blur-md active:scale-95 transition-all"
                            >
                                <span>Register as Buyer</span>
                                <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle Initiative Bar */}
            <div className="border-b border-white/[0.06] bg-white/[0.015]">
                <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 2xl:px-8">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        {/* District Logo & Title */}
                        <div className="flex items-center gap-3.5">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-0.5 shadow-lg shadow-blue-950/50 ring-1 ring-blue-400/30">
                                <Building2 className="h-6 w-6 text-sky-200" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <span className="text-lg font-black tracking-tight text-white">JsgSmile</span>
                                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                                        Verified Platform
                                    </span>
                                </div>
                                <p className="text-xs font-medium text-slate-400">
                                    District Administration, Jharsuguda • Government of Odisha
                                </p>
                            </div>
                        </div>

                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-2.5 text-xs">
                            <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300 font-semibold backdrop-blur-xs">
                                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                                <span>GST & Udyam Verified</span>
                            </div>
                            <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300 font-semibold backdrop-blur-xs">
                                <Lock className="h-4 w-4 text-sky-400" />
                                <span>256-Bit SSL Encrypted</span>
                            </div>
                            <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300 font-semibold backdrop-blur-xs">
                                <Globe className="h-4 w-4 text-amber-400" />
                                <span>Public Procurement Linkage</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Navigation Grid */}
            <div className="mx-auto max-w-[1680px] px-4 py-12 sm:px-6 2xl:px-8">
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 xl:gap-10">
                    {/* Column 1: District Secretariat & Identity */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black tracking-widest uppercase text-white flex items-center gap-2">
                            <span className="h-3 w-1 bg-blue-500 rounded-full inline-block" />
                            District Secretariat
                        </h3>
                        <p className="text-xs text-slate-300/80 leading-relaxed font-medium">
                            Jharsuguda Synergy for MSME & Industry Linkage Ecosystem connects local manufacturing units, SHG producers, and enterprise buyers with institutional transparency.
                        </p>

                        <div className="space-y-3 pt-2">
                            <div className="flex items-start gap-3 text-xs text-slate-300/90 font-medium">
                                <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-sky-400 shrink-0">
                                    <MapPin className="h-3.5 w-3.5" />
                                </div>
                                <span className="leading-snug">District Collectorate, Jharsuguda, Odisha — 768201</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-300/90 font-medium">
                                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-sky-400 shrink-0">
                                    <Mail className="h-3.5 w-3.5" />
                                </div>
                                <a
                                    href="mailto:support@jsgsmile.in"
                                    className="hover:text-sky-300 transition-colors underline-offset-2 hover:underline"
                                >
                                    support@jsgsmile.in
                                </a>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-300/90 font-medium">
                                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-500/10 text-sky-400 shrink-0">
                                    <Phone className="h-3.5 w-3.5" />
                                </div>
                                <span>+91 (06645) 272-100 / 1800-345-7111</span>
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Marketplace Portals */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black tracking-widest uppercase text-white flex items-center gap-2">
                            <span className="h-3 w-1 bg-emerald-500 rounded-full inline-block" />
                            Marketplace Portals
                        </h3>
                        <ul className="space-y-2">
                            {[
                                { label: 'Register as Buyer', href: '/buyer/register' },
                                { label: 'Register as Seller / MSME', href: '/seller/register' },
                                { label: 'Account Login', href: '/login' },
                                { label: 'Browse Products Catalogue', href: '/marketplace/products' },
                                { label: 'Browse Industrial Services', href: '/marketplace/services' },
                                { label: 'Verified Sellers Directory', href: '/marketplace/sellers' },
                                { label: 'Large Industry Buyers', href: '/marketplace/buyers' },
                            ].map((item) => (
                                <li key={item.label}>
                                    <Link
                                        href={item.href}
                                        className="group flex items-center gap-2 text-xs font-semibold text-slate-300/80 hover:text-white transition-colors duration-200"
                                    >
                                        <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all duration-200" />
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 3: Governance & Compliance */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black tracking-widest uppercase text-white flex items-center gap-2">
                            <span className="h-3 w-1 bg-amber-500 rounded-full inline-block" />
                            Governance & Policies
                        </h3>
                        <ul className="space-y-2">
                            {[
                                { label: 'Terms & Conditions', href: '/terms-of-use' },
                                { label: 'Website Policies & Privacy', href: '/website-policies' },
                                { label: 'Copyright Policy', href: '/copyright' },
                                { label: 'Hyperlinking Policy', href: '/hyperlinking-policy' },
                                { label: 'Public Procurement Disclaimer', href: '/disclaimer' },
                                { label: 'Caution Notice against Fraud', href: '/caution-notice' },
                                { label: 'Portal Sitemap', href: '/sitemap' },
                            ].map((item) => (
                                <li key={item.label}>
                                    <Link
                                        href={item.href}
                                        className="group flex items-center gap-2 text-xs font-semibold text-slate-300/80 hover:text-white transition-colors duration-200"
                                    >
                                        <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all duration-200" />
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 4: Dedicated Helpdesk & Support Box */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black tracking-widest uppercase text-white flex items-center gap-2">
                            <span className="h-3 w-1 bg-violet-500 rounded-full inline-block" />
                            Helpdesk & Support
                        </h3>
                        <ul className="space-y-2">
                            {[
                                { label: 'Help Center & Guides', href: '/help' },
                                { label: 'Frequently Asked Questions', href: '/faqs' },
                                { label: 'Contact District MSME Cell', href: '/contact-us' },
                                { label: 'Grievance Redressal Portal', href: '/feedback' },
                            ].map((item) => (
                                <li key={item.label}>
                                    <Link
                                        href={item.href}
                                        className="group flex items-center gap-2 text-xs font-semibold text-slate-300/80 hover:text-white transition-colors duration-200"
                                    >
                                        <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-violet-400 group-hover:translate-x-1 transition-all duration-200" />
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>

                        {/* Premium Glassmorphic Helpline Card */}
                        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-blue-950/70 via-slate-900/60 to-slate-950/80 border border-blue-400/20 shadow-xl shadow-black/40 backdrop-blur-md">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                                        Toll Free Helpdesk
                                    </span>
                                </div>
                                <Headphones className="w-4 h-4 text-sky-400" />
                            </div>
                            <a
                                href="tel:18003457111"
                                className="block text-xl font-black text-white tracking-tight hover:text-sky-300 transition-colors"
                            >
                                1800-345-7111
                            </a>
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mt-1.5">
                                <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                <span>Mon–Sat: 9:00 AM – 6:00 PM IST</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Bar: Copyright & Compliance */}
            <div className="border-t border-white/[0.08] bg-black/40 backdrop-blur-md">
                <div className="mx-auto flex max-w-[1680px] flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-6 2xl:px-8">
                    <p className="text-[11px] font-medium text-slate-400 text-center sm:text-left">
                        © {new Date().getFullYear()} <span className="font-bold text-white">JsgSmile</span> — Jharsuguda Synergy for MSME & Industry Linkage Ecosystem. All Rights Reserved.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] font-medium text-slate-400">
                        <Link href="/terms-of-use" className="hover:text-white transition-colors">Terms of Use</Link>
                        <span className="text-slate-600">•</span>
                        <Link href="/website-policies" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-300">
                            Last Updated: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
