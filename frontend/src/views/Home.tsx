import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Building2, Store, ArrowRight, ShieldCheck, CheckCircle2, LayoutDashboard, MapPin, FileText, Gavel, Clock, IndianRupee, Eye } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { api, resolveMediaUrl } from '../lib/api';
import { cn } from '../lib/utils';
import { formatCurrency, formatDate } from '../features/shared/format';
import { Card, CardContent } from '../components/ui/card';

const METHOD_COLORS: Record<string, string> = {
  RFQ: 'border-orange-200 bg-orange-50 text-orange-700',
  RFP: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  OPEN_TENDER: 'border-amber-200 bg-amber-50 text-amber-800',
  LIMITED_TENDER: 'border-sky-200 bg-sky-50 text-sky-700',
  REVERSE_AUCTION: 'border-rose-200 bg-rose-50 text-rose-700',
  RATE_CONTRACT: 'border-teal-200 bg-teal-50 text-teal-700',
  REPEAT_ORDER: 'border-lime-200 bg-lime-50 text-lime-700',
};

const METHOD_LABELS: Record<string, string> = {
  RFQ: 'RFQ',
  RFP: 'RFP',
  OPEN_TENDER: 'Open Tender',
  LIMITED_TENDER: 'Limited Tender',
  REVERSE_AUCTION: 'Reverse Auction',
  RATE_CONTRACT: 'Rate Contract',
  REPEAT_ORDER: 'Repeat Order',
};

type ProcurementOpportunity = {
  id: number;
  source: 'bid' | 'rfq';
  title: string;
  method: string;
  buyerName: string;
  buyerOrganization: string | null;
  estimatedValue: number | null;
  currency: string;
  deadlineDate: string | null;
  category: string | null;
  location: string | null;
  createdAt: string;
};

const opportunityHref = (opp: ProcurementOpportunity) => {
  if (opp.source === 'rfq') return `/seller/rfq?requestId=${opp.id}`;
  const method = (opp.method || '').toUpperCase();
  if (method === 'REVERSE_AUCTION') return `/bids/${opp.id}`;
  if (method === 'RFP') return `/seller/rfp?requestId=${opp.id}`;
  if (method === 'RFQ') return `/seller/rfq?requestId=${opp.id}`;
  return `/bids/${opp.id}`;
};

