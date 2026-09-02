'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Store,
    Building2,
    Users,
    ShieldCheck,
    CheckCircle2,
    ArrowRight,
    ArrowUpRight,
    Sparkles,
    TrendingUp,
    Wallet,
    FileCheck2,
    BadgeCheck,
    Briefcase,
    Layers,
    Scale,
    Clock,
    HeartHandshake,
    Check,
    ChevronRight,
    HelpCircle,
    ShoppingBag,
    Award,
    Factory,
    Boxes,
    ChevronDown,
    Zap,
    Lock
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { MarketplaceFooter } from '../components/MarketplaceFooter';

type RoleTab = 'all' | 'seller' | 'buyer' | 'shg';

export default function MarketplaceBenefitsPage() {
    const [selectedTab, setSelectedTab] = useState<RoleTab>('all');
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans">
            {/* Top Breadcrumb & Status Bar */}
            <div className="bg-white border-b border-slate-200">
                <div className="mx-auto max-w-[1680px] px-4 py-3 sm:px-6 2xl:px-8">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        <nav aria-label="Breadcrumb" className="flex items-center gap-2 font-semibold text-slate-500">
                            <Link href="/" className="hover:text-[#0b2447] transition-colors">Home</Link>
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                            <Link href="/marketplace/products" className="hover:text-[#0b2447] transition-colors">Marketplace</Link>
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-[#0b3a75] font-bold">Platform Benefits</span>
                        </nav>

                    </div>
                </div>
            </div>

            {/* Hero Banner */}
            <section className="relative overflow-hidden bg-gradient-to-br from-[#07172e] via-[#0b2447] to-[#12335f] text-white py-14 sm:py-20 lg:py-24">
                {/* Decorative Gradients & Glow */}
                <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-blue-500/20 blur-[120px] pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[150px] pointer-events-none" />

                <div className="relative mx-auto max-w-[1680px] px-4 sm:px-6 2xl:px-8">
                    <div className="max-w-4xl mx-auto text-center space-y-6">
                        

                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                            Unlocking Sustainable Growth for <br className="hidden sm:inline" />
                            <span className="bg-gradient-to-r from-sky-300 via-emerald-300 to-amber-200 bg-clip-text text-transparent">
                                MSME Sellers, Enterprise Buyers & SHGs
                            </span>
                        </h1>

                        <p className="text-sm sm:text-base lg:text-lg text-slate-200/90 font-medium leading-relaxed max-w-3xl mx-auto">
                            JsgSmile bridges the gap between Jharsuguda’s manufacturing powerhouses, local MSME suppliers, and women Self-Help Groups with institutional transparency, zero intermediary fees, and guaranteed payment cycles.
                        </p>

                        {/* High-Level Metrics Strip */}
                        <div className="pt-4 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4 backdrop-blur-sm text-left">
                                <div className="flex items-center gap-2 text-sky-300 mb-1">
                                    <ShieldCheck className="h-4 w-4" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Verification</span>
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-white">100% Verified</div>
                                <div className="text-[11px] text-slate-300 mt-0.5">GST, Udyam & PAN Checked</div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4 backdrop-blur-sm text-left">
                                <div className="flex items-center gap-2 text-emerald-300 mb-1">
                                    <Wallet className="h-4 w-4" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Settlement</span>
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-white">Escrow Secured</div>
                                <div className="text-[11px] text-slate-300 mt-0.5">Automated GRN to Payout</div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4 backdrop-blur-sm text-left">
                                <div className="flex items-center gap-2 text-amber-300 mb-1">
                                    <Award className="h-4 w-4" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider">District Mandate</span>
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-white">Local Priority</div>
                                <div className="text-[11px] text-slate-300 mt-0.5">Jharsuguda MSME Tagging</div>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 sm:p-4 backdrop-blur-sm text-left">
                                <div className="flex items-center gap-2 text-purple-300 mb-1">
                                    <TrendingUp className="h-4 w-4" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Efficiency</span>
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-white">15-25% Savings</div>
                                <div className="text-[11px] text-slate-300 mt-0.5">Transparent Price Bidding</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Interactive Stakeholder Role Filter Bar */}
            <section className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
                <div className="mx-auto max-w-[1680px] px-4 sm:px-6 2xl:px-8">
                    <div className="flex items-center justify-between overflow-x-auto py-2.5 gap-2 scrollbar-none">
                        <div className="flex items-center gap-2 min-w-max">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2 hidden sm:inline">
                                View Benefits For:
                            </span>

                            <button
                                type="button"
                                onClick={() => setSelectedTab('all')}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    selectedTab === 'all'
                                        ? 'bg-[#0b2447] text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                                }`}
                            >
                                🌟 All Stakeholders
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelectedTab('seller')}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    selectedTab === 'seller'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                }`}
                            >
                                <Store className="h-3.5 w-3.5" />
                                <span>MSME Sellers & Vendors</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelectedTab('buyer')}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    selectedTab === 'buyer'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                }`}
                            >
                                <Building2 className="h-3.5 w-3.5" />
                                <span>Enterprise Buyers & Plants</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelectedTab('shg')}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                    selectedTab === 'shg'
                                        ? 'bg-amber-600 text-white shadow-sm'
                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                }`}
                            >
                                <Users className="h-3.5 w-3.5" />
                                <span>Self-Help Groups (HerSHG)</span>
                            </button>
                        </div>

                        <div className="hidden lg:flex items-center gap-3">
                            <Link
                                href="/register"
                                className="inline-flex items-center gap-1.5 text-xs font-black text-[#0b3a75] hover:underline"
                            >
                                Get Started Free <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Content Area */}
            <main id="main-content" className="mx-auto max-w-[1680px] px-4 py-10 sm:px-6 lg:py-16 2xl:px-8 space-y-16 lg:space-y-24">

                {/* ──────────────────────────────────────────────────────────── */}
                {/* 1. MSME SELLERS SECTION */}
                {/* ──────────────────────────────────────────────────────────── */}
                {(selectedTab === 'all' || selectedTab === 'seller') && (
                    <section id="seller-benefits" className="scroll-mt-20">
                        {/* Section Header */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-lg bg-blue-100/80 px-3 py-1 text-xs font-extrabold text-blue-800 mb-2.5">
                                    <Store className="h-4 w-4 text-blue-600" />
                                    <span>For Manufacturers, Fabricators, Contractors & MSMEs</span>
                                </div>
                                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                                    Expand Your Reach to Major Industries & Secure Payments
                                </h2>
                                <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                                    List products, quote for high-value tenders, and supply directly to top industrial buyers with zero commission and instant escrow-backed payments.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                                <Link
                                    href="/seller/register"
                                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 shadow-md shadow-blue-600/20 active:scale-95 transition-all"
                                >
                                    <span>Register as Seller</span>
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                <Link
                                    href="/marketplace/sellers"
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                                >
                                    <span>View Top Sellers</span>
                                </Link>
                            </div>
                        </div>

                        {/* Seller Key Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Card 1 */}
                            <div className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="relative mb-5 h-44 w-full overflow-hidden rounded-xl bg-slate-100">
                                        <img
                                            src="/category-photos/1787987232675/steel-and-metal-products.webp"
                                            alt="Steel and Industrial Supply"
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                                            <span className="text-xs font-bold bg-blue-600/90 px-2.5 py-0.5 rounded-md backdrop-blur-xs">
                                                Direct Demand Access
                                            </span>
                                            <span className="text-[11px] text-slate-200">Zero Middlemen</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                            <Factory className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-base font-black text-slate-900">Direct Industrial Orders</h3>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Get instant visibility to multi-crore annual procurement RFQs, Rate Contracts, and direct purchase orders from Vedanta, OPGC, TRL Krosaki, and JSW without broker margins.
                                    </p>
                                </div>
                                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Opportunities</span>
                                    <Link href="/marketplace" className="font-bold text-blue-600 hover:underline flex items-center gap-1">
                                        Open RFQs & Bids &rarr;
                                    </Link>
                                </div>
                            </div>

                            {/* Card 2 */}
                            <div className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="relative mb-5 h-44 w-full overflow-hidden rounded-xl bg-slate-100">
                                        <img
                                            src="/category-photos/1787987232675/fabrication-and-welding-services.webp"
                                            alt="Fabrication and Welding Services"
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                                            <span className="text-xs font-bold bg-emerald-600/90 px-2.5 py-0.5 rounded-md backdrop-blur-xs">
                                                Financial Safety
                                            </span>
                                            <span className="text-[11px] text-slate-200">100% Transparency</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                            <ShieldCheck className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-base font-black text-slate-900">Guaranteed Escrow Payouts</h3>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Eliminate delayed payment disputes with automated milestone-based escrow locks. Once the buyer acknowledges Goods Receipt Note (GRN), funds disburse straight to your bank.
                                    </p>
                                </div>
                                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Protection</span>
                                    <span className="font-bold text-emerald-700">Automated GRN Clearance</span>
                                </div>
                            </div>

                            {/* Card 3 */}
                            <div className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="relative mb-5 h-44 w-full overflow-hidden rounded-xl bg-slate-100">
                                        <img
                                            src="/category-photos/1787987232675/industrial-machinery-and-spare-parts.webp"
                                            alt="Industrial Machinery and Spares"
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                                            <span className="text-xs font-bold bg-amber-600/90 px-2.5 py-0.5 rounded-md backdrop-blur-xs">
                                                District Advantage
                                            </span>
                                            <span className="text-[11px] text-slate-200">Local Preference</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                            <BadgeCheck className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-base font-black text-slate-900">Verified District MSME Badge</h3>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Stand out with verified Udyam and GST credentials. Local Jharsuguda MSMEs enjoy top algorithmic ranking, exclusive district-restricted tenders, and statutory priority.
                                    </p>
                                </div>
                                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Digital Store</span>
                                    <Link href="/marketplace/products" className="font-bold text-amber-700 hover:underline flex items-center gap-1">
                                        Explore Catalogue &rarr;
                                    </Link>
                                </div>
                            </div>
                        </div>

                        {/* Seller Quick Bullets Strip */}
                        <div className="mt-6 rounded-2xl bg-blue-50/60 border border-blue-100 p-6">
                            <h4 className="text-xs font-black uppercase tracking-wider text-blue-900 mb-3 flex items-center gap-2">
                                <Zap className="h-4 w-4 text-blue-600" />
                                Key Operational Advantages for Sellers at a Glance
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold text-slate-700">
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                    <span><strong>Zero Listing Fees:</strong> Unlimited product & service catalogue entries at no cost.</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                    <span><strong>Multi-Mode Selling:</strong> Direct checkout, RFQs, e-Tenders, or Reverse Auctions.</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                    <span><strong>Digital Invoicing & GST:</strong> One-click invoice dispatch with auto-tax computation.</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                    <span><strong>District Cell Assistance:</strong> Free onboarding support at Jharsuguda Facilitation Cell.</span>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ──────────────────────────────────────────────────────────── */}
                {/* 2. ENTERPRISE & INDUSTRY BUYERS SECTION */}
                {/* ──────────────────────────────────────────────────────────── */}
                {(selectedTab === 'all' || selectedTab === 'buyer') && (
                    <section id="buyer-benefits" className="scroll-mt-20">
                        {/* Section Header */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-100/80 px-3 py-1 text-xs font-extrabold text-emerald-800 mb-2.5">
                                    <Building2 className="h-4 w-4 text-emerald-600" />
                                    <span>For Plants, Large Industries, Institutions & Procurement Managers</span>
                                </div>
                                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                                    Streamlined Local Sourcing, Cost Reduction & Full Compliance
                                </h2>
                                <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                                    Access a dependable network of audited district suppliers, run automated reverse auctions, and achieve 100% statutory local MSME procurement compliance.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                                <Link
                                    href="/buyer/register"
                                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
                                >
                                    <span>Register as Buyer</span>
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                <Link
                                    href="/marketplace/buyers"
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                                >
                                    <span>View Industry Buyers</span>
                                </Link>
                            </div>
                        </div>

                        {/* Buyer Key Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Card 1 */}
                            <div className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-xl hover:border-emerald-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="relative mb-5 h-44 w-full overflow-hidden rounded-xl bg-slate-100">
                                        <img
                                            src="/category-photos/1787987232675/tools-and-industrial-hardware.webp"
                                            alt="Tools and Industrial Hardware"
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                                            <span className="text-xs font-bold bg-emerald-600/90 px-2.5 py-0.5 rounded-md backdrop-blur-xs">
                                                Audited Vendors
                                            </span>
                                            <span className="text-[11px] text-slate-200">50+ Categories</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                            <Boxes className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-base font-black text-slate-900">Hyper-Local Resilient Supply</h3>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Prevent manufacturing downtime with vetted local suppliers in Jharsuguda for industrial hardware, fabrication, mechanical spares, safety gear, and emergency maintenance.
                                    </p>
                                </div>
                                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Turnaround Time</span>
                                    <span className="font-bold text-emerald-700">Same-Day Local Dispatch</span>
                                </div>
                            </div>

                            {/* Card 2 */}
                            <div className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-xl hover:border-emerald-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="relative mb-5 h-44 w-full overflow-hidden rounded-xl bg-slate-100">
                                        <img
                                            src="/category-photos/1787987232675/electrical-cables-and-power-equipment.webp"
                                            alt="Electrical and Power Equipment"
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                                            <span className="text-xs font-bold bg-blue-600/90 px-2.5 py-0.5 rounded-md backdrop-blur-xs">
                                                Best Market Pricing
                                            </span>
                                            <span className="text-[11px] text-slate-200">15-25% Savings</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                            <Scale className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-base font-black text-slate-900">Dynamic Bidding & Reverse Auctions</h3>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Publish requirements and let pre-qualified suppliers compete in real-time reverse auctions or structured RFQs, unlocking true market-driven competitive rates.
                                    </p>
                                </div>
                                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Evaluation</span>
                                    <span className="font-bold text-blue-700">Audit-Ready Quotation Logs</span>
                                </div>
                            </div>

                            {/* Card 3 */}
                            <div className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-xl hover:border-emerald-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="relative mb-5 h-44 w-full overflow-hidden rounded-xl bg-slate-100">
                                        <img
                                            src="/category-photos/1787987232675/safety-equipment-and-industrial-safety.webp"
                                            alt="Safety and Industrial Compliance"
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                                            <span className="text-xs font-bold bg-purple-600/90 px-2.5 py-0.5 rounded-md backdrop-blur-xs">
                                                CSR & ESG
                                            </span>
                                            <span className="text-[11px] text-slate-200">Statutory Compliance</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                                            <FileCheck2 className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-base font-black text-slate-900">Statutory MSME Sourcing Mandate</h3>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Effortlessly fulfill corporate CSR and district MSME procurement targets with automated reporting, verified enterprise linkage certificates, and district administration records.
                                    </p>
                                </div>
                                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Reporting</span>
                                    <span className="font-bold text-purple-700">Instant MIS & Tax Reports</span>
                                </div>
                            </div>
                        </div>

                        {/* Buyer Quick Bullets Strip */}
                        <div className="mt-6 rounded-2xl bg-emerald-50/60 border border-emerald-100 p-6">
                            <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 mb-3 flex items-center gap-2">
                                <Zap className="h-4 w-4 text-emerald-600" />
                                Key Operational Advantages for Buyers at a Glance
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold text-slate-700">
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <span><strong>Multi-Tier Approvals:</strong> Custom PO approval workflows and organization team roles.</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <span><strong>Digital GRN Inspection:</strong> Verify item quality on-site before releasing escrow funds.</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <span><strong>Rate Contract Lock-in:</strong> Pre-negotiate annual rates to safeguard against price inflation.</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <span><strong>Verified Track Record:</strong> Review supplier ratings, historical deliveries, and credentials.</span>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ──────────────────────────────────────────────────────────── */}
                {/* 3. SELF-HELP GROUPS (HerSHG) SECTION */}
                {/* ──────────────────────────────────────────────────────────── */}
                {(selectedTab === 'all' || selectedTab === 'shg') && (
                    <section id="shg-benefits" className="scroll-mt-20">
                        {/* Section Header */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-lg bg-amber-100/80 px-3 py-1 text-xs font-extrabold text-amber-800 mb-2.5">
                                    <Users className="h-4 w-4 text-amber-600" />
                                    <span>Dedicated HerSHG Empowerment & Women Producer Collectives</span>
                                </div>
                                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                                    Direct Institutional Market Access for Women Self-Help Groups
                                </h2>
                                <p className="text-sm text-slate-600 mt-1 max-w-2xl">
                                    Connect local women artisans, food producers, and service collectives directly with industrial canteens, corporate offices, and institutions with zero commission.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                                <Link
                                    href="/hershg/register"
                                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-black hover:bg-amber-700 shadow-md shadow-amber-600/20 active:scale-95 transition-all"
                                >
                                    <span>Register HerSHG Group</span>
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                                <Link
                                    href="/contact-us"
                                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
                                >
                                    <span>District Helpdesk</span>
                                </Link>
                            </div>
                        </div>

                        {/* SHG Key Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Card 1 */}
                            <div className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-xl hover:border-amber-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="relative mb-5 h-44 w-full overflow-hidden rounded-xl bg-slate-100">
                                        <img
                                            src="/category-photos/1787987232675/fmcg-and-daily-utility-supply.webp"
                                            alt="FMCG and Daily Utility Supply"
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                                            <span className="text-xs font-bold bg-amber-600/90 px-2.5 py-0.5 rounded-md backdrop-blur-xs">
                                                Bulk Institutional Sales
                                            </span>
                                            <span className="text-[11px] text-slate-200">Corporate Demand</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                                            <ShoppingBag className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-base font-black text-slate-900">Direct Corporate Canteen & Supply Contracts</h3>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Supply organic spices, packaged snacks, fresh produce, cleaning supplies, and uniforms to major plant canteens and administrative townships on pre-fixed contracts.
                                    </p>
                                </div>
                                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Earnings</span>
                                    <span className="font-bold text-amber-700">100% Retained by SHG</span>
                                </div>
                            </div>

                            {/* Card 2 */}
                            <div className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-xl hover:border-amber-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="relative mb-5 h-44 w-full overflow-hidden rounded-xl bg-slate-100">
                                        <img
                                            src="/category-photos/1787987232675/textile-and-garments-supply.webp"
                                            alt="Handicrafts and Textiles"
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                                            <span className="text-xs font-bold bg-rose-600/90 px-2.5 py-0.5 rounded-md backdrop-blur-xs">
                                                District Handholding
                                            </span>
                                            <span className="text-[11px] text-slate-200">Simplified KYC</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                                            <HeartHandshake className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-base font-black text-slate-900">District Facilitation Cell Support</h3>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        No technical hurdles. The Jharsuguda MSME Facilitation Cell provides free in-person assistance for Aadhaar verification, group profile creation, product photography, and listing.
                                    </p>
                                </div>
                                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Assistance</span>
                                    <span className="font-bold text-rose-700">Free In-Person Support</span>
                                </div>
                            </div>

                            {/* Card 3 */}
                            <div className="group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-xl hover:border-amber-300 transition-all duration-300 flex flex-col justify-between">
                                <div>
                                    <div className="relative mb-5 h-44 w-full overflow-hidden rounded-xl bg-slate-100">
                                        <img
                                            src="/category-photos/1787987232675/agriculture-and-nursery.webp"
                                            alt="Agriculture and Nursery"
                                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                                            <span className="text-xs font-bold bg-emerald-600/90 px-2.5 py-0.5 rounded-md backdrop-blur-xs">
                                                Financial Growth
                                            </span>
                                            <span className="text-[11px] text-slate-200">Bank Credit Linkage</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 mb-2.5">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                            <TrendingUp className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-base font-black text-slate-900">Banking History & Credit Linkages</h3>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        Verified order deliveries and transparent digital bank transfers create an immutable financial trail, helping SHGs secure subsidized institutional bank loans and capital expansion grants.
                                    </p>
                                </div>
                                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                                    <span className="text-slate-500 font-medium">Financial Inclusion</span>
                                    <span className="font-bold text-emerald-700">Direct Bank Credit</span>
                                </div>
                            </div>
                        </div>

                        {/* SHG Quick Bullets Strip */}
                        <div className="mt-6 rounded-2xl bg-amber-50/60 border border-amber-100 p-6">
                            <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 mb-3 flex items-center gap-2">
                                <Zap className="h-4 w-4 text-amber-600" />
                                Key Operational Advantages for SHGs at a Glance
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold text-slate-700">
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                    <span><strong>0% Commission:</strong> Entire product purchase price goes directly to the SHG bank account.</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                    <span><strong>Simplified Documentation:</strong> Register using SHG Resolution and member Aadhaar verification.</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                    <span><strong>Recurring Rate Contracts:</strong> Fixed monthly orders for supply stability and predictable income.</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                    <span><strong>Promoted Showcase:</strong> Dedicated HerSHG badge and featured placement on the homepage.</span>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* ──────────────────────────────────────────────────────────── */}
                {/* 4. COMPREHENSIVE STAKEHOLDER COMPARISON MATRIX */}
                {/* ──────────────────────────────────────────────────────────── */}
                <section id="matrix" className="scroll-mt-20">
                    <div className="text-center max-w-3xl mx-auto mb-10">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-700 mb-2">
                            <Scale className="h-3.5 w-3.5 text-[#0b2447]" />
                            <span>Feature & Protection Comparison</span>
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                            How JsgSmile Serves Each Stakeholder
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-600 mt-1">
                            A clear side-by-side view of capabilities, access levels, and security guarantees across user roles.
                        </p>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-xs">
                                <thead>
                                    <tr className="bg-[#0b2447] text-white">
                                        <th className="px-5 py-4 font-black uppercase tracking-wider text-xs">Portal Feature / Guarantee</th>
                                        <th className="px-5 py-4 font-black uppercase tracking-wider text-xs text-center bg-blue-900/60">
                                            MSME Seller / Vendor
                                        </th>
                                        <th className="px-5 py-4 font-black uppercase tracking-wider text-xs text-center bg-emerald-900/60">
                                            Enterprise Buyer / Plant
                                        </th>
                                        <th className="px-5 py-4 font-black uppercase tracking-wider text-xs text-center bg-amber-900/60">
                                            HerSHG / Women Collective
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {[
                                        {
                                            feature: 'Account Registration & Verification',
                                            seller: 'Udyam, GST & PAN Verified',
                                            buyer: 'Corporate CIN / GST Audited',
                                            shg: 'Aadhaar & SHG Resolution Verified',
                                        },
                                        {
                                            feature: 'Direct Access to Large Industrial Demands',
                                            seller: 'Instant RFQ / Tender Visibility',
                                            buyer: 'Publish Custom Requirements',
                                            shg: 'Canteen & Facility Supply Bids',
                                        },
                                        {
                                            feature: 'Payment & Settlement Guarantee',
                                            seller: 'Escrow Lock & Direct Bank Disbursal',
                                            buyer: 'Milestone & GRN Inspection Controlled',
                                            shg: '100% Value Direct Bank Transfer',
                                        },
                                        {
                                            feature: 'Platform Fees & Commissions',
                                            seller: 'Zero Commission / Free Listing',
                                            buyer: 'Zero Platform Convenience Fee',
                                            shg: 'Zero Commission / Free Assistance',
                                        },
                                        {
                                            feature: 'Pricing & Sourcing Mechanisms',
                                            seller: 'Direct Quote, Rate Contract, Reverse Auction',
                                            buyer: 'Lowest Price Bidding & Reverse Auctions',
                                            shg: 'Standardized Rate Contracts & Direct Orders',
                                        },
                                        {
                                            feature: 'District MSME Priority Tagging',
                                            seller: 'Exclusive Jharsuguda Local Badge',
                                            buyer: 'District Mandate Compliance Tracking',
                                            shg: 'Special HerSHG District Priority',
                                        },
                                        {
                                            feature: 'Digital Invoicing & GRN Tracking',
                                            seller: '1-Click Invoice & Delivery Dispatch',
                                            buyer: 'Quality Check & Digital GRN Sign-Off',
                                            shg: 'Simplified Paperless Handover',
                                        },
                                        {
                                            feature: 'Dedicated District Cell Handholding',
                                            seller: 'Online + In-Person Helpdesk',
                                            buyer: 'Enterprise Liaison Manager',
                                            shg: 'Free In-Person Field Assistance',
                                        },
                                    ].map((row, idx) => (
                                        <tr key={row.feature} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                            <td className="px-5 py-4 font-bold text-slate-900">
                                                {row.feature}
                                            </td>
                                            <td className="px-5 py-4 text-center text-slate-700 font-semibold bg-blue-50/20">
                                                <div className="inline-flex items-center gap-1.5 justify-center">
                                                    <Check className="h-4 w-4 text-blue-600 shrink-0" />
                                                    <span>{row.seller}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center text-slate-700 font-semibold bg-emerald-50/20">
                                                <div className="inline-flex items-center gap-1.5 justify-center">
                                                    <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                                                    <span>{row.buyer}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-center text-slate-700 font-semibold bg-amber-50/20">
                                                <div className="inline-flex items-center gap-1.5 justify-center">
                                                    <Check className="h-4 w-4 text-amber-600 shrink-0" />
                                                    <span>{row.shg}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* ──────────────────────────────────────────────────────────── */}
                {/* 5. PROCESS WORKFLOW (HOW IT WORKS IN 4 STEPS) */}
                {/* ──────────────────────────────────────────────────────────── */}
                <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-[#07172e] to-[#0b2447] text-white p-8 sm:p-12 lg:p-16 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="text-center max-w-2xl mx-auto mb-12">
                            <span className="text-xs font-bold uppercase tracking-widest text-sky-400 bg-sky-950/60 px-3 py-1 rounded-full border border-sky-400/20">
                                Seamless End-to-End Workflow
                            </span>
                            <h2 className="text-2xl sm:text-3xl font-black text-white mt-3">
                                How Procurement & Fulfillment Works
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-300 mt-2">
                                4 streamlined steps from digital onboarding to final payment release.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                {
                                    step: '01',
                                    title: 'Register & Verify',
                                    desc: 'Onboard with Aadhaar, GST, or Udyam credentials. Get verified by District MSME Facilitation Cell.',
                                    icon: ShieldCheck,
                                    badge: 'Step 1',
                                },
                                {
                                    step: '02',
                                    title: 'Post or Discover',
                                    desc: 'Buyers publish RFQs & Tenders; Sellers & SHGs list items and submit competitive price quotations.',
                                    icon: Layers,
                                    badge: 'Step 2',
                                },
                                {
                                    step: '03',
                                    title: 'Contract & Escrow Lock',
                                    desc: 'Purchase Orders issued; Buyer locks funds securely in escrow to guarantee delivery settlement.',
                                    icon: Lock,
                                    badge: 'Step 3',
                                },
                                {
                                    step: '04',
                                    title: 'Inspect, GRN & Payout',
                                    desc: 'Supplier delivers goods. Buyer inspects and marks GRN accepted; payment releases automatically.',
                                    icon: Wallet,
                                    badge: 'Step 4',
                                },
                            ].map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div
                                        key={item.step}
                                        className="relative rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm flex flex-col justify-between hover:bg-white/10 transition-colors"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <span className="text-3xl font-black text-sky-400/80">{item.step}</span>
                                                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300">
                                                    <Icon className="h-4 w-4" />
                                                </span>
                                            </div>
                                            <h3 className="text-base font-black text-white mb-2">{item.title}</h3>
                                            <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

            

                {/* ──────────────────────────────────────────────────────────── */}
                {/* 7. BOTTOM CALL TO ACTION BANNER */}
                {/* ──────────────────────────────────────────────────────────── */}
                <section className="relative rounded-3xl bg-gradient-to-r from-[#0b2447] via-[#12335f] to-[#07172e] text-white p-8 sm:p-12 text-center overflow-hidden shadow-xl">
                    <div className="relative z-10 max-w-3xl mx-auto space-y-6">
                       
                        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white">
                            Ready to Transform Your Sourcing & Sales?
                        </h2>

                        <p className="text-xs sm:text-sm text-slate-200/90 max-w-xl mx-auto">
                            Registration takes under 3 minutes. Unlock direct industrial contracts, zero commission selling, and guaranteed payment cycles today.
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                            <Link
                                href="/seller/register"
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white text-[#07172e] text-xs font-black hover:bg-slate-100 shadow-lg active:scale-95 transition-all"
                            >
                                <span>Register as Seller</span>
                                <ArrowUpRight className="h-4 w-4 text-blue-700" />
                            </Link>

                            <Link
                                href="/buyer/register"
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-white text-xs font-black hover:bg-emerald-600 shadow-lg active:scale-95 transition-all"
                            >
                                <span>Register as Buyer</span>
                                <ArrowUpRight className="h-4 w-4" />
                            </Link>

                            <Link
                                href="/hershg/register"
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-amber-500 text-white text-xs font-black hover:bg-amber-600 shadow-lg active:scale-95 transition-all"
                            >
                                <span>Register HerSHG</span>
                                <ArrowUpRight className="h-4 w-4" />
                            </Link>
                        </div>
                    </div>
                </section>

            </main>

            {/* Platform Footer */}
            <MarketplaceFooter />
        </div>
    );
}
