'use client';
import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, BadgeCheck, Truck, HeadphonesIcon, FileText, Lock } from 'lucide-react';

import { cn } from '../../../lib/utils';

const BADGES = [
    {
        icon: ShieldCheck,
        title: 'Verified Sellers Only',
        sub: 'GST + Udyam checked',
        tag: '100% Verified',
        bg: 'from-emerald-500/10 via-emerald-500/5 to-emerald-500/0',
        border: 'border-emerald-500/20',
        color: 'text-emerald-600',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
        glow: 'group-hover:shadow-emerald-500/10',
        dot: 'bg-emerald-500',
    },
    {
        icon: BadgeCheck,
        title: 'Trusted Procurement',
        sub: 'Government-grade process',
        tag: 'Govt Standard',
        bg: 'from-blue-500/10 via-blue-500/5 to-blue-500/0',
        border: 'border-blue-500/20',
        color: 'text-blue-600',
        badgeBg: 'bg-blue-50 text-blue-700 border-blue-200/60',
        glow: 'group-hover:shadow-blue-500/10',
        dot: 'bg-blue-500',
    },
    {
        icon: Truck,
        title: 'Local Delivery',
        sub: 'Jharsuguda & beyond',
        tag: 'Regional Fleet',
        bg: 'from-amber-500/10 via-amber-500/5 to-amber-500/0',
        border: 'border-amber-500/20',
        color: 'text-amber-600',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200/60',
        glow: 'group-hover:shadow-amber-500/10',
        dot: 'bg-amber-500',
    },
    {
        icon: HeadphonesIcon,
        title: 'Dedicated Helpdesk',
        sub: 'Mon–Sat support',
        tag: 'Priority Desk',
        bg: 'from-purple-500/10 via-purple-500/5 to-purple-500/0',
        border: 'border-purple-500/20',
        color: 'text-purple-600',
        badgeBg: 'bg-purple-50 text-purple-700 border-purple-200/60',
        glow: 'group-hover:shadow-purple-500/10',
        dot: 'bg-purple-500',
    },
    {
        icon: FileText,
        title: 'Quote-Based Buying',
        sub: 'Transparent pricing',
        tag: 'Direct RFQ',
        bg: 'from-sky-500/10 via-sky-500/5 to-sky-500/0',
        border: 'border-sky-500/20',
        color: 'text-sky-600',
        badgeBg: 'bg-sky-50 text-sky-700 border-sky-200/60',
        glow: 'group-hover:shadow-sky-500/10',
        dot: 'bg-sky-500',
    },
    {
        icon: Lock,
        title: 'Secure Transactions',
        sub: 'Encrypted & audited',
        tag: '256-Bit SSL',
        bg: 'from-teal-500/10 via-teal-500/5 to-teal-500/0',
        border: 'border-teal-500/20',
        color: 'text-teal-600',
        badgeBg: 'bg-teal-50 text-teal-700 border-teal-200/60',
        glow: 'group-hover:shadow-teal-500/10',
        dot: 'bg-teal-500',
    },
];

export function TrustBanner() {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
            { threshold: 0.2 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    return (
        <div ref={ref} className="relative z-10 my-1 py-1">
            <div className="mx-auto max-w-[1680px] px-3 sm:px-6 2xl:px-8">
                {/* Elevated Glassmorphic Container Card */}
                <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_4px_25px_-5px_rgba(15,23,42,0.05)] backdrop-blur-xl transition-all duration-300 hover:border-slate-300/90 hover:shadow-[0_8px_30px_-5px_rgba(15,23,42,0.08)]">
                    {/* Top micro multi-color gradient shine bar */}
                    <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500/50 via-blue-500/50 via-amber-500/50 via-purple-500/50 via-sky-500/50 to-teal-500/50" />

                    {/* Subtle ambient light gradient */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-blue-50/20 via-transparent to-emerald-50/20" />

                    <div className="relative flex items-center overflow-x-auto no-scrollbar py-2 px-2 snap-x snap-mandatory scroll-padding-2 xl:grid xl:grid-cols-6 xl:divide-x xl:divide-slate-100 xl:px-0">
                        {BADGES.map((b, i) => {
                            const Icon = b.icon;
                            return (
                                <div
                                    key={b.title}
                                    className="group relative flex w-[85vw] max-w-[280px] sm:w-auto shrink-0 snap-start cursor-default items-center gap-3.5 rounded-xl px-4 py-2.5 transition-all duration-300 hover:bg-slate-50/90 hover:shadow-sm xl:justify-center overflow-hidden"
                                    style={{
                                        opacity: visible ? 1 : 0,
                                        transform: visible ? 'translateY(0)' : 'translateY(10px)',
                                        transition: `opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${i * 70}ms, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${i * 70}ms, background-color 0.2s ease, box-shadow 0.2s ease`,
                                    }}
                                >
                                    {/* Icon Badge Container */}
                                    <div className="relative shrink-0">
                                        <div
                                            className={cn(
                                                "relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br border shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-md",
                                                b.bg,
                                                b.border,
                                                b.glow
                                            )}
                                        >
                                            <Icon className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-105", b.color)} />
                                            {/* Micro pulse status dot */}
                                            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                                <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", b.dot)} />
                                                <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full border border-white", b.dot)} />
                                            </span>
                                        </div>
                                    </div>

                                    {/* Title, Subtitle & Tag Content */}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <p className="truncate text-[12px] font-bold text-slate-800 tracking-tight transition-colors duration-200 group-hover:text-slate-950">
                                                {b.title}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <p className="truncate text-[10px] font-medium text-slate-500 transition-colors duration-200 group-hover:text-slate-700">
                                                {b.sub}
                                            </p>
                                            <span className={cn("inline-flex items-center rounded-full border px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider hidden sm:inline-flex", b.badgeBg)}>
                                                {b.tag}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Premium Hover Overlay Tooltip */}
                                    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-white/95 px-2 opacity-0 backdrop-blur-md transition-all duration-300 group-hover:opacity-100 shadow-[inset_0_0_15px_rgba(255,255,255,0.5)] border border-slate-100 text-center scale-95 group-hover:scale-100">
                                        <p className="text-[12px] font-bold text-slate-900 tracking-tight leading-tight">{b.title}</p>
                                        <p className="mt-0.5 text-[10px] font-bold text-slate-600 leading-tight">{b.sub}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