export default function Home() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<ProcurementOpportunity[]>([]);
  const [oppLoading, setOppLoading] = useState(true);
  const [oppError, setOppError] = useState(false);

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const res = await api.fetch('/api/buyer-showcase/public/organizations');
        if (res.ok) {
          const body = await res.json();
          setOrganizations(body.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch verified buyer organizations', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrgs();
  }, []);

  useEffect(() => {
    const fetchOpportunities = async () => {
      setOppLoading(true);
      setOppError(false);
      try {
        const res = await api.fetch('/api/public/procurement-opportunities');
        if (res.ok) {
          const body = await res.json();
          setOpportunities(body.data?.opportunities || body.opportunities || []);
        }
      } catch {
        setOppError(true);
      } finally {
        setOppLoading(false);
      }
    };
    fetchOpportunities();
  }, []);

  return (
    <div className="relative min-h-dvh w-full bg-[#f8fafc] text-[#1f2937] flex flex-col justify-between overflow-hidden">
      {/* 3-Color Flag Accent Strip at the very top */}
      <div className="brand-tricolor-strip w-full absolute top-0 left-0 z-50 h-1.5 bg-gradient-to-r from-orange-500 via-white to-green-600" />

      {/* Dynamic Animated Glow Orbs & Light Beams in Background */}
      <div className="absolute top-[-10%] left-[-15%] h-[55%] w-[55%] rounded-full bg-gradient-to-br from-blue-200/40 via-sky-100/30 to-transparent blur-[140px] animate-pulse-glow pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-15%] h-[55%] w-[55%] rounded-full bg-gradient-to-tl from-amber-200/40 via-amber-100/30 to-transparent blur-[140px] animate-pulse-glow pointer-events-none" style={{ animationDelay: '2s' }} />

      {/* Floating 3D Geometric Accents */}
      <div className="absolute top-24 right-[12%] w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400/20 to-amber-200/40 border border-amber-300/40 backdrop-blur-md animate-float-3d pointer-events-none hidden lg:block shadow-lg" />
      <div className="absolute bottom-32 left-[8%] w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/10 to-indigo-500/20 border border-blue-300/30 backdrop-blur-md animate-float-reverse-3d pointer-events-none hidden lg:block shadow-lg" />

      {/* Hero Section Container */}
      <div className="relative w-full max-w-[1600px] mx-auto flex-grow flex flex-col justify-center px-4 py-10 sm:px-6 md:px-10 lg:px-16 xl:px-20 lg:py-16 xl:py-20 z-10">
        <div className="grid lg:grid-cols-12 gap-8 md:gap-10 lg:gap-14 xl:gap-20 items-center">

          {/* Left Column: Hero Text */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6 lg:space-y-8 text-left">
            {/* Logo + Portal Badge */}
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="relative group">
                <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-tr from-amber-500/30 via-blue-500/20 to-emerald-500/30 blur-md animate-pulse" />
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-2xl bg-white flex items-center justify-center overflow-hidden shrink-0 p-1.5 sm:p-2 shadow-xl border border-white/80 transition-transform duration-500 hover:scale-105">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-shimmer" />
                  <img src="/logoo.png" alt="SMiLE - Synergy for MSME and Industry Linkage Ecosystem" className="w-full h-full object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.12)]" />
                </div>
              </div>
              <div>
                <p className="text-[10px] sm:text-xs md:text-sm font-black text-[#c8a45c] uppercase tracking-[0.2em] flex items-center gap-1.5">
                  <span>Government of India</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                </p>
                <p className="text-xs sm:text-sm md:text-base font-bold text-slate-500 leading-tight">MSME Procurement Portal</p>
              </div>
            </div>

            <h1 className="text-[clamp(1.75rem,5vw,3.75rem)] font-black leading-[1.08] tracking-tight text-[#0b2447] text-wrap-balance">
              Streamline Your <br className="hidden sm:inline" />
              Procurement Onboarding with <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#c8a45c] via-amber-600 to-amber-800">JsgSmile</span>
            </h1>

            <p className="max-w-2xl text-[clamp(0.8rem,1.5vw,1.15rem)] leading-relaxed text-slate-600 font-medium">
              The unified government-linked gateway for verified buyers and sellers to seamlessly connect, register, and coordinate procurement workflows with unmatched speed, transparency, and simplicity.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-1">
              {!user ? (
                <>
                  <Link href="/seller/register" className="flex-1 sm:flex-none">
                    <Button className="h-12 sm:h-14 w-full gap-3 px-6 sm:px-8 rounded-2xl bg-gradient-to-r from-[#0b2447] via-[#12335f] to-[#0b2447] hover:from-[#12335f] hover:to-[#0b2447] text-white font-extrabold uppercase tracking-wider transition-all hover:translate-y-[-3px] active:scale-[0.98] shadow-xl shadow-blue-900/20 text-xs sm:text-sm relative overflow-hidden group">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      <Store className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300" />
                      <span>Join as Seller</span>
                    </Button>
                  </Link>
                  <Link href="/buyer/register" className="flex-1 sm:flex-none">
                    <Button className="h-12 sm:h-14 w-full gap-3 px-6 sm:px-8 rounded-2xl border-2 border-[#0b2447] hover:border-[#12335f] bg-white/80 hover:bg-white text-[#0b2447] font-extrabold uppercase tracking-wider transition-all hover:translate-y-[-3px] active:scale-[0.98] shadow-md text-xs sm:text-sm backdrop-blur-md">
                      <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-[#0b2447]" />
                      <span>Join as Buyer</span>
                    </Button>
                  </Link>
                </>
              ) : (
                <Link href="/dashboard">
                  <Button className="h-12 sm:h-14 gap-3 px-6 sm:px-8 rounded-2xl bg-gradient-to-r from-[#0b2447] to-[#12335f] hover:from-[#12335f] hover:to-[#0b2447] text-white font-extrabold uppercase tracking-wider transition-all hover:translate-y-[-3px] active:scale-[0.98] shadow-xl shadow-blue-900/20 text-xs sm:text-sm">
                    <LayoutDashboard className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300" />
                    <span>Access Your Dashboard</span>
                  </Button>
                </Link>
              )}
            </div>

            {!user && (
              <div className="pt-1">
                <p className="text-slate-500 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  Already have an account? {' '}
                  <Link href="/login" className="text-[#c8a45c] font-black hover:text-amber-700 transition-colors underline decoration-[#c8a45c] underline-offset-4 decoration-2">
                    Access Portal Here
                  </Link>
                </p>
              </div>
            )}
          </div>

          {/* Right Column: 3D Interactive Feature Cards Showcase */}
          <div className="lg:col-span-5 perspective-1000 transform-style-3d">
            <div className="grid gap-4 sm:gap-5 lg:gap-6">

              {/* 3D Card 1 */}
              <div className="hover-3d-card group relative flex gap-4 sm:gap-5 rounded-3xl border border-white/80 bg-white/70 hover:bg-white/95 p-5 sm:p-6 lg:p-7 shadow-[0_12px_35px_rgba(11,36,71,0.06)] backdrop-blur-xl transition-all duration-300">
                <div className="absolute top-4 right-4 text-xs font-black text-slate-300/40 select-none font-mono">01</div>
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-amber-50 to-amber-100/80 rounded-2xl flex items-center justify-center border border-amber-200/60 group-hover:scale-110 transition-transform duration-300 shrink-0 shadow-sm">
                  <ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7 text-amber-600" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0b2447] tracking-tight group-hover:text-amber-700 transition-colors">
                    Secure Verification
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed font-semibold">
                    Enterprise-grade document verification and state-of-the-art KYB checks for all participants.
                  </p>
                </div>
              </div>

              {/* 3D Card 2 */}
              <div className="hover-3d-card group relative flex gap-4 sm:gap-5 rounded-3xl border border-white/80 bg-white/70 hover:bg-white/95 p-5 sm:p-6 lg:p-7 shadow-[0_12px_35px_rgba(11,36,71,0.06)] backdrop-blur-xl transition-all duration-300">
                <div className="absolute top-4 right-4 text-xs font-black text-slate-300/40 select-none font-mono">02</div>
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-emerald-50 to-emerald-100/80 rounded-2xl flex items-center justify-center border border-emerald-200/60 group-hover:scale-110 transition-transform duration-300 shrink-0 shadow-sm">
                  <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-600" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0b2447] tracking-tight group-hover:text-emerald-700 transition-colors">
                    Fast Turnaround
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed font-semibold">
                    Dedicated official workflows ensure processing and review completed securely within 48 hours.
                  </p>
                </div>
              </div>

              {/* 3D Card 3 */}
              <div className="hover-3d-card group relative flex gap-4 sm:gap-5 rounded-3xl border border-white/80 bg-white/70 hover:bg-white/95 p-5 sm:p-6 lg:p-7 shadow-[0_12px_35px_rgba(11,36,71,0.06)] backdrop-blur-xl transition-all duration-300">
                <div className="absolute top-4 right-4 text-xs font-black text-slate-300/40 select-none font-mono">03</div>
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-blue-50 to-indigo-100/80 rounded-2xl flex items-center justify-center border border-blue-200/60 group-hover:scale-110 transition-transform duration-300 shrink-0 shadow-sm">
                  <ArrowRight className="h-6 w-6 sm:h-7 sm:w-7 text-[#0b2447]" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0b2447] tracking-tight group-hover:text-blue-700 transition-colors">
                    Direct Integration
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed font-semibold">
                    Instantly connect directly to unified industry ERP and catalog modules after authorization.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Active Procurement Opportunities */}
      {!oppLoading && !oppError && opportunities.length > 0 && (
        <div className="relative w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-10 lg:px-16 xl:px-20 py-12 z-10 border-t border-slate-200/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <p className="text-[10px] sm:text-xs font-black text-[#c8a45c] uppercase tracking-[0.2em]">Active Opportunities</p>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[#0b2447] tracking-tight uppercase mt-1">
                Procurement Opportunities
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Browse active public procurement opportunities from verified buyers.
              </p>
            </div>
            <Link href={user ? (user.role === 'seller' ? '/seller/opportunities' : '/marketplace/requirements') : '/marketplace/requirements'}>
              <Button variant="outline" size="sm" className="h-10 rounded-full border-slate-300 text-[10px] font-black uppercase tracking-wider hover:bg-slate-100 transition-all">
                View All <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 perspective-1000">
            {opportunities.slice(0, 9).map(opp => {
              const methodKey = (opp.method || '').toUpperCase();
              const colorClass = METHOD_COLORS[methodKey] || 'border-slate-200 bg-slate-50 text-slate-700';
              const label = METHOD_LABELS[methodKey] || methodKey;
              const href = opportunityHref(opp);
              return (
                <Link key={`${opp.source}-${opp.id}`} href={href} className="block">
                  <Card className="hover-3d-card group rounded-2xl border-0 bg-white/80 backdrop-blur-md shadow-sm ring-1 ring-slate-200/70 transition-all duration-300 overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex flex-wrap gap-1.5">
                          <span className={cn('px-2.5 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-wider shadow-2xs', colorClass)}>
                            {label}
                          </span>
                        </div>
                        {opp.estimatedValue && (
                          <span className="shrink-0 text-xs font-black text-slate-900 tabular-nums">
                            {formatCurrency(opp.estimatedValue)}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug mb-2 group-hover:text-[#0b2447] transition-colors">
                        {opp.title}
                      </h3>
                      <div className="space-y-1 text-[10px] font-semibold text-slate-500">
                        <p className="flex items-center gap-1.5">
                          <Building2 className="h-3 w-3 shrink-0 text-slate-400" />
                          {opp.buyerOrganization || opp.buyerName}
                        </p>
                        {opp.deadlineDate && (
                          <p className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 shrink-0 text-amber-500" />
                            Closes {formatDate(opp.deadlineDate)}
                          </p>
                        )}
                        {opp.location && (
                          <p className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                            {opp.location}
                          </p>
                        )}
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-[#12335f] transition-colors">
                          View Details
                        </span>
                        <Eye className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#12335f] transition-colors" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Verified Buyer Requirements Showcase Strip */}
      {organizations.length > 0 && (
        <div className="relative w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-10 lg:px-16 xl:px-20 py-12 z-10 border-t border-slate-200/50">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <p className="text-[10px] sm:text-xs font-black text-[#c8a45c] uppercase tracking-[0.2em]">Verified Industry Partners</p>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[#0b2447] tracking-tight uppercase mt-1">
                Buyer Requirements Showcase
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-1">
                Explore frequently bought items and requirements posted by verified buyer organizations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 perspective-1000">
            {organizations.map((org) => (
              <Link key={org.id} href={`/buyer-requirements/${org.id}`}>
                <div className="hover-3d-card group relative flex flex-col justify-between h-full rounded-3xl border border-white bg-white/70 hover:bg-white/95 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.03)] backdrop-blur-md transition-all duration-300 cursor-pointer">
                  <div>
                    {/* Banner preview or top accent */}
                    <div className="h-20 w-full rounded-2xl overflow-hidden bg-slate-100 mb-4 relative border border-slate-200/60">
                      {org.bannerUrl ? (
                        <img src={resolveMediaUrl(org.bannerUrl) || ''} alt="Banner" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-r from-slate-100 via-slate-200/70 to-slate-100 flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-slate-350" />
                        </div>
                      )}
                      {/* Logo badge overlapping banner */}
                      <div className="absolute bottom-2 left-2 w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-md">
                        {org.logoUrl ? (
                          <img src={resolveMediaUrl(org.logoUrl) || ''} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                          <Building2 className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 mt-2">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-black text-[#0b2447] tracking-tight truncate group-hover:text-amber-700 transition-colors uppercase">
                          {org.organizationName}
                        </h3>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      </div>
                      
                      {org.departmentName && (
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">
                          {org.departmentName}
                        </p>
                      )}

                      <p className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {org.city || 'Odisha'}, {org.state || 'IN'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100/50 mt-4 flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-wider group-hover:text-[#0b2447] transition-colors">
                    <span>View Requirements</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Premium Footer */}
      <footer className="w-full bg-white/50 backdrop-blur-sm border-t border-slate-200/50 py-5 sm:py-6 px-4 sm:px-6 z-10">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center sm:text-left">
            &copy; {new Date().getFullYear()} Jharsuguda Synergy for MSME and Industry Linkage Ecosystem. All Rights Reserved.
          </p>
          <Link href="/admin/register" className="group flex items-center gap-1.5 rounded-xl px-3 py-1.5 border border-slate-200 hover:border-slate-300 bg-white/50 hover:bg-white text-[10px] font-black text-slate-500 hover:text-[#0b2447] transition-all uppercase tracking-widest shadow-sm">
            <span>Admin Control Center</span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
