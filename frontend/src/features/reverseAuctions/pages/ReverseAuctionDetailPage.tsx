import { FormEvent, useEffect, useState, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Gavel,
  Pause,
  Play,
  RefreshCw,
  Send,
  Square,
  UserPlus,
  Loader2,
  X,
  Building2,
  Tag,
  Activity,
  FileText,
  Users,
  Award,
  ShieldAlert,
  Scale,
  Clock,
  Settings,
  HelpCircle,
  ChevronRight,
  ArrowLeft,
  Hourglass,
  Laptop,
  Eye,
  TrendingDown,
  IndianRupee,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  Package,
  MessageSquare,
  Layers,
  ExternalLink,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { DocumentPreviewModal } from '../../../components/DocumentPreviewModal';
import { getFileAssetPreview, getDocumentPreviewMode, type DocumentPreview } from '../../../lib/files';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../shared/format';
import { reverseAuctionApi } from '../api';
import AuctionClarificationPanel from '../components/AuctionClarificationPanel';
import { procurementBidApi } from '../../procurementBid/api';
import { marketplaceApi, type MarketplaceSeller } from '../../marketplace/api';
import { useAuth } from '../../../hooks/useAuth';
import { cn } from '../../../lib/utils';
import { formatRefId } from '../../../utils/refIdUtils';
import { KpiCard } from '../../shared/KpiCard';

function formatEnumLabel(val?: string | null): string {
  if (!val) return 'N/A';
  const str = String(val).trim();
  if (str === 'ENGLISH_REVERSE') return 'English Reverse Auction';
  if (str === 'ONLINE') return 'Online E-Auction';
  if (str === 'SHOW_RANK_ONLY') return 'Show Rank Only';
  if (str === 'SHOW_LOWEST_PRICE') return 'Show Lowest Price';
  if (str === 'SHOW_PRICE_AND_RANK') return 'Show Price & Rank';
  if (str === 'TECHNICAL_QUALIFICATION') return 'Technical Qualification';
  if (str === 'DIRECT_AUCTION') return 'Direct Auction';
  if (str === 'BID_WITH_REVERSE_AUCTION') return 'Bid with Reverse Auction';
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

export default function ReverseAuctionDetailPage({ id }: { id: number | string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const isSeller = user?.role === 'seller';
  const [message, setMessage] = useState('');
  const [selectedSeller, setSelectedSeller] = useState<MarketplaceSeller | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'requirement' | 'clarifications' | 'all'>('overview');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<DocumentPreview | null>(null);
  const inviteButtonRef = useRef<HTMLButtonElement | null>(null);

  const openDocumentPreview = async (label: string, fileIdOrAsset: any) => {
    try {
      const preview = await getFileAssetPreview(fileIdOrAsset, label);
      setPreviewDocument(preview);
    } catch {
      const id = typeof fileIdOrAsset === 'number' ? fileIdOrAsset : fileIdOrAsset?.fileAssetId || fileIdOrAsset?.id;
      const url = id ? `/api/files/${id}/view` : fileIdOrAsset?.url;
      if (url) {
        setPreviewDocument({
          label,
          url,
          mode: getDocumentPreviewMode(url, '', label.split('.').pop() || '')
        });
      } else {
        toast.error('Unable to open document preview.');
      }
    }
  };

  useEffect(() => {
    if (!isInviteModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsInviteModalOpen(false);
        inviteButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInviteModalOpen]);

  // Return to the page the seller came from; fall back to their opportunities list on a cold open.
  const goBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push(isSeller ? '/seller/opportunities' : '/buyer/my-procurements?type=Reverse Auction');
  };

  // Queries
  const auction = useQuery({
    queryKey: ['reverse-auction', id],
    queryFn: () => reverseAuctionApi.get(id),
    staleTime: 30_000,
    refetchInterval: isSeller ? false : 15_000,
    refetchOnWindowFocus: false
  });

  const effectiveId = auction.data?.id ?? id;

  const summary = useQuery({
    queryKey: ['reverse-auction-summary', effectiveId],
    queryFn: () => reverseAuctionApi.liveSummary(effectiveId),
    staleTime: 10_000,
    refetchInterval: isSeller ? false : 10_000,
    refetchOnWindowFocus: false,
    enabled: !!auction.data
  });

  const participantsQuery = useQuery({
    queryKey: ['reverse-auction-participants', effectiveId],
    queryFn: () => reverseAuctionApi.participants(effectiveId),
    staleTime: 10_000,
    refetchInterval: () => String(auction.data?.statusEnum || auction.data?.status || '').toUpperCase() === 'LIVE' ? 5_000 : 20_000,
    enabled: !!user && !!auction.data
  });

  const bidsQuery = useQuery({
    queryKey: ['reverse-auction-bids', effectiveId],
    queryFn: () => reverseAuctionApi.bids(effectiveId),
    staleTime: 5_000,
    refetchInterval: () => String(auction.data?.statusEnum || auction.data?.status || '').toUpperCase() === 'LIVE' ? 5_000 : 20_000,
    enabled: !!user && !!auction.data
  });

  const linkedBidId = auction.data?.linkedBidId;
  const tenderId = auction.data?.tenderId;

  const linkedBid = useQuery({
    queryKey: ['linked-bid', linkedBidId || tenderId],
    queryFn: () => procurementBidApi.detail(String(linkedBidId || `TENDER-${tenderId}`)),
    enabled: !!(auction.data && (linkedBidId || tenderId))
  });

  const clarificationsQuery = useQuery({
    queryKey: ['reverse-auction-clarifications', effectiveId],
    queryFn: () => reverseAuctionApi.clarifications(effectiveId),
    staleTime: 15_000,
    enabled: !!effectiveId
  });

  const clarificationCount = clarificationsQuery.data?.length ?? 0;

  const buyerTabs = useMemo(() => [
    {
      id: 'overview' as const,
      label: '1. Auction Overview',
      shortLabel: 'Overview',
      icon: FileText,
      badge: undefined,
    },
    {
      id: 'rules' as const,
      label: '2. Sourcing & Rules',
      shortLabel: 'Rules',
      icon: Settings,
      badge: undefined,
    },
    {
      id: 'requirement' as const,
      label: '3. Procurement Requirement',
      shortLabel: 'Requirement',
      icon: Package,
      badge: auction.data?.linkedRequirement
        ? (auction.data.linkedRequirement.requirementNumber || `${auction.data.linkedRequirement.items?.length || 0} items`)
        : 'Standalone',
    },
    {
      id: 'clarifications' as const,
      label: '4. Clarifications & Queries',
      shortLabel: 'Clarifications',
      icon: MessageSquare,
      badge: clarificationCount > 0 ? String(clarificationCount) : '0',
    },
    {
      id: 'all' as const,
      label: 'All Sections',
      shortLabel: 'View All',
      icon: Layers,
      badge: undefined,
    },
  ], [auction.data?.linkedRequirement, clarificationCount]);

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const tabIds = buyerTabs.map(t => t.id);
    const currentIndex = tabIds.indexOf(activeTab);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % tabIds.length;
      setActiveTab(tabIds[nextIndex]);
      document.getElementById(`tab-${tabIds[nextIndex]}`)?.focus();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
      setActiveTab(tabIds[prevIndex]);
      document.getElementById(`tab-${tabIds[prevIndex]}`)?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveTab(tabIds[0]);
      document.getElementById(`tab-${tabIds[0]}`)?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveTab(tabIds[tabIds.length - 1]);
      document.getElementById(`tab-${tabIds[tabIds.length - 1]}`)?.focus();
    }
  };

  // Mutators
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['reverse-auction', id] });
    if (effectiveId !== id) {
      qc.invalidateQueries({ queryKey: ['reverse-auction', effectiveId] });
    }
    qc.invalidateQueries({ queryKey: ['reverse-auction-summary', effectiveId] });
    qc.invalidateQueries({ queryKey: ['reverse-auction-participants', effectiveId] });
    qc.invalidateQueries({ queryKey: ['reverse-auction-bids', effectiveId] });
  };

  const transition = useMutation({
    mutationFn: (action: 'schedule' | 'start' | 'pause' | 'resume' | 'close') =>
      reverseAuctionApi.transition(effectiveId, action),
    onSuccess: () => {
      setMessage(`Auction status transitioned.`);
      invalidate();
    },
    onError: (err: any) => {
      setMessage(`Transition failed: ${err.message}`);
    }
  });

  const invite = useMutation({
    mutationFn: (args: { sellerOrgId: number; sellerUserId?: number }) =>
      reverseAuctionApi.inviteSellers(effectiveId, [args]),
    onSuccess: () => {
      setMessage('Seller organization invited successfully.');
      invalidate();
    },
    onError: err => setMessage((err as Error).message)
  });

  const recommendAwardMutation = useMutation({
    mutationFn: (participantId?: number) => reverseAuctionApi.recommendAward(effectiveId, participantId),
    onSuccess: () => {
      setMessage('Award recommendation submitted.');
      invalidate();
    },
    onError: err => setMessage((err as Error).message)
  });

  const joinAuction = useMutation({
    mutationFn: () => reverseAuctionApi.join(effectiveId),
    onSuccess: () => {
      setMessage('You have joined this auction. The bidding console is now available.');
      invalidate();
    },
    onError: err => setMessage((err as Error).message)
  });

  if (auction.isLoading) return <LoadingState label="Loading reverse auction workspace..." />;
  if (auction.isError || !auction.data) return <InlineError message="Reverse auction not found or inaccessible." onRetry={invalidate} />;

  const status = String(auction.data.statusEnum || auction.data.status || 'DRAFT').toUpperCase();
  const isPublicAuction = auction.data.auctionType === 'OPEN' || !auction.data.auctionType || auction.data.auctionType === 'ENGLISH_REVERSE';
  const participants = participantsQuery.data?.participants || (auction.data as any).participants || [];
  const currentLowest = summary.data?.currentLowestPrice || (auction.data as any).currentLowestBid || (auction.data as any).currentLowestPrice || 0;
  const startPrice = auction.data.startPrice || 0;
  const savings = startPrice > 0 && currentLowest > 0 && currentLowest < startPrice ? startPrice - currentLowest : 0;
  const savingsPercent = startPrice > 0 && savings > 0 ? (savings / startPrice) * 100 : 0;
  const autoExtensionEnabled = auction.data.autoExtensionEnabled !== false;
  const extensionCount = auction.data.extensionCount || 0;

  const termsDocFileId = auction.data.termsDocumentFileId || (auction.data.auctionConfig as any)?.auctionTermsDocument?.fileAssetId || null;
  const termsDocName = auction.data.termsDocumentName || (auction.data.auctionConfig as any)?.auctionTermsDocument?.fileName || null;
  const isTermsImage = Boolean(termsDocName && /\.(jpe?g|png|webp|gif|svg)$/i.test(termsDocName));

  const hasJoined = participants.some((p: any) =>
    (user?.organizationId && p.sellerOrgId === user.organizationId) ||
    (user?.id && p.sellerUserId === user.id)
  );

  const startMs = new Date(auction.data.startTime).getTime();
  const endMs = new Date(auction.data.endTime).getTime();
  const durationMin = Math.round((endMs - startMs) / 60000);

  const RowItem = ({ icon: Icon, label, value, highlight }: { icon: React.ElementType; label: string; value: string; highlight?: boolean }) => (
    <div className="flex items-center justify-between py-2 px-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors rounded-lg">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className="h-4 w-4 text-slate-400 shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">{label}</span>
      </div>
      <span title={value} className={cn("text-xs font-black truncate text-right max-w-[55%]", highlight ? "text-blue-600 font-extrabold" : "text-slate-900")}>
        {value}
      </span>
    </div>
  );

  if (isSeller || !user) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 md:px-8 space-y-6 pb-16 pt-2">
        {/* Guest notice banner */}
        {!user && (
          <div className="rounded-3xl border border-blue-200 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white text-lg shadow-sm">
                <Info className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-sm font-black text-slate-900">Want to participate in this procurement?</h4>
                <p className="text-xs text-slate-600 font-medium mt-0.5">This is a public opportunity. To submit queries, request clarifications, or participate in the bidding process, please login.</p>
              </div>
            </div>
            <Link
              href={`/login?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '')}`}
              className="rounded-xl bg-gradient-to-r from-[#0b2447] to-[#123668] px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:from-blue-600 hover:to-indigo-600 transition-all shadow-md text-center shrink-0"
            >
              Login to Participate
            </Link>
          </div>
        )}

        {/* Hero Title & Live bid console header */}
        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between relative z-10">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-black text-slate-700 font-mono tracking-wider">
                  {(auction.data.auctionCode?.replace(/^RA-/, 'REQ-')) || formatRefId('REQ', auction.data.linkedRequirementId || id)}
                </span>
                <span className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
                  status === 'LIVE' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                  status === 'SCHEDULED' ? "bg-blue-50 text-blue-700 border border-blue-200" :
                  "bg-slate-100 text-slate-600 border border-slate-200"
                )}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", status === 'LIVE' ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
                  {status}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 leading-tight">
                {auction.data.title || 'Reverse Auction Sourcing'}
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-500 max-w-3xl">
                Review rules here. Use live console for bid entry, rank updates, and server-time validation.
              </p>
            </div>

            {user && user.role === 'seller' && (
              hasJoined ? (
                <Link href={`/seller/procurement/reverse-auction/${effectiveId}/live`} className="shrink-0">
                  <Button type="button" className="h-11 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:via-indigo-500 hover:to-blue-600 px-6 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2">
                    <Play className="h-4 w-4 fill-white" /> Live Bid Console
                  </Button>
                </Link>
              ) : isPublicAuction ? (
                <Button
                  type="button"
                  onClick={() => joinAuction.mutate()}
                  disabled={joinAuction.isPending}
                  className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-[#0b2447] via-[#123668] to-[#0b2447] hover:from-blue-600 hover:via-indigo-600 hover:to-blue-600 px-6 text-xs font-black uppercase tracking-wider text-white shadow-md transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  {joinAuction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {joinAuction.isPending ? 'Joining…' : 'Join to Bid'}
                </Button>
              ) : null
            )}
          </div>

          {/* Banner message next step */}
          <SellerNextStep status={status} startTime={auction.data.startTime} endTime={auction.data.endTime} />
        </div>

        {/* Dynamic Bidding Warning */}
        <div className="rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent p-4.5 shadow-xs backdrop-blur-md">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
            <div>
              <p className="text-xs font-black text-amber-900">Dynamic Commercial Bidding Active</p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-800/90">
                To respect competitive rules and prevent information leakage, the full bidding panel, competitor ranks, and increment tools are located on the live screen. Please click the button above to join.
              </p>
            </div>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Card 1: CURRENT LOWEST BID */}
          <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-blue-50/30 p-5 flex items-center gap-4 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Gavel className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-blue-700/80">Current Lowest Bid</p>
              <p title={currentLowest > 0 ? formatCurrency(currentLowest) : 'No bid yet'} className="mt-1 text-lg sm:text-xl font-black text-slate-900 tabular-nums truncate">
                {currentLowest > 0 ? formatCurrency(currentLowest) : 'No bid yet'}
              </p>
            </div>
          </div>

          {/* Card 2: SAVINGS */}
          <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30 p-5 flex items-center gap-4 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20">
              <IndianRupee className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700/80">Savings</p>
              <p title={savings > 0 ? `${formatCurrency(savings)} (${savingsPercent.toFixed(1)}%)` : '₹0.00 (0.0%)'} className="mt-1 text-lg sm:text-xl font-black text-slate-900 tabular-nums truncate">
                {savings > 0 ? `${formatCurrency(savings)} (${savingsPercent.toFixed(1)}%)` : '₹0.00 (0.0%)'}
              </p>
            </div>
          </div>

          {/* Card 3: TIME REMAINING */}
          <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/30 p-5 flex items-center gap-4 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20">
              <Clock className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-700/80">Time Remaining</p>
              <p title={formatDateTime(auction.data.endTime)} className="mt-1 text-sm sm:text-base font-black text-slate-900 tabular-nums truncate">
                {formatDateTime(auction.data.endTime)}
              </p>
            </div>
          </div>
        </div>

        {/* Main Columns: Overview & Rules */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* AUCTION OVERVIEW */}
          <section className="border border-slate-200/80 rounded-3xl bg-white p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <div className="h-5 w-1.5 rounded-full bg-gradient-to-b from-blue-600 to-indigo-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Auction Overview
              </h2>
            </div>
            <div className="mt-4 space-y-3">
              <RowItem icon={Scale} label="Procurement Method" value={formatEnumLabel(auction.data.procurementMethod)} />
              <RowItem icon={Tag} label="Category" value={auction.data.category || 'Not specified'} />
              <RowItem icon={Clock} label="Start Time" value={formatDateTime(auction.data.startTime)} />
              <RowItem icon={Hourglass} label="End Time" value={formatDateTime(auction.data.endTime)} />
              <RowItem icon={Clock} label="Duration" value={`${durationMin} minutes`} />
              <RowItem icon={Award} label="Status" value={status} highlight />
              <RowItem icon={Gavel} label="Auction Type" value={formatEnumLabel(auction.data.auctionType || 'ENGLISH_REVERSE')} />
              <RowItem icon={Laptop} label="Auction Mode" value={formatEnumLabel(auction.data.auctionMode || 'ONLINE')} />
            </div>
          </section>

          {/* SOURCING RULES */}
          <section className="border border-slate-200/80 rounded-3xl bg-white p-6 sm:p-7 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <div className="h-5 w-1.5 rounded-full bg-gradient-to-b from-indigo-600 to-purple-600" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Sourcing Rules
              </h2>
            </div>
            <div className="mt-4 space-y-3">
              <RowItem icon={IndianRupee} label="Opening Price" value={formatCurrency(auction.data.startPrice)} />
              <RowItem icon={TrendingDown} label="Min Decrement" value={auction.data.minDecrementAmount ? formatCurrency(auction.data.minDecrementAmount) : `${auction.data.minDecrementPercent}%`} />
              <RowItem icon={Eye} label="Rank Visibility" value={formatEnumLabel(auction.data.rankVisibility || 'SHOW_RANK_ONLY')} />
              <RowItem icon={Users} label="Minimum Qualified Bidders" value={String(auction.data.minimumQualifiedBidders || 2)} />
              <RowItem icon={Settings} label="Auto-Extension" value={autoExtensionEnabled ? 'Enabled' : 'Disabled'} />
              <RowItem icon={IndianRupee} label="Currency" value={auction.data.currency || 'INR'} />
              {termsDocName ? (
                <div className="flex items-center justify-between py-2 px-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors rounded-lg">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">Terms Document</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span title={termsDocName} className="text-xs font-black truncate max-w-[130px] text-slate-900">
                      {termsDocName}
                    </span>
                    <button
                      type="button"
                      onClick={() => openDocumentPreview(termsDocName, termsDocFileId || { name: termsDocName })}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] font-black uppercase transition cursor-pointer"
                    >
                      <Eye className="h-3 w-3" /> View
                    </button>
                  </div>
                </div>
              ) : (
                <RowItem icon={FileText} label="Terms Document" value="Not attached" />
              )}
            </div>
          </section>
        </div>

        {/* Description */}
        {auction.data.description && (
          <section className="border border-slate-200/80 rounded-3xl bg-white p-6 sm:p-7 shadow-sm">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <div className="h-5 w-1.5 rounded-full bg-gradient-to-b from-slate-600 to-slate-800" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Description
              </h2>
            </div>
            <p className="mt-4 text-xs sm:text-sm font-semibold leading-relaxed text-slate-600 whitespace-pre-line">
              {auction.data.description}
            </p>
          </section>
        )}

        {/* Procurement Requirement */}
        {auction.data.linkedRequirement && (
          <LinkedRequirementPanel requirement={auction.data.linkedRequirement} onPreviewDocument={openDocumentPreview} />
        )}

        {/* Your Participation */}
        {isSeller && (
          <section className="border border-blue-200/80 rounded-3xl bg-gradient-to-br from-blue-50/50 via-white to-indigo-50/30 p-6 sm:p-7 shadow-sm">
            <div className="flex items-center gap-2.5 pb-4 border-b border-blue-100">
              <div className="h-5 w-1.5 rounded-full bg-blue-600" />
              <h2 className="text-sm font-black text-[#0b2447] uppercase tracking-wider flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" /> Your Participation
              </h2>
            </div>
            {participants.length === 0 ? (
              isPublicAuction ? (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs sm:text-sm font-semibold text-slate-600">
                    This is an open reverse auction. Join to place bids in the live console.
                  </p>
                  <Button
                    type="button"
                    onClick={() => joinAuction.mutate()}
                    disabled={joinAuction.isPending}
                    className="h-10 shrink-0 rounded-xl bg-[#0b2447] hover:bg-blue-600 px-5 text-xs font-black uppercase tracking-wider text-white shadow-sm flex items-center gap-2 transition"
                  >
                    {joinAuction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    {joinAuction.isPending ? 'Joining…' : 'Join this auction'}
                  </Button>
                </div>
              ) : (
                <p className="mt-4 text-xs font-semibold text-slate-500">
                  This is an invite-only reverse auction. You will be able to participate once the buyer invites your organization.
                </p>
              )
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <RowItem icon={ShieldAlert} label="Invitation Status" value={String(participants[0]?.status || 'INVITED')} highlight />
                <RowItem icon={Award} label="Your Current Rank" value={participants[0]?.currentRank ? `L${participants[0].currentRank}` : 'Not ranked'} />
                <RowItem icon={IndianRupee} label="Your Last Bid" value={participants[0]?.lastBidAmount ? formatCurrency(participants[0].lastBidAmount) : 'No bid yet'} />
                <RowItem icon={Clock} label="Last Bid Time" value={participants[0]?.lastBidTime ? formatDateTime(participants[0].lastBidTime) : 'N/A'} />
              </div>
            )}
          </section>
        )}

        {/* Clarifications Panel */}
        <AuctionClarificationPanel auctionId={effectiveId} role="seller" />

        <DocumentPreviewModal
          previewDocument={previewDocument}
          onClose={() => setPreviewDocument(null)}
        />
      </div>
    );
  }

  // Buyer View
  return (
    <div className="mx-auto max-w-[1600px] px-4 md:px-8 space-y-6 pb-16 pt-2">
      {/* Detail Header */}
      <div className="flex flex-col gap-4 border border-slate-200/80 bg-white p-6 sm:p-7 rounded-3xl shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              "rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider",
              status === 'LIVE' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
              status === 'SCHEDULED' ? "bg-blue-50 text-blue-700 border border-blue-200" :
              "bg-slate-100 text-slate-600 border border-slate-200"
            )}>
              {status}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono">{(auction.data.auctionCode?.replace(/^RA-/, 'REQ-')) || formatRefId('REQ', auction.data.linkedRequirementId || effectiveId)}</span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900">{auction.data.title || 'Reverse Auction Sourcing'}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/seller/procurement/reverse-auction/${effectiveId}/live`} className="w-full sm:w-auto">
            <Button type="button" className="w-full h-10 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold shadow-md shadow-blue-500/20">
              <Activity className="mr-2 h-4 w-4" /> Open Full Live Board
            </Button>
          </Link>
          <Button
            ref={inviteButtonRef}
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="h-10 rounded-xl bg-[#0b2447] hover:bg-blue-700 text-white font-extrabold shadow-md shadow-[#0b2447]/20 transition-all flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4 text-amber-400" /> Invite Sellers
          </Button>
          <Button variant="outline" onClick={() => invalidate()} className="rounded-xl font-bold">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>

          {status === 'DRAFT' && (
            <Button variant="outline" onClick={() => transition.mutate('schedule')} className="rounded-xl font-bold">
              <Clock className="mr-2 h-4 w-4" /> Schedule
            </Button>
          )}
          {['DRAFT', 'SCHEDULED', 'PAUSED'].includes(status) && (
            <Button onClick={() => transition.mutate('start')} className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
              <Play className="mr-2 h-4 w-4" /> Start
            </Button>
          )}
          {status === 'LIVE' && (
            <Button variant="secondary" onClick={() => transition.mutate('pause')} className="rounded-xl font-bold">
              <Pause className="mr-2 h-4 w-4" /> Pause
            </Button>
          )}
          {['LIVE', 'PAUSED'].includes(status) && (
            <Button variant="danger" onClick={() => transition.mutate('close')} className="rounded-xl font-bold">
              <Square className="mr-2 h-4 w-4" /> Close
            </Button>
          )}
        </div>
      </div>

      {message && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-[#0b2447] flex justify-between items-center shadow-xs">
          <span>{message}</span>
          <button onClick={() => setMessage('')}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Main Content: Detailed panels arranged with accessible Tabs (Full Width) */}
      <div className="space-y-6">
          {/* Tab Navigation Strip */}
          <div className="border border-slate-200/80 bg-white p-1.5 rounded-2xl shadow-2xs">
            <div
              role="tablist"
              aria-label="Auction Details Sections"
              onKeyDown={handleTabKeyDown}
              className="flex items-center gap-1.5 overflow-x-auto scrollbar-none"
            >
              {buyerTabs.map((tab) => {
                const isSelected = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    role="tab"
                    type="button"
                    aria-selected={isSelected}
                    aria-controls={`panel-${tab.id}`}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 whitespace-nowrap px-3.5 sm:px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#0b2447]",
                      isSelected
                        ? "bg-[#0b2447] text-white shadow-sm shadow-[#0b2447]/25"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-amber-400" : "text-slate-400")} />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums tracking-tight transition-colors",
                          isSelected
                            ? "bg-white/20 text-white"
                            : "bg-slate-100 text-slate-600 border border-slate-200/70"
                        )}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Tab Panel */}
          <div
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            tabIndex={0}
            className="outline-none space-y-6"
          >
            {/* SECTION 1: Overview */}
            {(activeTab === 'overview' || activeTab === 'all') && (
              <Card className="border-slate-200/80 rounded-3xl shadow-sm overflow-hidden bg-white animate-in fade-in-50 duration-200">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-sm font-black uppercase text-[#0b2447] tracking-wider flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" /> 1. Auction Overview
                    </h2>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">
                      {(auction.data.auctionCode?.replace(/^RA-/, 'REQ-')) || formatRefId('REQ', auction.data.linkedRequirementId || effectiveId)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-2 md:grid-cols-3">
                    <KpiCard label="Procurement Method" value={formatEnumLabel(auction.data.procurementMethod)} subtext="Auction procedure" icon={Scale} tone="blue" />
                    <KpiCard label="Buyer Organization" value={auction.data.buyerOrganizationName || (auction.data.buyerOrgId ? `Buyer Org #${auction.data.buyerOrgId}` : 'Verified Buyer')} subtext="Host organization" icon={Building2} tone="indigo" />
                    <KpiCard label="Category" value={auction.data.category || 'Not specified'} subtext="Product classification" icon={Tag} tone="amber" />
                    <KpiCard label="Auction Type" value={formatEnumLabel(auction.data.auctionType || 'ENGLISH_REVERSE')} subtext="Bidding mechanism" icon={Settings} tone="slate" />
                    <KpiCard label="Auction Mode" value={formatEnumLabel(auction.data.auctionMode || 'ONLINE')} subtext="Execution channel" icon={Activity} tone="emerald" />
                    <KpiCard label="Minimum Qualified Bidders" value={String(auction.data.minimumQualifiedBidders || 2)} subtext="Bidder threshold" icon={Users} tone="purple" />
                    <KpiCard label="Start Time" value={formatDateTime(auction.data.startTime)} subtext="Bidding window opens" icon={Clock} tone="blue" />
                    <KpiCard label="End Time" value={formatDateTime(auction.data.endTime)} subtext="Bidding window closes" icon={Clock} tone="red" />
                    <KpiCard label="Calculated Duration" value={`${durationMin} mins`} subtext="Live event window" icon={Clock} tone="slate" />
                  </div>

                  {auction.data.description && (
                    <div className="mt-3 text-xs font-semibold text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="font-black text-slate-800 mb-1 uppercase tracking-wider text-[10px]">Description</p>
                      {auction.data.description}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* SECTION 2: Rules */}
            {(activeTab === 'rules' || activeTab === 'all') && (
              <Card className="border-slate-200/80 rounded-3xl shadow-sm overflow-hidden bg-white animate-in fade-in-50 duration-200">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-sm font-black uppercase text-[#0b2447] tracking-wider flex items-center gap-2">
                      <Settings className="h-4 w-4 text-indigo-600" /> 2. Sourcing &amp; Auction Rules
                    </h2>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">
                      {formatEnumLabel(auction.data.auctionType || 'ENGLISH_REVERSE')}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                    <InfoRow label="Opening Price" value={formatCurrency(auction.data.startPrice)} />
                    <InfoRow label="Reserve Price" value={auction.data.reservePrice ? formatCurrency(auction.data.reservePrice) : 'Not configured'} />
                    <InfoRow label="Minimum Decrement" value={auction.data.minDecrementAmount ? formatCurrency(auction.data.minDecrementAmount) : `${auction.data.minDecrementPercent}%`} />
                    <InfoRow label="Rank Visibility" value={formatEnumLabel(auction.data.rankVisibility || (auction.data.allowCompetitorNames ? 'SHOW_LOWEST_PRICE' : 'SHOW_RANK_ONLY'))} />
                    <InfoRow label="Auto Extension" value={autoExtensionEnabled ? `Trigger window: ${auction.data.autoExtensionWindowMinutes}m` : 'Disabled'} />
                    <InfoRow label="Extension Length" value={autoExtensionEnabled ? `${auction.data.autoExtensionByMinutes} mins` : 'N/A'} />
                    <InfoRow label="Max Auto-Extensions" value={autoExtensionEnabled ? String(auction.data.maxAutoExtensions) : 'N/A'} />
                    <InfoRow label="Extension Count" value={String(extensionCount)} />
                    <InfoRow label="Currency" value={auction.data.currency || 'INR'} />
                    <div className="py-2.5 px-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors rounded-lg flex flex-col justify-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Terms Document</p>
                      {termsDocName ? (
                        <div className="mt-1 flex flex-col gap-1">
                          <span className="text-xs sm:text-[13px] font-bold text-slate-900 text-wrap-anywhere leading-snug truncate" title={termsDocName}>
                            {termsDocName}
                          </span>
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <button
                              type="button"
                              onClick={() => openDocumentPreview(termsDocName, termsDocFileId || { name: termsDocName })}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[11px] font-bold transition shadow-2xs cursor-pointer"
                            >
                              <Eye className="h-3 w-3" /> View
                            </button>
                            {termsDocFileId && (
                              <a
                                href={`/api/files/${termsDocFileId}/view`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 text-[11px] font-bold transition shadow-2xs"
                              >
                                <ExternalLink className="h-3 w-3" /> Open
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-0.5 text-xs sm:text-[13px] font-bold text-slate-500">Not attached</p>
                      )}
                    </div>
                    <InfoRow label="Auction Trigger" value={formatEnumLabel(auction.data.auctionTrigger || (auction.data.procurementMethod === 'BID_WITH_REVERSE_AUCTION' ? 'TECHNICAL_QUALIFICATION' : 'DIRECT_AUCTION'))} />
                    <InfoRow label="Taxes Rule" value="Excluded from bid values" />
                  </div>

                  {/* Prominent Attached Document Card with Preview */}
                  {termsDocName && (
                    <div className="mt-4 rounded-2xl border border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-white p-4.5 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {isTermsImage && termsDocFileId ? (
                            <div
                              onClick={() => openDocumentPreview(termsDocName, termsDocFileId)}
                              className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-blue-200 bg-white shadow-xs cursor-pointer group"
                              title="Click to view full preview"
                            >
                              <img
                                src={`/api/files/${termsDocFileId}/view`}
                                alt={termsDocName}
                                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-110"
                              />
                              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Eye className="h-4 w-4 drop-shadow" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                              <FileText className="h-6 w-6" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black uppercase tracking-wider text-blue-700/80">Terms &amp; Conditions Document</p>
                            <p className="mt-0.5 text-xs sm:text-sm font-black text-slate-900 truncate" title={termsDocName}>
                              {termsDocName}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                              Attached document for reverse auction terms and guidelines
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            type="button"
                            onClick={() => openDocumentPreview(termsDocName, termsDocFileId || { name: termsDocName })}
                            className="h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
                          >
                            <Eye className="h-4 w-4" /> View Document
                          </Button>
                          {termsDocFileId && (
                            <a
                              href={`/api/files/${termsDocFileId}/view`}
                              download={termsDocName}
                              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                            >
                              <Download className="h-3.5 w-3.5" /> Download
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* SECTION 3: Linked Requirement */}
            {(activeTab === 'requirement' || activeTab === 'all') && (
              <div className="animate-in fade-in-50 duration-200">
                {auction.data.linkedRequirement ? (
                  <LinkedRequirementPanel requirement={auction.data.linkedRequirement} prefix="3. " onPreviewDocument={openDocumentPreview} />
                ) : (
                  <Card className="border-slate-200/80 rounded-3xl shadow-sm overflow-hidden bg-white">
                    <CardContent className="p-10 text-center space-y-3">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                        <Package className="h-6 w-6" />
                      </div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">3. Procurement Requirement</h3>
                      <p className="text-xs font-semibold text-slate-500 max-w-md mx-auto">
                        This reverse auction was created as a standalone auction without an attached procurement tender or RFQ requisition.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* SECTION 4: Clarifications */}
            {(activeTab === 'clarifications' || activeTab === 'all') && (
              <div className="animate-in fade-in-50 duration-200">
                <AuctionClarificationPanel auctionId={effectiveId} role="buyer" />
              </div>
            )}
          </div>
        </div>

      {/* Invite Sellers Modal Dialog */}
      {isInviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsInviteModalOpen(false);
              inviteButtonRef.current?.focus();
            }
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="border-b border-slate-100 bg-slate-50/80 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="invite-modal-title" className="text-base font-black text-slate-900 uppercase tracking-wide">
                    Invite Sellers
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">
                    Search verified MSMEs to grant direct bidding access.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsInviteModalOpen(false);
                  inviteButtonRef.current?.focus();
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:border-[#0b2447] hover:text-[#0b2447] transition shadow-2xs"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-6 space-y-6">
              {/* Feedback Alert if present */}
              {message && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-[#0b2447] flex justify-between items-center">
                  <span>{message}</span>
                  <button type="button" onClick={() => setMessage('')}><X className="h-3.5 w-3.5" /></button>
                </div>
              )}

              {/* Invite Form */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                  Search &amp; Select Vendor
                </label>
                <form
                  onSubmit={(e: FormEvent) => {
                    e.preventDefault();
                    if (!selectedSeller?.id) return;
                    invite.mutate({ sellerOrgId: selectedSeller.id, sellerUserId: selectedSeller.sellerUserId || undefined });
                  }}
                  className="space-y-3"
                >
                  <VendorSearchableDropdown
                    value={selectedSeller?.id || ''}
                    onChange={(seller) => setSelectedSeller(seller)}
                    placeholder="Search vendor name..."
                  />
                  {selectedSeller && (
                    <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-3 text-xs">
                      <p className="font-bold text-[#0b2447]">{selectedSeller.organizationName}</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        {selectedSeller.organizationType} · {[selectedSeller.city, selectedSeller.state].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  )}
                  <Button
                    type="submit"
                    disabled={invite.isPending || !selectedSeller}
                    className="w-full rounded-xl bg-[#0b2447] hover:bg-blue-600 font-bold text-xs h-10 text-white shadow-sm flex items-center justify-center gap-2"
                  >
                    {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    {invite.isPending ? 'Inviting Organization...' : 'Invite Organization'}
                  </Button>
                </form>
              </div>

              {/* Current Participants / Invited Sellers */}
              {participants.length > 0 && (
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-blue-600" /> Invited Sellers ({participants.length})
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Current Participants</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {participants.map((p: any, idx: number) => (
                      <div key={p.id || idx} className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-slate-200/60">
                        <span className="font-bold text-slate-800 truncate">{p.sellerOrgName || `Seller Org #${p.sellerOrgId}`}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {p.status || 'INVITED'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Auction Guidelines */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 space-y-3">
                <p className="text-xs font-black uppercase tracking-widest text-[#0b2447] flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-blue-600" /> Auction Guidelines
                </p>
                <div className="text-xs text-slate-600 leading-relaxed space-y-2.5 font-semibold">
                  <p>1. Standalone auctions are created immediately. Bids with reverse auctions require technical screening first.</p>
                  <p>2. Reverse auctions calculate L1 ranking using net price inputs. Tax and freight calculations are kept separate.</p>
                  <p>3. If auto-extension is enabled, any bid submitted in the closing minutes triggers a dynamic end-time extension.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Document Preview Modal */}
      <DocumentPreviewModal
        previewDocument={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2.5 px-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors rounded-lg flex flex-col justify-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">{label}</p>
      <p className="mt-0.5 text-xs sm:text-[13px] font-bold text-slate-900 text-wrap-anywhere leading-snug">{value}</p>
    </div>
  );
}

/** Buyer-filled procurement facts (items, documents, delivery, consignees) behind the auction. */
function LinkedRequirementPanel({
  requirement,
  prefix = '',
  onPreviewDocument
}: {
  requirement: NonNullable<import('../api').ReverseAuction['linkedRequirement']>;
  prefix?: string;
  onPreviewDocument?: (label: string, fileIdOrAsset: any) => void;
}) {
  const items = requirement.items || [];
  const documents = requirement.documents || [];
  const consignees = requirement.consigneeDetails || [];

  return (
    <section className="border border-slate-200/80 rounded-3xl bg-white p-6 sm:p-7 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-1.5 rounded-full bg-gradient-to-b from-blue-600 to-indigo-600" />
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600" /> {prefix}Procurement Requirement
          </h2>
        </div>
        {requirement.requirementNumber && (
          <span className="rounded-md bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[10px] font-black text-slate-700 font-mono tracking-wider">
            {requirement.requirementNumber}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <InfoRow label="Title" value={requirement.title || '—'} />
        <InfoRow label="Category" value={requirement.category || 'Not specified'} />
        <InfoRow label="Estimated Value" value={requirement.estimatedValue ? formatCurrency(Number(requirement.estimatedValue)) : 'Not disclosed'} />
        <InfoRow label="Delivery Location" value={requirement.deliveryLocation || 'Not specified'} />
        {requirement.requiredBy && <InfoRow label="Required By" value={formatDate(requirement.requiredBy)} />}
        {requirement.paymentTerms && <InfoRow label="Payment Terms" value={requirement.paymentTerms} />}
        {requirement.bidStartDate && <InfoRow label="Bid Start" value={formatDateTime(requirement.bidStartDate)} />}
        {requirement.bidClosingDate && <InfoRow label="Bid Closing" value={formatDateTime(requirement.bidClosingDate)} />}
      </div>

      {items.length > 0 && (
        <div className="mt-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5">Line Items ({items.length})</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">Item</th>
                    <th className="p-3">Description</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {items.map((item, i) => (
                    <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-3 text-slate-400 font-black text-center">{i + 1}</td>
                      <td className="p-3 font-bold text-slate-900">{item.itemName || '—'}</td>
                      <td title={item.description || '—'} className="p-3 text-slate-500 max-w-[260px] truncate">{item.description || '—'}</td>
                      <td className="p-3 text-right tabular-nums font-bold text-slate-900">{item.quantity ?? '—'}</td>
                      <td className="p-3">{item.unitOfMeasure || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {documents.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Required Documents ({documents.length})</p>
            <ul className="mt-2.5 space-y-2">
              {documents.map((doc, i) => {
                const docFileId = (doc as any).fileAssetId || (doc as any).fileId;
                const docUrl = (doc as any).url || (docFileId ? `/api/files/${docFileId}/view` : null);
                const docLabel = doc.name || doc.fileName || `Document ${i + 1}`;
                return (
                  <li key={i} className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                      <span title={docLabel} className="flex-1 truncate font-bold">{docLabel}</span>
                      {doc.required && <span className="text-red-500 font-black text-[10px] uppercase bg-red-50 px-1.5 py-0.5 rounded border border-red-200 shrink-0">Required</span>}
                    </div>
                    {onPreviewDocument && (docFileId || docUrl) && (
                      <button
                        type="button"
                        onClick={() => onPreviewDocument(docLabel, docFileId || { url: docUrl })}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] font-black uppercase transition shrink-0 cursor-pointer"
                      >
                        <Eye className="h-3 w-3" /> View
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {consignees.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consignees / Delivery Points ({consignees.length})</p>
            <ul className="mt-2.5 space-y-2">
              {consignees.map((consignee, i) => (
                <li key={i} className="text-xs font-semibold text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200/60 shadow-2xs">
                  <span className="font-black text-slate-900 block">{consignee.name || `Consignee ${i + 1}`}</span>
                  <span className="text-[11px] text-slate-500">
                    {consignee.location ? `${consignee.location}` : ''}
                    {consignee.quantity != null ? ` · Qty: ${consignee.quantity}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function SellerNextStep({ status, startTime, endTime }: { status: string; startTime: string; endTime: string }) {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const live = status === 'LIVE' && start <= now && end > now;
  const title = live ? 'Auction is open for bidding' : status === 'SCHEDULED' ? 'Auction is scheduled' : status === 'CLOSED' ? 'Auction is closed' : 'Auction is not accepting bids';
  const description = live
    ? 'Go to live console to submit a lower commercial bid.'
    : status === 'SCHEDULED'
      ? `Prepare now. Bidding window starts at ${formatDateTime(startTime)}.`
      : status === 'CLOSED'
        ? 'Review final rules and bid history from live screen; new bid submission is locked.'
        : `Current status is ${status.replace(/_/g, ' ')}.`;

  return (
    <div className={cn('mt-5 rounded-2xl border p-4 shadow-2xs flex items-start gap-3', live ? 'border-emerald-200 bg-emerald-50/80' : 'border-blue-200 bg-blue-50/70')}>
      <div className={cn("p-1.5 rounded-xl shrink-0 mt-0.5", live ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}>
        {live ? <CheckCircle2 className="h-4 w-4" /> : <Info className="h-4 w-4" />}
      </div>
      <div>
        <p className={cn('text-xs font-black', live ? 'text-emerald-900' : 'text-[#0b2447]')}>{title}</p>
        <p className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-600">{description}</p>
      </div>
    </div>
  );
}

interface VendorSearchableDropdownProps {
  value: string | number;
  onChange: (seller: MarketplaceSeller | null) => void;
  placeholder?: string;
  className?: string;
}

function VendorSearchableDropdown({ value, onChange, placeholder = 'Search vendor name or organization...', className }: VendorSearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sellers, setSellers] = useState<MarketplaceSeller[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<MarketplaceSeller | null>(null);

  // Fetch initial seller if value exists
  useEffect(() => {
    if (value) {
      setLoading(true);
      marketplaceApi.getSellers({ pageSize: 50 })
        .then(res => {
          const found = res?.sellers?.find((s: any) => s.id === Number(value));
          if (found) {
            setSelectedSeller(found);
            setSearch(found.organizationName);
          }
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    } else {
      setSelectedSeller(null);
      setSearch('');
    }
  }, [value]);

  // Debounce search query
  useEffect(() => {
    if (!open) return;
    const delayDebounce = setTimeout(() => {
      setLoading(true);
      const params: Record<string, string | number> = { pageSize: 20 };
      if (search) params.q = search;
      marketplaceApi.getSellers(params)
        .then(res => {
          setSellers(res?.sellers || []);
        })
        .catch(err => console.error(err))
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [search, open]);

  return (
    <div className={cn("relative w-full", className)}>
      <div className="relative">
        <input
          type="text"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-3.5 pr-10 text-xs sm:text-sm font-semibold text-slate-900 outline-none transition focus:border-[#0b2447] focus:ring-2 focus:ring-[#0b2447]/10 shadow-2xs"
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-[#0b2447]" />}
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedSeller(null);
                onChange(null);
                setSellers([]);
              }}
              className="hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-20">
            {loading && sellers.length === 0 ? (
              <div className="p-3 text-center text-xs font-semibold text-slate-500">Loading sellers...</div>
            ) : sellers.length === 0 ? (
              <div className="p-3 text-center text-xs font-semibold text-slate-500">No sellers found</div>
            ) : (
              sellers.map((seller) => {
                const isValid = seller.sellerUserId !== null && seller.sellerUserId !== undefined;
                const isSelected = selectedSeller?.id === seller.id;
                return (
                  <button
                    key={seller.id}
                    type="button"
                    disabled={!isValid}
                    onClick={() => {
                      setSelectedSeller(seller);
                      setSearch(seller.organizationName);
                      onChange(seller);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full flex-col items-start rounded-lg px-3 py-2 text-left text-xs transition",
                      !isValid ? "opacity-50 cursor-not-allowed bg-slate-50/50" : "hover:bg-slate-50",
                      isSelected && "bg-blue-50 text-[#0b2447]"
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{seller.organizationName}</span>
                      {seller.verificationStatus === 'VERIFIED' && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] uppercase font-bold border border-emerald-200 text-emerald-700">Verified</span>
                      )}
                    </div>
                    <div className="mt-1 flex w-full items-center justify-between text-[10px] text-slate-500 font-semibold">
                      <span>
                        {seller.organizationType} · {[seller.city, seller.state].filter(Boolean).join(', ')}
                      </span>
                      {!isValid && (
                        <span className="text-red-500 font-bold">No active user account</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
