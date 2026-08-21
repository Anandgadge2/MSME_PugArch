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
        <footer className="bg-[#051326] text-white relative overflow-hidden border-t border-slate-800" id="help">
            {/* Background subtle illumination */}
            <div className="absolute top-0 left-1/3 w-[500px] h-[250px] bg-blue-600/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-10 w-[400px] h-[200px] bg-violet-600/5 blur-[120px] pointer-events-none" />

            {/* Top District & Initiative Banner */}
            <div className="border-b border-white/[0.08] bg-white/[0.02]">
                <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 2xl:px-8">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        {/* District Emblem & Initiative Title */}
                        <div className="flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-slate-900 border border-blue-400/30 flex items-center justify-center shadow-md shadow-blue-900/30 shrink-0">
                                <Building2 className="w-5 h-5 text-sky-300" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-base font-extrabold tracking-tight text-white">JsgSmile</span>
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                                        MSME Marketplace
                                    </span>
                                </div>
                                <p className="text-xs text-slate-300/70 mt-0.5">
                                    An Initiative of District Administration, Jharsuguda, Government of Odisha
                                </p>
                            </div>
                        </div>

                        {/* Trust Badges */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-300/80">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                <span>Verified MSME Sellers</span>
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                                <Lock className="w-4 h-4 text-sky-400" />
                                <span>Secure Procurement</span>
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                                <Building2 className="w-4 h-4 text-amber-400" />
                                <span>Industry Linkage</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Footer Navigation Columns */}
            <div className="mx-auto max-w-[1680px] px-4 py-12 sm:px-6 2xl:px-8">
                <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 xl:gap-12">
                    {/* Column 1: About JsgSmile */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold tracking-wide uppercase text-white/90 flex items-center gap-2">
                            <span className="w-1.5 h-3.5 bg-blue-500 rounded-full inline-block" />
                            About JsgSmile
                        </h3>
                        <p className="text-xs text-slate-300/70 leading-relaxed font-normal">
                            Jharsuguda Synergy for MSME and Industry Linkage Ecosystem is the official digital marketplace connecting local manufacturers, service providers, and large industrial buyers for transparent B2B commerce.
                        </p>
                        <div className="space-y-2.5 pt-2">
                            <div className="text-xs text-slate-300/80 flex items-start gap-2.5">
                                <MapPin className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
                                <span>District Collectorate, Jharsuguda, Odisha — 768201</span>
                            </div>
                            <div className="text-xs text-slate-300/80 flex items-center gap-2.5">
                                <Mail className="h-4 w-4 text-sky-400 shrink-0" />
                                <a
                                    href="mailto:support@jsgsmile.in"
                                    className="hover:text-sky-300 transition-colors underline-offset-2 hover:underline"
                                >
                                    support@jsgsmile.in
                                </a>
                            </div>
                            <div className="text-xs text-slate-300/80 flex items-center gap-2.5">
                                <Phone className="h-4 w-4 text-sky-400 shrink-0" />
                                <a
                                    href="tel:1800XXXXXXX"
                                    className="hover:text-sky-300 transition-colors font-medium"
                                >
                                    1800-XXX-XXXX (Toll Free)
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Quick Links / Marketplace */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold tracking-wide uppercase text-white/90 flex items-center gap-2">
                            <span className="w-1.5 h-3.5 bg-emerald-500 rounded-full inline-block" />
                            Marketplace Portals
                        </h3>
                        <ul className="space-y-2.5">
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
                                        className="group flex items-center gap-1.5 text-xs text-slate-300/70 hover:text-white transition-colors duration-200"
                                    >
                                        <ChevronRight className="h-3 w-3 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all duration-200" />
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 3: Policies & Governance */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold tracking-wide uppercase text-white/90 flex items-center gap-2">
                            <span className="w-1.5 h-3.5 bg-amber-500 rounded-full inline-block" />
                            Governance & Policies
                        </h3>
                        <ul className="space-y-2.5">
                            {[
                                { label: 'Terms & Conditions', href: '/terms-of-use' },
                                { label: 'Website Policies & Privacy', href: '/website-policies' },
                                { label: 'Copyright Policy', href: '/copyright' },
                                { label: 'Hyperlinking Policy', href: '/hyperlinking-policy' },
                                { label: 'Disclaimer', href: '/disclaimer' },
                                { label: 'Caution Notice', href: '/caution-notice' },
                                { label: 'Portal Sitemap', href: '/sitemap' },
                            ].map((item) => (
                                <li key={item.label}>
                                    <Link
                                        href={item.href}
                                        className="group flex items-center gap-1.5 text-xs text-slate-300/70 hover:text-white transition-colors duration-200"
                                    >
                                        <ChevronRight className="h-3 w-3 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all duration-200" />
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Column 4: Helpdesk & Support Box */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold tracking-wide uppercase text-white/90 flex items-center gap-2">
                            <span className="w-1.5 h-3.5 bg-violet-500 rounded-full inline-block" />
                            Helpdesk & Support
                        </h3>
                        <ul className="space-y-2.5">
                            {[
                                { label: 'Help Center & Documentation', href: '/help' },
                                { label: 'Frequently Asked Questions (FAQs)', href: '/faqs' },
                                { label: 'Contact District MSME Cell', href: '/contact-us' },
                                { label: 'Feedback & Grievances', href: '/feedback' },
                                { label: 'Buyer & Seller User Guide', href: '/user-guide' },
                            ].map((item) => (
                                <li key={item.label}>
                                    <Link
                                        href={item.href}
                                        className="group flex items-center gap-1.5 text-xs text-slate-300/70 hover:text-white transition-colors duration-200"
                                    >
                                        <ChevronRight className="h-3 w-3 text-slate-500 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all duration-200" />
                                        <span>{item.label}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>

                        {/* Helpline Card */}
                        <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-white/[0.07] to-white/[0.02] border border-white/10 shadow-lg shadow-black/20">
                            <div className="flex items-center gap-2 mb-2">
                                <Headphones className="w-4 h-4 text-emerald-400" />
                                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                                    MSME Helpdesk Support
                                </span>
                            </div>
                            <a
                                href="tel:1800XXXXXXX"
                                className="block text-base sm:text-lg font-extrabold text-white tracking-tight hover:text-sky-300 transition-colors"
                            >
                                1800-XXX-XXXX
                            </a>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-300/60 mt-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>Mon–Sat, 9:00 AM – 6:00 PM IST</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Bar: Copyright & Compliance */}
            <div className="border-t border-white/[0.08] bg-black/20">
                <div className="mx-auto flex max-w-[1680px] flex-col items-center justify-between gap-3 px-4 py-4 sm:flex-row sm:px-6 2xl:px-8">
                    <p className="text-[11px] text-slate-400 text-center sm:text-left leading-relaxed">
                        © {new Date().getFullYear()} JsgSmile — Jharsuguda Synergy for MSME and Industry Linkage Ecosystem. All Rights Reserved.
                    </p>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400">
                        <span className="hidden sm:inline text-slate-500">•</span>
                        <span>
                            Last Updated: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Official Tricolor Strip at bottom */}
            <div className="brand-tricolor-strip w-full h-1" />
        </footer>
    );
}

