import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, unwrapApiData } from '../lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { isShgUser } from '../lib/shg';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui/card';
import { AlertTriangle, CheckCircle2, Clock, XCircle, FileText, ArrowRight, ShieldCheck, Bell, Info, ShoppingBag, MessageSquare, Gavel, Briefcase, Users, BarChart3, ClipboardCheck, FileSearch, Loader2, Images, Trophy, Package, Wrench, KeyRound, UserPlus, Truck, CreditCard, Store, PlusCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { validators } from '../lib/validators';
import RoleAwareActionCards from '../features/dashboard/components/RoleAwareActionCards';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bannerApi } from '../features/banners/api';
import { marketplaceApi } from '../features/marketplace/api';
import { resolveMarketplaceImage } from '../features/marketplace/utils/marketplaceImages';
import { AIInsightBox } from '../features/dashboard/components/AIInsightBox';
import { formatGstVerificationError } from '../features/shared/gstVerification';
import { LiveOpportunityRadar } from '../features/dashboard/components/LiveOpportunityRadar';
import { BiddingPerformanceChart } from '../features/dashboard/components/BiddingPerformanceChart';
import { UrgentActionsInbox } from '../features/dashboard/components/UrgentActionsInbox';
import { RecentOrdersSnapshot } from '../features/dashboard/components/RecentOrdersSnapshot';
import { BuyerProcurementMonitor } from '../features/dashboard/components/BuyerProcurementMonitor';
import { BuyerUrgentActionsInbox } from '../features/dashboard/components/BuyerUrgentActionsInbox';
import { BuyerSpendAndCompliance } from '../features/dashboard/components/BuyerSpendAndCompliance';

const ADMIN_REVIEW_CHECKLIST = [
  'Clear pending stakeholder approvals',
  'Check resubmissions with remarks',
  'Export MIS report for audit trail',
  'Verify approved seller capacity'
] as const;

type AdminTile = {
  label: string;
  value: number;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  tone: string;
};

type AdminModule = {
  title: string;
  detail: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
};

const formatBannerDate = (value?: string | null) => {
  if (!value) return 'No expiry set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No expiry set';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const readableBannerStatus = (value?: string | null) =>
  String(value || 'No upload yet').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());

