import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api, readJsonResponse } from '../lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import {
  ShieldCheck,
  Mail,
  Key,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  Building2,
  Store,
  UsersRound,
  Sparkles,
  Lock,
  Zap,
  Activity,
  ArrowRight,
  TrendingUp,
  Award,
  Globe2,
  Cpu,
  Fingerprint
} from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { isShgUser } from '../lib/shg';
import { safeInternalPath } from '../lib/safeNavigation';

const generateSecureCaptchaString = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [captchaValue, setCaptchaValue] = useState(generateSecureCaptchaString());
  const [userCaptcha, setUserCaptcha] = useState('');
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [twoFactorOtp, setTwoFactorOtp] = useState('');
  const [twoFactorChannel, setTwoFactorChannel] = useState<'email' | 'sms'>('email');
  const [canSms, setCanSms] = useState(false);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);

  // 3D Tilt Card State for Logo
  const [cardTilt, setCardTilt] = useState({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { user, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  const generateCaptcha = useCallback(() => {
    setCaptchaValue(generateSecureCaptchaString());
    setUserCaptcha('');
  }, []);

  // Dynamic feature ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFeatureIndex(prev => (prev + 1) % 4);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  // Interactive Particle Network & Electric Synapse Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 600);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 800);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    const particleCount = Math.min(42, Math.floor((width * height) / 16000));
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

    const ripples: Array<{
      x: number;
      y: number;
      radius: number;
      maxRadius: number;
      alpha: number;
    }> = [];

    const colors = ['#c8a45c', '#38bdf8', '#10b981', '#a855f7', '#fbbf24'];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: Math.random() * 2.2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: Math.random() * 0.5 + 0.25,
        pulsePhase: Math.random() * Math.PI * 2
      });
    }

    let mouseX = -1000;
    let mouseY = -1000;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };
    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };
    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      ripples.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        radius: 0,
        maxRadius: 180,
        alpha: 0.8
      });
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('click', handleClick);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw Click Ripples
      for (let r = ripples.length - 1; r >= 0; r--) {
        const rip = ripples[r];
        rip.radius += 3.5;
        rip.alpha *= 0.94;
        ctx.strokeStyle = `rgba(200, 164, 92, ${rip.alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
        ctx.stroke();

        if (rip.alpha < 0.02 || rip.radius > rip.maxRadius) {
          ripples.splice(r, 1);
        }
      }

      // Draw particle connections & generate electric synapse sparks
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            const alpha = (1 - dist / 120) * 0.18;
            ctx.strokeStyle = `rgba(200, 164, 92, ${alpha})`;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();

            // Occasional high-speed electric spark between close nodes
            if (Math.random() < 0.0008 && sparks.length < 5) {
              sparks.push({
                p1: i,
                p2: j,
                progress: 0,
                speed: 0.03 + Math.random() * 0.03,
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
          const alpha = (1 - mouseDist / 160) * 0.45;
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouseX, mouseY);
          ctx.stroke();
        }
      }

      // Render traveling synapse sparks
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
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
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

        const currentRadius = p.radius + Math.sin(p.pulsePhase) * 0.6;
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
      if (canvas) {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mouseleave', handleMouseLeave);
        canvas.removeEventListener('click', handleClick);
      }
    };
  }, []);

  // 3D Mouse Parallax on Brand Logo Card
  const handleLogoMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -12;
    const rotateY = ((x - centerX) / centerX) * 12;
    setCardTilt({
      rotateX,
      rotateY,
      glareX: (x / rect.width) * 100,
      glareY: (y / rect.height) * 100
    });
  };

  const handleLogoMouseLeave = () => {
    setCardTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });
  };

  useEffect(() => {
    if (user) {
      if (returnUrl) {
        router.replace(safeInternalPath(returnUrl));
      } else {
        if (isShgUser(user)) {
          router.replace('/shg/dashboard');
        } else {
          router.replace(user.role === 'master_admin' ? '/master-admin' : '/dashboard');
        }
      }
    }
  }, [user, router, returnUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const loadToast = toast.loading('Authenticating credentials...');

    try {
      const res = await api.post('/api/auth/login', { email, password });
      const data = await readJsonResponse(res);

      if (res.ok) {
        if (data.requiresTwoFactor) {
          setTwoFactorPending(true);
          setTwoFactorChannel(data.channel === 'sms' ? 'sms' : 'email');
          setCanSms(!!data.canSms);
          toast.success(`Enter the two-factor code sent to your ${data.channel === 'sms' ? 'mobile' : 'email'}`, { id: loadToast });
          return;
        }
        const destination = returnUrl ? safeInternalPath(returnUrl) : (
          isShgUser(data.user) ? '/shg/dashboard' : (data.user.role === 'master_admin' ? '/master-admin' : '/dashboard')
        );
        toast.success(`Welcome back, ${data.user.name}!`, { id: loadToast });
        login(data.accessToken || data.token, data.user, data.refreshToken, destination);
      } else {
        toast.error(data.message || 'Login failed', { id: loadToast });
        generateCaptcha();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Unable to reach the backend API', { id: loadToast });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const loadToast = toast.loading('Verifying secure code...');
    try {
      const res = await api.post('/api/auth/2fa/verify', { email, channel: twoFactorChannel, otp: twoFactorOtp });
      const data = await readJsonResponse(res);
      if (!res.ok) {
        toast.error(data.message || 'Invalid verification code', { id: loadToast });
        return;
      }
      const destination = returnUrl ? safeInternalPath(returnUrl) : (
        isShgUser(data.user) ? '/shg/dashboard' : (data.user.role === 'master_admin' ? '/master-admin' : '/dashboard')
      );
      toast.success(`Welcome back, ${data.user.name}!`, { id: loadToast });
      login(data.accessToken || data.token, data.user, data.refreshToken, destination);
    } catch (err: any) {
      toast.error(err?.message || 'Unable to verify code', { id: loadToast });
    } finally {
      setIsLoading(false);
    }
  };

  const featurePills = [
    { label: 'MSME Direct Linkage', icon: Building2, desc: 'Direct access to industrial enterprise demand' },
    { label: 'Smart Escrow & Settlements', icon: ShieldCheck, desc: 'Idempotency protected milestone payments' },
    { label: 'Instant Reverse Bidding', icon: Zap, desc: 'Real-time competitive procurement auctions' },
    { label: 'District GeM Integration', icon: CheckCircle2, desc: 'Integrated state & district level verification' }
  ];

  return (
    <div className="relative flex min-h-dvh w-full overflow-hidden bg-slate-950 font-sans selection:bg-[#c8a45c]/30 selection:text-white">

      {/* ═══════════════════════════════════════════════════════════════════
          LEFT PANEL — Ultra-Modern Brand Showcase with 3D Holographic Dynamics
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col items-center justify-between overflow-hidden bg-gradient-to-br from-[#040e1d] via-[#0b2447] to-[#071a33] p-8 xl:p-12">
        
        {/* Interactive Particle Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-0 pointer-events-auto opacity-80 cursor-crosshair"
        />

        {/* Ambient Multi-tone Glowing Nebula Orbs */}
        <div className="absolute top-[5%] left-[5%] h-[55%] w-[55%] rounded-full bg-blue-500/[0.14] blur-[150px] animate-pulse pointer-events-none" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[5%] right-[5%] h-[50%] w-[50%] rounded-full bg-[#c8a45c]/[0.12] blur-[140px] animate-pulse pointer-events-none" style={{ animationDuration: '6s' }} />
        <div className="absolute top-[40%] left-[30%] h-[40%] w-[40%] rounded-full bg-emerald-500/[0.08] blur-[120px] animate-pulse pointer-events-none" style={{ animationDuration: '10s' }} />

        {/* Futuristic Cyber-Grid Pattern Overlay */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px)`,
            backgroundSize: '24px 24px'
          }}
        />

       

       

       

        {/* CENTER CONTENT: 3D Interactive Logo Card with Rotating Conic Aura */}
        <div className="relative z-10 flex flex-col items-center text-center max-w-lg my-auto py-2">
          
          {/* Logo Card with 3D Mouse Gyroscope & Rotating Conic Glow Aura */}
          <div
            className="relative group cursor-pointer perspective-1000"
            onMouseMove={handleLogoMouseMove}
            onMouseLeave={handleLogoMouseLeave}
            style={{ perspective: 1000 }}
          >
            {/* Multi-layered Neon Ambient Aura */}
            <div
              className="absolute -inset-3.5 rounded-[3.2rem] bg-gradient-to-tr from-[#c8a45c]/50 via-blue-500/40 to-emerald-400/50 opacity-80 blur-2xl group-hover:opacity-100 transition-opacity duration-700 animate-pulse"
              style={{ animationDuration: '4s' }}
            />
            
            {/* 3D Tilted Inner Container */}
            <div
              className="relative w-64 h-64 sm:w-72 sm:h-72 xl:w-80 xl:h-80 bg-white rounded-[2.5rem] shadow-[0_35px_90px_-15px_rgba(0,0,0,0.7)] flex items-center justify-center p-1 border-2 border-white/40 overflow-hidden transition-transform duration-200 ease-out"
              style={{
                transform: `rotateX(${cardTilt.rotateX}deg) rotateY(${cardTilt.rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
                transformStyle: 'preserve-3d'
              }}
            >
              {/* Dynamic Light Sheen on Tilt */}
              <div
                className="absolute inset-0 pointer-events-none opacity-30 group-hover:opacity-60 transition-opacity duration-300"
                style={{
                  background: `radial-gradient(circle at ${cardTilt.glareX}% ${cardTilt.glareY}%, rgba(255,255,255,0.8) 0%, transparent 60%)`
                }}
              />

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logoo.png"
                alt="JSG SMiLE - Synergy for MSME and Industry Linkage Ecosystem"
                className="w-full h-full object-contain drop-shadow-lg transition-transform duration-500 group-hover:scale-[1.04]"
              />
            </div>
          </div>

          {/* Golden Gradient Separator with Luminous Glow */}
          <div className="mt-7 w-24 h-[3px] bg-gradient-to-r from-transparent via-[#c8a45c] to-transparent rounded-full shadow-[0_0_16px_rgba(200,164,92,0.9)] animate-pulse" />

          {/* Title & Official Portal Designation */}
          <h1 className="mt-4 text-2xl xl:text-3xl font-black tracking-tight text-white leading-tight">
            <span className="block text-[#c8a45c] text-[10px] xl:text-[11px] font-bold uppercase tracking-[0.45em] mb-1.5">
              Government of India &bull; District Portal
            </span>
            JSG <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#c8a45c] via-amber-300 to-yellow-500">SMiLE</span> Portal
          </h1>
          <p className="mt-2.5 text-xs xl:text-sm font-medium text-slate-300 leading-relaxed max-w-sm">
            Jharsuguda Synergy for MSME &amp; Industry Linkage Ecosystem
          </p>

          {/* Dynamic Interactive Feature Carousel Pill */}
          <div className="mt-6 w-full max-w-sm">
            <div className="flex items-center gap-3 rounded-2xl bg-white/[0.07] border border-white/15 px-4 py-3 backdrop-blur-md shadow-lg transition-all duration-500 hover:bg-white/[0.1] hover:border-[#c8a45c]/40">
              {React.createElement(featurePills[activeFeatureIndex].icon, {
                className: "h-5 w-5 text-[#c8a45c] shrink-0 animate-bounce",
                style: { animationDuration: '2s' }
              })}
              <div className="text-left min-w-0 flex-1">
                <div className="text-xs font-black text-white tracking-wide truncate">
                  {featurePills[activeFeatureIndex].label}
                </div>
                <div className="text-[10px] font-medium text-slate-300 truncate">
                  {featurePills[activeFeatureIndex].desc}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {featurePills.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === activeFeatureIndex ? 'w-4 bg-[#c8a45c]' : 'w-1.5 bg-white/20'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Trust Badges Row */}
          <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-sm">
            {[
              { icon: ShieldCheck, label: 'AES-256 Encrypted' },
              { icon: CheckCircle2, label: 'Govt. Verified' },
              { icon: Building2, label: 'MSME Linked' },
            ].map((badge) => (
              <div
                key={badge.label}
                className="group flex flex-col items-center gap-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] py-3 px-2 backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.1] hover:border-[#c8a45c]/50 hover:-translate-y-1 hover:shadow-lg"
              >
                <badge.icon className="h-4 w-4 text-[#c8a45c] group-hover:scale-125 transition-transform duration-300" />
                <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider text-center leading-tight">
                  {badge.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* BOTTOM FOOTER */}
        <div className="relative z-10 w-full text-center border-t border-white/[0.06] pt-4">
          <p className="text-[10px] font-medium text-slate-400/70 tracking-wider">
            &copy; {new Date().getFullYear()} District Administration, Jharsuguda, Odisha &bull; Powered by PugArch
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          RIGHT PANEL — Ultra-Luxury Frosted Glass Login Interface
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative flex-1 flex flex-col items-center justify-center px-4 py-8 sm:px-6 lg:px-12 xl:px-16 bg-gradient-to-br from-slate-900 via-slate-900 to-[#07172e] lg:from-slate-50 lg:via-slate-100 lg:to-blue-50/40">
        
        {/* Back to Home Action */}
        <Link
          href="/"
          className="group absolute top-5 left-5 z-20 flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700 shadow-sm backdrop-blur-md transition-all hover:-translate-x-1 hover:text-[#0b2447] hover:border-[#c8a45c]/50 hover:shadow-md active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 text-[#0b2447]" />
          <span>Back to Home</span>
        </Link>

        {/* Soft Ambient Background Highlights */}
        <div className="absolute top-[-10%] right-[-10%] h-[45%] w-[45%] rounded-full bg-blue-400/20 blur-[130px] animate-pulse pointer-events-none" style={{ animationDuration: '7s' }} />
        <div className="absolute bottom-[-10%] left-[-10%] h-[40%] w-[40%] rounded-full bg-[#c8a45c]/15 blur-[120px] animate-pulse pointer-events-none" style={{ animationDuration: '9s' }} />

        {/* Mobile Header Banner (visible on < lg) */}
        <div className="lg:hidden w-full max-w-md mb-6 animate-in fade-in zoom-in duration-500">
          <div className="relative rounded-3xl bg-gradient-to-br from-[#051124] via-[#0b2447] to-[#071a33] p-6 text-center overflow-hidden border border-white/15 shadow-2xl">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#c8a45c]/15 rounded-full blur-2xl pointer-events-none" />
            <div className="relative flex flex-col items-center">
              <div className="w-24 h-24 bg-white rounded-2xl shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)] flex items-center justify-center p-2 border-2 border-white/30 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logoo.png" alt="SMiLE MSME Logo" className="w-full h-full object-contain" />
              </div>
              <h2 className="mt-3 text-lg font-black text-white uppercase tracking-tight">
                <span className="block text-[#c8a45c] text-[9px] tracking-[0.3em] mb-0.5">Government of India</span>
                JSG SMiLE Portal
              </h2>
              <p className="mt-1 text-[10px] font-bold text-slate-300/80 uppercase tracking-wider">
                MSME Procurement &amp; Industry Linkage
              </p>
            </div>
          </div>
        </div>

        {/* Luxury Glass Form Card with Glowing Animated Border */}
        <div className="relative z-10 w-full max-w-md bg-white/95 lg:bg-white/90 backdrop-blur-2xl rounded-3xl border border-white/80 shadow-[0_30px_70px_-15px_rgba(11,36,71,0.18)] p-7 sm:p-9 border-t-4 border-t-[#c8a45c] animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Card Header with Glowing Gateway Badge */}
          <div className="mb-6">
            <div className="hidden lg:flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#0b2447] to-[#12335f] flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(11,36,71,0.35)]">
                <ShieldCheck className="h-5 w-5 text-[#c8a45c]" />
              </div>
              <div>
                <p className="text-[10px] font-black text-[#c8a45c] uppercase tracking-[0.2em]">Secure Sign-In</p>
                <p className="text-xs font-bold text-slate-500">Official Procurement Gateway</p>
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-[#0b2447]">
              Welcome Back
            </h2>
            <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
              Enter your authorized credentials to access your portal account
            </p>
          </div>

          {/* Form Content */}
          <form onSubmit={twoFactorPending ? handleTwoFactorSubmit : handleSubmit} className="space-y-4" suppressHydrationWarning>
            {twoFactorPending ? (
              <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
                <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-1">Two-Factor Code</label>
                <p className="text-xs font-semibold text-slate-500">
                  Enter the 6-digit code sent to your {twoFactorChannel === 'sms' ? 'verified mobile number' : 'registered email'}.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFactorOtp}
                  onChange={(e) => setTwoFactorOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full h-14 rounded-2xl border-2 border-slate-200 bg-white px-4 text-center text-2xl font-black tracking-[0.5em] text-[#0b2447] focus:outline-none focus:ring-2 focus:ring-[#c8a45c]/40 focus:border-[#0b2447] transition-all shadow-sm"
                  required
                  autoFocus
                  suppressHydrationWarning
                />
                {canSms && (
                  <div className="flex justify-between items-center pt-1 px-1">
                    <button
                      type="button"
                      onClick={async () => {
                        const newChannel = twoFactorChannel === 'sms' ? 'email' : 'sms';
                        const loadToast = toast.loading(`Sending code to your ${newChannel === 'sms' ? 'mobile' : 'email'}...`);
                        try {
                          const res = await api.post('/api/auth/login', { email, password, channel: newChannel });
                          const data = await readJsonResponse(res);
                          if (res.ok && data.requiresTwoFactor) {
                            setTwoFactorChannel(newChannel);
                            toast.success(`OTP sent to your ${newChannel === 'sms' ? 'mobile' : 'email'}`, { id: loadToast });
                          } else {
                            toast.error('Failed to send OTP to the requested channel', { id: loadToast });
                          }
                        } catch {
                          toast.error('Error switching verification channel', { id: loadToast });
                        }
                      }}
                      className="text-xs font-bold text-[#0b2447] underline decoration-[#c8a45c] underline-offset-4 hover:text-[#c8a45c] transition-colors"
                      suppressHydrationWarning
                    >
                      Receive OTP via {twoFactorChannel === 'sms' ? 'Email' : 'SMS'} instead
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setTwoFactorPending(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700 underline decoration-slate-300 underline-offset-4 block mt-1 transition-colors"
                  suppressHydrationWarning
                >
                  &larr; Use different credentials
                </button>
              </div>
            ) : (
              <>
                {/* Email Field with Glowing Accent Ring */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-1">Official Email or Mobile</label>
                  <div className="group relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[#c8a45c] transition-colors duration-300" />
                    <input
                      type="text"
                      placeholder="email@company.com or 10-digit mobile"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full h-12 pl-12 pr-4 rounded-2xl border border-slate-200 bg-white/95 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#c8a45c]/40 focus:border-[#0b2447] focus:shadow-[0_0_24px_rgba(200,164,92,0.18)] transition-all font-semibold shadow-xs hover:border-slate-300 hover:bg-white"
                      suppressHydrationWarning
                    />
                  </div>
                </div>

                {/* Password Field with Glowing Accent Ring */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-slate-600 tracking-[0.2em] ml-1">Secure Password</label>
                    <Link
                      href="/forgot-password"
                      className="text-[10px] font-black uppercase tracking-wider text-[#0b2447] hover:text-[#c8a45c] underline decoration-[#c8a45c]/50 underline-offset-4 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="group relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-[#c8a45c] transition-colors duration-300" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full h-12 pl-12 pr-12 rounded-2xl border border-slate-200 bg-white/95 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#c8a45c]/40 focus:border-[#0b2447] focus:shadow-[0_0_24px_rgba(200,164,92,0.18)] transition-all font-semibold shadow-xs hover:border-slate-300 hover:bg-white"
                      suppressHydrationWarning
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0b2447] focus:outline-none transition-colors"
                      suppressHydrationWarning
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4 text-[#0b2447]" /> : <Eye className="h-4 w-4 text-slate-400 hover:text-[#0b2447]" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Shimmer Submit Button with Light Ray */}
            <div className="pt-2">
              <Button
                type="submit"
                className="relative overflow-hidden w-full h-12 rounded-2xl bg-gradient-to-r from-[#07172e] via-[#0b2447] to-[#12335f] hover:from-[#0b2447] hover:to-[#07172e] text-white font-black uppercase tracking-[0.2em] shadow-[0_16px_36px_-6px_rgba(11,36,71,0.4)] transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_22px_48px_-8px_rgba(200,164,92,0.4)] active:scale-[0.98] disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
                disabled={isLoading}
                suppressHydrationWarning
              >
                {/* Continuous luxury light shimmer */}
                <div className="absolute inset-0 -translate-x-full hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#c8a45c]" />
                    Authenticating...
                  </span>
                ) : twoFactorPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#c8a45c]" /> Verify Code
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>Sign In Now</span>
                    <ArrowRight className="h-4 w-4 text-[#c8a45c] group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </Button>
            </div>

            {/* Elegant Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">New To Portal?</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Registration CTA & Role-Specific Shortcuts */}
            <div className="text-center space-y-3">
              <p className="text-xs font-semibold text-slate-600">
                Don't have an enterprise account?{' '}
                <Link
                  href={returnUrl ? `/register?returnUrl=${encodeURIComponent(returnUrl)}` : '/register'}
                  className="text-[#0b2447] font-black uppercase hover:text-[#c8a45c] transition-colors underline decoration-[#c8a45c] underline-offset-4 decoration-2"
                >
                  Create Profile
                </Link>
              </p>

              {/* Enhanced Quick Role Shortcuts */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Link
                  href="/seller/register"
                  className="group flex flex-col items-center gap-1.5 rounded-2xl border border-purple-100 bg-purple-50/50 p-2.5 text-[10px] font-bold text-purple-900 hover:bg-purple-100/70 hover:border-purple-300 hover:shadow-sm transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="h-7 w-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                    <Store className="h-3.5 w-3.5" />
                  </div>
                  <span className="tracking-tight">Join as Seller</span>
                </Link>

                <Link
                  href="/buyer/register"
                  className="group flex flex-col items-center gap-1.5 rounded-2xl border border-blue-100 bg-blue-50/50 p-2.5 text-[10px] font-bold text-blue-900 hover:bg-blue-100/70 hover:border-blue-300 hover:shadow-sm transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="h-7 w-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                    <Building2 className="h-3.5 w-3.5" />
                  </div>
                  <span className="tracking-tight">Join as Buyer</span>
                </Link>

                <Link
                  href="/hershg/register"
                  className="group flex flex-col items-center gap-1.5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-2.5 text-[10px] font-bold text-emerald-900 hover:bg-emerald-100/70 hover:border-emerald-300 hover:shadow-sm transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="h-7 w-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                    <UsersRound className="h-3.5 w-3.5" />
                  </div>
                  <span className="tracking-tight">Join as SHG</span>
                </Link>
              </div>
            </div>
          </form>

          {/* Footer Security Seal */}
          <div className="mt-6 flex items-center justify-center gap-2 text-slate-400 border-t border-slate-100 pt-4">
            <Fingerprint className="h-3.5 w-3.5 text-[#c8a45c]" />
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Government of India &bull; 256-Bit SSL Protected Gateway
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
