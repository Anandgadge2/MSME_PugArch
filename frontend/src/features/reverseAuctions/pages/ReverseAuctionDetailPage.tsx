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
import { useReverseAuctionRealtime } from '../hooks/useReverseAuctionRealtime';
import { useUserRealtime } from '../../../hooks/useUserRealtime';
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
  const rolePrefix = pathname.startsWith('/buyer') ? '/buyer' :
                     pathname.startsWith('/admin') ? '/admin' :
                     pathname.startsWith('/shg') ? '/shg' :
                     user?.role === 'buyer' ? '/buyer' :
                     user?.role === 'admin' ? '/admin' :
                     user?.role === 'shg' ? '/shg' : '/seller';

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

  useReverseAuctionRealtime(effectiveId, canonicalCode);
  useUserRealtime(user?.id);

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

  const linkedBidId = auction.data?.linkedBidId || auction.data?.linkedRequirement?.id;
  const tenderId = auction.data?.tenderId;
  const linkedRequirementId = auction.data?.linkedRequirementId;
  const referenceNo = auction.data?.referenceNo || (auction.data?.linkedRequirement as any)?.bidNumber || auction.data?.linkedRequirement?.requirementNumber;
  const candidateRefNo =
    referenceNo &&
    !String(referenceNo).toUpperCase().startsWith('RA-') &&
    referenceNo !== auction.data?.auctionCode &&
    referenceNo !== `RA-${effectiveId}`
      ? referenceNo
      : null;

  const targetProcurementId = linkedBidId
    ? String(linkedBidId)
    : tenderId
    ? `TENDER-${tenderId}`
    : linkedRequirementId
    ? String(linkedRequirementId)
    : candidateRefNo;

  const linkedBid = useQuery({
    queryKey: ['linked-bid', targetProcurementId],
    queryFn: () => procurementBidApi.detail(targetProcurementId!),
    enabled: !!(auction.data && targetProcurementId),
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

  const auctionData = auction.data || ({} as any);
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

  const isAuctionCancelled = status === 'CANCELLED';

  const canCancel =
    isBuyerOrAdmin && !isAuctionCancelled && !['CLOSED', 'AWARDED', 'COMPLETED'].includes(status);

  const isAuctionClosed =
    !isAuctionCancelled &&
    (['CLOSED', 'COMPLETED', 'AWARD_RECOMMENDED', 'AWARDED'].includes(status) ||
      (auctionData.endTime ? new Date(auctionData.endTime).getTime() < Date.now() : false));

  // Requirement data fallback (typed safely)
  const reqData: any = auctionData.linkedRequirement || {};
  const linkedBidData: any = linkedBid.data || {};

  // Buyer Organization details (authentic registered location, distinct from delivery location)
  const buyerOrg = (auctionData as any).buyerOrganization || reqData.buyerOrganization || reqData.organization || linkedBidData.buyerOrganization || null;
  const buyerRegisteredAddress = buyerOrg?.registeredAddress || null;

  // Resolved Line items
  const resolvedItems: any[] =
    (reqData.items && reqData.items.length > 0 ? reqData.items : null) ||
    (linkedBidData.items && linkedBidData.items.length > 0 ? linkedBidData.items : null) ||
    (linkedBidData.technicalPacket?.items && linkedBidData.technicalPacket.items.length > 0
      ? linkedBidData.technicalPacket.items
      : []) ||
    [];

  // Resolved BOQ Table
  const resolvedBoqTable: any[] =
    (Array.isArray(reqData.boqTable) && reqData.boqTable.length > 0 ? reqData.boqTable : null) ||
    (Array.isArray(linkedBidData.boqTable) && linkedBidData.boqTable.length > 0 ? linkedBidData.boqTable : null) ||
    (Array.isArray(linkedBidData.technicalPacket?.boqTable) && linkedBidData.technicalPacket.boqTable.length > 0
      ? linkedBidData.technicalPacket.boqTable
      : []) ||
    [];

  // Authentic Seller Participation Resolution (Zero Mock Fallback)
  const effectiveSellerParticipation = useMemo(() => {
    if (!user) return null;
    const uid = String(user.id || '');
    const oid = String(user.organizationId || user.organization?.id || user.sellerProfile?.organizationId || '');

    // 1. Matched participant in reverse auction participants list
    const participantFromList = participants.find((p: any) =>
      p.isCurrentViewer ||
      (oid && String(p.sellerOrgId) === oid) ||
      (uid && String(p.sellerUserId) === uid)
    ) || null;

    // 2. Base participant from auction query / summary query
    const basePart = participantFromList || myParticipant;

    // 3. Linked participation from parent tender/procurement bid
    const rawLinkedParts = linkedBidData?.participations || [];
    const matchedLinkedPart = Array.isArray(rawLinkedParts)
      ? rawLinkedParts.find((p: any) => {
          const pUid = String(p.sellerId || p.sellerUserId || p.seller?.id || '');
          const pOid = String(p.organizationId || p.sellerOrganizationId || p.seller?.organizationId || '');
          return (uid && pUid === uid) || (oid && pOid === oid);
        }) || null
      : null;

    if (!basePart && !matchedLinkedPart) return null;

    // 4. Seller's bids in this reverse auction
    const myAuctionBids = Array.isArray(auctionData?.bids)
      ? (auctionData.bids as any[]).filter((b: any) =>
          b.isMyBid ||
          (uid && String(b.sellerId) === uid) ||
          (oid && String(b.sellerOrgId) === oid)
        )
      : [];
    const myLowestAuctionBid = myAuctionBids.length > 0
      ? [...myAuctionBids].sort((a, b) => Number(a.amount || a.bidAmount || 0) - Number(b.amount || b.bidAmount || 0))[0]
      : null;

    const ack = (matchedLinkedPart?.acknowledgement && typeof matchedLinkedPart.acknowledgement === 'object' && !Array.isArray(matchedLinkedPart.acknowledgement))
      ? (matchedLinkedPart.acknowledgement as Record<string, any>)
      : (basePart?.acknowledgement && typeof basePart.acknowledgement === 'object' && !Array.isArray(basePart.acknowledgement))
        ? (basePart.acknowledgement as Record<string, any>)
        : {};

    const quotedVal = Number(
      myLowestAuctionBid?.amount ||
      myLowestAuctionBid?.bidAmount ||
      basePart?.lastBidAmount ||
      basePart?.initialQuoteTotal ||
      basePart?.initialQuoteAmount ||
      matchedLinkedPart?.totalAmount ||
      matchedLinkedPart?.quotedAmount ||
      matchedLinkedPart?.offeredPrice ||
      basePart?.quotedAmount ||
      basePart?.totalAmount ||
      0
    );

    const initialVal = Number(
      basePart?.initialQuoteTotal ||
      basePart?.initialQuoteAmount ||
      matchedLinkedPart?.totalAmount ||
      matchedLinkedPart?.quotedAmount ||
      quotedVal
    );

    const allCandidateDocs = [
      ...(Array.isArray(basePart?.documents) ? basePart.documents : []),
      ...(Array.isArray(basePart?.qualificationDocuments) ? basePart.qualificationDocuments : []),
      ...(Array.isArray(matchedLinkedPart?.documents) ? matchedLinkedPart.documents : []),
      ...(Array.isArray(ack.documents) ? ack.documents : []),
    ];
    const uniqueDocsMap = new Map<string, any>();
    for (const d of allCandidateDocs) {
      if (!d) continue;
      const key = String(d.fileAssetId || d.id || d.url || d.fileUrl || d.fileName || d.name || '');
      if (key && !uniqueDocsMap.has(key)) {
        uniqueDocsMap.set(key, d);
      }
    }
    const resolvedDocs = Array.from(uniqueDocsMap.values());

    return {
      ...(matchedLinkedPart || {}),
      ...(basePart || {}),
      _isFromUserParticipation: true,
      id: basePart?.id || matchedLinkedPart?.id,
      sellerOrgId: Number(user.organizationId || basePart?.sellerOrgId || matchedLinkedPart?.sellerOrganizationId || 0),
      sellerUserId: Number(user.id || basePart?.sellerUserId || matchedLinkedPart?.sellerId || 0),
      quotedAmount: quotedVal,
      totalAmount: quotedVal,
      offeredPrice: quotedVal,
      initialQuoteAmount: initialVal,
      initialQuoteTotal: initialVal,
      lastBidAmount: basePart?.lastBidAmount || myLowestAuctionBid?.amount || quotedVal,
      deliveryTimeline:
        basePart?.deliveryTimeline ||
        matchedLinkedPart?.deliveryTimeline ||
        ack.deliveryTimeline ||
        (matchedLinkedPart?.deliveryDays ? `${matchedLinkedPart.deliveryDays} Days` : null) ||
        reqData.deliveryTimeline ||
        linkedBidData.deliveryTimeline ||
        'As per specifications',
      paymentTerms:
        basePart?.paymentTerms ||
        matchedLinkedPart?.paymentTerms ||
        ack.paymentTerms ||
        ack.terms ||
        reqData.paymentTerms ||
        linkedBidData.paymentTerms ||
        'As per tender terms',
      documents: resolvedDocs,
      lineItems: (Array.isArray(basePart?.lineItems) && basePart.lineItems.length > 0)
        ? basePart.lineItems
        : (Array.isArray(matchedLinkedPart?.lineItems) && matchedLinkedPart.lineItems.length > 0)
          ? matchedLinkedPart.lineItems
          : (Array.isArray(ack.lineItems) && ack.lineItems.length > 0)
            ? ack.lineItems
            : resolvedItems,
      acknowledgement: ack,
      makeBrand: basePart?.makeBrand || matchedLinkedPart?.makeBrand || ack.makeBrand || null,
      model: basePart?.model || matchedLinkedPart?.model || ack.model || null,
      submittedAt: basePart?.qualificationSubmittedAt || basePart?.submittedAt || matchedLinkedPart?.submittedAt || basePart?.createdAt || auctionData?.startTime,
    };
  }, [participants, myParticipant, linkedBidData?.participations, linkedBidData.deliveryTimeline, linkedBidData.paymentTerms, auctionData?.bids, auctionData?.startTime, user, reqData.deliveryTimeline, reqData.paymentTerms, resolvedItems]);

  // Clarification window closure logic:
  // In public procurement & reverse auctions, clarification queries are pre-bid only.
  // The clarification window closes when:
  // 1. Auction is live, scheduled, paused, closed, completed, awarded, or cancelled.
  // 2. The bid submission deadline has elapsed (from linked bid, requirement, or auction).
  // 3. The explicit clarification deadline has elapsed.
  // 4. The seller has submitted qualification proposal and evaluation is concluded/in-flight.
  const isClarificationClosed = useMemo(() => {
    if (isAuctionClosed || isAuctionCancelled) return true;
    if (['LIVE', 'SCHEDULED', 'PAUSED', 'CLOSED', 'COMPLETED', 'AWARDED', 'AWARD_RECOMMENDED'].includes(status)) {
      return true;
    }
    const now = Date.now();
    // Auction end time
    if (auctionData.endTime && new Date(auctionData.endTime).getTime() < now) {
      return true;
    }
    // Linked Bid deadlines
    const bidDeadline = linkedBidData.endDate ? new Date(linkedBidData.endDate).getTime() : 0;
    if (bidDeadline > 0 && bidDeadline < now) return true;
    const bidClarDeadline = linkedBidData.clarificationEndDate ? new Date(linkedBidData.clarificationEndDate).getTime() : 0;
    if (bidClarDeadline > 0 && bidClarDeadline < now) return true;

    // Linked Requirement deadlines
    const reqDeadline = reqData.bidSubmissionEnd ? new Date(reqData.bidSubmissionEnd).getTime() : 0;
    if (reqDeadline > 0 && reqDeadline < now) return true;
    const reqClarDeadline = reqData.clarificationDeadline ? new Date(reqData.clarificationDeadline).getTime() : 0;
    if (reqClarDeadline > 0 && reqClarDeadline < now) return true;

    // If seller has joined/submitted proposal and bid submission is closed
    if (hasJoined && (myStatus === 'QUALIFIED' || myStatus === 'TECHNICALLY_QUALIFIED' || myStatus === 'DISQUALIFIED')) {
      return true;
    }

    return false;
  }, [
    isAuctionClosed,
    isAuctionCancelled,
    status,
    auctionData.endTime,
    linkedBidData.endDate,
    linkedBidData.clarificationEndDate,
    reqData.bidSubmissionEnd,
    reqData.clarificationDeadline,
    hasJoined,
    myStatus,
  ]);

  // Resolved Terms & Conditions
  const resolvedTerms: any =
    (Array.isArray(reqData.termsAndConditions) && reqData.termsAndConditions.length > 0 ? reqData.termsAndConditions : null) ||
    (Array.isArray(linkedBidData.termsAndConditions) && linkedBidData.termsAndConditions.length > 0 ? linkedBidData.termsAndConditions : null) ||
    (Array.isArray(linkedBidData.technicalPacket?.termsAndConditions) && linkedBidData.technicalPacket.termsAndConditions.length > 0
      ? linkedBidData.technicalPacket.termsAndConditions
      : null) ||
    (Array.isArray(linkedBidData.technicalPacket?.terms?.termsAndConditions) && linkedBidData.technicalPacket.terms.termsAndConditions.length > 0
      ? linkedBidData.technicalPacket.terms.termsAndConditions
      : (reqData.termsAndConditions || linkedBidData.termsAndConditions || null));

  // Resolved Eligibility Criteria
  const resolvedEligibility: any =
    (Array.isArray(reqData.eligibilityCriteria) && reqData.eligibilityCriteria.length > 0 ? reqData.eligibilityCriteria : null) ||
    (Array.isArray(linkedBidData.eligibilityCriteria) && linkedBidData.eligibilityCriteria.length > 0 ? linkedBidData.eligibilityCriteria : null) ||
    (Array.isArray(linkedBidData.technicalPacket?.basics?.eligibilityCriteria) && linkedBidData.technicalPacket.basics.eligibilityCriteria.length > 0
      ? linkedBidData.technicalPacket.basics.eligibilityCriteria
      : (reqData.eligibilityCriteria || linkedBidData.eligibilityCriteria || null));

  // Resolved Required Documents
  const resolvedRequiredDocuments: any =
    (Array.isArray(reqData.requiredDocuments) && reqData.requiredDocuments.length > 0 ? reqData.requiredDocuments : null) ||
    (Array.isArray(linkedBidData.requiredDocuments) && linkedBidData.requiredDocuments.length > 0 ? linkedBidData.requiredDocuments : null) ||
    (Array.isArray(linkedBidData.technicalPacket?.requiredDocs) && linkedBidData.technicalPacket.requiredDocs.length > 0
      ? linkedBidData.technicalPacket.requiredDocs
      : (reqData.requiredDocuments || linkedBidData.requiredDocuments || []));

  // Resolved Consignee Details
  const resolvedConsigneeDetails: any[] =
    (Array.isArray(reqData.consigneeDetails) && reqData.consigneeDetails.length > 0 ? reqData.consigneeDetails : null) ||
    (Array.isArray(linkedBidData.consigneeDetails) && linkedBidData.consigneeDetails.length > 0 ? linkedBidData.consigneeDetails : null) ||
    (Array.isArray(linkedBidData.technicalPacket?.consigneeDetails) && linkedBidData.technicalPacket.consigneeDetails.length > 0
      ? linkedBidData.technicalPacket.consigneeDetails
      : []) ||
    [];

  // Resolved Description
  const resolvedDescription =
    (auctionData.description && auctionData.description !== 'No description provided.' && auctionData.description !== '—' && !auctionData.description.toLowerCase().startsWith('reverse auction event'))
      ? auctionData.description
      : (reqData.description || linkedBidData.description || auctionData.description || '');

  // Resolved Subject / Title
  const resolvedSubject =
    (auctionData.title && !auctionData.title.startsWith('RA-') && !auctionData.title.toLowerCase().startsWith('reverse auction'))
      ? auctionData.title
      : (reqData.title || linkedBidData.title || auctionData.title || 'Reverse Auction Sourcing');

  // Resolved Delivery & Commercial Terms
  const resolvedDeliveryLocation =
    reqData.deliveryLocation ||
    linkedBidData.deliveryLocation ||
    (linkedBidData.technicalPacket as any)?.basics?.deliveryLocation ||
    'As specified in auction terms';

  const resolvedPaymentTerms =
    reqData.paymentTerms ||
    linkedBidData.paymentTerms ||
    (linkedBidData.technicalPacket as any)?.terms?.paymentTerms ||
    'Standard commercial payment terms';

  const resolvedDeliveryTerms =
    reqData.deliveryTerms ||
    linkedBidData.deliveryTerms ||
    (linkedBidData.technicalPacket as any)?.terms?.deliveryTerms ||
    'Door delivery within contract period';

  const rawCategoryCandidate =
    auctionData.category ||
    reqData.category ||
    linkedBidData.category ||
    null;

  const resolvedCategory =
    (rawCategoryCandidate && !['general sourcing', 'general procurement'].includes(rawCategoryCandidate.trim().toLowerCase()))
      ? rawCategoryCandidate.trim()
      : (reqData.whatAreYouBuying || '');

  const resolvedApprovalAuthority =
    reqData.approvalAuthority ||
    linkedBidData.approvalAuthority ||
    (linkedBidData.technicalPacket as any)?.internal?.approvalAuthority ||
    null;

  const resolvedJustification =
    reqData.justification ||
    linkedBidData.justification ||
    (linkedBidData.technicalPacket as any)?.internal?.justification ||
    null;

  const resolvedInternalDetails =
    reqData.internalDetails ||
    linkedBidData.internalDetails ||
    (linkedBidData.technicalPacket as any)?.internal ||
    null;

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
    const toastId = toast.loading('Preparing Reverse Auction Sourcing Notice PDF...');
    try {
      const engine = new PdfEngine();
      const doc = await engine.generate({
        documentTitle: 'REVERSE AUCTION SOURCING NOTICE',
        documentNumber: auctionData.auctionCode || `RA-${effectiveId}`,
        dateStr: formatDateTime(auctionData.startTime),
        status,
        issuerName: auctionData.buyerOrganizationName || 'Procuring Entity',
        issuerSubtitle: 'Live Reverse Auction Event Notice',
        parties: [
          {
            title: 'BUYER ORGANIZATION',
            name: auctionData.buyerOrganizationName || 'Verified Buyer',
            address: reqData.deliveryLocation || undefined,
            details: resolvedCategory ? [`Category: ${resolvedCategory}`] : [],
          },
          {
            title: 'AUCTION EVENT SPECIFICATION',
            name: auctionData.title || 'Reverse Auction Event',
            details: [
              'Method: Dynamic Reverse Auction',
              `Bidding Window Closes: ${formatDateTime(auctionData.endTime)}`,
              'Participation: Technically Qualified Bidders Only',
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
        signatoryMode: 'single',
        singleSignatoryTitle: auctionData.buyerOrganizationName || 'Procuring Authority',
        footerNote: 'JSGSMILE Enterprise Procurement Portal - Reverse Auction Console',
      });
      doc.save(`${(auctionData.auctionCode || `RA-${effectiveId}`).replace(/[^a-zA-Z0-9-]/g, '_')}-Notice.pdf`);
      toast.success('Notice PDF downloaded successfully.', { id: toastId });
    } catch {
      toast.error('Failed to generate PDF document.', { id: toastId });
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

      {/* 4. Active Joined Seller Ready Alert */}
      {hasJoined && !isAuctionClosed && !isAuctionCancelled && myStatus !== 'DISQUALIFIED' && !evalPending && (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white p-4.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Activity className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900">
                Participation Active — Live Console Ready
              </h4>
              <p className="text-xs font-semibold text-emerald-800/90 mt-0.5">
                You are registered for this reverse auction. Access the dynamic bidding console to submit competitive decrements.
              </p>
            </div>
          </div>
          <Link
            href={`/seller/procurement/reverse-auction/${encodeURIComponent(canonicalCode)}/live`}
            className="rounded-xl bg-[#0b2447] hover:bg-[#123668] text-white px-5 py-2.5 text-xs font-black uppercase tracking-wider shrink-0 transition-all shadow-md flex items-center gap-2"
          >
            <Activity className="h-4 w-4" />
            Open Live Console
          </Link>
        </div>
      )}

      {/* 5. Cancelled Auction Notice */}
      {isAuctionCancelled && (
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 via-red-50/30 to-white p-4.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-rose-950">
                Reverse Auction Cancelled
              </h4>
              <p className="text-xs font-semibold text-rose-800/90 mt-0.5">
                This reverse auction has been officially cancelled. No further bidding, evaluation, or contract award can take place.
              </p>
            </div>
          </div>
          {participants.length > 0 && hasJoined && (
            <button
              type="button"
              onClick={() => router.push(`${rolePrefix}/procurement/reverse-auction/${encodeURIComponent(canonicalCode)}/results`)}
              className="rounded-xl bg-slate-900 hover:bg-[#0b2447] text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider shrink-0 text-center transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              View Auction Results
            </button>
          )}
        </div>
      )}

      {/* 6. Closed / Concluded Auction Notice */}
      {isAuctionClosed && (
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
          <button
            type="button"
            onClick={() => router.push(`${rolePrefix}/procurement/reverse-auction/${encodeURIComponent(canonicalCode)}/results`)}
            className="rounded-xl bg-slate-900 hover:bg-[#0b2447] text-white px-4 py-2.5 text-xs font-bold uppercase tracking-wider shrink-0 text-center transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          >
            View Auction Results
          </button>
        </div>
      )}

      {/* 7. Not Joined Public Auction Notice (Only when auction is active and open) */}
      {!hasJoined && isPublicAuction && !isAuctionClosed && !isAuctionCancelled && (
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

  // Buyer Action Buttons (Lifecycle Controls)
  const buyerAuctionActions = isBuyerOrAdmin ? (
    <div className="flex flex-wrap items-center gap-2">
      {!isAuctionClosed && !isAuctionCancelled && (
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
      )}
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

  const rawCandidateParent =
    linkedBidData.bidNumber ||
    linkedBidData.referenceNumber ||
    (linkedBidData.id ? formatRefId(String(linkedBidData.procurementType || '').includes('LIMITED') ? 'LTND' : 'TND', linkedBidData.id) : null) ||
    reqData.referenceNumber ||
    (auctionData.auctionConfig as any)?.parentRefNumber ||
    (auctionData.referenceNo && !String(auctionData.referenceNo).toUpperCase().startsWith('RA-') && auctionData.referenceNo !== auctionData.auctionCode ? auctionData.referenceNo : null);

  // Strict deduplication: A parent reference cannot be an RA- self-reference, cannot equal auctionCode, and cannot duplicate the auction code
  const parentRef =
    rawCandidateParent &&
    !String(rawCandidateParent).toUpperCase().startsWith('RA-') &&
    rawCandidateParent !== auctionData.auctionCode
      ? rawCandidateParent
      : null;

  const compositeDisplayId = parentRef && auctionData.auctionCode
    ? `${parentRef} • ${auctionData.auctionCode}`
    : (auctionData.auctionCode || (auctionData.linkedRequirementId ? formatRefId('REQ', auctionData.linkedRequirementId) : `RA-${effectiveId}`));

  const isParentLimitedTender = Boolean(
    String(linkedBidData.procurementType || '').toUpperCase().includes('LIMITED') ||
    parentRef?.startsWith('LTND-') ||
    String(reqData.procurementMethod || '').toUpperCase().includes('LIMITED') ||
    String(reqData.procurementType || '').toUpperCase().includes('LIMITED')
  );
  const isParentOpenTender = Boolean(
    String(linkedBidData.procurementType || '').toUpperCase().includes('OPEN') ||
    parentRef?.startsWith('TND-') ||
    String(reqData.procurementMethod || '').toUpperCase().includes('OPEN')
  );
  const isParentRfq = Boolean(
    String(linkedBidData.procurementType || '').toUpperCase().includes('RFQ') ||
    parentRef?.startsWith('RFQ-') ||
    String(reqData.procurementMethod || '').toUpperCase().includes('RFQ')
  );
  const isParentRateContract = Boolean(
    String(linkedBidData.procurementType || '').toUpperCase().includes('RATE') ||
    parentRef?.startsWith('RC-') ||
    String(reqData.procurementMethod || '').toUpperCase().includes('RATE')
  );

  const parentTypeLabel = isParentLimitedTender
    ? 'Limited Tender'
    : isParentOpenTender
    ? 'Open Tender'
    : isParentRfq
    ? 'RFQ'
    : isParentRateContract
    ? 'Rate Contract'
    : null;

  const effectiveProcurementLabel = parentTypeLabel ? `${parentTypeLabel} (e-RA)` : 'Reverse Auction';

  const resolvedBuyingType =
    reqData.whatAreYouBuying ||
    reqData.buyingType ||
    linkedBidData.whatAreYouBuying ||
    linkedBidData.buyingType ||
    (linkedBidData.category && !String(linkedBidData.category).toUpperCase().includes('TENDER') && !String(linkedBidData.category).toUpperCase().includes('AUCTION') ? linkedBidData.category : undefined) ||
    'Goods / Products';

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

  return (
    <>
      <ProcurementDetailUnifiedView
        procurementType="REVERSE_AUCTION"
        procurementLabel={effectiveProcurementLabel}
        backRouteLabel={isSeller ? 'Opportunities' : 'Reverse Auctions'}
        backRoute={isSeller ? '/seller/opportunities' : '/buyer/my-procurements'}
        id={effectiveId}
        displayId={compositeDisplayId}
        subject={resolvedSubject}
        status={status}
        buyerName={auctionData.buyerOrganizationName || reqData.buyerOrganization?.organizationName || 'Verified Buyer'}
        contactPerson={auctionData.buyerOrganizationName || reqData.buyerOrganization?.organizationName || 'Procurement Officer'}
        orgName={auctionData.buyerOrganizationName || reqData.buyerOrganization?.organizationName || 'Verified Buyer'}
        buyerEmail={user?.role === 'buyer' ? user?.email : undefined}
        buyerMobile={user?.role === 'buyer' ? user?.mobile : undefined}
        buyerAddress={buyerRegisteredAddress || reqData.deliveryLocation || undefined}
        buyer={{
          name: auctionData.buyerOrganizationName || reqData.buyerOrganization?.organizationName || 'Verified Buyer',
          email: user?.role === 'buyer' ? user?.email : undefined,
          mobile: user?.role === 'buyer' ? user?.mobile : undefined,
          buyerProfile: {
            organizationName: auctionData.buyerOrganizationName || reqData.buyerOrganization?.organizationName || 'Verified Buyer',
            address: buyerRegisteredAddress || reqData.deliveryLocation || undefined,
            city: buyerOrg?.city,
            state: buyerOrg?.state,
            pincode: buyerOrg?.pincode,
          },
        }}
        estimatedValue={auctionData.startPrice || reqData.estimatedValue || linkedBidData.estimatedValue}
        discloseEstimatedCost={true}
        deadlineDate={auctionData.endTime}
        createdAt={(auctionData as any).createdAt || auctionData.startTime}
        publishedDate={auctionData.startTime ? formatDateTime(auctionData.startTime) : undefined}
        submissionStartDate={auctionData.startTime ? formatDateTime(auctionData.startTime) : undefined}
        closingDate={auctionData.endTime ? formatDateTime(auctionData.endTime) : undefined}
        clarificationDate={reqData.clarificationDeadline ? formatDateTime(reqData.clarificationDeadline) : undefined}
        category={resolvedCategory}
        procurementMethod={parentTypeLabel ? `${parentTypeLabel} with Reverse Auction` : "Reverse Auction"}
        buyingType={resolvedBuyingType}
        deliveryLocation={resolvedDeliveryLocation}
        paymentTerms={resolvedPaymentTerms}
        deliveryTerms={resolvedDeliveryTerms}
        description={resolvedDescription}
        rawBid={linkedBidData?.rawBid || linkedBidData}
        payload={{
          ...(linkedBidData.payload || linkedBidData.technicalPacket || {}),
          ...(reqData.payload || reqData || {}),
          ...(auctionData.auctionConfig || {}),
          ...(auctionData.preBidStage || {}),
          ...(auctionData || {}),
        }}
        items={resolvedItems}
        boqTable={resolvedBoqTable}
        termsAndConditions={resolvedTerms}
        eligibilityCriteria={resolvedEligibility}
        requiredDocuments={resolvedRequiredDocuments}
        consigneeDetails={resolvedConsigneeDetails}
        approvalAuthority={resolvedApprovalAuthority}
        justification={resolvedJustification}
        internalDetails={resolvedInternalDetails}
        documents={resolvedDocuments}
        evaluationMethod={`${formatEnumLabel(auctionData.auctionType || 'ENGLISH_REVERSE')} (Dynamic Decrement: ${
          auctionData.minDecrementAmount
            ? formatCurrency(auctionData.minDecrementAmount)
            : `${auctionData.minDecrementPercent || 1}%`
        })`}
        participations={participants}
        participantsCount={participants.length}
        hasSubmittedProposal={hasJoined}
        ownParticipation={effectiveSellerParticipation || myParticipant}
        linkedAuction={auctionData}
        onAuctionBidSubmitted={() => invalidate()}
        sellerAuctionActions={sellerAuctionActions}
        buyerAuctionActions={buyerAuctionActions}
        customClarificationPanel={
          <AuctionClarificationPanel
            auctionId={effectiveId}
            role={isSeller ? 'seller' : 'buyer'}
            closed={isClarificationClosed}
          />
        }
        isSubmitDisabled={(isAuctionClosed || isAuctionCancelled) && !hasJoined}
        submitButtonLabel={
          isSeller
            ? isAuctionCancelled
              ? hasJoined && participants.length > 0
                ? 'View Auction Results'
                : undefined
              : isAuctionClosed
              ? hasJoined
                ? 'View Auction Results'
                : undefined
              : hasJoined
              ? 'Live Bid Console'
              : isPublicAuction
              ? 'Join to Bid'
              : undefined
            : isBuyerOrAdmin
            ? isAuctionCancelled
              ? participants.length > 0
                ? 'View Auction Results'
                : undefined
              : isAuctionClosed
              ? 'View Auction Results'
              : 'Open Live Console'
            : undefined
        }
        onSubmitClick={
          isSeller
            ? isAuctionCancelled
              ? hasJoined && participants.length > 0
                ? () => router.push(`${rolePrefix}/procurement/reverse-auction/${encodeURIComponent(canonicalCode)}/results`)
                : undefined
              : isAuctionClosed
              ? hasJoined
                ? () => router.push(`${rolePrefix}/procurement/reverse-auction/${encodeURIComponent(canonicalCode)}/results`)
                : undefined
              : hasJoined
              ? () => router.push(`/seller/procurement/reverse-auction/${canonicalCode}/live`)
              : isPublicAuction
              ? () => joinAuction.mutate()
              : undefined
            : isBuyerOrAdmin
            ? isAuctionCancelled
              ? participants.length > 0
                ? () => router.push(`${rolePrefix}/procurement/reverse-auction/${encodeURIComponent(canonicalCode)}/results`)
                : undefined
              : isAuctionClosed
              ? () => router.push(`${rolePrefix}/procurement/reverse-auction/${encodeURIComponent(canonicalCode)}/results`)
              : () => router.push(`/seller/procurement/reverse-auction/${canonicalCode}/live`)
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
            id: auctionData?.id || (!isNaN(Number(effectiveId)) ? Number(effectiveId) : 0) || auctionData?.auctionCode || String(effectiveId),
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