const PromotionEligibilityCard = React.memo(function PromotionEligibilityCard({
  eligibility,
  isLoading
}: {
  eligibility: any;
  isLoading: boolean;
}) {
  if (isLoading || !eligibility?.eligible) return null;

  const latestEligibility = Array.isArray(eligibility.eligibility) ? eligibility.eligibility[0] : null;
  const latestBanner = Array.isArray(eligibility.banners) ? eligibility.banners[0] : null;
  const eligibilityType = readableBannerStatus(latestEligibility?.eligibilityType || 'Promotion');
  const expiry = formatBannerDate(latestEligibility?.expiresAt);
  const recentStatus = readableBannerStatus(latestBanner?.status);

  return (
    <Card className="overflow-hidden rounded-xl border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-blue-50 shadow-sm">
      <CardContent className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white shadow-sm">
              <Trophy className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-700">Banner Eligibility</p>
              <h3 className="text-sm font-bold text-slate-950">Homepage Promotion Unlocked</h3>
              <p className="mt-0.5 max-w-xl text-[11px] font-medium leading-relaxed text-slate-600">
                Your organization can submit one homepage promotional banner for admin approval.
              </p>
            </div>
          </div>
          <Link href="/my-org/banner-eligibility">
            <Button className="h-8 rounded-md bg-[#12335f] px-3 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-[#0b2445]">
              Upload Banner
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-white/70 bg-white/80 p-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Eligibility Type</p>
            <p className="mt-0.5 text-[11px] font-bold text-slate-900">{eligibilityType}</p>
          </div>
          <div className="rounded-md border border-white/70 bg-white/80 p-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Valid Until</p>
            <p className="mt-0.5 text-[11px] font-bold text-slate-900">{expiry}</p>
          </div>
          <div className="rounded-md border border-white/70 bg-white/80 p-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Recent Upload</p>
            <p className="mt-0.5 text-[11px] font-bold text-slate-900">{recentStatus}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

import { KpiCard } from '../features/shared/KpiCard';

const AdminKpiLink = React.memo(function AdminKpiLink({ stat, isLoading }: { stat: AdminTile; isLoading: boolean }) {
  const router = useRouter();
  return (
    <KpiCard
      key={stat.label}
      label={stat.label}
      value={stat.value ?? 0}
      subtext={stat.helper}
      icon={stat.icon}
      tone={stat.tone}
      loading={isLoading}
      onClick={() => router.push(stat.path)}
    />
  );
});

const AdminModuleLink = React.memo(function AdminModuleLink({ module }: { module: AdminModule }) {
  const Icon = module.icon;
  return (
    <Link
      href={module.path}
      className="rounded-xl bg-slate-50/80 p-3 ring-1 ring-slate-200/70 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_4px_12px_rgba(15,23,42,0.05)] hover:ring-[#12335f]/25 active:scale-[0.98] active:translate-y-px focus:outline-none focus:ring-2 focus:ring-[#12335f]"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#12335f] shadow-sm">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-900">{module.title}</h3>
          <p className="mt-0.5 text-[10px] font-medium leading-snug text-slate-500 line-clamp-2">{module.detail}</p>
          <span className="mt-1.5 inline-flex text-[9px] font-bold uppercase tracking-widest text-[#12335f]">Open Module</span>
        </div>
      </div>
    </Link>
  );
});

// const BuyerMarketplaceDiscovery = React.memo(function BuyerMarketplaceDiscovery({
//   data,
//   isLoading
// }: {
//   data: any;
//   isLoading: boolean;
// }) {
//   const sections = Array.isArray(data?.sections) ? data.sections.filter((section: any) => section.items?.length) : [];
//   const categories = Array.isArray(data?.categories) ? data.categories.slice(0, 8) : [];
//   const items = sections.flatMap((section: any) =>
//     (section.items || []).map((item: any) => ({
//       ...item,
//       sectionTitle: section.title,
//       itemType: item.itemType || (item.pricingModel || item.basePrice ? 'SERVICE' : 'PRODUCT')
//     }))
//   ).slice(0, 4);

//   return (
//     <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 transition-all">
//       <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between rounded-t-xl">
//         <div>
//           <h2 className="text-sm font-bold text-slate-900">Quick Supplier Discovery</h2>
//           <p className="text-[11px] font-medium text-slate-500">Shortcuts for products, services, and requirements.</p>
//         </div>
//         <div className="flex flex-wrap gap-2">
//           <Link href="/buyer/marketplace">
//             <Button variant="outline" className="h-8 rounded-md px-3 text-[10px] font-bold uppercase tracking-wide bg-white">
//               Browse Market
//               <ArrowRight className="ml-1.5 h-3 w-3" />
//             </Button>
//           </Link>
//         </div>
//       </div>

//       {categories.length > 0 && (
//         <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3 no-scrollbar">
//           {categories.map((category: any) => (
//             <Link
//               key={category.id || category.name}
//               href={category.id ? `/buyer/marketplace?categoryId=${category.id}` : `/buyer/marketplace?q=${encodeURIComponent(category.name)}`}
//               className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-700 transition hover:border-[#12335f]/40 hover:text-[#12335f]"
//             >
//               {category.name}
//             </Link>
//           ))}
//         </div>
//       )}

//       {isLoading && items.length === 0 ? (
//         <div className="grid gap-2 p-3 sm:grid-cols-2 md:grid-cols-4">
//           {[1, 2, 3, 4].map((item) => (
//             <div key={item} className="flex gap-2.5 rounded-lg bg-slate-50/60 p-2.5 ring-1 ring-slate-200/50 animate-pulse">
//               <div className="h-12 w-12 shrink-0 rounded-md bg-slate-200/60" />
//               <div className="flex-1 space-y-2 py-1">
//                 <div className="h-2 w-1/3 rounded bg-slate-200/60" />
//                 <div className="h-2.5 w-4/5 rounded bg-slate-200/60" />
//                 <div className="h-2 w-1/2 rounded bg-slate-200/60" />
//               </div>
//             </div>
//           ))}
//         </div>
//       ) : items.length > 0 ? (
//         <div className="grid gap-2 p-3 sm:grid-cols-2 md:grid-cols-4">
//           {items.map((item: any, idx: number) => {
//             const type = String(item.itemType || '').toUpperCase() === 'SERVICE' ? 'service' : 'product';
//             const imageUrl = resolveMarketplaceImage(item, type);
//             const href = item.detailUrl || `/marketplace/${type === 'service' ? 'services' : 'products'}/${item.id}`;
//             const price = Number(type === 'service' ? item.basePrice || item.price || item.discountPrice || 0 : item.price || item.discountPrice || 0);
//             return (
//               <Link key={`${type}-${item.id || 'item'}-${idx}`} href={href} className="group flex gap-2.5 rounded-lg bg-white p-2.5 ring-1 ring-slate-200/70 transition hover:shadow-md hover:ring-[#12335f]/20">
//                 <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-100 bg-slate-50">
//                   {imageUrl ? (
//                     <img src={imageUrl} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
//                   ) : type === 'service' ? (
//                     <Wrench className="h-5 w-5 text-[#12335f]/45" />
//                   ) : (
//                     <Package className="h-5 w-5 text-slate-300" />
//                   )}
//                 </div>
//                 <div className="min-w-0 flex-1 flex flex-col justify-center">
//                   <p className="text-[8px] font-bold uppercase tracking-wider text-[#12335f]/70">{type === 'service' ? 'Service' : 'Product'}</p>
//                   <h3 className="mt-0.5 truncate text-[11px] font-bold leading-tight text-slate-900 group-hover:text-[#12335f]">{item.name}</h3>
//                   <p className="mt-0.5 truncate text-[9px] font-medium text-slate-500">{item.sellerName || item.organization?.organizationName || 'Verified seller'}</p>
//                   <p className="mt-0.5 text-[10px] font-bold text-[#12335f]">{price > 0 ? `Rs. ${price.toLocaleString('en-IN')}` : 'Quote based'}</p>
//                 </div>
//               </Link>
//             );
//           })}
//         </div>
//       ) : null}
//     </section>
//   );
// });

export default function Dashboard() {
  const { user, token, logout, refreshUser, isLoggingOut } = useAuth();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const queryClient = useQueryClient();
  const router = useRouter();

  const [showPendingModal, setShowPendingModal] = useState(false);

  useEffect(() => {
    if (user && ['buyer', 'seller'].includes(user.role)) {
      const isPending = 
        user.onboardingStatus === 'pending' || 
        user.onboardingStatus === 'resubmission_required';
      if (isPending) {
        queueMicrotask(() => {
          setShowPendingModal(true);
        });
      }
    }
  }, [user]);

  const [gstInput, setGstInput] = useState('');
  const [isSubmittingGst, setIsSubmittingGst] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Profile Query
  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await api.fetch('/api/auth/me', { headers: authHeaders });
      if (!res.ok) {
        if (res.status === 401) {
          logout('/');
          router.replace('/');
        }
        throw new Error('Failed to fetch profile');
      }
      return res.json();
    },
    enabled: !!token,
    staleTime: 10 * 60_000,
    initialData: user ? { user, profile: user.sellerProfile || user.buyerProfile } : undefined,
  });
  const profile = profileData?.profile || null;

  // 2. Notifications Query
  const { data: notificationsData, isLoading: isNotifLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.fetch('/api/notifications', { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const json = await res.json();
      return unwrapApiData<any[]>(json) || [];
    },
    enabled: !!token,
    staleTime: 60_000,
    refetchInterval: 15000,
  });
  const notifications = notificationsData || [];

  // 3. Admin Stats Query (KPI Cards)
  const { data: adminStats, isLoading: isAdminStatsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: async () => {
      const res = await api.fetch('/api/admin/reports/summary?kpiOnly=true', { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to fetch stats');
      const json = await res.json();
      return json?.data ?? json;
    },
    enabled: !!token && user?.role === 'admin',
    staleTime: 5 * 60_000,
    refetchInterval: 15000,
  });

  const canCheckBannerEligibility = Boolean(
    token &&
    user?.organizationId &&
    ['buyer', 'seller', 'admin'].includes(String(user?.role || ''))
  );

  const { data: bannerEligibility, isLoading: isBannerEligibilityLoading } = useQuery({
    queryKey: ['dashboard-banner-eligibility', user?.organizationId],
    queryFn: bannerApi.eligibility,
    enabled: canCheckBannerEligibility,
    retry: false,
    staleTime: 60_000,
  });

  const { data: marketplaceRecommendations, isLoading: isMarketplaceRecommendationsLoading } = useQuery({
    queryKey: ['dashboard-marketplace-recommendations', user?.id],
    queryFn: marketplaceApi.getRecommendations,
    enabled: !!token && user?.role === 'buyer',
    retry: 1,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    placeholderData: (previousData) => previousData,
  });

  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await api.fetch('/api/dashboard/summary', { headers: authHeaders });
      if (!res.ok) throw new Error('Failed to fetch summary');
      const json = await res.json();
      return unwrapApiData<any>(json);
    },
    enabled: !!token && user?.role !== 'admin',
    staleTime: 5 * 60_000,
    refetchInterval: 15000,
  });

  const dashboardData = useMemo(() => {
    return {
      user: {
        name: user?.name,
        role: user?.role,
        organizationName: (user?.organization as any)?.organizationName,
        onboardingStatus: user?.onboardingStatus
      },
      metrics: user?.role === 'admin' ? (adminStats || {}) : (summaryData || {})
    };
  }, [user, adminStats, summaryData]);

  const isDashboardLoading = isProfileLoading || (user?.role === 'admin' ? isAdminStatsLoading : isSummaryLoading);

  const handleGstSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedGstin = gstInput.trim().toUpperCase();
    if (!validators.gstin(normalizedGstin)) {
      const message = 'Enter a valid GSTIN exactly as shown on your GST certificate. The format and checksum must both be correct.';
      setErrorMsg(message);
      toast.error(message);
      return;
    }
    setIsSubmittingGst(true);
    setErrorMsg("");
    try {
      const res = await api.fetch('/api/profile/verify-gst-dashboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ gstin: normalizedGstin })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(formatGstVerificationError(errorData));
      }
      toast.success("GSTIN verified and saved successfully!");
      await refreshUser({ skipCache: true });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong.");
      toast.error(err.message || "Verification failed.");
    } finally {
      setIsSubmittingGst(false);
    }
  }, [gstInput, token, refreshUser, queryClient]);

  useEffect(() => {
    if (!token) return;
    const refreshNotifications = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
    window.addEventListener('notifications:updated', refreshNotifications);
    return () => window.removeEventListener('notifications:updated', refreshNotifications);
  }, [token, queryClient]);

  useEffect(() => {
    if (!token && !user && !isLoggingOut) {
      router.replace('/login');
    }
  }, [token, user, isLoggingOut, router]);

  const isApprovedOrOnboarded = useMemo(() => {
    const status = user?.onboardingStatus || profileData?.user?.onboardingStatus;
    const role = user?.role || profileData?.user?.role;
    return (
      status === 'approved_for_procurement' ||
      status === 'approved' ||
      role === 'admin' ||
      role === 'master_admin'
    );
  }, [user, profileData]);

  const hasGst = useMemo(() => {
    const isValidGstString = (val?: any) => {
      if (!val || typeof val !== 'string') return false;
      const clean = val.trim().toUpperCase();
      return clean.length >= 10;
    };

    const regGstin = user?.registrationDetails?.gstin || user?.registrationDetails?.gst || (profileData?.user?.registrationDetails as any)?.gstin;
    const orgGstin = (user?.organization as any)?.gstin || (profileData?.user?.organization as any)?.gstin || (profile as any)?.organization?.gstin;
    const buyerGstin = user?.buyerProfile?.gst || profile?.buyerProfile?.gst || (profile as any)?.gst;
    const sellerGstin = user?.sellerProfile?.gst || profile?.sellerProfile?.gst;
    const userGstin = (user as any)?.gstin || (profile as any)?.gstin;

    const sellerOffices = user?.sellerProfile?.offices || profile?.sellerProfile?.offices || (profile as any)?.offices || [];
    const sellerHasOfficeGst = Array.isArray(sellerOffices) && sellerOffices.some((o: any) => isValidGstString(o?.gstNumber) || Boolean(o?.gstRegistered));

    return (
      isValidGstString(orgGstin) ||
      isValidGstString(regGstin) ||
      isValidGstString(buyerGstin) ||
      isValidGstString(sellerGstin) ||
      isValidGstString(userGstin) ||
      sellerHasOfficeGst
    );
  }, [profile, profileData, user]);

  const showFastTrackCard = !isApprovedOrOnboarded && !hasGst;

  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'approved_for_procurement': return <CheckCircle2 className="h-10 w-10 text-emerald-500" />;
      case 'rejected': return <XCircle className="h-10 w-10 text-red-500" />;
      case 'under_compliance_review': return <Clock className="h-10 w-10 text-amber-500" />;
      case 'resubmission_required': return <AlertTriangle className="h-10 w-10 text-amber-500" />;
      default: return <Clock className="h-10 w-10 text-blue-500" />;
    }
  }, []);

  const getStatusLabel = useCallback((status: string) => {
    return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }, []);

  const adminTiles = useMemo(() => [
    {
      label: 'Pending Approval',
      value: adminStats?.pendingApproval ?? 0,
      helper: 'Applications waiting for review',
      icon: FileSearch,
      path: '/admin/onboarding',
      tone: 'bg-amber-50 text-amber-700'
    },
    {
      label: 'Active Sellers',
      value: adminStats?.activeSellers ?? 0,
      helper: 'Approved suppliers in the network',
      icon: Users,
      path: '/admin/onboarding?tab=sellers',
      tone: 'bg-emerald-50 text-emerald-700'
    },
    {
      label: 'Active Buyers',
      value: adminStats?.activeBuyers ?? 0,
      helper: 'Buyer departments enabled',
      icon: ClipboardCheck,
      path: '/admin/onboarding?tab=buyers',
      tone: 'bg-slate-50 text-[#12335f]'
    },
    {
      label: 'Total Network',
      value: adminStats?.totalNetwork ?? 0,
      helper: 'Stakeholders registered',
      icon: BarChart3,
      path: '/admin/reports',
      tone: 'bg-slate-100 text-slate-700'
    },
    {
      label: 'Tender Queue',
      value: adminStats?.pendingTenders ?? adminStats?.tenders ?? 0,
      helper: 'Procurement tenders and bids',
      icon: Gavel,
      path: '/admin/bids',
      tone: 'bg-purple-50 text-purple-700'
    },
    {
      label: 'Purchase Orders',
      value: adminStats?.purchaseOrders ?? 0,
      helper: 'Procurement orders generated',
      icon: FileText,
      path: '/admin/reports',
      tone: 'bg-cyan-50 text-cyan-700'
    }
  ], [adminStats]);

  const adminModules = useMemo(() => [
    {
      title: 'Stakeholder Approvals',
      detail: 'Review seller and buyer onboarding, compliance exceptions, review queues, and approved stakeholder capacity.',
      path: '/admin/onboarding',
      icon: ClipboardCheck
    },
    {
      title: 'Onboarding Console',
      detail: 'Approve, reject, request section changes, and send administrator feedback.',
      path: '/admin/onboarding',
      icon: FileSearch
    },
    {
      title: 'Roles & Invite Permissions',
      detail: 'Create role policies, assign permission scopes, and use invite-based team access for organizations.',
      path: '/admin/rbac',
      icon: KeyRound
    },
    {
      title: 'MIS Reports',
      detail: 'Export filtered records and review overall stakeholder network health.',
      path: '/admin/reports',
      icon: BarChart3
    },
    {
      title: 'Monthly Rankings',
      detail: 'Compute buyer and seller ranking lists that unlock homepage promotion eligibility.',
      path: '/admin/monthly-rankings',
      icon: Trophy
    },
    {
      title: 'Banner Management',
      detail: 'Create, approve, hide, and review homepage banners submitted by eligible organizations.',
      path: '/admin/banners',
      icon: Images
    },
    {
      title: 'Marketplace Sections',
      detail: 'Control homepage discovery order, section visibility, and section item limits.',
      path: '/admin/marketplace/home-sections',
      icon: ShoppingBag
    },
    {
      title: 'Reverse Auction Monitoring',
      detail: 'Track live auctions, monitor L1 rankings, review results, and open award recommendations.',
      path: '/seller/opportunities/auctions',
      icon: Gavel
    }
  ], []);

  const sectionMessages = useMemo(() => Object.entries(user?.sectionRejectionReasons || {}).filter(([section, reason]) => {
    const status = user?.sectionStatus?.[section as keyof typeof user.sectionStatus];
    return reason && ['rejected', 'resubmission_required'].includes(status || '');
  }), [user?.sectionRejectionReasons, user?.sectionStatus]);

  if (user?.role === 'admin') {
    return (
      <div className="space-y-3 animate-in fade-in duration-500">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#12335f] tracking-tight">Admin Control Center</h1>
            <p className="text-[11px] font-medium text-slate-500">Manage approvals, compliance, and MIS reporting.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/onboarding">
              <Button className="bg-[#12335f] hover:bg-[#0b2445] text-white h-8 px-3 rounded text-[10px] font-bold uppercase tracking-wide">
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                Review Submissions
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {adminTiles.map(stat => <AdminKpiLink key={stat.label} stat={stat} isLoading={isAdminStatsLoading} />)}
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
          <AdminActionPanel
            title="Review Command Center"
            description="Fast path for stakeholder approval, tender approval, and final award checks."
            actions={[
              ['Stakeholder approvals', '/admin/onboarding', ShieldCheck],
              ['Tender approvals', '/admin/bids', Gavel],
              ['Final award approvals', '/admin/procurement-orders', Trophy],
            ]}
          />
          <AdminActionPanel
            title="Operations Monitoring"
            description="Track marketplace, orders, delivery, payments, and compliance signals from one row."
            actions={[
              ['Catalogue review', '/admin/marketplace', Store],
              ['Orders & delivery', '/admin/delivery', Truck],
              ['Payments & escrow', '/payments/transactions', CreditCard],
            ]}
          />
          <AdminActionPanel
            title="Access & Reports"
            description="Manage invite-based roles and audit-ready management reports."
            actions={[
              ['Roles & permissions', '/admin/rbac', KeyRound],
              ['Invite team access', '/org/team', UserPlus],
              ['MIS reports', '/admin/reports', BarChart3],
            ]}
          />
        </div>

        {/* <AIInsightBox dashboardData={dashboardData} /> */}

        <div className="grid gap-3 xl:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70">
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-900">Admin Work Areas</h2>
            </div>
            <div className="grid gap-2 p-3 md:grid-cols-2">
              {adminModules.map(module => <AdminModuleLink key={module.title} module={module} />)}
            </div>
          </section>

          <aside className="rounded-xl bg-[#12335f] p-4 text-white shadow-md">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <h2 className="text-[11px] font-bold uppercase tracking-wide">Daily review checklist</h2>
            </div>
            <div className="mt-4 space-y-3">
              {ADMIN_REVIEW_CHECKLIST.map(item => (
                <div key={item} className="flex items-start gap-2 text-xs font-semibold text-blue-50">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <Link href="/admin/onboarding" className="mt-5 inline-flex text-xs font-black uppercase tracking-wide text-white underline">
              Open stakeholder approvals
            </Link>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1560px] space-y-3 pb-6 animate-in fade-in duration-500">
      {/* ── Transparent Header ── */}
      {/* <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-950">Dashboard</h1>
            <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300" />
            <p className="hidden sm:block text-[10px] font-bold uppercase tracking-wider text-[#12335f]">MSME Procurement Portal</p>
          </div>
          <p className="mt-0.5 text-xs font-medium text-slate-500">Welcome back, {user?.name}. Manage your activities and verification status.</p>
        </div>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-white p-1.5 text-left shadow-sm ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-[#12335f]/30 focus:outline-none focus:ring-2 focus:ring-[#12335f] max-w-[200px]"
        >
          <div className="h-7 w-7 rounded-md bg-[#12335f] flex items-center justify-center text-white font-bold text-xs shrink-0">
            {user?.name?.charAt(0)}
          </div>
          <div className="pr-1 overflow-hidden">
            <p className="text-[10px] font-bold text-slate-900 uppercase truncate">{user?.name}</p>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wide truncate">{user?.role} Account</p>
          </div>
        </button>
      </div> */}

      {user?.role === 'buyer' && (
        <section className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 border-l-4 border-l-[#12335f]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Create Procurement</h2>
                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200 px-1.5 py-0 text-[8px] uppercase tracking-wider rounded">Primary</Badge>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                Start once, choose business intent, and continue to marketplace, requests, or large procurement.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href="/buyer/procurement/create">
                <Button className="h-8 rounded bg-[#12335f] px-3 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-[#0b2445] shadow-sm transition">
                  Create New
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </Link>
              <Link href="/buyer/procurement/responses">
                <Button variant="ghost" className="h-8 rounded px-3 text-[10px] font-bold uppercase tracking-wide text-[#12335f] bg-slate-50 hover:bg-slate-100 transition ring-1 ring-slate-200/70">
                  Manage Bids
                </Button>
              </Link>
              <Link href="/orders">
                <Button variant="ghost" className="h-8 rounded px-3 text-[10px] font-bold uppercase tracking-wide text-[#12335f] bg-slate-50 hover:bg-slate-100 transition ring-1 ring-slate-200/70">
                  View Orders
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {(user?.role === 'seller' || isShgUser(user) || user?.role === 'shg') && (
        <section className="rounded-xl bg-gradient-to-r from-[#12335f] to-indigo-900 p-4 text-white shadow-sm ring-1 ring-slate-200/70 relative overflow-hidden">
          <div className="pointer-events-none absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-white/10 to-transparent" />
          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">{isShgUser(user) || user?.role === 'shg' ? 'SHG Control Desk' : 'Seller Control Desk'}</h2>
                <Badge className="bg-white/10 text-emerald-300 hover:bg-white/10 border-white/20 px-1.5 py-0 text-[8px] uppercase tracking-wider rounded">Primary</Badge>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-blue-100/80">
                Publish catalogue items, monitor visibility, and respond to procurement bids.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href={isShgUser(user) || user?.role === 'shg' ? '/shg/products' : '/seller/catalogue'}>
                <Button className="h-8 rounded bg-white px-3 text-[10px] font-bold uppercase tracking-wide text-[#12335f] hover:bg-slate-50 shadow-sm transition">
                  My Catalogue
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {(user?.role as string) !== 'admin' && <RoleAwareActionCards />}

      <div className="space-y-4">
        {/* Only show the GST onboarding card if user is not yet approved/onboarded and has no GST */}
        {showFastTrackCard && (
          <Card className="relative overflow-hidden rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-sm">
            <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-white/5 to-transparent pointer-events-none" />
            <CardContent className="p-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[8px] font-bold uppercase tracking-wide border border-indigo-400/20">
                      <Briefcase className="h-2.5 w-2.5" /> Fast-Track
                    </span>
                    <h3 className="text-sm font-bold tracking-tight text-white">
                      Verify Business GSTIN
                    </h3>
                  </div>
                  <p className="text-[11px] font-medium text-slate-400 mt-1 max-w-xl">
                    Instantly verify details to auto-approve sections and fast-track onboarding.
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[9px] font-medium text-emerald-400/80">
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Auto-approve Offices</span>
                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Direct Procurement Live</span>
                  </div>
                </div>

                <form onSubmit={handleGstSubmit} className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto shrink-0">
                  <input
                    type="text"
                    placeholder="Enter 15-digit GSTIN"
                    value={gstInput}
                    onChange={(e) => {
                      setGstInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                      if (errorMsg) setErrorMsg('');
                    }}
                    maxLength={15}
                    className="w-full sm:w-56 h-8 px-2.5 bg-white/10 border border-white/20 rounded text-[11px] font-semibold text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-white uppercase tracking-wider"
                    disabled={isSubmittingGst}
                  />
                  <Button
                    type="submit"
                    disabled={isSubmittingGst || !validators.gstin(gstInput)}
                    className="h-8 bg-white hover:bg-slate-100 text-slate-900 rounded px-4 text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm"
                  >
                    {isSubmittingGst && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
                    {isSubmittingGst ? 'Submitting...' : 'Verify & Save'}
                  </Button>
                </form>
              </div>
              {errorMsg && (
                <p className="mt-2 text-[10px] font-medium text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 max-w-xl">
                  {errorMsg}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* <AIInsightBox dashboardData={dashboardData} /> */}

        <PromotionEligibilityCard eligibility={bannerEligibility} isLoading={isBannerEligibilityLoading} />

        {/* ── Main Role-Aware Workspace ── */}
        {user?.role === 'buyer' ? (
          /* ── Buyer Procurement Command Center ── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
            {/* Left Column (65% on large screens) */}
            <div className="lg:col-span-8 space-y-3.5">
              <BuyerProcurementMonitor />
              <RecentOrdersSnapshot />
             
            </div>

            {/* Right Column (35% on large screens) */}
            <div className="lg:col-span-4 space-y-3.5">
              <BuyerUrgentActionsInbox />
              
              <BuyerSpendAndCompliance 
                stats={{
                  totalSpend: Number(summaryData?.buyerProcurementTotalSpentValue || 0)
                }}
              />

              {/* Compact Verification & Support Cards */}
              <div className="space-y-3">
                <Card className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70">
                  <div className="bg-slate-50/50 px-3 py-2 border-b border-slate-100 flex items-center justify-between rounded-t-xl">
                    <h3 className="text-[11px] font-bold uppercase text-slate-900 tracking-wide flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-[#12335f]" />
                      Verification Status
                    </h3>
                  </div>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full bg-slate-50">
                        <div className="scale-75">
                          {getStatusIcon(user?.onboardingStatus || 'pending')}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-wide truncate">
                          {getStatusLabel(user?.onboardingStatus || 'pending')}
                        </h4>
                        <p className="text-slate-500 font-medium text-[9px] mt-0.5 truncate">
                          {user?.onboardingStatus === 'approved_for_procurement'
                            ? "Profile verified for procurement."
                            : "Under compliance review."}
                        </p>
                      </div>
                      <Button
                        onClick={() => router.push('/buyer/onboarding')}
                        className="bg-slate-50 hover:bg-slate-100 text-[#12335f] ring-1 ring-slate-200/70 rounded h-7 px-2.5 font-bold uppercase text-[9px] tracking-wide shrink-0 transition"
                      >
                        {user?.onboardingStatus === 'approved_for_procurement' ? 'View Profile' : 'Complete'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                
              </div>
              
            </div>
          </div>
        ) : (
          /* ── Seller & SHG Growth & Bidding Workspace ── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
            {/* Left Column (65% on large screens) */}
            <div className="lg:col-span-8 space-y-3.5">
              <LiveOpportunityRadar />
              <RecentOrdersSnapshot />
            </div>

            {/* Right Column (35% on large screens) */}
            <div className="lg:col-span-4 space-y-3.5">
              <UrgentActionsInbox />
              
              <BiddingPerformanceChart 
                stats={{
                  submitted: Number(summaryData?.sellerSubmittedBidsCount || summaryData?.sellerQuotationsCount || 0),
                  won: Number(summaryData?.sellerActivePOsCount || 0),
                  underEval: Number(summaryData?.sellerOpportunitiesCount || 0),
                  pipelineValue: 0,
                  onTimeDeliveryRate: 100
                }}
              />

              {/* Compact Verification & Support Cards */}
              <div className="space-y-3">
                <Card className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70">
                  <div className="bg-slate-50/50 px-3 py-2 border-b border-slate-100 flex items-center justify-between rounded-t-xl">
                    <h3 className="text-[11px] font-bold uppercase text-slate-900 tracking-wide flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-[#12335f]" />
                      Verification Status
                    </h3>
                  </div>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-full bg-slate-50">
                        <div className="scale-75">
                          {getStatusIcon(user?.onboardingStatus || 'pending')}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[10px] font-bold text-slate-900 uppercase tracking-wide truncate">
                          {getStatusLabel(user?.onboardingStatus || 'pending')}
                        </h4>
                        <p className="text-slate-500 font-medium text-[9px] mt-0.5 truncate">
                          {user?.onboardingStatus === 'approved_for_procurement'
                            ? "Profile verified for procurement."
                            : "Under compliance review."}
                        </p>
                      </div>
                      <Button
                        onClick={() => router.push(user?.role === 'seller' ? '/seller/onboarding' : '/buyer/onboarding')}
                        className="bg-slate-50 hover:bg-slate-100 text-[#12335f] ring-1 ring-slate-200/70 rounded h-7 px-2.5 font-bold uppercase text-[9px] tracking-wide shrink-0 transition"
                      >
                        {user?.onboardingStatus === 'approved_for_procurement' ? 'View Profile' : 'Complete'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70">
                  <div className="flex items-start gap-2.5">
                    <div className="h-7 w-7 shrink-0 rounded-full bg-blue-50 text-[#12335f] flex items-center justify-center">
                      <Info className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-slate-900 uppercase text-[10px] tracking-wide">Need Help?</h5>
                      <p className="text-[9px] font-medium text-slate-500 mt-0.5 leading-snug">Support team is available for onboarding assistance.</p>
                      <button
                        type="button"
                        onClick={() => toast.info('Support request noted. Email support@msme-portal.gov.in.')}
                        className="mt-1 text-[#12335f] font-bold uppercase text-[9px] hover:underline"
                      >
                        Contact Support →
                      </button>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {showPendingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 flex flex-col items-center text-center space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 border border-amber-200">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-slate-900 uppercase tracking-tight">
                Organization Verification Pending
              </h3>
              <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                {user?.organization?.organizationName ? (
                  <>
                    Your organization <span className="font-bold text-slate-700">"{user.organization.organizationName}"</span> is currently pending approval.
                  </>
                ) : (
                  <>Your profile onboarding is currently pending.</>
                )}{" "}
                Please complete your onboarding application to submit all sections for admin compliance review.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
              <Button
                onClick={() => {
                  setShowPendingModal(false);
                  router.push(user?.role === 'seller' ? '/seller/onboarding' : '/buyer/onboarding');
                }}
                className="w-full bg-[#12335f] hover:bg-[#0b2445] text-white rounded h-10 px-4 font-bold uppercase text-[11px] tracking-wide transition-all"
              >
                Verify Organization Now
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPendingModal(false)}
                className="w-full border-slate-200 hover:bg-slate-50 rounded h-10 px-4 font-bold uppercase text-[11px] tracking-wide text-slate-750 transition-all"
              >
                Remind Me Later
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminActionPanel({ title, description, actions }: {
  title: string;
  description: string;
  actions: Array<[string, string, React.ComponentType<{ className?: string }>]>;
}) {
  return (
    <section className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70">
      <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-900">{title}</h2>
      <p className="mt-0.5 text-[10px] font-medium leading-relaxed text-slate-500 line-clamp-2">{description}</p>
      <div className="mt-3 space-y-1.5">
        {actions.map(([label, href, Icon]) => (
          <Link key={href} href={href} className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[#12335f] transition hover:bg-slate-100 border border-slate-100">
            <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</span>
            <ArrowRight className="h-3 w-3 opacity-70" />
          </Link>
        ))}
      </div>
    </section>
  );
}
