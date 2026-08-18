'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Download, Trophy, FileText, X, Scale, CheckCircle2,
  LayoutGrid, List, Users, Eye, Mail, Phone, Clock, Tag, Package,
  CheckSquare, Square, Check
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { PageShell, ProcurementEmptyState, ProcurementErrorState, ProcurementHero, ProcurementLoadingState, ResultsTable, StatusBadge } from '../components';
import { money, type BidResultRow, type ProcurementBid } from '../data';
import { procurementBidApi } from '../api';
import { downloadCsv } from '../../shared/exportUtils';
import { getApi } from '../../shared/apiClient';
import { openFileAsset } from '../../../lib/files';
import { PdfEngine } from '../../../lib/pdfEngine';
import { toast } from 'sonner';

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
  
  // Multi-selection state for comparing specific sellers
  const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);
  
  // Modal state for selecting sellers to compare
  const [showCompareChooser, setShowCompareChooser] = useState(false);

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

  const handleDownloadQuotationPdf = (result: any) => {
    if (!result) return;
    try {
      toast.info(`Generating Quotation PDF for ${result.sellerName}…`);
      const engine = new PdfEngine('p');
      const quotedAmt = Number(result.quotedAmount || result.totalAmount || result.totalPrice || result.details?.quotedAmount || 0);
      const gst = Number(result.gstPercentage || result.details?.gstPercentage || 0);
      const totalAmt = Number(result.totalAmount || result.totalPrice || result.details?.totalAmount || quotedAmt);
      const qty = result.offeredQuantity || result.details?.offeredQuantity || 1;

      const doc = engine.generate({
        documentTitle: 'SUPPLIER QUOTATION RESPONSE',
        documentNumber: `QUOTE-${result.id || result.participationId || 'REF'}`,
        dateStr: result.submittedAt ? new Date(result.submittedAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
        status: result.technicalStatus || 'Submitted',
        parties: [
          {
            title: 'BUYER ORGANIZATION',
            name: (bid as any)?.buyerOrganization || (bid as any)?.buyerOrganizationName || bid?.buyer?.name || 'Procurement Buyer',
            details: [
              `Requirement / Bid ID: ${bidId}`,
              `Procurement Title: ${bid?.title || `Requirement ${bidId}`}`,
            ],
          },
          {
            title: 'SUPPLIER / QUOTING ORGANIZATION',
            name: result.sellerName || 'Quoting Supplier',
            address: result.sellerAddress || undefined,
            email: result.sellerEmail !== 'Not provided' ? result.sellerEmail : undefined,
            phone: result.sellerMobile !== 'Not listed' ? result.sellerMobile : undefined,
            details: [
              `Contact Person: ${result.contactPerson || 'Representative'}`,
              `Submitted Date: ${result.submittedAt ? new Date(result.submittedAt).toLocaleString('en-IN') : 'N/A'}`,
            ],
          },
        ],
        infoGrid: {
          'Make / Brand': result.makeBrand || 'As quoted',
          'Model': result.model || 'Standard',
          'Delivery Timeline': result.deliveryTimeline || 'Standard',
          'Offered Quantity': String(qty),
        },
        tableHeaders: ['#', 'Offered Item Description', 'Offered Qty', 'Quoted Rate', 'GST %', 'Total Amount'],
        tableData: [
          [
            '1',
            result.offeredItem || result.details?.offeredItemDescription || 'Procurement requirement',
            String(qty),
            quotedAmt ? `₹${quotedAmt.toLocaleString('en-IN')}` : '—',
            gst ? `${gst}%` : '0%',
            totalAmt ? `₹${totalAmt.toLocaleString('en-IN')}` : '—',
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
      if (data && Array.isArray(data.participations) && data.participations.length > 0 && (!Array.isArray(data.results) || data.results.length === 0)) {
        data.results = data.participations.map((r: any, idx: number) => {
          const respData = typeof r.responseData === 'string' ? (() => { try { return JSON.parse(r.responseData); } catch { return {}; } })() : (r.responseData || {});
          const quotedAmt = Number(r.offeredPrice || r.quotedAmount || r.totalAmount || r.totalPrice || 0);
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

          return {
            id: r.id || `res-${idx}`,
            participationId: r.id || idx + 1,
            sellerName: sellerOrg,
            contactPerson: contactPerson,
            sellerEmail: r.sellerEmail || r.sellerUser?.email || r.seller?.email || 'Not provided',
            sellerMobile: r.sellerMobile || r.sellerUser?.mobile || r.seller?.mobile || 'Not listed',
            submittedAt: r.createdAt || r.submittedAt,
            sellerType: 'Verified Seller',
            offeredItem: r.offeredItemDescription || r.message || r.itemName || 'Procurement requirement',
            makeBrand: r.makeBrand || respData.makeBrand || 'Standard',
            model: r.model || respData.model || 'Standard',
            technicalStatus: r.status === 'SHORTLISTED' || r.status === 'ACCEPTED' || r.technicalStatus === 'QUALIFIED' ? 'Qualified' : (r.status === 'REJECTED' || r.technicalStatus === 'DISQUALIFIED' ? 'Disqualified' : 'Pending'),
            totalPrice: quotedAmt,
            quotedAmount: quotedAmt,
            gstPercentage: Number(r.gstPercentage || respData.gstPercentage || 0),
            totalAmount: quotedAmt,
            offeredQuantity: r.offeredQuantity || r.quantity || 1,
            deliveryTimeline: r.deliveryTimeline || respData.deliveryTimeline || 'Standard',
            documents: r.documents || [],
            finalRank: `L${idx + 1}`,
            resultStatus: 'Responsive',
            details: {
              organizationName: sellerOrg,
              contactPerson: contactPerson,
              email: r.sellerEmail || r.sellerUser?.email || r.seller?.email || '',
              mobile: r.sellerMobile || r.sellerUser?.mobile || r.seller?.mobile || '',
              submittedAt: r.createdAt || r.submittedAt,
              deliveryTimeline: r.deliveryTimeline || respData.deliveryTimeline || 'Standard',
              complianceRemarks: r.complianceRemarks || 'Compliant',
              rfqNotes: r.message || r.offeredItemDescription || '',
              quotedAmount: quotedAmt,
              totalAmount: quotedAmt,
            }
          };
        });
      }

      // If data has no results, pick first valid non-empty response from fallbacks
      if (!data || !Array.isArray(data.results) || data.results.length === 0) {
        const fallbacks = [fallbackRes1, fallbackRes2, fallbackRes3];
        for (const f of fallbacks) {
          if (f.status === 'fulfilled' && f.value) {
            const reqRes: any = f.value;
            const reqItems = reqRes?.responses || reqRes?.participants || reqRes?.participations || reqRes?.items || reqRes?.data || (Array.isArray(reqRes) ? reqRes : []);
            if (Array.isArray(reqItems) && reqItems.length > 0) {
              const mappedResults = reqItems.map((r: any, idx: number) => {
                const respData = typeof r.responseData === 'string' ? JSON.parse(r.responseData) : (r.responseData || {});
                const rawDocs: any[] = Array.isArray(respData.documents) ? respData.documents : (Array.isArray(r.documents) ? r.documents : []);
                const docs = rawDocs.map((d: any, dIdx: number) => ({
                  id: d.id || `rdoc-${r.id}-${dIdx}`,
                  documentName: d.documentName || d.name || d.fileName || 'Document',
                  fileName: d.fileName || d.name || 'file.pdf',
                  fileUrl: d.fileUrl || d.url || null,
                  fileAssetId: d.fileAssetId || null,
                  documentCategory: d.documentCategory || d.category || 'TECHNICAL_PROPOSAL',
                }));

                const quotedAmt = Number(r.offeredPrice || r.quotedAmount || r.totalAmount || r.totalPrice || 0);
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

                return {
                  id: r.id || `res-${idx}`,
                  participationId: r.id || idx + 1,
                  sellerName: sellerOrg,
                  contactPerson: contactPerson,
                  sellerEmail: r.sellerEmail || r.sellerUser?.email || r.seller?.email || 'Not provided',
                  sellerMobile: r.sellerMobile || r.sellerUser?.mobile || r.seller?.mobile || 'Not listed',
                  submittedAt: r.createdAt || r.submittedAt,
                  sellerType: 'Verified Seller',
                  offeredItem: r.message || r.itemName || 'Procurement requirement',
                  makeBrand: r.makeBrand || respData.makeBrand || 'Standard',
                  model: r.model || respData.model || 'Standard',
                  technicalStatus: r.status === 'SHORTLISTED' || r.status === 'ACCEPTED' || r.technicalStatus === 'QUALIFIED' ? 'Qualified' : (r.status === 'REJECTED' || r.technicalStatus === 'DISQUALIFIED' ? 'Disqualified' : 'Pending'),
                  totalPrice: quotedAmt,
                  quotedAmount: quotedAmt,
                  gstPercentage: Number(r.gstPercentage || respData.gstPercentage || 0),
                  totalAmount: quotedAmt,
                  offeredQuantity: r.offeredQuantity || r.quantity || 1,
                  deliveryTimeline: r.deliveryTimeline || respData.deliveryTimeline || 'Standard',
                  documents: docs,
                  finalRank: `L${idx + 1}`,
                  resultStatus: 'Responsive',
                  details: {
                    organizationName: sellerOrg,
                    contactPerson: contactPerson,
                    email: r.sellerUser?.email || r.seller?.email || '',
                    mobile: r.sellerUser?.mobile || r.seller?.mobile || '',
                    submittedAt: r.createdAt || r.submittedAt,
                    deliveryTimeline: r.deliveryTimeline || respData.deliveryTimeline || 'Standard',
                    complianceRemarks: r.complianceRemarks || 'Compliant',
                    rfqNotes: r.message || '',
                    quotedAmount: quotedAmt,
                    totalAmount: quotedAmt,
                  }
                };
              });

              data = {
                id: reqRes?.requirement?.requirementNumber || bidId,
                title: reqRes?.requirement?.title || `Requirement ${bidId}`,
                status: reqRes?.requirement?.status || 'OPEN',
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
      const sorted = [...(data.results || [])].sort((a, b) => {
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

  if (loading) {
    return (
      <PageShell>
        <main className="mx-auto w-full max-w-7xl px-4 py-6">
          <ProcurementLoadingState message="Fetching live evaluation results & financial ranks..." />
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

  return (
    <PageShell>
      <main className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
        <ProcurementHero
          title="Bid Result and Financial Ranking"
          subtitle={`${bid.id} • ${bid.title}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleCompareClick}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-5 text-xs font-black text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Scale className="h-4 w-4" /> Compare Quotations {selectedForCompare.length > 0 && `(${selectedForCompare.length})`}
              </button>
              <Link
                href={`/bids/${bid.id}`}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-slate-50 transition"
              >
                Back to bid
              </Link>
            </div>
          }
        />

        {/* Seller Evaluation Section with Grid vs List Toggle (Matching 2nd Screenshot) */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
          
          {/* Header Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-650 shadow-2xs">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 tracking-tight">SELLER RESPONSES ({ranking.length})</h2>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">Review submitted seller quotations and technical details.</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Compare Action Button */}
              <button
                onClick={handleCompareClick}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-250 bg-white px-3.5 text-xs font-black text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              >
                <Scale className="h-4 w-4 text-blue-600" /> Compare {selectedForCompare.length > 0 && `(${selectedForCompare.length})`}
              </button>

              {/* View Mode Toggle Switch */}
              <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                  aria-label="Grid view"
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                    viewMode === 'grid' 
                      ? 'bg-white text-blue-700 shadow-2xs font-black' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  title="List view"
                  aria-label="List view"
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all ${
                    viewMode === 'list' 
                      ? 'bg-white text-blue-700 shadow-2xs font-black' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>

              <StatusBadge label={bid.status} />
            </div>
          </div>

          {/* Conditional View Mode Rendering */}
          {viewMode === 'grid' ? (
            /* Grid View (Matching Screenshot 2 layout & cards) */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ranking.length ? (
                ranking.map((row, idx) => {
                  const partId = row.participationId || idx + 1;
                  const isSelected = selectedForCompare.includes(partId);
                  const docCount = row.documents ? row.documents.length : 0;
                  const itemCount = row.details?.lineItems?.length || 1;
                  const sellerOrg = row.details?.organizationName || (row.seller as any)?.organization?.organizationName || row.sellerName || 'Supplier';
                  const contactPerson = row.contactPerson || row.details?.contactPerson || row.sellerName || 'Representative';
                  const email = row.sellerEmail && row.sellerEmail !== 'Not provided' 
                    ? row.sellerEmail 
                    : (row.details?.sellerEmail || row.details?.email || (row.seller as any)?.email || (row.seller as any)?.organization?.email || 'Not provided');
                  const mobile = row.sellerMobile && row.sellerMobile !== 'Not listed' 
                    ? row.sellerMobile 
                    : (row.details?.sellerMobile || row.details?.mobile || (row.seller as any)?.mobile || (row.seller as any)?.organization?.mobile || (row.seller as any)?.organization?.phone || 'Not listed');
                  const rawDate = row.submittedAt || row.details?.submittedAt || (row as any).createdAt || (row.details as any)?.createdAt;
                  const submissionTime = rawDate && !isNaN(new Date(rawDate).getTime())
                    ? new Date(rawDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Recently submitted';

                  return (
                    <div 
                      key={partId}
                      className={`rounded-2xl border bg-white p-5 space-y-4 shadow-xs transition-all duration-200 hover:shadow-md relative ${
                        isSelected ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10' : 'border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {/* Top Header Row */}
                      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div className="flex items-start gap-2.5">
                          <button
                            onClick={() => toggleSellerSelection(partId)}
                            className="mt-0.5 text-slate-400 hover:text-blue-600 transition"
                            title={isSelected ? "Deselect for comparison" : "Select for comparison"}
                          >
                            {isSelected ? (
                              <CheckSquare className="h-5 w-5 text-blue-600 fill-blue-50" />
                            ) : (
                              <Square className="h-5 w-5 text-slate-300 hover:text-slate-400" />
                            )}
                          </button>
                          <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-tight">{sellerOrg}</h3>
                            <p className="text-xs font-bold text-slate-500 mt-0.5">👤 {contactPerson}</p>
                          </div>
                        </div>

                        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-600 uppercase">
                          PRT-{partId}
                        </span>
                      </div>

                      {/* Info Metadata Block */}
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate font-medium">{email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium">{mobile}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 font-medium text-[11px]">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>Submitted: {submissionTime}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-900 font-black pt-1">
                          <Tag className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>Quoted Total: {row.totalPrice ? money(row.totalPrice) : 'Pending'}</span>
                        </div>
                      </div>

                      {/* Tag Badges Row */}
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 text-slate-700 px-2.5 py-1">
                          📄 {docCount} Document{docCount === 1 ? '' : 's'}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1">
                          📦 {itemCount} Quoted Item{itemCount === 1 ? '' : 's'}
                        </span>
                      </div>

                      {/* Technical Status Badge - Commented out */}
                      {/* <div>
                        <StatusBadge label={row.technicalStatus} />
                      </div> */}

                      {/* Card Footer Actions */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => setSelectedResult(row)}
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-250 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all shadow-2xs"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-500" /> View Quotation Details
                        </button>

                        {row.resultStatus === 'Awarded' || bid.status === 'Awarded' ? (
                          <span className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-black uppercase tracking-wide">
                            <CheckCircle2 className="h-4 w-4" /> PO Generated
                          </span>
                        ) : (
                          <button
                            onClick={() => setAwardModal({ show: true, row, remarks: '', submitting: false })}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-xs"
                          >
                            Accept Quotation
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-2 py-10 text-center text-xs font-bold text-slate-400">
                  No evaluation results available currently.
                </div>
              )}
            </div>
          ) : (
            /* List Table View */
            <div className="table-shell">
              <div className="table-shell-scroller">
                <table className="min-w-[1100px] w-full text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-3 w-[40px] text-center">Select</th>
                      <th className="px-4 py-3 font-black">Supplier & Contact</th>
                      <th className="px-4 py-3 font-black">Submission Date</th>
                      <th className="px-4 py-3 font-black">Offered Item / Make</th>
                      <th className="px-4 py-3 font-black">Attachments</th>
                      {/* <th className="px-4 py-3 font-black">Technical Status</th> */}
                      <th className="px-4 py-3 font-black">Quoted Total</th>
                      <th className="px-4 py-3 font-black text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    {ranking.length ? ranking.map((row, idx) => {
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
                      const submissionTime = rawDate && !isNaN(new Date(rawDate).getTime())
                        ? new Date(rawDate).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : 'Submitted';

                      return (
                        <tr key={partId} className={`hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-blue-50/30' : 'bg-white'}`}>
                          <td className="px-3 py-3.5 text-center">
                            <button
                              onClick={() => toggleSellerSelection(partId)}
                              className="text-slate-400 hover:text-blue-600 transition"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-4.5 w-4.5 text-blue-600 fill-blue-50" />
                              ) : (
                                <Square className="h-4.5 w-4.5 text-slate-300 hover:text-slate-400" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-black text-slate-900 uppercase text-xs">{sellerOrg}</div>
                            <div className="text-[11px] font-bold text-slate-500 mt-0.5">👤 {contactPerson}</div>
                            <div className="text-[10px] text-slate-400 font-medium mt-0.5 flex flex-wrap items-center gap-x-2">
                              <span>✉️ {email}</span>
                              {mobile && mobile !== 'Not listed' && <span>📞 {mobile}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-600 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-slate-600">
                              <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>{submissionTime}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="font-bold text-slate-800">{row.offeredItem}</div>
                            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                              {row.makeBrand && row.makeBrand !== 'As quoted' ? `Make: ${row.makeBrand}` : 'Standard Make'} 
                              {row.model && row.model !== 'Standard' ? ` | Model: ${row.model}` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                              <span className="inline-flex items-center rounded-md bg-slate-100 text-slate-700 px-2 py-0.5">
                                📄 {docCount} Doc{docCount === 1 ? '' : 's'}
                              </span>
                              <span className="inline-flex items-center rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5">
                                📦 {itemCount} Item{itemCount === 1 ? '' : 's'}
                              </span>
                            </div>
                          </td>
                          {/* <td className="px-4 py-3.5">
                            <StatusBadge label={row.technicalStatus} />
                          </td> */}
                          <td className="px-4 py-3.5 font-black text-slate-900 text-xs">
                            {row.totalPrice ? money(row.totalPrice) : 'Pending'}
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedResult(row)}
                                className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-250 bg-white hover:bg-slate-50 text-slate-700 px-3 text-[10px] font-bold transition shadow-2xs"
                              >
                                <Eye className="h-3.5 w-3.5 text-slate-500" /> View Quotation Details
                              </button>
                              {row.resultStatus === 'Awarded' || bid.status === 'Awarded' ? (
                                <span className="inline-flex h-8 items-center gap-1 rounded-xl bg-emerald-100 px-3 text-[10px] font-black text-emerald-800 uppercase tracking-wide">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> PO Generated
                                </span>
                              ) : (
                                <button
                                  onClick={() => setAwardModal({ show: true, row, remarks: '', submitting: false })}
                                  className="inline-flex h-8 items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 text-[10px] font-black transition shadow-2xs"
                                >
                                  Accept Quotation
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-xs font-bold text-slate-500">No evaluation results available currently.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Financial Ranking Section */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-black text-slate-900">Financial Ranking Table</h2>
              <p className="text-xs text-slate-500 font-semibold">Lowest evaluated total is L1, followed by L2, L3, L4, and later ranks when returned by the backend.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
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
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 text-xs font-black text-white transition-all shadow-xs cursor-pointer"
              >
                <Download className="h-4 w-4" /> Export result
              </button>
            </div>
          </div>
          {ranking.length ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                {ranking.slice(0, 4).map((row, idx) => (
                  <div key={row.participationId || `${row.sellerName}-${idx}`} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <StatusBadge label={row.finalRank} />
                      <Trophy className="h-4 w-4 text-emerald-600" />
                    </div>
                    <p className="mt-3 text-xs font-black text-slate-800">{row.sellerName}</p>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">{row.totalPrice ? money(row.totalPrice) : 'Amount pending'}</p>
                  </div>
                ))}
              </div>
              <ResultsTable rows={ranking} />
            </div>
          ) : <ProcurementEmptyState title="No financial ranking available currently." message="Financial rankings will appear after the live backend opens financial evaluation." />}
        </section>
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
                    <div className="flex items-center gap-3">
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

      {/* Selected Result Details Modal */}
      {selectedResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-3xl border border-slate-150 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-xs">Supplier Response details</span>
                <h3 className="text-base font-black text-slate-900 mt-1">{selectedResult.sellerName}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadQuotationPdf(selectedResult)}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  title="Download Quotation PDF"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download PDF</span>
                </button>
                <button 
                  onClick={() => setSelectedResult(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content Scroll Shell */}
            <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1 text-xs">
              {/* Section 1: Technical Offer Details */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-l-2 border-blue-600 pl-2 mb-3">Technical Specification</h4>
                {(() => {
                  const hasValue = (v: any) => Boolean(v && String(v).trim() !== '' && String(v).trim() !== '—' && String(v).trim() !== 'N/A');

                  const make = selectedResult.makeBrand && hasValue(selectedResult.makeBrand) ? String(selectedResult.makeBrand) : null;
                  const model = selectedResult.model && hasValue(selectedResult.model) ? String(selectedResult.model) : null;
                  const desc = selectedResult.offeredItem || selectedResult.details?.offeredItemDescription;
                  const offeredDesc = hasValue(desc) ? String(desc) : null;
                  const compliance = selectedResult.details?.complianceRemarks || selectedResult.complianceRemarks;
                  const compRemarks = hasValue(compliance) ? String(compliance) : null;
                  const delivery = selectedResult.deliveryTimeline || selectedResult.details?.deliveryTimeline;
                  const delTimeline = hasValue(delivery) ? String(delivery) : null;
                  const warranty = selectedResult.details?.warrantyDetails || selectedResult.warrantyDetails;
                  const warrantyVal = hasValue(warranty) ? String(warranty) : null;
                  const support = selectedResult.details?.serviceSupport || selectedResult.serviceSupport;
                  const supportVal = hasValue(support) ? String(support) : null;
                  const deviation = selectedResult.details?.deviation || selectedResult.deviation;
                  const devVal = hasValue(deviation) ? String(deviation) : null;
                  const notes = selectedResult.details?.rfqNotes || selectedResult.rfqNotes || selectedResult.terms || selectedResult.details?.terms;
                  const notesVal = hasValue(notes) ? String(notes) : null;

                  const hasAnyTechField = make || model || offeredDesc || compRemarks || delTimeline || warrantyVal || supportVal || devVal || notesVal;

                  if (!hasAnyTechField) {
                    return <p className="text-xs font-semibold text-slate-400 py-2 border border-dashed border-slate-200 rounded-xl text-center">No technical specifications specified.</p>;
                  }

                  return (
                    <div className="grid grid-cols-2 gap-4 bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50">
                      {make && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Make / Brand</span>
                          <span className="text-xs font-bold text-slate-800 block mt-0.5">{make}</span>
                        </div>
                      )}
                      {model && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Model</span>
                          <span className="text-xs font-bold text-slate-800 block mt-0.5">{model}</span>
                        </div>
                      )}
                      {offeredDesc && (
                        <div className="col-span-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Offered Item/Service Description</span>
                          <span className="text-xs font-bold text-slate-800 block mt-0.5 leading-relaxed">{offeredDesc}</span>
                        </div>
                      )}
                      {compRemarks && (
                        <div className="col-span-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Technical Compliance Remarks</span>
                          <span className="text-xs font-semibold text-slate-700 block mt-0.5 leading-relaxed">{compRemarks}</span>
                        </div>
                      )}
                      {delTimeline && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Delivery Timeline</span>
                          <span className="text-xs font-bold text-slate-800 block mt-0.5">{delTimeline}</span>
                        </div>
                      )}
                      {warrantyVal && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Warranty Details</span>
                          <span className="text-xs font-bold text-slate-800 block mt-0.5">{warrantyVal}</span>
                        </div>
                      )}
                      {supportVal && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Service Support</span>
                          <span className="text-xs font-bold text-slate-800 block mt-0.5">{supportVal}</span>
                        </div>
                      )}
                      {devVal && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Deviation (if any)</span>
                          <span className="text-xs font-bold text-slate-800 block mt-0.5">{devVal}</span>
                        </div>
                      )}
                      {notesVal && (
                        <div className="col-span-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Additional Notes / Terms</span>
                          <span className="text-xs font-semibold text-slate-700 block mt-0.5 leading-relaxed">{notesVal}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Section 2: Financial Offer Details */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-l-2 border-emerald-600 pl-2 mb-3">Financial Quote Details</h4>
                <div className="grid grid-cols-3 gap-4 bg-emerald-50/10 rounded-2xl p-4 border border-emerald-100/30">
                  {Boolean(selectedResult.quotedAmount || selectedResult.details?.quotedAmount) && (
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Quoted Base Amount</span>
                      <span className="text-xs font-black text-slate-800 block mt-0.5">{money(selectedResult.quotedAmount || selectedResult.details?.quotedAmount)}</span>
                    </div>
                  )}
                  {Boolean(selectedResult.gstPercentage || selectedResult.details?.gstPercentage) && (
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">GST Percentage</span>
                      <span className="text-xs font-bold text-slate-800 block mt-0.5">{`${selectedResult.gstPercentage || selectedResult.details?.gstPercentage}%`}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Evaluated Price</span>
                    <span className="text-xs font-black text-emerald-700 block mt-0.5">{money(selectedResult.totalAmount || selectedResult.totalPrice || selectedResult.details?.totalAmount || 0)}</span>
                  </div>
                  {Boolean(selectedResult.offeredQuantity || selectedResult.details?.offeredQuantity) && (
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Offered Quantity</span>
                      <span className="text-xs font-bold text-slate-800 block mt-0.5">{selectedResult.offeredQuantity || selectedResult.details?.offeredQuantity}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Uploaded Supplier Documents (Separated by Type) */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 border-l-2 border-orange-600 pl-2">Uploaded Supplier Documents & Attachments</h4>
                {selectedResult.documents && selectedResult.documents.length > 0 ? (
                  (() => {
                    const allDocs = selectedResult.documents || [];
                    const techDocs = allDocs.filter((d: any) => {
                      const c = String(d.documentCategory || d.documentType || '').toLowerCase();
                      const n = String(d.documentName || d.fileName || d.name || '').toLowerCase();
                      return c.includes('tech') || c.includes('spec') || c.includes('compliance') || n.includes('tech') || n.includes('spec');
                    });
                    const finDocs = allDocs.filter((d: any) => {
                      const c = String(d.documentCategory || d.documentType || '').toLowerCase();
                      const n = String(d.documentName || d.fileName || d.name || '').toLowerCase();
                      return c.includes('finan') || c.includes('quote') || c.includes('price') || n.includes('price') || n.includes('quote') || n.includes('cost');
                    });
                    const boqDocs = allDocs.filter((d: any) => {
                      const c = String(d.documentCategory || d.documentType || '').toLowerCase();
                      const n = String(d.documentName || d.fileName || d.name || '').toLowerCase();
                      return c.includes('boq') || c.includes('schedule') || n.includes('boq') || n.includes('sheet') || n.includes('excel');
                    });
                    const otherDocs = allDocs.filter((d: any) => !techDocs.includes(d) && !finDocs.includes(d) && !boqDocs.includes(d));

                    const renderDocCard = (doc: any, idx: number, theme: string) => {
                      const docTitle = doc.documentName || doc.name || doc.title || 'Uploaded Document';
                      const fileName = doc.fileName || doc.originalName || '';
                      const category = doc.documentCategory || doc.documentType || 'Attachment';

                      return (
                        <div 
                          key={idx} 
                          title={fileName ? `${docTitle} (${fileName})` : docTitle}
                          onClick={() => {
                            if (doc.fileAssetId || doc.fileUrl || doc.url) {
                              openFileAsset({
                                id: doc.fileAssetId || doc.id,
                                fileAssetId: doc.fileAssetId,
                                originalName: fileName || docTitle,
                                url: doc.fileUrl || doc.url,
                              }, fileName || docTitle).catch(err => {
                                toast.error(err instanceof Error ? err.message : 'Unable to open file');
                              });
                            }
                          }}
                          className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-start gap-2.5 hover:shadow-md transition-all duration-200 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 group"
                        >
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${theme} transition-colors mt-0.5`}>
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-black text-slate-800 block leading-tight break-words">{docTitle}</span>
                            {fileName && fileName !== docTitle && (
                              <span className="text-[10px] font-semibold text-slate-500 block mt-0.5 break-all leading-tight">{fileName}</span>
                            )}
                            <span className="inline-block text-[8px] font-black text-blue-700 bg-blue-50 border border-blue-150 px-1.5 py-0.5 rounded-xs mt-1 uppercase tracking-wider">{category}</span>
                          </div>
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 group-hover:text-blue-600 group-hover:border-blue-300 transition-colors">
                            <Download className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      );
                    };

                    return (
                      <div className="space-y-3">
                        {techDocs.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider flex items-center gap-1">
                              <FileText className="h-3 w-3 text-blue-600" /> Technical Proposals & Specifications ({techDocs.length})
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {techDocs.map((doc: any, idx: number) => renderDocCard(doc, idx, 'bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white'))}
                            </div>
                          </div>
                        )}

                        {finDocs.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider flex items-center gap-1">
                              <FileText className="h-3 w-3 text-emerald-600" /> Financial Quotes & Price Bids ({finDocs.length})
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {finDocs.map((doc: any, idx: number) => renderDocCard(doc, idx, 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white'))}
                            </div>
                          </div>
                        )}

                        {boqDocs.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider flex items-center gap-1">
                              <FileText className="h-3 w-3 text-purple-600" /> BOQ & Rate Schedules ({boqDocs.length})
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {boqDocs.map((doc: any, idx: number) => renderDocCard(doc, idx, 'bg-purple-100 text-purple-700 group-hover:bg-purple-600 group-hover:text-white'))}
                            </div>
                          </div>
                        )}

                        {otherDocs.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-1">
                              <FileText className="h-3 w-3 text-slate-600" /> Statutory & Compliance Attachments ({otherDocs.length})
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {otherDocs.map((doc: any, idx: number) => renderDocCard(doc, idx, 'bg-slate-200 text-slate-700 group-hover:bg-slate-700 group-hover:text-white'))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-xs font-bold text-slate-400 py-3 text-center border border-dashed border-slate-100 rounded-xl">No documents uploaded.</p>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {selectedResult.resultStatus === 'Awarded' || bid?.status === 'Awarded' ? (
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-emerald-100 px-4 text-xs font-black text-emerald-800 uppercase tracking-wide">
                    <CheckCircle2 className="h-4 w-4" /> PO Generated (Awarded)
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setAwardModal({ show: true, row: selectedResult, remarks: '', submitting: false });
                    }}
                    className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 text-xs font-black text-white transition-colors inline-flex items-center gap-2 shadow-xs"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Accept Quotation & Generate PO
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDownloadQuotationPdf(selectedResult)}
                  className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 text-xs font-black text-white transition-colors inline-flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <Download className="h-4 w-4" /> Download PDF
                </button>
              </div>
              <button
                onClick={() => setSelectedResult(null)}
                className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 px-5 text-xs font-black text-slate-700 transition-colors"
              >
                Close Details
              </button>
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

            <div className="border-t border-slate-100 pt-4 flex justify-end gap-3">
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
    </PageShell>
  );
}
