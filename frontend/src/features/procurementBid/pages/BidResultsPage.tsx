'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Download, Trophy, FileText, X, Scale, CheckCircle2,
  LayoutGrid, List, Users, Eye, Mail, Phone, Clock, Tag, Package,
  CheckSquare, Square, Check, ArrowUp, ArrowDown, ArrowUpDown, Gavel,
  ShieldCheck, AlertCircle
} from 'lucide-react';
import StartReverseAuctionModal from '../../reverseAuctions/components/StartReverseAuctionModal';
import TechnicalEvaluationModal from '../../rfq/components/TechnicalEvaluationModal';
import { useAuth } from '../../../hooks/useAuth';
import { PageShell, ProcurementEmptyState, ProcurementErrorState, ProcurementHero, ProcurementLoadingState, ResultsTable, StatusBadge } from '../components';
import { money, type BidResultRow, type ProcurementBid } from '../data';
import { procurementBidApi } from '../api';
import { downloadCsv } from '../../shared/exportUtils';
import { formatDate, formatDateTime, formatCurrency } from '../../shared/format';
import { getApi, postApi } from '../../shared/apiClient';
import { openFileAsset } from '../../../lib/files';
import { PdfEngine, moneyPdf } from '../../../lib/pdfEngine';
import { toast } from 'sonner';
import { ComparisonMatrixSkeleton } from '../../../components/ui/skeleton';
import { SupplierQuotationDetailModal, SupplierQuotationDetailView, normalizeQuotationDocuments } from '../components/SupplierQuotationDetailModal';
import { DataTable, ColumnDef } from '../../../components/ui/data-table';

