'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Building2, Users, Package, Wrench, Layers, TrendingUp, Sparkles, Briefcase } from 'lucide-react';
import type { MarketplaceStats } from '../api';

// ─── Animated counter ─────────────────────────────────────────────────────────
function useCounter(target: number, running: boolean, duration = 1400) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!running || target === 0) return;
        let start = 0;
        const step = target / (duration / 16);
        const frame = () => {
            start += step;
            if (start >= target) { setCount(target); return; }
            setCount(Math.floor(start));
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    }, [running, target, duration]);
    return target === 0 ? 0 : count;
}

interface StatCardProps {
    icon: React.ReactNode;
    value: number;
    label: string;
    sublabel: string;
    textColor: string;
    iconGradient: string;
    iconBorder: string;
    glowBorder: string;
    delay: number;
    running: boolean;
}

function StatCard({
    icon,
    value,
    label,
    sublabel,
    textColor,
    iconGradient,
    iconBorder,
    glowBorder,
    delay,
    running,
}: StatCardProps) {
    const animated = useCounter(value, running, 1200);

    return (
        <div
            className={`group relative flex flex-col items-center justify-between text-center p-4 sm:p-5 lg:p-4 xl:p-5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-md border border-white/[0.09] ${glowBorder} transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl shadow-black/20 cursor-default overflow-hidden`}
            style={{
                opacity: running ? 1 : 0,
                transform: running ? 'translateY(0)' : 'translateY(24px)',
                transition: `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, background 0.3s, border-color 0.3s, box-shadow 0.3s`,
            }}
        >
            {/* Ambient inner card glow on hover */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            {/* Icon Container */}
            <div className="relative mb-3">
                <div
                    className={`w-11 h-11 sm:w-12 sm:h-12 xl:w-13 xl:h-13 rounded-2xl flex items-center justify-center bg-gradient-to-br ${iconGradient} ${iconBorder} shadow-inner transition-transform duration-300 group-hover:scale-110`}
                >
                    {icon}
                </div>
            </div>

            {/* Value Counter */}
            <div className="relative z-10 my-auto">
                <div className={`text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-black tracking-tight ${textColor}`}>
                    {animated.toLocaleString('en-IN')}
                    {value > 0 && <span className="text-lg sm:text-xl font-bold ml-0.5 opacity-80">+</span>}
                </div>
                <h3 className="text-xs sm:text-sm font-semibold text-white/90 mt-1 leading-snug">{label}</h3>
            </div>

            {/* Sub-badge / Context tag */}
            <div className="mt-3 pt-2.5 border-t border-white/[0.06] w-full flex items-center justify-center">
                <span className="text-[9.5px] sm:text-[10px] font-medium text-white/50 tracking-wide uppercase group-hover:text-white/70 transition-colors truncate">
                    {sublabel}
                </span>
            </div>
        </div>
    );
}

interface Props {
    stats?: MarketplaceStats;
}

export function StatsSection({ stats }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [running, setRunning] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setRunning(true);
                    obs.disconnect();
                }
            },
            { threshold: 0.15 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    const items = [
        {
            icon: <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-sky-400" />,
            value: stats?.verifiedSellers || 0,
            label: 'Verified Sellers',
            sublabel: 'KYC & MSME Validated',
            textColor: 'text-sky-300',
            iconGradient: 'from-sky-500/25 via-sky-600/15 to-blue-700/10',
            iconBorder: 'border border-sky-400/30',
            glowBorder: 'hover:border-sky-400/40 hover:shadow-sky-500/10',
        },
        {
            icon: <Users className="h-5 w-5 sm:h-6 sm:w-6 text-violet-400" />,
            value: stats?.registeredBuyers || 0,
            label: 'Registered Buyers',
            sublabel: 'Large Industries & PSUs',
            textColor: 'text-violet-300',
            iconGradient: 'from-violet-500/25 via-purple-600/15 to-indigo-700/10',
            iconBorder: 'border border-violet-400/30',
            glowBorder: 'hover:border-violet-400/40 hover:shadow-violet-500/10',
        },
        {
            icon: <Package className="h-5 w-5 sm:h-6 sm:w-6 text-amber-400" />,
            value: stats?.productsListed || 0,
            label: 'Products Listed',
            sublabel: 'Active Catalogue Items',
            textColor: 'text-amber-300',
            iconGradient: 'from-amber-500/25 via-orange-600/15 to-yellow-700/10',
            iconBorder: 'border border-amber-400/30',
            glowBorder: 'hover:border-amber-400/40 hover:shadow-amber-500/10',
        },
        {
            icon: <Wrench className="h-5 w-5 sm:h-6 sm:w-6 text-teal-400" />,
            value: stats?.servicesListed || 0,
            label: 'Services Listed',
            sublabel: 'Industrial & Technical',
            textColor: 'text-teal-300',
            iconGradient: 'from-teal-500/25 via-emerald-600/15 to-cyan-700/10',
            iconBorder: 'border border-teal-400/30',
            glowBorder: 'hover:border-teal-400/40 hover:shadow-teal-500/10',
        },
        {
            icon: <Briefcase className="h-5 w-5 sm:h-6 sm:w-6 text-rose-400" />,
            value: stats?.activeRequirements || 0,
            label: 'Active Demands',
            sublabel: 'Live RFQs & Tenders',
            textColor: 'text-rose-300',
            iconGradient: 'from-rose-500/25 via-pink-600/15 to-red-700/10',
            iconBorder: 'border border-rose-400/30',
            glowBorder: 'hover:border-rose-400/40 hover:shadow-rose-500/10',
        },
        {
            icon: <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" />,
            value: stats?.categories || 0,
            label: 'Categories',
            sublabel: 'Specialized Domains',
            textColor: 'text-emerald-300',
            iconGradient: 'from-emerald-500/25 via-green-600/15 to-teal-700/10',
            iconBorder: 'border border-emerald-400/30',
            glowBorder: 'hover:border-emerald-400/40 hover:shadow-emerald-500/10',
        },
    ];

    const hasData = items.some(i => i.value > 0);
    if (!hasData) return null;

    return (
        <section
            ref={ref}
            className="relative overflow-hidden bg-[#07172e] border-y border-white/[0.08]"
            style={{
                background: 'radial-gradient(ellipse 80% 60% at 50% 0%, #0d2a52 0%, #07172e 65%, #040e1d 100%)',
            }}
            aria-labelledby="stats-heading"
        >
            {/* Subtle background grid pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

            {/* Ambient decorative glow spheres */}
            <div className="absolute -top-32 left-1/4 w-96 h-96 rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-32 right-1/4 w-96 h-96 rounded-full bg-violet-500/10 blur-[100px] pointer-events-none" />

            <div className="relative mx-auto max-w-[1680px] px-4 py-12 sm:py-16 sm:px-6 2xl:px-8">
                {/* Header Badge & Title */}
                <div
                    className="text-center max-w-2xl mx-auto mb-10 sm:mb-12"
                    style={{
                        opacity: running ? 1 : 0,
                        transform: running ? 'translateY(0)' : 'translateY(16px)',
                        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
                    }}
                >
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 backdrop-blur-md shadow-sm shadow-emerald-500/10 mb-3.5">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Live Platform Stats</span>
                    </div>

                    <h2
                        id="stats-heading"
                        className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight"
                    >
                        JsgSmile Portal at a Glance
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300/70 mt-2 font-normal leading-relaxed">
                        Real-time procurement & trade metrics powering the Jharsuguda MSME Marketplace
                    </p>
                </div>

                {/* 6 Stats Cards Grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 xl:gap-4 2xl:gap-5">
                    {items.map((item, i) => (
                        <StatCard
                            key={item.label}
                            {...item}
                            delay={60 + i * 70}
                            running={running}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}

