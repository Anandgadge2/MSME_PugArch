import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '../components/ui/card';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ShieldCheck,
  Store,
  UsersRound,
  Sparkles,
  CheckCircle2,
  Zap,
  TrendingUp,
  Award,
  Lock,
  Cpu,
  Activity
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function RegisterSelection() {
  const searchParams = useSearchParams();
  const returnUrl = searchParams?.get('returnUrl') || '';

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [logoTilt, setLogoTilt] = useState({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });

  // Interactive Particle Network Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particleCount = Math.min(45, Math.floor((width * height) / 22000));
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      color: string;
      alpha: number;
      pulsePhase: number;
    }> = [];

    const sparks: Array<{
      p1: number;
      p2: number;
      progress: number;
      speed: number;
      color: string;
    }> = [];

    const colors = ['#c8a45c', '#38bdf8', '#10b981', '#a855f7', '#fbbf24'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.4 + 0.2,
        pulsePhase: Math.random() * Math.PI * 2
      });
    }

    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw particle connections & generate electric synapse sparks
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 130) {
            const alpha = (1 - dist / 130) * 0.15;
            ctx.strokeStyle = `rgba(200, 164, 92, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();

            // Synapse sparks
            if (Math.random() < 0.0006 && sparks.length < 4) {
              sparks.push({
                p1: i,
                p2: j,
                progress: 0,
                speed: 0.025 + Math.random() * 0.025,
                color: colors[Math.floor(Math.random() * colors.length)]
              });
            }
          }
        }

        // Mouse connection magnetism
        const mouseDx = particles[i].x - mouseX;
        const mouseDy = particles[i].y - mouseY;
        const mouseDist = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);
        if (mouseDist < 160) {
          const alpha = (1 - mouseDist / 160) * 0.35;
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouseX, mouseY);
          ctx.stroke();
        }
      }

      // Render sparks
      for (let s = sparks.length - 1; s >= 0; s--) {
        const spark = sparks[s];
        spark.progress += spark.speed;
        if (spark.progress >= 1) {
          sparks.splice(s, 1);
          continue;
        }
        const p1 = particles[spark.p1];
        const p2 = particles[spark.p2];
        if (!p1 || !p2) {
          sparks.splice(s, 1);
          continue;
        }
        const sx = p1.x + (p2.x - p1.x) * spark.progress;
        const sy = p1.y + (p2.y - p1.y) * spark.progress;

        ctx.fillStyle = spark.color;
        ctx.shadowColor = spark.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Update & Draw nodes
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.pulsePhase += 0.03;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        const currentRadius = p.radius + Math.sin(p.pulsePhase) * 0.5;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, currentRadius), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // 3D Parallax on Logo
  const handleLogoMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -12;
    const rotateY = ((x - centerX) / centerX) * 12;
    setLogoTilt({
      rotateX,
      rotateY,
      glareX: (x / rect.width) * 100,
      glareY: (y / rect.height) * 100
    });
  };

  const handleLogoMouseLeave = () => {
    setLogoTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });
  };

  const registrationOptions = [
    {
      href: returnUrl ? `/seller/register?returnUrl=${encodeURIComponent(returnUrl)}` : '/seller/register',
      roleKey: 'seller',
      badge: 'SUPPLIER / ENTERPRISE',
      badgeClass: 'bg-purple-100/90 text-purple-800 border-purple-200',
      title: 'Register as Seller / Vendor',
      cta: 'Get Started as Seller',
      description: 'For MSMEs, industrial suppliers, manufacturing companies, firms, startups, or proprietors looking to showcase catalogues, bid on public tenders, and fulfill enterprise orders.',
      highlights: ['Automated Catalogue Showcase', 'Tender & Reverse Bidding', 'Protected Escrow Payouts'],
      icon: Store,
      cardBorder: 'hover:border-purple-300 hover:shadow-purple-500/10',
      iconContainer: 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-purple-500/25',
      accentColor: 'text-purple-600',
      buttonBg: 'bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 shadow-purple-900/20'
    },
    {
      href: returnUrl ? `/buyer/register?returnUrl=${encodeURIComponent(returnUrl)}` : '/buyer/register',
      roleKey: 'buyer',
      badge: 'GOVT & ENTERPRISE PROCUREMENT',
      badgeClass: 'bg-blue-100/90 text-blue-800 border-blue-200',
      title: 'Register as Buyer / User',
      cta: 'Get Started as Buyer',
      description: 'For government departments, corporate procurers, co-operatives, institutions, and authorized procurement officers who publish RFQs, compare verified suppliers, and manage purchases.',
      highlights: ['Multi-Supplier Quotation RFQ', 'Verified Supplier Directory', 'Idempotency Escrow Protection'],
      icon: Building2,
      cardBorder: 'hover:border-blue-300 hover:shadow-blue-500/10',
      iconContainer: 'bg-gradient-to-br from-[#0b2447] to-[#12335f] text-white shadow-blue-900/25',
      accentColor: 'text-[#0b2447]',
      buttonBg: 'bg-gradient-to-r from-[#07172e] via-[#0b2447] to-[#12335f] hover:from-[#0b2447] hover:to-[#07172e] shadow-blue-900/20'
    },
    {
      href: returnUrl ? `/hershg/register?returnUrl=${encodeURIComponent(returnUrl)}` : '/hershg/register',
      roleKey: 'shg',
      badge: 'WOMEN EMPOWERMENT COLLECTIVES',
      badgeClass: 'bg-emerald-100/90 text-emerald-800 border-emerald-200',
      title: 'Register as herSHG',
      cta: 'Get Started as herSHG',
      description: 'For women Self-Help Groups, producer federations, and micro-collectives selling handcrafted goods, agro-food, textiles, and local artisanal items with guided verification.',
      highlights: ['Artisan Digital Storefront', 'Resolution Readiness Checklist', 'Zero-Fee Direct Market Linkage'],
      icon: UsersRound,
      cardBorder: 'hover:border-emerald-300 hover:shadow-emerald-500/10',
      iconContainer: 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-emerald-500/25',
      accentColor: 'text-emerald-600',
      buttonBg: 'bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 shadow-emerald-900/20'
    }
  ];

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-[#07172e] to-slate-900 px-3 py-12 sm:px-6 lg:py-10 text-white font-sans selection:bg-[#c8a45c]/30 selection:text-white">

      {/* Interactive Particle Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0 pointer-events-auto opacity-70 cursor-crosshair"
      />

      {/* Ambient Multi-tone Nebula Flares */}
      <div className="absolute top-[5%] left-[10%] h-[45%] w-[45%] rounded-full bg-blue-500/[0.12] blur-[150px] animate-pulse pointer-events-none" style={{ animationDuration: '8s' }} />
      <div className="absolute bottom-[5%] right-[10%] h-[45%] w-[45%] rounded-full bg-[#c8a45c]/[0.1] blur-[140px] animate-pulse pointer-events-none" style={{ animationDuration: '6s' }} />
      <div className="absolute top-[40%] left-[35%] h-[35%] w-[35%] rounded-full bg-emerald-500/[0.06] blur-[120px] animate-pulse pointer-events-none" style={{ animationDuration: '10s' }} />

      {/* Cyber Grid Background */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.4) 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Back to Login Action */}
      <Link
        href={returnUrl ? `/login?returnUrl=${encodeURIComponent(returnUrl)}` : '/login'}
        className="group absolute left-4 top-4 z-20 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-black uppercase tracking-wider text-slate-200 shadow-[0_8px_20px_rgba(0,0,0,0.3)] backdrop-blur-md transition-all hover:-translate-x-1 hover:text-white hover:border-[#c8a45c]/50 hover:bg-white/15 active:scale-[0.98] sm:left-6 sm:top-6 sm:px-4 sm:py-2.5"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 text-[#c8a45c]" />
        <span>Back to Login</span>
      </Link>

     

      {/* MAIN CONTAINER */}
      <div className="relative z-10 w-full max-w-7xl px-2 text-center sm:px-4">
        
        {/* HEADER SECTION: Logo & Titles with 3D Aura */}
        <div className="mb-8 text-center sm:mb-10 flex flex-col items-center">
          
          {/* Logo Card with 3D Parallax & Neon Glow */}
          <div
            className="relative group cursor-pointer mb-4"
            onMouseMove={handleLogoMouseMove}
            onMouseLeave={handleLogoMouseLeave}
            style={{ perspective: 1000 }}
          >
            {/* Spinning Conic Glow Aura */}
            <div
              className="absolute -inset-2.5 rounded-[2.2rem] bg-gradient-to-tr from-[#c8a45c]/50 via-blue-500/40 to-emerald-400/50 opacity-80 blur-xl group-hover:opacity-100 transition-opacity duration-700 animate-pulse"
              style={{ animationDuration: '4s' }}
            />
            
            {/* 3D Tilted Container */}
            <div
              className="relative w-24 h-24 sm:w-28 sm:h-28 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex items-center justify-center p-2 border-2 border-white/40 overflow-hidden transition-transform duration-200 ease-out"
              style={{
                transform: `rotateX(${logoTilt.rotateX}deg) rotateY(${logoTilt.rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
                transformStyle: 'preserve-3d'
              }}
            >
              {/* Dynamic Light Sheen on Tilt */}
              <div
                className="absolute inset-0 pointer-events-none opacity-30 group-hover:opacity-60 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle at ${logoTilt.glareX}% ${logoTilt.glareY}%, rgba(255,255,255,0.8) 0%, transparent 60%)`
                }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logoo.png" alt="SMiLE MSME Logo" className="h-full w-full object-contain drop-shadow" />
            </div>
          </div>

          <h1 className="text-2xl font-black uppercase tracking-tight text-white sm:text-3xl md:text-4xl">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.35em] text-[#c8a45c]">
              Join JSG SMiLE Ecosystem
            </span>
            Create Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#c8a45c] via-amber-300 to-yellow-400">Profile</span>
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-xs sm:text-sm font-medium leading-relaxed text-slate-300">
            Select the profile that best describes your enterprise, procurement organization, or women Self-Help Group to begin a verified onboarding flow.
          </p>
        </div>

        {/* 3 STAKEHOLDER CARDS WITH 3D GLASSMETRICS */}
        <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
          {registrationOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Link key={option.href} href={option.href} className="group block h-full">
                <Card
                  className={cn(
                    "relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 p-6 sm:p-8 text-left shadow-[0_20px_50px_rgba(11,36,71,0.25)] backdrop-blur-2xl transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_70px_rgba(200,164,92,0.25)] hover:border-[#c8a45c]/60",
                    option.cardBorder
                  )}
                >
                  {/* Subtle Top Accent Line */}
                  <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-[#c8a45c] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                  <CardContent className="flex h-full flex-col justify-between p-0 text-slate-900">
                    <div>
                      {/* Top Header: Icon & Category Badge */}
                      <div className="mb-5 flex items-center justify-between">
                        <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-2', option.iconContainer)}>
                          <Icon className="h-7 w-7" />
                        </div>
                        <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border', option.badgeClass)}>
                          {option.badge}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h3 className="mb-2.5 text-xl font-black tracking-tight text-[#0b2447] sm:text-2xl group-hover:text-black transition-colors">
                        {option.title}
                      </h3>
                      <p className="mb-5 text-xs font-semibold leading-relaxed text-slate-500 sm:text-sm">
                        {option.description}
                      </p>

                      {/* Feature Highlights Bullets */}
                      <div className="mb-6 space-y-2 border-t border-slate-100 pt-4">
                        {option.highlights.map((h, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                            <CheckCircle2 className={cn("h-4 w-4 shrink-0", option.accentColor)} />
                            <span>{h}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom CTA Button */}
                    <div className="mt-auto border-t border-slate-100 pt-5">
                      <div
                        className={cn(
                          "relative overflow-hidden w-full h-11 rounded-2xl flex items-center justify-between px-5 text-white font-black text-xs uppercase tracking-wider transition-all duration-300 group-hover:shadow-lg shadow-md active:scale-[0.98]",
                          option.buttonBg
                        )}
                      >
                        {/* Shimmer light sweep */}
                        <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
                        
                        <span>{option.cta}</span>
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white transition-transform duration-300 group-hover:translate-x-1">
                          <ArrowRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

       

        {/* BOTTOM FOOTER */}
        <div className="mt-8 text-center text-[10px] font-medium text-slate-400/60 tracking-wider">
          Protected by 256-Bit SSL &bull; &copy; {new Date().getFullYear()} District Administration, Jharsuguda, Odisha
        </div>
      </div>
    </div>
  );
}