export default function BidResultsPage() {
  const { user } = useAuth();
  const pathname = usePathname() || '';
  const router = useRouter();
  const bidId = pathname.split('/')[2];
  
  const [bid, setBid] = useState<ProcurementBid | null>(null);
  const [ranking, setRanking] = useState<BidResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedResult, setSelectedResult] = useState<any | null>(null);

  // View mode state (default to List as requested)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortKey, setSortKey] = useState<string>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'totalPrice' || key === 'rank' ? 'asc' : 'desc');
    }
  };

  const sortedRanking = React.useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...ranking].sort((a, b) => {
      switch (sortKey) {
        case 'seller': {
          const nameA = String(a.details?.organizationName || a.sellerName || '').toLowerCase();
          const nameB = String(b.details?.organizationName || b.sellerName || '').toLowerCase();
          return nameA.localeCompare(nameB) * dir;
        }
        case 'date': {
          const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
          const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
          return (dateA - dateB) * dir;
        }
        case 'item': {
          const itemA = String(a.offeredItem || '').toLowerCase();
          const itemB = String(b.offeredItem || '').toLowerCase();
          return itemA.localeCompare(itemB) * dir;
        }
        case 'attachments': {
          const countA = a.documents ? a.documents.length : 0;
          const countB = b.documents ? b.documents.length : 0;
          return (countA - countB) * dir;
        }
        case 'totalPrice': {
          const priceA = Number(a.totalPrice || (a as any).quotedAmount || 0);
          const priceB = Number(b.totalPrice || (b as any).quotedAmount || 0);
          return (priceA - priceB) * dir;
        }
        case 'technicalStatus': {
          const techA = String(a.technicalStatus || '').toLowerCase();
          const techB = String(b.technicalStatus || '').toLowerCase();
          return techA.localeCompare(techB) * dir;
        }
        case 'rank':
        default: {
          const rankA = a.finalRank === 'NA' ? 999 : Number(String(a.finalRank).slice(1));
          const rankB = b.finalRank === 'NA' ? 999 : Number(String(b.finalRank).slice(1));
          if (!isNaN(rankA) && !isNaN(rankB) && rankA !== rankB) return (rankA - rankB) * dir;
          return ((a.totalPrice || 0) - (b.totalPrice || 0)) * dir;
        }
      }
    });
  }, [ranking, sortKey, sortDir]);
  
  // Multi-selection state for comparing specific sellers
  const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);
  
  // Modal state for selecting sellers to compare
  const [showCompareChooser, setShowCompareChooser] = useState(false);
  const [showReverseAuctionModal, setShowReverseAuctionModal] = useState(false);

  // Technical Evaluation state
  const [selectedForTechEval, setSelectedForTechEval] = useState<any | null>(null);
  const [isCompletingTechEval, setIsCompletingTechEval] = useState(false);
  const [isOpeningFinancialEval, setIsOpeningFinancialEval] = useState(false);

  const isTwoPacketMode = React.useMemo(() => {
    if (!bid) return false;
    const b: any = bid;
    if (b.packetType === 'SINGLE_PACKET' || b.technicalPacket?.schedule?.packetType === 'Single') {
      return false;
    }
    return (
      b.packetType === 'TWO_PACKET' ||
      b.evaluationType === 'TWO_PACKET' ||
      b.tenderType?.includes('TWO') ||
      b.packetCount === 2 ||
      b.stageType === 'TWO_STAGE' ||
      b.bidType?.includes('TWO') ||
      b.technicalPacket?.packetType === 'TWO_PACKET' ||
      b.technicalPacket?.schedule?.packetType === 'Two' ||
      b.technicalPacket?.schedule?.packetType === 'Two-Packet'
    );
  }, [bid]);

  const isTechEvalCompleted = React.useMemo(() => {
    if (!bid) return false;
    const rawStatus = String((bid as any).status || '').toUpperCase();
    const rawStage = String((bid as any).lifecycleStage || '').toUpperCase();
    return (
      rawStatus === 'TECHNICAL_EVALUATION_COMPLETED' ||
      rawStage === 'TECHNICAL_EVALUATION_COMPLETED' ||
      [
        'FINANCIAL_EVALUATION',
        'L1_GENERATED',
        'AWARD_RECOMMENDED',
        'AWARDED',
        'PO_GENERATED',
      ].includes(rawStatus)
    );
  }, [bid]);

  const isFinancialEvalReady = React.useMemo(() => {
    if (!bid) return false;
    const rawStatus = String((bid as any).status || '').toUpperCase();
    const rawStage = String((bid as any).lifecycleStage || '').toUpperCase();
    return rawStatus === 'TECHNICAL_EVALUATION_COMPLETED' || rawStage === 'TECHNICAL_EVALUATION_COMPLETED';
  }, [bid]);

  const isFinancialEvalOpened = React.useMemo(() => {
    if (!bid) return false;
    const rawStatus = String((bid as any).status || '').toUpperCase();
    return [
      'FINANCIAL_EVALUATION',
      'L1_GENERATED',
      'AWARD_RECOMMENDED',
      'AWARDED',
      'PO_GENERATED',
    ].includes(rawStatus);
  }, [bid]);

  const isBidAlreadyAwarded = React.useMemo(() => {
    if (!bid) return false;
    const rawStatus = String((bid as any).status || '').toUpperCase();
    const rawStage = String((bid as any).lifecycleStage || '').toUpperCase();
    return (
      ['AWARDED', 'PO_GENERATED', 'CLOSED', 'COMPLETED'].includes(rawStatus) ||
      ['AWARDED', 'PO_GENERATED', 'CLOSED', 'COMPLETED'].includes(rawStage) ||
      Boolean((bid as any).awards && (bid as any).awards.length > 0) ||
      ranking.some(r => r.resultStatus === 'Awarded' || String((r as any).finalStatus || '').toUpperCase() === 'AWARDED')
    );
  }, [bid, ranking]);

  const checkIsRowAwarded = React.useCallback((row: BidResultRow) => {
    if (row.resultStatus === 'Awarded') return true;
    if (String(row.finalStatus || '').toUpperCase() === 'AWARDED') return true;
    if (String(row.rawParticipation?.finalStatus || '').toUpperCase() === 'AWARDED') return true;
    if (Array.isArray(bid?.awards) && bid.awards.length > 0) {
      const partId = Number(row.participationId || row.id);
      const sellerId = Number(row.sellerId || row.rawParticipation?.sellerId || row.rawParticipation?.sellerUserId);
      return bid.awards.some((a: any) =>
        (partId && Number(a.participationId) === partId) ||
        (sellerId && Number(a.sellerId) === sellerId)
      );
    }
    return false;
  }, [bid]);

  const techEvaluationStats = React.useMemo(() => {
    const total = ranking.length;
    const qualified = ranking.filter(
      (r) => r.technicalStatus === 'Qualified',
    ).length;
    const disqualified = ranking.filter(
      (r) => r.technicalStatus === 'Disqualified',
    ).length;
    const pending = ranking.filter(
      (r) => r.technicalStatus !== 'Qualified' && r.technicalStatus !== 'Disqualified',
    ).length;
    return {
      total,
      qualified,
      disqualified,
      pending,
      isComplete: total > 0 && pending === 0,
    };
  }, [ranking]);

  const handleCompleteTechnicalEvaluation = async () => {
    if (isTechEvalCompleted) {
      toast.info('Technical evaluation is already finalized.');
      return;
    }
    if (techEvaluationStats.pending > 0) {
      toast.error(
        `Cannot complete technical evaluation: ${techEvaluationStats.pending} vendor(s) are still pending evaluation.`,
      );
      return;
    }
    if (techEvaluationStats.qualified === 0) {
      toast.error(
        'At least one vendor must be technically qualified to proceed to Stage 2.',
      );
      return;
    }
    setIsCompletingTechEval(true);
    try {
      await postApi(
        `/api/buyer/procurement-bids/${encodeURIComponent(bidId)}/complete-technical-evaluation`,
        {},
      );
      toast.success(
        'Stage 1 Technical Evaluation completed successfully! You can now open Stage 2 financial ranking.',
      );
      await loadBid();
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.message ||
          'Failed to finalize technical evaluation. Please check server logs.',
      );
    } finally {
      setIsCompletingTechEval(false);
    }
  };

  const handleOpenFinancialEvaluation = async () => {
    setIsOpeningFinancialEval(true);
    try {
      await postApi(
        `/api/buyer/procurement-bids/${encodeURIComponent(bidId)}/open-financial-evaluation`,
        {},
      );
      toast.success(
        'Stage 2 Financial Evaluation opened successfully! L1/L2/L3 commercial ranking generated.',
      );
      await loadBid();
    } catch (err: any) {
      console.error(err);
      toast.error(
        err?.message ||
          'Failed to open financial evaluation. Please check server logs.',
      );
    } finally {
      setIsOpeningFinancialEval(false);
    }
  };

  const [awardModal, setAwardModal] = useState<{
    show: boolean;
    row: BidResultRow | null;
    remarks: string;
    submitting: boolean;
  }>({
    show: false,
    row: null,
    remarks: '',
    submitting: false,
  });

  const handleDownloadQuotationPdf = async (result: any) => {
    if (!result) return;
    try {
      const engine = new PdfEngine('p');
      const quotedAmt = Number(result.quotedAmount || result.totalAmount || result.totalPrice || result.details?.quotedAmount || 0);
      const gst = Number(result.gstPercentage || result.details?.gstPercentage || 0);
      const totalAmt = Number(result.totalAmount || result.totalPrice || result.details?.totalAmount || quotedAmt);
      const qty = result.offeredQuantity || result.details?.offeredQuantity || 1;

      const sellerLogo = result.sellerLogo || result.details?.logoUrl || result.details?.sellerLogo || undefined;
      const sellerSignature = result.signatureUrl || result.details?.signatureUrl || undefined;
      const sellerStamp = result.stampUrl || result.details?.stampUrl || undefined;
      const sellerOrgName = result.details?.organizationName || result.sellerName || 'N/A';

      const doc = await engine.generate({
        documentTitle: 'SUPPLIER QUOTATION RESPONSE',
        documentNumber: `QUOTE-${result.id || result.participationId || 'REF'}`,
        dateStr: formatDate(result.submittedAt),
        status: result.technicalStatus || 'Submitted',
        issuerName: sellerOrgName,
        issuerSubtitle: 'Supplier Quotation Submission',
        issuerLogo: sellerLogo,
        parties: [
          {
            title: 'BUYER ORGANIZATION',
            name: (bid as any)?.buyerOrganization || (bid as any)?.buyerOrganizationName || bid?.buyer?.name || 'N/A',
            details: [
              `Requirement / Bid ID: ${bidId || 'N/A'}`,
              `Procurement Title: ${bid?.title || 'N/A'}`,
            ],
          },
          {
            title: 'SUPPLIER / QUOTING ORGANIZATION',
            name: sellerOrgName,
            address: result.sellerAddress || result.details?.address || undefined,
            email: result.sellerEmail && result.sellerEmail !== 'Not provided' ? result.sellerEmail : undefined,
            phone: result.sellerMobile && result.sellerMobile !== 'Not listed' ? result.sellerMobile : undefined,
            details: [
              `Contact Person: ${result.contactPerson || result.details?.contactPerson || 'N/A'}`,
              `Submitted Date: ${formatDateTime(result.submittedAt)}`,
            ],
          },
        ],
        infoGrid: {
          'Make / Brand': result.makeBrand || result.details?.makeBrand || 'N/A',
          'Model': result.model || result.details?.model || 'N/A',
          'Delivery Timeline': result.deliveryTimeline || result.details?.deliveryTimeline || 'N/A',
          'Offered Quantity': String(qty),
        },
        tableHeaders: ['#', 'Offered Item Description', 'Offered Qty', 'Quoted Rate', 'GST %', 'Total Amount'],
        tableData: [
          [
            '1',
            result.offeredItem || result.details?.offeredItemDescription || 'Procurement requirement',
            String(qty),
            quotedAmt ? moneyPdf(quotedAmt) : 'N/A',
            gst ? `${gst}%` : '0%',
            totalAmt ? moneyPdf(totalAmt) : 'N/A',
          ]
        ],
        financials: {
          subtotal: quotedAmt,
          totalTax: totalAmt - quotedAmt > 0 ? totalAmt - quotedAmt : undefined,
          grandTotal: totalAmt,
        },
        terms: [
          result.details?.complianceRemarks ? `Technical Compliance: ${result.details.complianceRemarks}` : '',
          result.details?.rfqNotes ? `Additional Notes: ${result.details.rfqNotes}` : '',
        ].filter(Boolean),
        signatures: {
          sellerTitle: 'Quoting Supplier Signature & Stamp',
          sellerName: result.contactPerson || result.sellerName || 'Authorized Signatory',
          sellerSignatureUrl: sellerSignature,
          sellerStampUrl: sellerStamp,
        },
        footerNote: 'MSME Enterprise Procurement Portal — Official Quotation Record',
      });

      doc.save(`Quotation_${(result.sellerName || 'Supplier').replace(/[^a-zA-Z0-9]/g, '_')}_${bidId}.pdf`);
      toast.success('Quotation PDF downloaded successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to generate Quotation PDF');
    }
  };

  const loadBid = React.useCallback(async () => {
    let alive = true;
    setLoading(true);
    setError('');

    try {
      // Execute primary bid detail fetch and fallback endpoints concurrently in parallel!
      const [bidRes, fallbackRes1, fallbackRes2, fallbackRes3] = await Promise.allSettled([
        procurementBidApi.getBidResults(bidId),
        getApi(`/api/buyer/requirements/${encodeURIComponent(bidId)}/responses`, true),
        getApi(`/api/buyer/procurement-bids/${encodeURIComponent(bidId)}/participants`, true),
        getApi(`/api/marketplace/requirements/${encodeURIComponent(bidId)}/responses`, true),
      ]);

      let data: any = bidRes.status === 'fulfilled' ? bidRes.value : null;

      // If data has participations but no results, map participations to results
      // Helper function to map a participation/response list to standardized BidResultRow[]
      const mapItemsToResults = (items: any[]) => {
        // Sort items by price ascending so L1 is guaranteed to be the lowest bidder
        const sortedItems = [...items].sort((a: any, b: any) => {
          const ackDataA = typeof a.acknowledgement === 'string' ? (() => { try { return JSON.parse(a.acknowledgement); } catch { return {}; } })() : (a.acknowledgement && typeof a.acknowledgement === 'object' ? a.acknowledgement : {});
          const ackDataB = typeof b.acknowledgement === 'string' ? (() => { try { return JSON.parse(b.acknowledgement); } catch { return {}; } })() : (b.acknowledgement && typeof b.acknowledgement === 'object' ? b.acknowledgement : {});
          const respDataA = typeof a.responseData === 'string' ? (() => { try { return JSON.parse(a.responseData); } catch { return {}; } })() : (a.responseData && typeof a.responseData === 'object' ? a.responseData : {});
          const respDataB = typeof b.responseData === 'string' ? (() => { try { return JSON.parse(b.responseData); } catch { return {}; } })() : (b.responseData && typeof b.responseData === 'object' ? b.responseData : {});

          const priceA = Number(a.offeredPrice || a.quotedAmount || a.totalAmount || a.totalPrice || ackDataA.quotedAmount || ackDataA.totalAmount || respDataA.offeredPrice || respDataA.quotedAmount || respDataA.totalAmount || 0);
          const priceB = Number(b.offeredPrice || b.quotedAmount || b.totalAmount || b.totalPrice || ackDataB.quotedAmount || ackDataB.totalAmount || respDataB.offeredPrice || respDataB.quotedAmount || respDataB.totalAmount || 0);

          if (priceA > 0 && priceB > 0 && priceA !== priceB) return priceA - priceB;
          if (priceA > 0 && priceB <= 0) return -1;
          if (priceB > 0 && priceA <= 0) return 1;
          return new Date(a.submittedAt || a.createdAt || 0).getTime() - new Date(b.submittedAt || b.createdAt || 0).getTime();
        });

        return sortedItems.map((r: any, idx: number) => {
          const ackData = typeof r.acknowledgement === 'string'
            ? (() => { try { return JSON.parse(r.acknowledgement); } catch { return {}; } })()
            : (r.acknowledgement && typeof r.acknowledgement === 'object' ? r.acknowledgement : {});
          const respData = typeof r.responseData === 'string'
            ? (() => { try { return JSON.parse(r.responseData); } catch { return {}; } })()
            : (r.responseData && typeof r.responseData === 'object' ? r.responseData : {});
          const quotedAmt = Number(r.offeredPrice || r.quotedAmount || r.totalAmount || r.totalPrice || ackData.quotedAmount || ackData.totalAmount || respData.offeredPrice || respData.quotedAmount || respData.totalAmount || 0);
          const sellerOrg = r.sellerOrgName
            || r.sellerOrganization?.organizationName
            || r.seller?.organization?.organizationName
            || r.seller?.sellerProfile?.organizationName
            || r.sellerProfile?.organizationName
            || r.companyName
            || r.sellerName
            || r.sellerUser?.name
            || r.seller?.name
            || (r.sellerUserId || r.sellerId ? `Supplier #${r.sellerUserId || r.sellerId}` : `Supplier ${idx + 1}`);
          const contactPerson = r.contactPerson || r.sellerName || r.sellerUser?.name || r.seller?.name || 'Representative';

          const lineItems = (Array.isArray(r.lineItems) && r.lineItems.length > 0)
            ? r.lineItems
            : (Array.isArray(ackData.lineItems) && ackData.lineItems.length > 0)
            ? ackData.lineItems
            : (Array.isArray(ackData.lineQuotes) && ackData.lineQuotes.length > 0)
            ? ackData.lineQuotes
            : (Array.isArray(ackData.items) && ackData.items.length > 0)
            ? ackData.items
            : (Array.isArray(respData.lineItems) && respData.lineItems.length > 0)
            ? respData.lineItems
            : (Array.isArray(respData.lineQuotes) && respData.lineQuotes.length > 0)
            ? respData.lineQuotes
            : [];

          const docs = normalizeQuotationDocuments({
            ...r,
            acknowledgement: ackData,
            responseData: respData,
          });

          const totalQty = lineItems.reduce((acc: number, item: any) => acc + (Number(item.quantity) || 0), 0);
          const offeredQuantity = r.offeredQuantity || ackData.offeredQuantity || respData.offeredQuantity || (totalQty > 0 ? totalQty : (r.quantity || 1));

          return {
            id: r.id || `res-${idx}`,
            participationId: r.id || idx + 1,
            sellerId: r.sellerId || r.sellerUserId || r.seller?.id || r.sellerUser?.id,
            sellerName: sellerOrg,
            contactPerson: contactPerson,
            sellerEmail: r.sellerEmail || r.sellerUser?.email || r.seller?.email || 'Not provided',
            sellerMobile: r.sellerMobile || r.sellerUser?.mobile || r.seller?.mobile || 'Not listed',
            submittedAt: r.createdAt || r.submittedAt,
            sellerType: 'Verified Seller',
            offeredItem: r.offeredItemDescription || r.message || respData.message || respData.coverNote || r.itemName || 'Procurement requirement',
            makeBrand: r.makeBrand || ackData.makeBrand || respData.makeBrand || 'Standard',
            model: r.model || ackData.model || respData.model || 'Standard',
            technicalStatus: (() => {
              const rawTech = String(
                r.technicalStatus ||
                r.status ||
                r.submissionStatus ||
                ackData.technicalStatus ||
                respData.technicalStatus ||
                ''
              ).toUpperCase();
              if (rawTech === 'QUALIFIED' || rawTech === 'SHORTLISTED' || rawTech === 'ACCEPTED') return 'Qualified';
              if (rawTech === 'DISQUALIFIED' || rawTech === 'REJECTED') return 'Disqualified';
              return 'Pending';
            })(),
            technicalRemarks: r.technicalRemarks || ackData.technicalRemarks || respData.technicalRemarks || '',
            score: r.score ?? r.technicalScore ?? ackData.score ?? respData.score,
            totalPrice: quotedAmt,
            quotedAmount: quotedAmt,
            gstPercentage: Number(r.gstPercentage || ackData.gstPercentage || respData.gstPercentage || 0),
            totalAmount: quotedAmt,
            offeredQuantity,
            deliveryTimeline: r.deliveryTimeline || ackData.deliveryTimeline || respData.deliveryTimeline || 'Standard',
            documents: docs,
            lineItems: lineItems,
            acknowledgement: ackData,
            message: r.message || respData.message || respData.coverNote || r.offeredItemDescription || '',
            terms: r.terms || ackData.terms || respData.terms || '',
            attachmentUrl: r.attachmentUrl || ackData.attachmentUrl || respData.attachmentUrl || '',
            responseData: respData,
            rawParticipation: r,
            finalRank: `L${idx + 1}`,
            finalStatus: r.finalStatus,
            resultStatus: (() => {
              const isItemAwarded =
                r.finalStatus === 'AWARDED' ||
                (Array.isArray(data?.awards) && data.awards.some((a: any) =>
                  Number(a.participationId) === Number(r.id) ||
                  (a.sellerId && Number(a.sellerId) === Number(r.sellerId || r.sellerUserId || r.seller?.id || r.sellerUser?.id))
                ));
              if (isItemAwarded) return 'Awarded';
              if (r.finalStatus === 'NOT_SELECTED' || r.finalStatus === 'REJECTED') return 'Not Selected';
              return 'Responsive';
            })(),
            details: {
              organizationName: sellerOrg,
              contactPerson: contactPerson,
              email: r.sellerEmail || r.sellerUser?.email || r.seller?.email || '',
              mobile: r.sellerMobile || r.sellerUser?.mobile || r.seller?.mobile || '',
              submittedAt: r.createdAt || r.submittedAt,
              deliveryTimeline: r.deliveryTimeline || ackData.deliveryTimeline || respData.deliveryTimeline || 'Standard',
              complianceRemarks: r.complianceRemarks || ackData.complianceRemarks || 'Compliant',
              rfqNotes: r.message || respData.message || r.offeredItemDescription || '',
              terms: r.terms || ackData.terms || respData.terms || '',
              message: r.message || respData.message || respData.coverNote || r.offeredItemDescription || '',
              attachmentUrl: r.attachmentUrl || ackData.attachmentUrl || respData.attachmentUrl || '',
              quotedAmount: quotedAmt,
              totalAmount: quotedAmt,
              offeredQuantity,
              lineItems: lineItems,
              documents: docs,
              technicalStatus: (() => {
                const rawTech = String(
                  r.technicalStatus ||
                  r.status ||
                  r.submissionStatus ||
                  ackData.technicalStatus ||
                  respData.technicalStatus ||
                  ''
                ).toUpperCase();
                if (rawTech === 'QUALIFIED' || rawTech === 'SHORTLISTED' || rawTech === 'ACCEPTED') return 'Qualified';
                if (rawTech === 'DISQUALIFIED' || rawTech === 'REJECTED') return 'Disqualified';
                return 'Pending';
              })(),
              technicalRemarks: r.technicalRemarks || ackData.technicalRemarks || respData.technicalRemarks || '',
              score: r.score ?? r.technicalScore ?? ackData.score ?? respData.score,
            }
          };
        });
      };

      // If data has participations but no results, map participations to results
      if (data && Array.isArray(data.participations) && data.participations.length > 0 && (!Array.isArray(data.results) || data.results.length === 0)) {
        data.results = mapItemsToResults(data.participations);
      }

      // If data is still missing entirely (e.g. legacy requirement URL), try direct fallbacks for bidId only
      if (!data) {
        const fallbacks = [fallbackRes1, fallbackRes2, fallbackRes3];
        for (const f of fallbacks) {
          if (f.status === 'fulfilled' && f.value) {
            const reqRes: any = f.value;
            const reqItems = reqRes?.responses || reqRes?.participants || reqRes?.participations || reqRes?.items || reqRes?.data || (Array.isArray(reqRes) ? reqRes : []);
            if (Array.isArray(reqItems) && reqItems.length > 0) {
              const mappedResults = mapItemsToResults(reqItems);
              data = {
                ...(data || {}),
                id: reqRes?.requirement?.requirementNumber || data?.id || bidId,
                title: reqRes?.requirement?.title || data?.title || `Requirement ${bidId}`,
                status: reqRes?.requirement?.status || data?.status || 'OPEN',
                results: mappedResults,
                participations: mappedResults
              };
              break;
            }
          }
        }
      }

      if (!alive) return;

      if (!data) {
        setError('Unable to load bid evaluation result.');
        setLoading(false);
        return;
      }

      setBid(data);
      const normalizedResults = (data.results || []).map((r: any, idx: number) => {
        const rawTech = String(
          r.technicalStatus ||
          r.status ||
          r.submissionStatus ||
          r.acknowledgement?.technicalStatus ||
          r.responseData?.technicalStatus ||
          r.details?.technicalStatus ||
          ''
        ).toUpperCase();
        const isQualified = rawTech === 'QUALIFIED' || rawTech === 'SHORTLISTED' || rawTech === 'ACCEPTED';
        const isDisqualified = rawTech === 'DISQUALIFIED' || rawTech === 'REJECTED';
        const techStatus = isQualified ? 'Qualified' : isDisqualified ? 'Disqualified' : 'Pending';

        const isItemAwarded =
          r.resultStatus === 'Awarded' ||
          String(r.finalStatus || '').toUpperCase() === 'AWARDED' ||
          String(r.rawParticipation?.finalStatus || '').toUpperCase() === 'AWARDED' ||
          Boolean(data?.awards?.some((a: any) =>
            Number(a.participationId) === Number(r.participationId || r.id) ||
            (a.sellerId && Number(a.sellerId) === Number(r.sellerId || r.rawParticipation?.sellerId || r.rawParticipation?.sellerUserId))
          ));

        return {
          ...r,
          technicalStatus: r.technicalStatus === 'Qualified' || r.technicalStatus === 'Disqualified' ? r.technicalStatus : techStatus,
          resultStatus: isItemAwarded
            ? 'Awarded'
            : (r.resultStatus && r.resultStatus !== 'Awarded'
                ? r.resultStatus
                : (isDisqualified ? 'Ineligible' : 'Responsive')),
          rawParticipation: r.rawParticipation || r,
        };
      });
      const sorted = [...normalizedResults].sort((a, b) => {
        const rankA = a.finalRank === 'NA' ? 999 : Number(String(a.finalRank).slice(1));
        const rankB = b.finalRank === 'NA' ? 999 : Number(String(b.finalRank).slice(1));
        if (!isNaN(rankA) && !isNaN(rankB) && rankA !== rankB) return rankA - rankB;
        return (a.totalPrice || Number.MAX_SAFE_INTEGER) - (b.totalPrice || Number.MAX_SAFE_INTEGER);
      });
      setRanking(sorted);
    } catch (err: any) {
      if (!alive) return;
      setError(err instanceof Error ? err.message : 'Unable to load bid evaluation result.');
    } finally {
      if (alive) setLoading(false);
    }
  }, [bidId]);

  useEffect(() => {
    loadBid();
  }, [loadBid]);

  const toggleSellerSelection = (participationId: number) => {
    if (!participationId) return;
    setSelectedForCompare(prev => 
      prev.includes(participationId) 
        ? prev.filter(id => id !== participationId)
        : [...prev, participationId]
    );
  };

  const tableColumns = React.useMemo<ColumnDef<BidResultRow>[]>(() => [
    {
      key: 'select',
      header: 'Select',
      width: 'w-10',
      align: 'center',
      cell: (row, idx) => {
        const partId = row.participationId || idx + 1;
        const isSelected = selectedForCompare.includes(partId);
        return (
          <button
            type="button"
            onClick={() => toggleSellerSelection(partId)}
            className="text-slate-400 hover:text-blue-600 transition p-1"
            aria-label={isSelected ? `Deselect ${row.sellerName} for comparison` : `Select ${row.sellerName} for comparison`}
          >
            {isSelected ? (
              <CheckSquare className="h-4.5 w-4.5 text-blue-600 fill-blue-50" />
            ) : (
              <Square className="h-4.5 w-4.5 text-slate-300 hover:text-slate-400" />
            )}
          </button>
        );
      }
    },
    {
      key: 'seller',
      header: 'Rank & Supplier',
      sortable: true,
      sortKey: 'seller',
      cell: (row) => {
        const sellerOrg = row.details?.organizationName || (row.seller as any)?.organization?.organizationName || row.sellerName || 'Supplier';
        const contactPerson = row.contactPerson || row.details?.contactPerson || row.sellerName || 'Representative';
        const email = row.sellerEmail && row.sellerEmail !== 'Not provided' 
          ? row.sellerEmail 
          : (row.details?.sellerEmail || row.details?.email || (row.seller as any)?.email || 'Not provided');
        const mobile = row.sellerMobile && row.sellerMobile !== 'Not listed' 
          ? row.sellerMobile 
          : (row.details?.sellerMobile || row.details?.mobile || (row.seller as any)?.mobile || 'Not listed');
        const rank = row.finalRank;
        const isL1 = rank === 'L1';
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {rank && rank !== 'NA' && (
                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                  isL1 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-2xs' 
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}>
                  {isL1 && <Trophy className="h-3 w-3 text-emerald-600 inline" />} {rank}
                </span>
              )}
              <span className="font-black text-slate-900 uppercase text-xs tracking-tight">{sellerOrg}</span>
            </div>
            <div className="text-[11px] font-bold text-slate-500">👤 {contactPerson}</div>
            <div className="text-[10px] text-slate-400 font-medium flex flex-wrap items-center gap-x-2">
              <span>✉️ {email}</span>
              {mobile && mobile !== 'Not listed' && <span>📞 {mobile}</span>}
            </div>
          </div>
        );
      }
    },
    {
      key: 'date',
      header: 'Submission Date',
      sortable: true,
      sortKey: 'date',
      width: 'w-36',
      cell: (row) => {
        const rawDate = row.submittedAt || row.details?.submittedAt || (row as any).createdAt || (row.details as any)?.createdAt;
        const submissionTime = rawDate ? formatDateTime(rawDate) : 'Submitted';
        return (
          <div className="flex items-center gap-1.5 text-slate-600 font-semibold text-xs whitespace-nowrap">
            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>{submissionTime}</span>
          </div>
        );
      }
    },
    {
      key: 'item',
      header: 'Offered Item / Make',
      sortable: true,
      sortKey: 'item',
      cell: (row) => (
        <div>
          <div className="font-bold text-slate-800 text-xs leading-snug">{row.offeredItem}</div>
          <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
            {row.makeBrand && row.makeBrand !== 'As quoted' ? `Make: ${row.makeBrand}` : 'Standard Make'} 
            {row.model && row.model !== 'Standard' ? ` • Model: ${row.model}` : ''}
          </div>
        </div>
      )
    },
    {
      key: 'attachments',
      header: 'Attachments',
      sortable: true,
      sortKey: 'attachments',
      width: 'w-32',
      cell: (row) => {
        const docCount = row.documents ? row.documents.length : 0;
        const itemCount = row.details?.lineItems?.length || 1;
        return (
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
            <span className="inline-flex items-center rounded-md bg-slate-100 text-slate-700 px-2 py-0.5">
              📄 {docCount} Doc{docCount === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5">
              📦 {itemCount} Item{itemCount === 1 ? '' : 's'}
            </span>
          </div>
        );
      }
    },
    {
      key: 'totalPrice',
      header: 'Quoted Total',
      sortable: true,
      sortKey: 'totalPrice',
      align: 'right',
      width: 'w-32',
      cellClassName: 'text-right',
      headerClassName: 'text-right',
      cell: (row) => (
        <span className="font-black text-slate-900 text-xs">
          {row.totalPrice ? money(row.totalPrice) : 'Pending'}
        </span>
      )
    },
    {
      key: 'technicalStatus',
      header: 'Technical Status',
      sortable: true,
      sortKey: 'technicalStatus',
      width: 'w-44',
      cell: (row) => {
        const isQualified = row.technicalStatus === 'Qualified';
        const isDisqualified = row.technicalStatus === 'Disqualified';
        const isPending = !isQualified && !isDisqualified;
        return (
          <div className="flex flex-col gap-1 items-start">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                isQualified
                  ? 'bg-emerald-100 border border-emerald-300 text-emerald-800'
                  : isDisqualified
                    ? 'bg-rose-100 border border-rose-300 text-rose-800'
                    : 'bg-amber-100 border border-amber-300 text-amber-800'
              }`}
            >
              {isQualified && <CheckCircle2 className="h-3 w-3" />}
              {isDisqualified && <X className="h-3 w-3" />}
              {isPending && <Clock className="h-3 w-3" />}
              {row.technicalStatus || 'Pending'}
            </span>
            {isBidAlreadyAwarded ? (
              <button
                type="button"
                onClick={() => setSelectedForTechEval((row as any).rawParticipation || row)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:underline transition cursor-pointer"
                title="View finalized technical evaluation (read-only audit record)"
              >
                <Eye className="h-3 w-3 text-slate-500" />
                View Evaluation
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedForTechEval((row as any).rawParticipation || row)}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 underline transition cursor-pointer"
              >
                <FileText className="h-3 w-3" />
                {isPending ? 'Evaluate Technical Bid' : 'Edit Evaluation'}
              </button>
            )}
          </div>
        );
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: 'w-60',
      cellClassName: 'text-right',
      headerClassName: 'text-right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setSelectedResult(row)}
            className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-250 bg-white hover:bg-slate-50 text-slate-700 px-2.5 text-[10px] font-bold transition shadow-2xs cursor-pointer"
            title="View Quotation Breakdown"
          >
            <Eye className="h-3.5 w-3.5 text-slate-500" /> Details
          </button>
          <button
            onClick={() => handleDownloadQuotationPdf(row)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-250 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs cursor-pointer"
            title="Download Quotation PDF"
            aria-label={`Download Quotation PDF for ${row.sellerName}`}
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          {checkIsRowAwarded(row) ? (
            <span className="inline-flex h-8 items-center gap-1 rounded-xl bg-emerald-100 px-2.5 text-[10px] font-black text-emerald-800 uppercase tracking-wide">
              <CheckCircle2 className="h-3.5 w-3.5" /> Awarded
            </span>
          ) : row.technicalStatus === 'Disqualified' ? (
            <span className="inline-flex h-8 items-center rounded-xl bg-slate-100 border border-slate-200 text-slate-500 px-2 text-[10px] font-semibold" title="Ineligible for award due to technical disqualification">
              Ineligible for Award
            </span>
          ) : isBidAlreadyAwarded ? (
            <span className="inline-flex h-8 items-center rounded-xl bg-slate-100 border border-slate-200 text-slate-500 px-2.5 text-[10px] font-semibold">
              Not Selected
            </span>
          ) : (
            <button
              onClick={() => {
                if (row.technicalStatus === 'Disqualified') {
                  toast.error('Cannot award to a technically disqualified supplier.');
                  return;
                }
                setAwardModal({ show: true, row, remarks: '', submitting: false });
              }}
              className="inline-flex h-8 items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 text-[10px] font-black transition shadow-2xs cursor-pointer"
            >
              Accept & PO
            </button>
          )}
        </div>
      )
    }
  ], [selectedForCompare, bid, isBidAlreadyAwarded, checkIsRowAwarded]);

  const handleCompareClick = () => {
    if (selectedForCompare.length >= 2) {
      router.push(`/bids/${bidId}/compare?ids=${selectedForCompare.join(',')}`);
    } else {
      setShowCompareChooser(true);
    }
  };

  const handleConfirmAward = async () => {
    if (!awardModal.row || !bid) return;
    setAwardModal(prev => ({ ...prev, submitting: true }));
    try {
      await procurementBidApi.recommendAward(bid.id, {
        participationId: awardModal.row.participationId || (awardModal.row as any).id || 0,
        remarks: awardModal.remarks || 'Accepted quotation and generated purchase order.',
      });
      toast.success('Award created & Purchase Order generated successfully!');
      setAwardModal({ show: false, row: null, remarks: '', submitting: false });
      loadBid();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate Purchase Order.');
      setAwardModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const handleSelectResult = (row: any) => {
    setSelectedResult(row);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const qId = String(row.id || row.participationId || '');
      if (qId) {
        url.searchParams.set('quoteId', qId);
        window.history.pushState({}, '', url.toString());
      }
    }
  };

  const handleBackFromQuotationDetail = () => {
    setSelectedResult(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('quoteId');
      window.history.pushState({}, '', url.toString());
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && ranking.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const quoteId = params.get('quoteId');
      if (quoteId) {
        const match = ranking.find(
          r => String((r as any).id) === quoteId || String(r.participationId) === quoteId
        );
        if (match) {
          setSelectedResult(match);
        }
      }
    }
  }, [ranking]);

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const quoteId = params.get('quoteId');
        if (!quoteId) {
          setSelectedResult(null);
        } else if (ranking.length > 0) {
          const match = ranking.find(
            r => String((r as any).id) === quoteId || String(r.participationId) === quoteId
          );
          if (match) setSelectedResult(match);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [ranking]);

  if (loading) {
    return (
      <PageShell>
        <main className="mx-auto w-full max-w-[1560px] px-4 py-6">
          <ComparisonMatrixSkeleton />
        </main>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <main className="mx-auto w-full max-w-7xl px-4 py-6">
          <ProcurementHero title="Bid Result and Financial Ranking" subtitle={bidId || 'Requested bid'} action={<Link href="/bids" className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-xs font-black text-slate-700">Back to bids</Link>} />
          <div className="mt-5"><ProcurementErrorState message={error} onRetry={loadBid} /></div>
        </main>
      </PageShell>
    );
  }

  if (!bid) {
    return (
      <PageShell>
        <main className="mx-auto w-full max-w-7xl px-4 py-6">
          <ProcurementHero title="Bid Result and Financial Ranking" subtitle={bidId || 'Requested bid'} action={<Link href="/bids" className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-xs font-black text-slate-700">Back to bids</Link>} />
          <div className="mt-5"><ProcurementEmptyState title="No bid results available currently." message="This bid was not returned by the live backend." /></div>
        </main>
      </PageShell>
    );
  }

  const closingDeadlineRaw =
    (bid as any).deadlineDate ||
    (bid as any).submissionDeadline ||
    (bid as any).closingDate ||
    (bid as any).bidClosingDate ||
    (bid as any).technicalPacket?.deadlineDate ||
    (bid as any).technicalPacket?.dates?.submissionClosingDate ||
    (bid as any).technicalPacket?.dates?.submissionDeadline ||
    (bid as any).payload?.dates?.submissionDeadline ||
    (bid as any).payload?.basics?.submissionDeadline;

  const isBiddingOpen = (() => {
    const rawStatus = String(bid.status || '').toUpperCase();
    const isClosedStatus = [
      'CLOSED',
      'TECHNICAL_EVALUATION',
      'FINANCIAL_EVALUATION',
      'L1_GENERATED',
      'AWARD_RECOMMENDED',
      'AWARDED',
      'COMPLETED',
      'EXPIRED',
    ].includes(rawStatus);

    if (isClosedStatus) return false;

    if (closingDeadlineRaw) {
      const d = new Date(closingDeadlineRaw);
      if (!isNaN(d.getTime())) {
        return d.getTime() > Date.now();
      }
    }

    return ['OPEN', 'ACTIVE', 'PUBLISHED'].includes(rawStatus);
  })();

  if (isBiddingOpen) {
    const formattedDeadline = closingDeadlineRaw
      ? formatDateTime(closingDeadlineRaw)
      : 'the closing date';
    const totalResponses = ranking.length;

    return (
      <PageShell>
        <main className="mx-auto w-full max-w-4xl px-4 py-10 space-y-6">
          <ProcurementHero
            title="Bid Evaluation & Results"
            subtitle={`${bid.id} • ${bid.title || 'Procurement'}`}
            action={
              <Link
                href={`/bids/${bid.id}`}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              >
                Back to Bid Details
              </Link>
            }
          />

          <div className="rounded-3xl border border-indigo-150 bg-gradient-to-b from-indigo-50/70 via-white to-white p-6 sm:p-10 text-center shadow-sm space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
              <ShieldCheck className="h-8 w-8" />
            </div>

            <div className="max-w-xl mx-auto space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-200 px-3 py-1 text-xs font-black text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Bidding Currently Open
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Sealed Quotations Protected
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                In strict compliance with sealed-bid procurement regulations and standard vigilance guidelines, supplier quotations and commercial rates remain sealed and confidential until the bidding submission window concludes.
              </p>
            </div>

            <div className="mx-auto max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              <div className="rounded-2xl border border-slate-150 bg-white p-4 shadow-2xs space-y-1">
                <span className="text-[10.5px] font-bold text-slate-400 uppercase">Submission Deadline</span>
                <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-indigo-600" />
                  {formattedDeadline}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-150 bg-white p-4 shadow-2xs space-y-1">
                <span className="text-[10.5px] font-bold text-slate-400 uppercase">Sealed Submissions</span>
                <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5 text-emerald-600" />
                  {totalResponses > 0 ? `${totalResponses} Quotation${totalResponses === 1 ? '' : 's'} Received (Sealed)` : 'Awaiting Supplier Quotations'}
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`/bids/${bid.id}`}
                className="w-full sm:w-auto inline-flex h-10 items-center justify-center rounded-xl bg-[#0b2447] hover:bg-[#12335f] px-6 text-xs font-black text-white transition shadow-sm"
              >
                Return to Procurement Overview
              </Link>
            </div>
          </div>
        </main>
      </PageShell>
    );
  }

  // Render dedicated Full View Page when a quotation is selected
  if (selectedResult) {
    return (
      <PageShell>
        <SupplierQuotationDetailView
          result={selectedResult}
          bid={bid}
          bidId={bidId}
          onBack={handleBackFromQuotationDetail}
          onAcceptAndGeneratePo={(res) => setAwardModal({ show: true, row: res, remarks: '', submitting: false })}
          onDownloadPdf={(res) => handleDownloadQuotationPdf(res)}
        />

        {/* Award & PO Generation Confirmation Modal */}
        {awardModal.show && awardModal.row && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg rounded-3xl border border-slate-150 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-sm">Generate Purchase Order</span>
                  <h3 className="text-base font-black text-slate-900 mt-1">Accept Quotation & Award Bid</h3>
                </div>
                <button
                  onClick={() => setAwardModal({ show: false, row: null, remarks: '', submitting: false })}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="py-4 space-y-4 text-xs">
                <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Selected Supplier:</span>
                    <span className="font-black text-slate-900">{awardModal.row.sellerName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Evaluated Price:</span>
                    <span className="font-black text-emerald-700 text-sm">{money(awardModal.row.totalPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-semibold">Rank:</span>
                    <span className="font-black text-slate-800">{awardModal.row.finalRank}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700">Award Remarks / PO Reference</label>
                  <textarea
                    rows={3}
                    value={awardModal.remarks}
                    onChange={(e) => setAwardModal(prev => ({ ...prev, remarks: e.target.value }))}
                    placeholder="Enter award justification or procurement notes (e.g., L1 verified and compliant)..."
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Accepting this quotation will officially award the procurement to <strong className="text-slate-700">{awardModal.row.sellerName}</strong>, mark the bid as awarded, and trigger automatic purchase order generation.
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAwardModal({ show: false, row: null, remarks: '', submitting: false })}
                  className="h-9 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={awardModal.submitting}
                  onClick={handleConfirmAward}
                  className="h-9 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-black text-white flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {awardModal.submitting ? (
                    'Generating PO...'
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Confirm & Generate PO
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </PageShell>
    );
  }

  return (
    <PageShell>
      <main className="mx-auto w-full max-w-7xl space-y-3 px-4 py-3 md:py-4">
        {/* Compact Header Card */}
        <section className="relative overflow-hidden rounded-xl border border-slate-200/90 bg-white px-4 py-3 md:px-5 md:py-3 shadow-2xs">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500" />
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between pt-0.5">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 select-none">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                MSME Procurement Control
              </span>
              <h1 className="text-base md:text-lg font-black tracking-tight text-slate-900 truncate">
                Bid Result and Financial Ranking
              </h1>
              <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                {bid.id}
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="text-xs md:text-sm font-semibold text-slate-700 truncate max-w-xs md:max-w-md" title={bid.title}>
                {bid.title}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {ranking.length >= 2 && (
                <button
                  type="button"
                  onClick={handleCompareClick}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 text-xs font-bold text-white shadow-2xs transition cursor-pointer"
                >
                  <Scale className="h-3.5 w-3.5" /> Compare Quotations {selectedForCompare.length > 0 && `(${selectedForCompare.length})`}
                </button>
              )}
              {ranking.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const rows = ranking.map(row => ({
                      sellerName: row.sellerName,
                      sellerType: row.sellerType,
                      offeredItem: row.offeredItem,
                      totalPrice: row.totalPrice,
                      rank: row.finalRank,
                      status: row.resultStatus
                    }));
                    downloadCsv(`${bid.id}-result.csv`, rows);
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 text-xs font-bold text-slate-700 transition shadow-2xs cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-slate-500" /> Export CSV
                </button>
              )}
              <Link
                href={`/bids/${bid.id}`}
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              >
                Back to bid
              </Link>
            </div>
          </div>
        </section>

        {/* 4-KPI Metric Strip (High Density) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-2xs flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Quotations</span>
              <div className="mt-0.5 text-base sm:text-lg font-black text-slate-900 leading-tight">{ranking.length}</div>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500 truncate">
                {ranking.length === 0 ? 'No responses yet' : `${ranking.length} seller quotation${ranking.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Users className="h-4 w-4" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-2xs flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Technical Scrutiny</span>
              <div className="mt-0.5 text-base sm:text-lg font-black text-slate-900 leading-tight">
                {ranking.length > 0 ? `${techEvaluationStats.qualified} Qualified` : '0 Qualified'}
              </div>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500 truncate">
                {ranking.length === 0
                  ? 'Awaiting vendor proposals'
                  : techEvaluationStats.pending > 0
                    ? `${techEvaluationStats.pending} pending review`
                    : `${techEvaluationStats.disqualified} disqualified • Completed`}
              </p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-2xs flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Lowest Quote (L1)</span>
              <div className="mt-0.5 text-base sm:text-lg font-black text-emerald-700 leading-tight truncate">
                {ranking.length > 0 && ranking[0]?.totalPrice ? money(ranking[0].totalPrice) : '—'}
              </div>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500 truncate">
                {ranking.length > 0 ? (ranking[0]?.sellerName || 'Leading quote') : 'Awaiting quotes'}
              </p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Trophy className="h-4 w-4" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-2xs flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Procurement Budget</span>
              <div className="mt-0.5 text-base sm:text-lg font-black text-slate-900 leading-tight truncate">
                {bid.estimatedValue ? money(bid.estimatedValue) : 'Confidential'}
              </div>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500 truncate">
                {(isTwoPacketMode ? 'Two-Packet' : 'Single-Packet')} • {bid.evaluationMethod || 'L1 Basis'}
              </p>
            </div>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Tag className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Empty State: Zero quotations submitted */}
        {ranking.length === 0 ? (
          <section className="rounded-xl border border-slate-200/90 bg-white p-6 sm:p-10 text-center shadow-2xs">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-slate-50 border border-slate-200/80 text-slate-400 mb-3 shadow-2xs">
              <FileText className="h-7 w-7 text-slate-400" />
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-0.5 text-xs font-bold text-amber-800 mb-2.5">
              <Clock className="h-3.5 w-3.5" /> Awaiting Seller Quotations
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">No Seller Quotations Submitted Yet</h2>
            <p className="mt-1.5 max-w-lg mx-auto text-xs text-slate-500 font-medium leading-relaxed">
              No suppliers have submitted quotations or technical proposals for this bid yet. Once sellers participate, their technical compliance documents, itemized pricing, and automated L1-L4 financial rankings will be displayed here for evaluation.
            </p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-xl mx-auto text-left">
              <div className="rounded-lg border border-slate-150 bg-slate-50/70 p-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Submission Closing</span>
                <span className="text-xs font-black text-slate-800 mt-0.5 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{bid.endDate ? formatDateTime(bid.endDate) : 'Open'}</span>
                </span>
              </div>
              <div className="rounded-lg border border-slate-150 bg-slate-50/70 p-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Evaluation Mode</span>
                <span className="text-xs font-black text-slate-800 mt-0.5 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{isTwoPacketMode ? '2-Packet Scrutiny' : 'Single-Packet'}</span>
                </span>
              </div>
              <div className="rounded-lg border border-slate-150 bg-slate-50/70 p-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimated Budget</span>
                <span className="text-xs font-black text-slate-800 mt-0.5 flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{bid.estimatedValue ? money(bid.estimatedValue) : 'Confidential'}</span>
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <Link
                href={`/bids/${bid.id}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 px-3.5 text-xs font-bold text-white shadow-xs transition"
              >
                <Eye className="h-3.5 w-3.5" /> View Bid Overview & Scope
              </Link>
              <Link
                href="/bids"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3.5 text-xs font-bold text-slate-700 transition"
              >
                Back to Bids
              </Link>
            </div>
          </section>
        ) : (
          /* Active Quotations Section */
          <section className="rounded-xl border border-slate-200/90 bg-white p-3.5 md:p-4 shadow-2xs space-y-3">
            {/* Header Controls Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-650 shadow-2xs">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                    SELLER QUOTATIONS & EVALUATION ({ranking.length})
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Review submitted seller quotations, technical packet compliance, and financial ranking.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex items-center rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    title="Grid view"
                    aria-label="Grid view"
                    className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${
                      viewMode === 'grid' 
                        ? 'bg-white text-blue-700 shadow-2xs font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <LayoutGrid className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    title="List view"
                    aria-label="List view"
                    className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${
                      viewMode === 'list' 
                        ? 'bg-white text-blue-700 shadow-2xs font-black' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <List className="h-3 w-3" />
                  </button>
                </div>

                {/* Reverse Auction Button */}
                {!isBidAlreadyAwarded && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isTwoPacketMode && techEvaluationStats.pending > 0) {
                        toast.error(
                          `Stage 1 Technical Evaluation is still pending for ${techEvaluationStats.pending} vendor(s). Please evaluate all vendors before starting Stage 2 Reverse Auction.`
                        );
                        return;
                      }
                      if (isTwoPacketMode && techEvaluationStats.qualified === 0) {
                        toast.error(
                          'No vendors are technically qualified. Reverse auction requires at least 1 qualified vendor.'
                        );
                        return;
                      }
                      setShowReverseAuctionModal(true);
                    }}
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-2.5 text-xs font-bold text-white transition shadow-2xs cursor-pointer"
                  >
                    <Gavel className="h-3 w-3" /> Start Reverse Auction
                  </button>
                )}

                <StatusBadge label={bid.status} />
              </div>
            </div>

            {/* Two-Packet Stage 1 Banner OR Single-Packet Finalization Strip */}
            {isTwoPacketMode ? (
              <div className="rounded-lg border border-indigo-200/90 bg-indigo-50/60 px-3.5 py-2 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-2xs shrink-0">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-indigo-950 uppercase tracking-wide">
                      Stage 1: Technical Scrutiny
                    </span>
                    <span className="rounded-full bg-indigo-100 border border-indigo-200 px-1.5 py-0.2 text-[9px] font-black text-indigo-800 uppercase">
                      2-Packet Mode
                    </span>
                    <span className="text-slate-300 hidden sm:inline">•</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                      <CheckCircle2 className="h-3 w-3" />
                      {techEvaluationStats.qualified} Qualified
                    </span>
                    {techEvaluationStats.disqualified > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100/80 border border-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                        <X className="h-3 w-3" />
                        {techEvaluationStats.disqualified} Disqualified
                      </span>
                    )}
                    {techEvaluationStats.pending > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100/80 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                        <Clock className="h-3 w-3" />
                        {techEvaluationStats.pending} Pending Review
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress & Action Bar */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-semibold text-slate-600 text-[11px] hidden lg:inline">
                    {techEvaluationStats.pending > 0
                      ? `${techEvaluationStats.pending} vendor(s) need review`
                      : isFinancialEvalReady
                        ? `Stage 1 complete • Ready for Stage 2`
                        : isFinancialEvalOpened
                          ? `Financial ranking active`
                          : `${techEvaluationStats.qualified} eligible for Stage 2`}
                  </span>

                  {!isTechEvalCompleted && techEvaluationStats.pending === 0 && techEvaluationStats.qualified > 0 && (
                    <button
                      type="button"
                      disabled={isCompletingTechEval}
                      onClick={handleCompleteTechnicalEvaluation}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 text-xs font-bold text-white shadow-2xs transition cursor-pointer disabled:opacity-50"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>{isCompletingTechEval ? 'Finalizing...' : 'Complete Technical Evaluation'}</span>
                    </button>
                  )}

                  {isFinancialEvalReady && (
                    <button
                      type="button"
                      disabled={isOpeningFinancialEval}
                      onClick={handleOpenFinancialEvaluation}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-2.5 text-xs font-bold text-white shadow-2xs transition cursor-pointer disabled:opacity-50"
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      <span>{isOpeningFinancialEval ? 'Opening Ranking...' : 'Open Financial Ranking (Stage 2)'}</span>
                    </button>
                  )}

                  {isFinancialEvalOpened && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 text-[11px] font-black text-emerald-800">
                      <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                      Stage 2 Financial Ranking Active
                    </span>
                  )}
                </div>
              </div>
            ) : isFinancialEvalReady ? (
              <div className="rounded-lg border border-blue-200/90 bg-blue-50/60 px-3.5 py-2 shadow-2xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-700 shrink-0" />
                  <span className="text-xs font-bold text-slate-800">
                    Technical evaluation complete ({techEvaluationStats.qualified} qualified). Ready to finalize commercial ranking.
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isOpeningFinancialEval}
                  onClick={handleOpenFinancialEvaluation}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-2.5 text-xs font-bold text-white shadow-2xs transition cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <Trophy className="h-3.5 w-3.5" />
                  <span>{isOpeningFinancialEval ? 'Finalizing...' : 'Finalize Financial Ranking'}</span>
                </button>
              </div>
            ) : null}

            {/* View Mode Rendering */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {sortedRanking.map((row, idx) => {
                  const partId = row.participationId || idx + 1;
                  const isSelected = selectedForCompare.includes(partId);
                  const docCount = row.documents ? row.documents.length : 0;
                  const itemCount = row.details?.lineItems?.length || 1;
                  const sellerOrg = row.details?.organizationName || (row.seller as any)?.organization?.organizationName || row.sellerName || 'Supplier';
                  const contactPerson = row.contactPerson || row.details?.contactPerson || row.sellerName || 'Representative';
                  const email = row.sellerEmail && row.sellerEmail !== 'Not provided' 
                    ? row.sellerEmail 
                    : (row.details?.sellerEmail || row.details?.email || (row.seller as any)?.email || 'Not provided');
                  const mobile = row.sellerMobile && row.sellerMobile !== 'Not listed' 
                    ? row.sellerMobile 
                    : (row.details?.sellerMobile || row.details?.mobile || (row.seller as any)?.mobile || 'Not listed');
                  const rawDate = row.submittedAt || row.details?.submittedAt || (row as any).createdAt || (row.details as any)?.createdAt;
                  const submissionTime = rawDate ? formatDateTime(rawDate) : 'Recently submitted';
                  const isL1 = row.finalRank === 'L1';

                  return (
                    <div 
                      key={partId}
                      className={`rounded-2xl border bg-white p-4 space-y-3 shadow-2xs transition-all duration-200 hover:shadow-xs relative ${
                        isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => toggleSellerSelection(partId)}
                            className="mt-0.5 text-slate-400 hover:text-blue-600 transition"
                            aria-label={isSelected ? `Deselect ${sellerOrg}` : `Select ${sellerOrg}`}
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4.5 w-4.5 text-blue-600 fill-blue-50" />
                            ) : (
                              <Square className="h-4.5 w-4.5 text-slate-300 hover:text-slate-400" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {row.finalRank && row.finalRank !== 'NA' && (
                                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                                  isL1 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300' 
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {isL1 && <Trophy className="h-3 w-3 text-emerald-600 inline" />} {row.finalRank}
                                </span>
                              )}
                              <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">{sellerOrg}</h3>
                            </div>
                            <p className="text-[11px] font-bold text-slate-500 mt-0.5">👤 {contactPerson}</p>
                          </div>
                        </div>

                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                          PRT-{partId}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate font-medium">{email}</span>
                        </div>
                        {mobile && mobile !== 'Not listed' && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="font-medium">{mobile}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-slate-500 font-medium text-[11px]">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>Submitted: {submissionTime}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-900 font-black pt-1">
                          <Tag className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span>Quoted Total: {row.totalPrice ? money(row.totalPrice) : 'Pending'}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 text-slate-700 px-2 py-0.5">
                          📄 {docCount} Document{docCount === 1 ? '' : 's'}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5">
                          📦 {itemCount} Quoted Item{itemCount === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-150">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Tech Status:</span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                              row.technicalStatus === 'Qualified'
                                ? 'bg-emerald-100 border border-emerald-300 text-emerald-800'
                                : row.technicalStatus === 'Disqualified'
                                  ? 'bg-rose-100 border border-rose-300 text-rose-800'
                                  : 'bg-amber-100 border border-amber-300 text-amber-800'
                            }`}
                          >
                            {row.technicalStatus === 'Qualified' && <CheckCircle2 className="h-3 w-3" />}
                            {row.technicalStatus === 'Disqualified' && <X className="h-3 w-3" />}
                            {row.technicalStatus !== 'Qualified' && row.technicalStatus !== 'Disqualified' && <Clock className="h-3 w-3" />}
                            {row.technicalStatus || 'Pending'}
                          </span>
                        </div>
                        {isBidAlreadyAwarded ? (
                          <button
                            type="button"
                            onClick={() => setSelectedForTechEval((row as any).rawParticipation || row)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-250 px-2 py-0.5 rounded-lg shadow-2xs transition cursor-pointer"
                            title="View finalized technical evaluation (read-only audit record)"
                          >
                            <Eye className="h-3 w-3 text-slate-500" />
                            View Evaluation
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedForTechEval((row as any).rawParticipation || row)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-900 bg-white border border-blue-200 px-2 py-0.5 rounded-lg shadow-2xs transition cursor-pointer"
                          >
                            <FileText className="h-3 w-3" />
                            {row.technicalStatus === 'Pending' ? 'Evaluate Tech Bid' : 'Edit Evaluation'}
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleSelectResult(row)}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-xl border border-slate-250 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-bold transition shadow-2xs cursor-pointer"
                        >
                          <Eye className="h-3 w-3 text-slate-500" /> Details
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadQuotationPdf(row)}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-xl border border-slate-250 bg-white hover:bg-slate-50 text-slate-800 text-[11px] font-bold transition shadow-2xs cursor-pointer"
                        >
                          <Download className="h-3 w-3 text-slate-500" /> PDF
                        </button>
                        {checkIsRowAwarded(row) ? (
                          <span className="inline-flex h-8 items-center justify-center gap-1 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-black uppercase tracking-wide">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Awarded
                          </span>
                        ) : row.technicalStatus === 'Disqualified' ? (
                          <span className="inline-flex h-8 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-[11px] font-semibold">
                            Ineligible
                          </span>
                        ) : isBidAlreadyAwarded ? (
                          <span className="inline-flex h-8 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-[11px] font-semibold">
                            Not Selected
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (row.technicalStatus === 'Disqualified') {
                                toast.error('Cannot award to a technically disqualified supplier.');
                                return;
                              }
                              setAwardModal({ show: true, row, remarks: '', submitting: false });
                            }}
                            className="inline-flex h-8 items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black transition shadow-xs cursor-pointer"
                          >
                            Accept & PO
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <DataTable<BidResultRow>
                data={sortedRanking}
                columns={tableColumns}
                keyExtractor={(row, idx) => row.participationId || idx + 1}
                showSrNo={false}
                rowClassName={(row, idx) => selectedForCompare.includes(row.participationId || idx + 1) ? 'bg-blue-50/30' : ''}
                minWidth="min-w-[900px]"
                emptyTitle="No evaluation results available currently."
              />
            )}
          </section>
        )}
      </main>

      {/* Choose Sellers to Compare Modal */}
      {showCompareChooser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-150 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Scale className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Select Sellers to Compare</h3>
                  <p className="text-xs text-slate-500 font-semibold">Choose 2 to 4 seller quotations for side-by-side matrix comparison.</p>
                </div>
              </div>
              <button
                onClick={() => setShowCompareChooser(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {ranking.map((row, idx) => {
                const partId = row.participationId || idx + 1;
                const isSelected = selectedForCompare.includes(partId);

                return (
                  <div
                    key={partId}
                    onClick={() => toggleSellerSelection(partId)}
                    className={`flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected ? 'border-blue-500 bg-blue-50/20 shadow-2xs' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-row sm:items-center w-full sm:w-auto">
                      <div className="text-blue-600">
                        {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-slate-300" />}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 uppercase">{row.sellerName}</p>
                        <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                          Quoted: {row.totalPrice ? money(row.totalPrice) : 'Pending'}
                        </p>
                      </div>
                    </div>
                    <StatusBadge label={row.technicalStatus} />
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs font-bold text-slate-500">
                {selectedForCompare.length} seller{selectedForCompare.length === 1 ? '' : 's'} selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCompareChooser(false)}
                  className="h-9 px-4 text-xs font-bold text-slate-600 rounded-xl hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowCompareChooser(false);
                    const idsQuery = selectedForCompare.length ? `?ids=${selectedForCompare.join(',')}` : '';
                    router.push(`/bids/${bidId}/compare${idsQuery}`);
                  }}
                  className="h-9 px-4 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs"
                >
                  Proceed to Comparison Matrix
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Award & PO Generation Confirmation Modal */}
      {awardModal.show && awardModal.row && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-150 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-sm">Generate Purchase Order</span>
                <h3 className="text-base font-black text-slate-900 mt-1">Accept Quotation & Award Bid</h3>
              </div>
              <button
                onClick={() => setAwardModal({ show: false, row: null, remarks: '', submitting: false })}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="py-4 space-y-4 text-xs">
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100 space-y-2">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Supplier:</span>
                  <span className="font-black text-slate-900">{awardModal.row.sellerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Offered Item:</span>
                  <span className="font-semibold text-slate-800">{awardModal.row.offeredItem || 'As Quoted'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Total Evaluated Price:</span>
                  <span className="font-black text-emerald-700">{awardModal.row.totalPrice ? money(awardModal.row.totalPrice) : 'Evaluated'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Rank:</span>
                  <span className="font-bold text-slate-800">{awardModal.row.finalRank}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                  Purchase Order Notes / Award Remarks
                </label>
                <textarea
                  rows={3}
                  value={awardModal.remarks}
                  onChange={e => setAwardModal(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Enter award notes or terms to include in the generated Purchase Order..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end gap-2.5 sm:gap-3">
              <button
                onClick={() => setAwardModal({ show: false, row: null, remarks: '', submitting: false })}
                disabled={awardModal.submitting}
                className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 px-4 text-xs font-black text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAward}
                disabled={awardModal.submitting}
                className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 text-xs font-black text-white inline-flex items-center gap-2 shadow-xs"
              >
                {awardModal.submitting ? 'Generating PO...' : 'Confirm & Generate PO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReverseAuctionModal && (
        <StartReverseAuctionModal
          isOpen={showReverseAuctionModal}
          onClose={() => setShowReverseAuctionModal(false)}
          procurementId={bidId}
          procurementTitle={bid?.title || `Procurement #${bidId}`}
          initialLowestQuote={
            ranking.length
              ? Math.min(...ranking.map(r => Number(r.totalPrice || 0)).filter(q => q > 0))
              : undefined
          }
          submittedVendors={ranking.map((r, idx) => ({
            sellerOrgId: (r as any).sellerOrgId || (r as any).sellerOrganizationId,
            sellerUserId: (r as any).sellerUserId || (r as any).sellerId,
            sellerId: (r as any).sellerId,
            vendorName: r.sellerName || `Vendor ${idx + 1}`,
            quotedAmount: Number(r.totalPrice || 0),
            offeredQty: String((r as any).offeredQuantity || (r as any).quantity || 1),
            deliveryTimeline: (r as any).deliveryTimeline || r.details?.deliveryTimeline,
            makeBrand: (r as any).makeBrand || (r as any).brand || r.details?.makeBrand,
            model: (r as any).model || r.details?.model,
            technicalStatus: String(r.technicalStatus || '').toUpperCase(),
          }))}
          onAuctionStarted={(newAuction) => {
            router.push(`/reverse-auctions/${newAuction.id}/live`);
          }}
        />
      )}

      {/* Stage 1 Technical Evaluation Modal */}
      {selectedForTechEval && (
        <TechnicalEvaluationModal
          isOpen={Boolean(selectedForTechEval)}
          onClose={() => setSelectedForTechEval(null)}
          procurementId={bidId}
          participation={selectedForTechEval}
          readOnly={isBidAlreadyAwarded}
          onSuccess={() => {
            loadBid();
          }}
        />
      )}
    </PageShell>
  );
}
