'use client';
import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, BadgeCheck, Truck, HeadphonesIcon, FileText, Lock } from 'lucide-react';

import { cn } from '../../../lib/utils';

const BADGES = [
    { icon: ShieldCheck, title: 'Verified Sellers Only', sub: 'GST + Udyam checked', bg: 'from-emerald-50 to-emerald-100/50 border-emerald-200/50', color: 'text-emerald-600' },
    { icon: BadgeCheck, title: 'Trusted Procurement', sub: 'Government-grade process', bg: 'from-blue-50 to-blue-100/50 border-blue-200/50', color: 'text-blue-600' },
    { icon: Truck, title: 'Local Delivery', sub: 'Jharsuguda & beyond', bg: 'from-orange-50 to-orange-100/50 border-orange-200/50', color: 'text-orange-500' },
    { icon: HeadphonesIcon, title: 'Dedicated Helpdesk', sub: 'Mon–Sat support', bg: 'from-purple-50 to-purple-100/50 border-purple-200/50', color: 'text-purple-600' },
    { icon: FileText, title: 'Quote-Based Buying', sub: 'Transparent pricing', bg: 'from-slate-50 to-slate-100/50 border-slate-200/50', color: 'text-[#0b2447]' },
    { icon: Lock, title: 'Secure Transactions', sub: 'Encrypted & audited', bg: 'from-teal-50 to-teal-100/50 border-teal-200/50', color: 'text-teal-600' },
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
        <section ref={ref} className="border-y border-slate-100 bg-white/50 backdrop-blur-sm">
            <div className="mx-auto max-w-[1680px]">
                <div className="grid grid-cols-2 gap-2 p-3 sm:gap-0 sm:p-0 sm:grid-cols-2 lg:flex lg:flex-row lg:divide-x divide-slate-100/60 items-center lg:justify-between py-1 sm:py-2 lg:py-1">
                    {BADGES.map((b, i) => {
                        const Icon = b.icon;
                        return (
                            <div
                                key={b.title}
                                className="group flex flex-col sm:flex-row cursor-default items-center text-center sm:text-left gap-2 sm:gap-3.5 p-3 sm:px-6 sm:py-4 lg:shrink-0 xl:justify-center xl:px-4 transition-all duration-300 bg-white/50 sm:bg-transparent rounded-xl sm:rounded-none border sm:border-0 border-slate-100/60"
                                style={{
                                    opacity: visible ? 1 : 0,
                                    transform: visible ? 'translateY(0)' : 'translateY(8px)',
                                    transition: `opacity 0.4s ease ${i * 60}ms, transform 0.4s ease ${i * 60}ms`,
                                }}
                            >
                                <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br border flex items-center justify-center shrink-0 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:rotate-3", b.bg)}>
                                    <Icon className={cn("h-4.5 w-4.5", b.color)} />
                                </div>
                                <div>
                                    <p className="text-[11px] font-extrabold text-slate-800 whitespace-nowrap tracking-tight">{b.title}</p>
                                    <p className="text-[9px] font-bold text-slate-400 whitespace-nowrap mt-0.5">{b.sub}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
