'use client';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Building2, Users, Package, Wrench, Layers, TrendingUp, Sparkles, Briefcase, Activity } from 'lucide-react';
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
            className={`group relative flex flex-col items-center justify-between text-center p-4 sm:p-5 lg:p-4 xl:p-5 rounded-3xl bg-white/[0.05] hover:bg-white/[0.1] backdrop-blur-xl border border-white/10 ${glowBorder} transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.5)] cursor-default overflow-hidden`}
            style={{
                opacity: running ? 1 : 0,
                transform: running ? 'translateY(0)' : 'translateY(24px)',
                transition: `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, background 0.3s, border-color 0.3s, box-shadow 0.3s`,
            }}
        >
            {/* Ambient inner card glow on hover */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            {/* Top highlight bar */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#c8a45c] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Icon Container with 3D Pop */}
            <div className="relative mb-3">
                <div
                    className={`w-11 h-11 sm:w-12 sm:h-12 xl:w-14 xl:h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br ${iconGradient} ${iconBorder} shadow-lg transition-transform duration-500 group-hover:scale-115 group-hover:rotate-3`}
                >
                    {icon}
                </div>
            </div>

            {/* Value Counter */}
            <div className="relative z-10 my-auto">
                <div className={`text-2xl sm:text-3xl lg:text-2xl xl:text-3xl font-black tracking-tight ${textColor} drop-shadow-md`}>
                    {animated.toLocaleString('en-IN')}
                    {value > 0 && <span className="text-lg sm:text-xl font-bold ml-0.5 opacity-90">+</span>}
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-white mt-1 leading-snug group-hover:text-white transition-colors">{label}</h3>
            </div>

            {/* Sub-badge / Context tag */}
            <div className="mt-3 pt-2.5 border-t border-white/[0.08] w-full flex items-center justify-center">
                <span className="text-[9.5px] sm:text-[10px] font-bold text-slate-400 tracking-wider uppercase group-hover:text-slate-200 transition-colors truncate">
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
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [running, setRunning] = useState(false);

    // Particle Background Canvas for Stats Section
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let width = (canvas.width = canvas.parentElement?.clientWidth || 1200);
        let height = (canvas.height = canvas.parentElement?.clientHeight || 400);

        const handleResize = () => {
            if (!canvas || !canvas.parentElement) return;
            width = canvas.width = canvas.parentElement.clientWidth;
            height = canvas.height = canvas.parentElement.clientHeight;
        };
        window.addEventListener('resize', handleResize);

        const particleCount = 28;
        const particles: Array<{
            x: number;
            y: number;
            vx: number;
            vy: number;
            radius: number;
            color: string;
            alpha: number;
        }> = [];

        const colors = ['#c8a45c', '#38bdf8', '#10b981', '#a855f7'];

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.35,
                vy: (Math.random() - 0.5) * 0.35,
                radius: Math.random() * 2 + 1,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: Math.random() * 0.4 + 0.15
            });
        }

        const render = () => {
            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 120) {
                        ctx.strokeStyle = `rgba(200, 164, 92, ${(1 - dist / 120) * 0.12})`;
                        ctx.lineWidth = 0.8;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }

            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0 || p.x > width) p.vx *= -1;
                if (p.y < 0 || p.y > height) p.vy *= -1;

                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const items = useMemo(() => [
        {
            icon: <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-sky-400" />,
            value: stats?.verifiedSellers || 0,
            label: 'Verified Sellers',
            sublabel: 'KYC & MSME Validated',
            textColor: 'text-sky-300',
            iconGradient: 'from-sky-500/30 via-sky-600/20 to-blue-700/10',
            iconBorder: 'border border-sky-400/40',
            glowBorder: 'hover:border-sky-400/50 hover:shadow-sky-500/20',
        },
        {
            icon: <Users className="h-5 w-5 sm:h-6 sm:w-6 text-violet-400" />,
            value: stats?.registeredBuyers || 0,
            label: 'Registered Buyers',
            sublabel: 'Large Industries & PSUs',
            textColor: 'text-violet-300',
            iconGradient: 'from-violet-500/30 via-purple-600/20 to-indigo-700/10',
            iconBorder: 'border border-violet-400/40',
            glowBorder: 'hover:border-violet-400/50 hover:shadow-violet-500/20',
        },
        {
            icon: <Package className="h-5 w-5 sm:h-6 sm:w-6 text-amber-400" />,
            value: stats?.productsListed || 0,
            label: 'Products Listed',
            sublabel: 'Active Catalogue Items',
            textColor: 'text-amber-300',
            iconGradient: 'from-amber-500/30 via-orange-600/20 to-yellow-700/10',
            iconBorder: 'border border-amber-400/40',
            glowBorder: 'hover:border-amber-400/50 hover:shadow-amber-500/20',
        },
        {
            icon: <Wrench className="h-5 w-5 sm:h-6 sm:w-6 text-teal-400" />,
            value: stats?.servicesListed || 0,
            label: 'Services Listed',
            sublabel: 'Industrial & Technical',
            textColor: 'text-teal-300',
            iconGradient: 'from-teal-500/30 via-emerald-600/20 to-cyan-700/10',
            iconBorder: 'border border-teal-400/40',
            glowBorder: 'hover:border-teal-400/50 hover:shadow-teal-500/20',
        },
        {
            icon: <Briefcase className="h-5 w-5 sm:h-6 sm:w-6 text-rose-400" />,
            value: stats?.activeRequirements || 0,
            label: 'Active Demands',
            sublabel: 'Live RFQs & Tenders',
            textColor: 'text-rose-300',
            iconGradient: 'from-rose-500/30 via-pink-600/20 to-red-700/10',
            iconBorder: 'border border-rose-400/40',
            glowBorder: 'hover:border-rose-400/50 hover:shadow-rose-500/20',
        },
        {
            icon: <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400" />,
            value: stats?.categories || 0,
            label: 'Categories',
            sublabel: 'Specialized Domains',
            textColor: 'text-emerald-300',
            iconGradient: 'from-emerald-500/30 via-green-600/20 to-teal-700/10',
            iconBorder: 'border border-emerald-400/40',
            glowBorder: 'hover:border-emerald-400/50 hover:shadow-emerald-500/20',
        },
    ], [stats]);

    const hasData = items.some(i => i.value > 0);

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
    }, [hasData]);

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
            {/* Interactive Particle Canvas */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 z-0 pointer-events-none opacity-60"
            />

            {/* Subtle background grid pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

            {/* Ambient decorative glow spheres */}
            <div className="absolute -top-32 left-1/4 w-96 h-96 rounded-full bg-blue-500/15 blur-[120px] pointer-events-none" />
            <div className="absolute -bottom-32 right-1/4 w-96 h-96 rounded-full bg-[#c8a45c]/10 blur-[120px] pointer-events-none" />

            <div className="relative z-10 mx-auto max-w-[1680px] px-4 py-12 sm:py-16 sm:px-6 2xl:px-8">
                {/* Header Badge & Title */}
                <div
                    className="text-center max-w-2xl mx-auto mb-8 sm:mb-10"
                    style={{
                        opacity: running ? 1 : 0,
                        transform: running ? 'translateY(0)' : 'translateY(16px)',
                        transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
                    }}
                >
                    

                    <h2
                        id="stats-heading"
                        className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight"
                    >
                        JSG <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#c8a45c] to-amber-300">SMiLE</span> Portal at a Glance
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300/80 mt-2 font-normal leading-relaxed">
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
