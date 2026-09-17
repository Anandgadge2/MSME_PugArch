'use client';

import { FormEvent, useEffect, useState, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Gavel,
  Pause,
  Play,
  RefreshCw,
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
  Download,
  Ban,
  Lock,
  XCircle,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import { DocumentPreviewModal } from '../../../components/DocumentPreviewModal';
import { getFileAssetPreview, getDocumentPreviewMode, type DocumentPreview } from '../../../lib/files';
import { Button } from '../../../components/ui/button';
import {
  ProcurementDetailUnifiedView,
  ProcurementDetailSkeleton,
  type DisplayDocument,
} from '../../rfq/components/ProcurementDetailUnifiedView';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from '../../shared/format';
import { reverseAuctionApi } from '../api';
import AuctionClarificationPanel from '../components/AuctionClarificationPanel';
import { procurementBidApi } from '../../procurementBid/api';
import { marketplaceApi, type MarketplaceSeller } from '../../marketplace/api';
import { useAuth } from '../../../hooks/useAuth';
import { cn } from '../../../lib/utils';
import { formatRefId } from '../../../utils/refIdUtils';
import { postApi } from '../../shared/apiClient';
import { CancelProcurementModal } from '../../procurement/components/CancelProcurementModal';
import { PdfEngine, moneyPdf } from '../../../lib/pdfEngine';

function formatEnumLabel(val?: string | null): string {
  if (!val) return 'N/A';
  const str = String(val).trim();
  if (str === 'ENGLISH_REVERSE') return 'English Reverse Auction';
  if (str === 'RANK_BASED_REVERSE') return 'Rank Based Reverse Auction';
  if (str === 'ONLINE') return 'Online E-Auction';
  if (str === 'SHOW_RANK_ONLY') return 'Show Rank Only';
  if (str === 'SHOW_LOWEST_PRICE') return 'Show Lowest Price';
  if (str === 'SHOW_PRICE_AND_RANK') return 'Show Price & Rank';
  if (str === 'HIDDEN') return 'Hidden';
  if (str === 'REVERSE_AUCTION') return 'Reverse Auction';
  if (str === 'BID_WITH_REVERSE_AUCTION') return 'Bid with Reverse Auction';
  if (str === 'TECHNICAL_QUALIFICATION') return 'Technical Qualification';
  if (str === 'DIRECT_AUCTION') return 'Direct Auction';
  if (str === 'AFTER_TECHNICAL_QUALIFICATION') return 'After Technical Qualification';
  if (str === 'TOP_N_BIDDERS') return 'Top N Bidders';
  if (str === 'ALL_TECHNICALLY_QUALIFIED') return 'All Technically Qualified';
  if (str === 'INVITED_SELLERS_ONLY') return 'Invited Sellers Only';
  if (str === 'TECHNICALLY_QUALIFIED_ONLY') return 'Technically Qualified Only';
  if (str === 'INVITED') return 'Invited';
  if (str === 'ACCEPTED') return 'Accepted';
  if (str === 'QUALIFIED') return 'Qualified';
  if (str === 'DISQUALIFIED') return 'Disqualified';
  if (str === 'LIVE') return 'Live';
  if (str === 'DRAFT') return 'Draft';
  if (str === 'SCHEDULED') return 'Scheduled';
  if (str === 'PAUSED') return 'Paused';
  if (str === 'CLOSED') return 'Closed';
  if (str === 'COMPLETED') return 'Completed';
  return str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function ReverseAuctionDetailPage({ id }: { id: number | string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const pathname = usePathname() || '';
  const { user } = useAuth();
  const isSeller = user?.role === 'seller' || (!user && pathname.includes('/seller'));
  const isBuyerOrAdmin = user?.role === 'buyer' || user?.role === 'admin' || user?.role === 'master_admin';

  const [selectedSeller, setSelectedSeller] = useState<MarketplaceSeller | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<DocumentPreview | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const inviteButtonRef = useRef<HTMLButtonElement | null>(null);

  const openDocumentPreview = async (label: string, fileIdOrAsset: any) => {
    try {
      const preview = await getFileAssetPreview(fileIdOrAsset, label);
      setPreviewDocument(preview);
    } catch {
      const fid = typeof fileIdOrAsset === 'number' ? fileIdOrAsset : fileIdOrAsset?.fileAssetId || fileIdOrAsset?.id;
      const url = fid ? `/api/files/${fid}/view` : fileIdOrAsset?.url;
      if (url) {
        setPreviewDocument({
          label,
          url,
          mode: getDocumentPreviewMode(url, '', label.split('.').pop() || ''),
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

  // Queries
  const auction = useQuery({
    queryKey: ['reverse-auction', id],
    queryFn: () => reverseAuctionApi.get(id),
    staleTime: 30_000,
    refetchInterval: isSeller ? 10_000 : 15_000,
    refetchOnWindowFocus: false,
  });

  const effectiveId = auction.data?.id ?? id;
  const canonicalCode = auction.data?.auctionCode || String(effectiveId);

  // Sync URL to human-readable canonical code (e.g. /seller/procurement/reverse-auction/RA-2026-69UXUD)
  useEffect(() => {
    if (auction.data?.auctionCode && typeof window !== 'undefined') {
      const code = auction.data.auctionCode;
      const currentPath = window.location.pathname;
      const match = currentPath.match(/^(\/(?:seller|shg|buyer)\/procurement\/reverse-auction|\/reverse-auctions)\/([^/]+)(\/.*)?$/i);
      if (match) {
        const [, basePrefix, currentSlug, subRoute] = match;
        if (decodeURIComponent(currentSlug) !== code) {
          const newPath = `${basePrefix}/${encodeURIComponent(code)}${subRoute || ''}${window.location.search || ''}${window.location.hash || ''}`;
          window.history.replaceState(null, '', newPath);
        }
      }
    }
  }, [auction.data?.auctionCode]);

  const summary = useQuery({
    queryKey: ['reverse-auction-summary', effectiveId],
    queryFn: () => reverseAuctionApi.liveSummary(effectiveId),
    staleTime: 5_000,
    refetchInterval: 5_000,
    refetchOnWindowFocus: false,
    enabled: !!auction.data,
  });

  const participantsQuery = useQuery({
    queryKey: ['reverse-auction-participants', effectiveId],
    queryFn: () => reverseAuctionApi.participants(effectiveId),
    staleTime: 10_000,
    refetchInterval: () =>
      String(auction.data?.statusEnum || auction.data?.status || '').toUpperCase() === 'LIVE' ? 5_000 : 20_000,
    enabled: !!user && !!auction.data,
  });

  const linkedBidId = auction.data?.linkedBidId;
  const tenderId = auction.data?.tenderId;

  const linkedBid = useQuery({
    queryKey: ['linked-bid', linkedBidId || tenderId],
    queryFn: () => procurementBidApi.detail(String(linkedBidId || `TENDER-${tenderId}`)),
    enabled: !!(auction.data && (linkedBidId || tenderId)),
  });

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
      toast.success('Auction status transitioned successfully.');
      invalidate();
    },
    onError: (err: any) => {
      toast.error(`Transition failed: ${err.message}`);
    },
  });

  const invite = useMutation({
    mutationFn: (args: { sellerOrgId: number; sellerUserId?: number }) =>
      reverseAuctionApi.inviteSellers(effectiveId, [args]),
    onSuccess: () => {
      toast.success('Seller organization invited successfully.');
      setSelectedSeller(null);
      setIsInviteModalOpen(false);
      invalidate();
    },
    onError: (err: any) => toast.error(err.message || 'Invitation failed'),
  });

  const joinAuction = useMutation({
    mutationFn: () => reverseAuctionApi.join(effectiveId),
    onSuccess: () => {
      toast.success('You have joined this auction. The live bidding console is now available.');
      invalidate();
    },
    onError: (err: any) => toast.error(err.message || 'Failed to join auction'),
  });

  if (auction.isLoading) {
    return <ProcurementDetailSkeleton />;
  }

  if (auction.isError || !auction.data) {
    return (
      <div className="p-12 text-center space-y-4 max-w-lg mx-auto">
        <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto" />
        <p className="text-sm font-bold text-rose-600">Reverse auction not found or inaccessible.</p>
        <Button type="button" variant="outline" onClick={() => invalidate()}>
          Retry
        </Button>
      </div>
    );
  }

  const auctionData = auction.data;
  const status = String(auctionData.statusEnum || auctionData.status || 'DRAFT').toUpperCase();
  const isPublicAuction =
    auctionData.auctionType === 'OPEN' || !auctionData.auctionType || auctionData.auctionType === 'ENGLISH_REVERSE';
  const participants = participantsQuery.data?.participants || (auctionData as any).participants || [];

  const termsDocFileId =
    auctionData.termsDocumentFileId || (auctionData.auctionConfig as any)?.auctionTermsDocument?.fileAssetId || null;
  const termsDocName =
    auctionData.termsDocumentName || (auctionData.auctionConfig as any)?.auctionTermsDocument?.fileName || null;

  const myParticipant = (auctionData as any).myParticipant || (summary.data as any)?.participant || null;
  const evalPending = Boolean((auctionData as any).evaluationPending || (summary.data as any)?.auction?.evaluationPending);
  const myStatus = String(myParticipant?.status || '').toUpperCase();

  const hasJoined = Boolean(
    auctionData.hasJoined ||
      myParticipant ||
      participants.some(
        (p: any) =>
          (user?.organizationId && p.sellerOrgId === user.organizationId) ||
          (user?.id && p.sellerUserId === user.id)
      )
  );

  const canCancel =
    isBuyerOrAdmin && !['CANCELLED', 'CLOSED', 'AWARDED', 'COMPLETED'].includes(status);

  // Requirement data fallback (typed safely)
  const reqData: any = auctionData.linkedRequirement || {};
  const linkedBidData: any = linkedBid.data || {};

  // Buyer Organization details (authentic registered location, distinct from delivery location)
  const buyerOrg = (auctionData as any).buyerOrganization || reqData.buyerOrganization || reqData.organization || null;
  const buyerRegisteredAddress = buyerOrg?.registeredAddress || null;

  // Resolved Line items
  const resolvedItems: any[] =
    (reqData.items && reqData.items.length > 0 ? reqData.items : null) ||
    (linkedBidData.items && linkedBidData.items.length > 0 ? linkedBidData.items : null) ||
    (linkedBidData.technicalPacket?.items && linkedBidData.technicalPacket.items.length > 0
      ? linkedBidData.technicalPacket.items
      : []) ||
    [];

  // Resolved Documents
  const resolvedDocuments: DisplayDocument[] = [
    ...(termsDocName
      ? [
          {
            id: 'terms-doc',
            name: termsDocName,
            meta: 'Auction Terms & Conditions',
            fileAssetId: termsDocFileId,
            required: true,
          },
        ]
      : []),
    ...((reqData.documents || []).map((d: any, idx: number) => ({
      id: d.id || d.fileAssetId || `doc-${idx + 1}`,
      name: d.name || d.fileName || `Tender Document ${idx + 1}`,
      meta: d.required ? 'Mandatory' : 'Optional',
      fileAssetId: d.fileAssetId || null,
      url: d.url || null,
      required: d.required !== false,
    }))),
    ...((linkedBidData.documents || []).map((d: any, idx: number) => ({
      id: d.id || d.fileAssetId || `bid-doc-${idx + 1}`,
      name: d.name || d.fileName || `Bid Document ${idx + 1}`,
      meta: d.documentType || 'Tender Attachment',
      fileAssetId: d.fileAssetId || null,
      url: d.url || null,
      required: true,
    }))),
  ];

  const handleDownloadPdf = async () => {
    try {
      toast.info('Generating Reverse Auction Notice PDF…');
      const engine = new PdfEngine();
      const doc = await engine.generate({
        documentTitle: 'REVERSE AUCTION SOURCING NOTICE',
        documentNumber: auctionData.auctionCode || `RA-${effectiveId}`,
        dateStr: formatDateTime(auctionData.startTime),
        status,
        issuerName: auctionData.buyerOrganizationName || 'Procuring Entity',
        parties: [
          {
            title: 'BUYER ORGANIZATION',
            name: auctionData.buyerOrganizationName || 'Verified Buyer',
            address: reqData.deliveryLocation || undefined,
            details: [`Category: ${auctionData.category || reqData.category || 'N/A'}`],
          },
          {
            title: 'AUCTION EVENT',
            name: auctionData.title || 'Reverse Auction',
            details: [
              'Method: Reverse Auction',
              `Closing: ${formatDateTime(auctionData.endTime)}`,
            ],
          },
        ],
        infoGrid: {
          'Opening Price': formatCurrency(auctionData.startPrice),
          'Min Decrement': auctionData.minDecrementAmount
            ? formatCurrency(auctionData.minDecrementAmount)
            : `${auctionData.minDecrementPercent || 1}%`,
          'Rank Visibility': formatEnumLabel(auctionData.rankVisibility),
          'Auction Type': formatEnumLabel(auctionData.auctionType),
        },
        tableHeaders: ['#', 'Item', 'Qty', 'Unit', 'Est. Price'],
        tableData: resolvedItems.map((it: any, i: number) => [
          String(i + 1),
          it.itemName || it.name || 'Item',
          String(it.quantity ?? it.qty ?? 1),
          it.unitOfMeasure || it.unit || 'Nos',
          it.estimatedUnitPrice || it.price ? formatCurrency(it.estimatedUnitPrice || it.price) : 'N/A',
        ]),
        financials: { grandTotal: Number(auctionData.startPrice || 0) },
        terms: [
          `Payment Terms: ${reqData.paymentTerms || 'Standard'}`,
          `Delivery Terms: ${reqData.deliveryTerms || 'Standard'}`,
          `Auction Format: ${formatEnumLabel(auctionData.auctionType)}`,
        ],
        footerNote: 'MSME Enterprise Procurement Portal - Reverse Auction Console',
      });
      doc.save(`${(auctionData.auctionCode || `RA-${effectiveId}`).replace(/[^a-zA-Z0-9-]/g, '_')}-Notice.pdf`);
      toast.success('Notice PDF downloaded.');
    } catch {
      toast.error('Failed to generate PDF.');
    }
  };

  // Seller Action Notices / Banners
  const sellerAuctionActions = isSeller ? (
    <div className="space-y-3 pt-1">
      {/* 1. Disqualified Alert */}
      {myStatus === 'DISQUALIFIED' && (
        <div
          className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 via-rose-50/70 to-white p-4.5 shadow-sm flex items-start gap-3"
          role="alert"
        >
          <div className="h-9 w-9 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Ban className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-red-900">Bidding Disqualified</h4>
            <p className="mt-0.5 text-xs font-semibold text-red-800/90 leading-relaxed">
              {myParticipant?.disqualificationReason ||
                'Your organization was disqualified from this reverse auction during evaluation.'}
            </p>
          </div>
        </div>
      )}

      {/* 2. Qualification Under Review */}
      {myParticipant &&
        (myParticipant.qualificationStatus === 'SUBMITTED' ||
          myStatus === 'SUBMITTED' ||
          myStatus === 'IN_PROGRESS') && (
          <div
            className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50/50 to-white p-4.5 shadow-sm flex items-start gap-3"
            role="status"
            aria-live="polite"
          >
            <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                Stage 1 Qualification Under Review
              </h4>
              <p className="mt-0.5 text-xs font-semibold text-amber-800/90 leading-relaxed">
                Your Stage 1 quotation and compliance documents have been submitted. The buyer is currently reviewing
                eligibility. Live console access will be unlocked upon qualification.
              </p>
            </div>
          </div>
        )}

      {/* 3. Evaluation In Progress / Auction On Hold */}
      {evalPending && myStatus !== 'DISQUALIFIED' && (
        <div
          className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white p-4.5 shadow-sm flex items-start gap-3"
          role="status"
          aria-live="polite"
        >
          <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Hourglass className="h-5 w-5 animate-pulse" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-blue-900">
              Auction On Hold — Technical Evaluation In Progress
            </h4>
            <p className="mt-0.5 text-xs font-semibold text-blue-800/90 leading-relaxed">
              The buyer is evaluating participating seller proposals against mandatory specifications. The dynamic
              bidding window will commence once technical qualification is finalized.
            </p>
          </div>
        </div>
      )}

      {/* 4. Closed / Concluded Auction Notice */}
      {['CLOSED', 'COMPLETED', 'AWARD_RECOMMENDED', 'AWARDED'].includes(status) && (
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-white p-4.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shrink-0 shadow-sm">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Reverse Auction Bidding Concluded
              </h4>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                The bidding window has ended. You can view final L1 outcomes, ranking, and award recommendations.
              </p>
            </div>
          </div>
          <Link
            href={`/seller/procurement/reverse-auction/${canonicalCode}/results`}
            className="rounded-xl bg-slate-900 hover:bg-[#0b2447] text-white px-4 py-2 text-xs font-bold uppercase tracking-wider shrink-0 text-center transition-all shadow-sm"
          >
            View Auction Results
          </Link>
        </div>
      )}

      {/* 5. Not Joined Public Auction Notice */}
      {!hasJoined && isPublicAuction && !['CLOSED', 'COMPLETED', 'CANCELLED'].includes(status) && (
        <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white p-4.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Public Reverse Auction Opportunity
              </h4>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                This is an open competitive reverse auction. Join this auction to access real-time bid decrement tools.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => joinAuction.mutate()}
            disabled={joinAuction.isPending}
            className="rounded-xl bg-gradient-to-r from-[#0b2447] to-[#123668] hover:from-blue-600 hover:to-indigo-600 text-white px-5 py-2.5 text-xs font-black uppercase tracking-wider shrink-0 transition-all shadow-md flex items-center gap-2"
          >
            {joinAuction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {joinAuction.isPending ? 'Joining…' : 'Join to Bid'}
          </Button>
        </div>
      )}
    </div>
  ) : null;

  // Buyer Action Buttons
  const buyerAuctionActions = isBuyerOrAdmin ? (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/seller/procurement/reverse-auction/${canonicalCode}/live`}>
        <Button
          type="button"
          size="sm"
          className="h-9 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-extrabold shadow-sm flex items-center gap-1.5"
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Live Console</span>
        </Button>
      </Link>
      <Button
        ref={inviteButtonRef}
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsInviteModalOpen(true)}
        className="h-9 rounded-xl border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 font-bold text-xs flex items-center gap-1.5"
      >
        <UserPlus className="h-3.5 w-3.5 text-blue-600" />
        <span>Invite Sellers</span>
      </Button>
      {status === 'DRAFT' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => transition.mutate('schedule')}
          className="h-9 rounded-xl font-bold text-xs flex items-center gap-1.5"
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Schedule</span>
        </Button>
      )}
      {['DRAFT', 'SCHEDULED', 'PAUSED'].includes(status) && (
        <Button
          type="button"
          size="sm"
          onClick={() => transition.mutate('start')}
          className="h-9 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
        >
          <Play className="h-3.5 w-3.5" />
          <span>Start</span>
        </Button>
      )}
      {status === 'LIVE' && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => transition.mutate('pause')}
          className="h-9 rounded-xl font-bold text-xs flex items-center gap-1.5"
        >
          <Pause className="h-3.5 w-3.5" />
          <span>Pause</span>
        </Button>
      )}
      {['LIVE', 'PAUSED'].includes(status) && (
        <Button
          type="button"
          size="sm"
          onClick={() => transition.mutate('close')}
          className="h-9 rounded-xl font-bold text-xs bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5"
        >
          <Ban className="h-3.5 w-3.5" />
          <span>Close</span>
        </Button>
      )}
    </div>
  ) : null;

  return (
    <>
      <ProcurementDetailUnifiedView
        procurementType="REVERSE_AUCTION"
        procurementLabel="Reverse Auction"
        backRouteLabel={isSeller ? 'Opportunities' : 'Reverse Auctions'}
        backRoute={isSeller ? '/seller/opportunities' : '/buyer/my-procurements'}
        id={effectiveId}
        displayId={
          auctionData.auctionCode ||
          (auctionData.linkedRequirementId ? formatRefId('REQ', auctionData.linkedRequirementId) : `RA-${effectiveId}`)
        }
        subject={auctionData.title || 'Reverse Auction Sourcing'}
        status={status}
        buyerName={auctionData.buyerOrganizationName || 'Verified Buyer'}
        contactPerson={auctionData.buyerOrganizationName || 'Procurement Officer'}
        orgName={auctionData.buyerOrganizationName || 'Verified Buyer'}
        buyerEmail={user?.role === 'buyer' ? user?.email : undefined}
        buyerMobile={user?.role === 'buyer' ? user?.mobile : undefined}
        buyerAddress={buyerRegisteredAddress || undefined}
        buyer={{
          name: auctionData.buyerOrganizationName || 'Verified Buyer',
          email: user?.role === 'buyer' ? user?.email : undefined,
          mobile: user?.role === 'buyer' ? user?.mobile : undefined,
          buyerProfile: {
            organizationName: auctionData.buyerOrganizationName || 'Verified Buyer',
            address: buyerRegisteredAddress || undefined,
            city: buyerOrg?.city,
            state: buyerOrg?.state,
            pincode: buyerOrg?.pincode,
          },
        }}
        estimatedValue={auctionData.startPrice || reqData.estimatedValue}
        discloseEstimatedCost={true}
        deadlineDate={auctionData.endTime}
        createdAt={(auctionData as any).createdAt || auctionData.startTime}
        publishedDate={auctionData.startTime ? formatDateTime(auctionData.startTime) : undefined}
        submissionStartDate={auctionData.startTime ? formatDateTime(auctionData.startTime) : undefined}
        closingDate={auctionData.endTime ? formatDateTime(auctionData.endTime) : undefined}
        clarificationDate={reqData.clarificationDeadline ? formatDateTime(reqData.clarificationDeadline) : undefined}
        category={auctionData.category || reqData.category || 'General Sourcing'}
        procurementMethod="Reverse Auction"
        buyingType={reqData.whatAreYouBuying || 'Goods / Products'}
        deliveryLocation={reqData.deliveryLocation || 'As specified in auction terms'}
        paymentTerms={reqData.paymentTerms || 'Standard commercial payment terms'}
        deliveryTerms={reqData.deliveryTerms || 'Door delivery within contract period'}
        description={auctionData.description || reqData.description}
        payload={{
          ...(auctionData.auctionConfig || {}),
          ...(auctionData.preBidStage || {}),
          ...(reqData || {}),
        }}
        items={resolvedItems}
        documents={resolvedDocuments}
        evaluationMethod={`${formatEnumLabel(auctionData.auctionType || 'ENGLISH_REVERSE')} (Dynamic Decrement: ${
          auctionData.minDecrementAmount
            ? formatCurrency(auctionData.minDecrementAmount)
            : `${auctionData.minDecrementPercent || 1}%`
        })`}
        participations={participants}
        participantsCount={participants.length}
        hasSubmittedProposal={hasJoined}
        ownParticipation={myParticipant}
        linkedAuction={auctionData}
        onAuctionBidSubmitted={() => invalidate()}
        sellerAuctionActions={sellerAuctionActions}
        buyerAuctionActions={buyerAuctionActions}
        customClarificationPanel={
          <AuctionClarificationPanel
            auctionId={effectiveId}
            role={isSeller ? 'seller' : 'buyer'}
            closed={['CLOSED', 'COMPLETED', 'CANCELLED'].includes(status)}
          />
        }
        submitButtonLabel={
          isSeller
            ? hasJoined
              ? 'Live Bid Console'
              : isPublicAuction
              ? 'Join to Bid'
              : undefined
            : isBuyerOrAdmin
            ? 'Open Live Console'
            : undefined
        }
        onSubmitClick={
          isSeller
            ? hasJoined
              ? () => router.push(`/seller/procurement/reverse-auction/${canonicalCode}/live`)
              : isPublicAuction
              ? () => joinAuction.mutate()
              : undefined
            : isBuyerOrAdmin
            ? () => router.push(`/seller/procurement/reverse-auction/${canonicalCode}/live`)
            : undefined
        }
        onDownloadClick={handleDownloadPdf}
        onCancelClick={canCancel ? () => setCancelModalOpen(true) : undefined}
        cancelButtonLabel={status === 'DRAFT' ? 'Withdraw Auction' : 'Cancel Auction'}
      />

      {/* Buyer Invite Sellers Modal */}
      {isInviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-modal-title"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <UserPlus className="h-4 w-4" />
                </div>
                <h3 id="invite-modal-title" className="text-base font-black text-slate-900">
                  Invite Seller Organization
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                if (!selectedSeller) return;
                invite.mutate({
                  sellerOrgId: selectedSeller.id,
                  sellerUserId: selectedSeller.sellerUserId ? Number(selectedSeller.sellerUserId) : undefined,
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Select Registered Seller
                </label>
                <VendorSearchableDropdown
                  value={selectedSeller?.id || ''}
                  onChange={(seller) => setSelectedSeller(seller)}
                  placeholder="Search seller by business name..."
                />
              </div>

              {selectedSeller && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs space-y-1">
                  <p className="font-bold text-[#0b2447]">{selectedSeller.organizationName}</p>
                  <p className="text-slate-500">
                    {selectedSeller.organizationType} · {[selectedSeller.city, selectedSeller.state].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="rounded-xl font-bold text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={invite.isPending || !selectedSeller}
                  className="rounded-xl bg-[#0b2447] hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-2"
                >
                  {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  {invite.isPending ? 'Inviting…' : 'Send Invitation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Document Preview Modal */}
      <DocumentPreviewModal
        previewDocument={previewDocument}
        onClose={() => setPreviewDocument(null)}
      />

      {/* Cancel Modal */}
      {canCancel && (
        <CancelProcurementModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          procurement={{
            id: Number(effectiveId),
            type: 'reverse_auction',
            title: auctionData.title || 'Reverse Auction Sourcing',
            referenceNumber: auctionData.auctionCode || `RA-${effectiveId}`,
            typeLabel: 'Reverse Auction',
            status: status,
          }}
          onConfirm={async (params) => {
            await postApi('/api/buyer/procurements/cancel', params);
            toast.success('Reverse auction cancelled successfully');
            invalidate();
            router.push('/buyer/my-procurements');
          }}
        />
      )}
    </>
  );
}

interface VendorSearchableDropdownProps {
  value: string | number;
  onChange: (seller: MarketplaceSeller | null) => void;
  placeholder?: string;
  className?: string;
}

function VendorSearchableDropdown({
  value,
  onChange,
  placeholder = 'Search vendor name or organization...',
  className,
}: VendorSearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sellers, setSellers] = useState<MarketplaceSeller[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<MarketplaceSeller | null>(null);

  useEffect(() => {
    if (!open) return;
    const delayDebounce = setTimeout(() => {
      setLoading(true);
      const params: Record<string, string | number> = { pageSize: 20 };
      if (search) params.q = search;
      marketplaceApi
        .getSellers(params)
        .then((res) => {
          setSellers(res?.sellers || []);
        })
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [search, open]);

  return (
    <div className={cn('relative w-full', className)}>
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
                      'flex w-full flex-col items-start rounded-lg px-3 py-2 text-left text-xs transition',
                      !isValid ? 'opacity-50 cursor-not-allowed bg-slate-50/50' : 'hover:bg-slate-50',
                      isSelected && 'bg-blue-50 text-[#0b2447]'
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="font-bold text-slate-900">{seller.organizationName}</span>
                      {seller.verificationStatus === 'VERIFIED' && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] uppercase font-bold border border-emerald-200 text-emerald-700">
                          Verified
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex w-full items-center justify-between text-[10px] text-slate-500 font-semibold">
                      <span>
                        {seller.organizationType} · {[seller.city, seller.state].filter(Boolean).join(', ')}
                      </span>
                      {!isValid && <span className="text-red-500 font-bold">No active user account</span>}
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
