'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { 
  ArrowLeft, Award, Info, CheckCircle2, AlertTriangle, FileText,
  ChevronRight, X, BarChart3, Trophy, Scale, Layers, RotateCcw,
  Phone, Mail, FileSpreadsheet, Printer, ExternalLink,
  ShieldCheck, Check, Clock, Lock, XCircle, Package, Truck, MapPin
} from 'lucide-react';
import { PageShell, ProcurementLoadingState, ProcurementErrorState } from '../components';
import { money } from '../data';
import { toast } from 'sonner';
import { procurementBidApi } from '../api';
import { getApi } from '../../shared/apiClient';
import { normalizeQuotationDocuments } from '../components/SupplierQuotationDetailModal';
import { openFileAsset } from '../../../lib/files';

export default function BidComparisonPage() {
  const params = useParams();
  let bidId = params?.bidId as string;
  
  if (!bidId && typeof window !== 'undefined') {
    const match = window.location.pathname.match(/^\/bids\/([^/]+)\/compare$/);
    if (match) bidId = match[1];
  }
  
  const router = useRouter();
  const { token } = useAuth();

  const [sortBy, setSortBy] = useState<string>('lowest-price');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const idsStr = searchParams.get('ids') || searchParams.get('selected');
      if (idsStr) {
        const parsed = idsStr.split(',').map(n => Number(n.trim())).filter(n => Number.isFinite(n) && n > 0);
        if (parsed.length) setSelectedIds(parsed);
      }
    }
  }, []);

  // Fetch bid details with participations, fresh participants, and requirement responses concurrently
  const { data: bid, isLoading, error, refetch } = useQuery({
    queryKey: ['procurement-bid-comparison', bidId],
    queryFn: async () => {
      const [bidRes, partRes, fallbackReqRes] = await Promise.allSettled([
        procurementBidApi.getBidResults(bidId),
        getApi(`/api/buyer/procurement-bids/${encodeURIComponent(bidId)}/participants`, true),
        getApi(`/api/buyer/requirements/${encodeURIComponent(bidId)}/responses`, true),
      ]);

      let data: any = bidRes.status === 'fulfilled' ? bidRes.value : null;
      if (!data) {
        data = await procurementBidApi.detail(bidId, true);
      }

      const participantsFromApi = partRes.status === 'fulfilled' && Array.isArray(partRes.value) ? partRes.value : [];
      const reqResponses = fallbackReqRes.status === 'fulfilled' && (Array.isArray(fallbackReqRes.value) ? fallbackReqRes.value : (fallbackReqRes.value as any)?.responses || []);

      const currentParts = Array.isArray(data?.participations) ? data.participations : (Array.isArray(data?.results) ? data.results : []);
      const enrichedParts = [...currentParts];

      for (const p of [...participantsFromApi, ...reqResponses]) {
        if (!p) continue;
        const sId = p.sellerUserId || p.sellerId || p.seller?.id;
        const existing = enrichedParts.find((ep: any) => 
          (ep.id && p.id && String(ep.id) === String(p.id)) ||
          (sId && (String(ep.sellerId) === String(sId) || String(ep.sellerUserId) === String(sId)))
        );
        if (existing) {
          if (!existing.sellerMobile && (p.sellerMobile || p.mobile || p.phone || p.seller?.mobile || p.sellerUser?.mobile)) {
            existing.sellerMobile = p.sellerMobile || p.mobile || p.phone || p.seller?.mobile || p.sellerUser?.mobile;
          }
          if ((!existing.documents || existing.documents.length === 0) && Array.isArray(p.documents) && p.documents.length > 0) {
            existing.documents = p.documents;
          }
          if (!existing.attachmentUrl && p.attachmentUrl) {
            existing.attachmentUrl = p.attachmentUrl;
          }
          if (!existing.makeBrand && p.makeBrand) existing.makeBrand = p.makeBrand;
          if (!existing.model && p.model) existing.model = p.model;
        } else {
          enrichedParts.push(p);
        }
      }

      data.participations = enrichedParts;
      return data;
    },
    enabled: !!bidId && !!token,
    staleTime: 5_000,
  });

  // Single vs Double Packet Detection & Financial Opening Verification
  const rawPacketType = String(
    bid?.basics?.biddingType ||
    bid?.biddingType ||
    bid?.packetType ||
    bid?.tenderType ||
    bid?.tender?.biddingType ||
    bid?.tender?.packetType ||
    ""
  ).toUpperCase();

  const isExplicitSingle =
    rawPacketType.includes("SINGLE") ||
    rawPacketType === "1";

  const candidateFinDate =
    bid?.financialOpeningDate ||
    bid?.schedule?.financialOpeningDate ||
    bid?.schedule?.financialBidOpeningDate ||
    bid?.tender?.financialOpeningDate;

  const isTwoPacket =
    !isExplicitSingle &&
    (rawPacketType.includes("TWO") ||
      rawPacketType === "2" ||
      Boolean(candidateFinDate));

  const isFinancialOpened = useMemo(() => {
    const statusUpper = String(bid?.status || bid?.lifecycleStage || "").toUpperCase();
    if (['FINANCIAL_EVALUATION', 'FINANCIAL_EVALUATED', 'AWARD_RECOMMENDED', 'AWARD_OFFERED', 'AWARDED', 'COMPLETED'].includes(statusUpper)) {
      return true;
    }
    if (candidateFinDate) {
      return new Date(candidateFinDate).getTime() <= Date.now();
    }
    return !isTwoPacket;
  }, [bid?.status, bid?.lifecycleStage, candidateFinDate, isTwoPacket]);

  // Comprehensive Quotation Detail Parser
  const parseQuotationData = useCallback((p: any) => {
    if (!p) return null;

    const candList = [
      p.lineItems,
      p.items,
      p.lineQuotes,
      p.responseData?.lineItems,
      p.responseData?.items,
      p.responseData?.lineQuotes,
      p.responseData?.boqTable,
      p.details?.lineItems,
      p.details?.items,
      p.quotation?.lineItems,
      p.quotation?.items,
      p.acknowledgement?.responseData?.lineItems,
      p.acknowledgement?.responseData?.lineQuotes,
      p.acknowledgement?.lineItems,
      p.acknowledgement?.items,
      p.boqTable,
    ];
    let lineItems: any[] = [];
    for (const arr of candList) {
      if (Array.isArray(arr) && arr.length > lineItems.length) {
        lineItems = arr;
      }
    }

    let descData: Record<string, any> = {};
    const rawDesc = p.offeredItemDescription || p.message || p.responseData?.message;
    if (typeof rawDesc === 'string' && (rawDesc.trim().startsWith('{') || rawDesc.trim().startsWith('['))) {
      try {
        descData = JSON.parse(rawDesc);
      } catch {}
    }

    const ackData = p.acknowledgement && typeof p.acknowledgement === 'object' && !Array.isArray(p.acknowledgement) ? p.acknowledgement : {};
    const respData = p.responseData && typeof p.responseData === 'object' && !Array.isArray(p.responseData) ? p.responseData : {};
    const details = p.details && typeof p.details === 'object' ? p.details : {};
    const firstItem = lineItems.length ? lineItems[0] : {};
    const techOffer = descData.technicalOffer || respData.technicalOffer || ackData.technicalOffer || {};

    const first = (...vals: any[]) => vals.find(v => v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '—');

    // Amounts
    const totalAmount = Number(
      first(
        p.totalAmount,
        p.finalAmount,
        p.quotedAmount,
        respData.totalAmount,
        respData.quotedAmount,
        ackData.totalAmount,
        ackData.quotedAmount,
        details.totalAmount,
        details.quotedAmount,
        p.offeredPrice
      ) || 0
    );

    const baseAmount = Number(
      first(
        p.baseAmount,
        p.baseValue,
        respData.baseAmount,
        respData.basePrice,
        details.baseAmount,
        ackData.baseAmount,
        firstItem.unitPrice ? Number(firstItem.unitPrice) * (Number(firstItem.quantity) || 1) : null
      ) || (p.gstPercentage && totalAmount ? totalAmount / (1 + p.gstPercentage / 100) : totalAmount)
    );

    const gstPercentage = Number(
      first(
        p.gstPercentage,
        p.taxRate,
        p.gstRate,
        respData.gstPercentage,
        details.gstPercentage,
        ackData.gstPercentage,
        firstItem.gstRate,
        firstItem.taxRate
      ) || (totalAmount > baseAmount && baseAmount > 0 ? Math.round(((totalAmount - baseAmount) / baseAmount) * 100) : 0)
    );

    const taxAmount = Number(
      first(
        p.taxAmount,
        p.taxValue,
        respData.taxAmount,
        details.taxAmount,
        ackData.taxAmount
      ) || (totalAmount > baseAmount ? totalAmount - baseAmount : (baseAmount * gstPercentage) / 100)
    );

    // Scope & Quantity
    const tenderQty = bid?.basics?.quantity || bid?.quantity || bid?.requirement?.quantity;
    const tenderUnit = bid?.basics?.unit || bid?.unit || bid?.requirement?.unit || 'Nos';
    const offeredQty = first(
      p.offeredQuantity,
      p.offeredQty,
      p.quantity,
      respData.offeredQuantity,
      respData.offeredQty,
      details.offeredQty,
      ackData.offeredQty,
      firstItem.quantity ? `${firstItem.quantity} ${firstItem.unit || ''}`.trim() : null
    ) || (tenderQty ? `${tenderQty} ${tenderUnit}` : '—');

    // Delivery & SLA
    const rawDelivery = first(
      p.deliveryTimeline,
      p.deliveryPeriod,
      p.deliverySchedule,
      respData.deliveryTimeline,
      details.deliveryTimeline,
      ackData.deliveryTimeline,
      techOffer.deliveryTimeline,
      firstItem.deliveryTimeline,
      firstItem.deliverySchedule
    );
    const deliveryTimeline = rawDelivery && /^\d+$/.test(String(rawDelivery).trim())
      ? `${rawDelivery} Calendar Days`
      : (rawDelivery ? String(rawDelivery) : '—');

    const consigneeLocation = first(
      bid?.basics?.deliveryLocation,
      bid?.deliveryLocation,
      bid?.consigneeLocation,
      bid?.deliveryAddress,
      bid?.district ? `${bid.district}${bid.state ? `, ${bid.state}` : ''}` : null
    );
    const rawDeliveryTerms = first(
      p.deliveryTerms,
      p.freightTerms,
      respData.deliveryTerms,
      details.deliveryTerms,
      ackData.deliveryTerms
    );
    const deliveryTerms = rawDeliveryTerms 
      ? String(rawDeliveryTerms)
      : (consigneeLocation ? `Consignee Site (${consigneeLocation})` : '—');

    const rawPay = first(
      p.paymentTerms,
      details.paymentTerms,
      respData.paymentTerms,
      ackData.paymentTerms,
      p.terms,
      descData.paymentTerms,
      bid?.paymentTerms,
      bid?.basics?.paymentTerms
    );
    const formatPay = (v?: string) => {
      if (!v) return '—';
      const s = String(v).trim();
      const l = s.toLowerCase();
      if (l === 'on_delivery' || l === 'on delivery') return '100% on Delivery (Escrow Protected)';
      if (l === 'advance_payment' || l === 'advance') return '100% Advance Payment';
      if (l === 'against_invoice' || l === 'invoice') return 'Against Invoice (30 Days SLA)';
      if (['standard', 'standard terms', 'standard payment terms', 'as specified'].includes(l)) return 'As per tender requirements';
      return s;
    };
    const paymentTerms = formatPay(rawPay);

    const warranty = first(
      p.warrantyDetails,
      p.warranty,
      respData.warranty,
      respData.warrantyDetails,
      details.warranty,
      details.warrantyDetails,
      ackData.warranty,
      firstItem.warranty
    ) || '—';

    const serviceSupport = first(
      p.serviceSupport,
      details.serviceSupport,
      respData.serviceSupport,
      ackData.serviceSupport
    ) || '—';

    // Technical
    const rawMake = first(
      p.makeBrand,
      details.makeBrand,
      respData.makeBrand,
      ackData.makeBrand,
      descData.makeBrand,
      techOffer.makeBrand,
      firstItem.makeBrand,
      firstItem.brand
    );
    const makeBrand = rawMake && !['standard', 'compliant with technical specs', 'as per tender'].includes(String(rawMake).trim().toLowerCase())
      ? String(rawMake).trim()
      : '—';

    const rawModel = first(
      p.model,
      p.modelNumber,
      details.model,
      respData.model,
      ackData.model,
      descData.model,
      techOffer.model,
      firstItem.model,
      firstItem.partNumber
    );
    const model = rawModel && !['standard', 'as per tender boq'].includes(String(rawModel).trim().toLowerCase())
      ? String(rawModel).trim()
      : '—';

    const techSpecs = first(
      p.techSpecs,
      details.techSpecs,
      respData.techSpecs,
      descData.offeredItemDescription,
      p.offeredItemDescription,
      firstItem.description
    ) || '';

    const complianceStatement = first(
      p.complianceStatement,
      details.complianceStatement,
      respData.complianceStatement,
      ackData.complianceStatement
    ) || (p.deviation ? 'WITH_DEVIATION' : '');

    const complianceRemarks = first(
      p.complianceRemarks,
      details.complianceRemarks,
      respData.complianceRemarks,
      ackData.complianceRemarks,
      p.deviation
    ) || '';

    const techStatus = String(p.technicalStatus || details.techStatus || 'PENDING').toUpperCase();
    const techScore = p.technicalScore ?? details.techScore;

    // Org & contact
    const sellerOrg = first(
      p.seller?.organization?.organizationName,
      p.sellerOrganization?.organizationName,
      p.sellerOrganizationName,
      p.sellerOrgName,
      p.seller?.name,
      p.sellerName
    ) || `Supplier #${p.sellerId || p.id}`;

    const contactPerson = first(
      p.seller?.name,
      p.sellerName,
      p.sellerUser?.name,
      respData.contactPerson,
      details.contactPerson
    ) || 'Authorized Representative';

    const email = first(
      p.seller?.email,
      p.sellerEmail,
      p.email,
      p.sellerUser?.email,
      respData.email
    ) || null;

    const phoneCandidates = [
      p.sellerMobile,
      p.seller?.mobile,
      p.seller?.phone,
      p.sellerUser?.mobile,
      p.sellerUser?.phone,
      p.phone,
      p.mobile,
      respData.sellerMobile,
      respData.mobile,
      respData.phone,
      ackData.sellerMobile,
      ackData.mobile
    ];
    const phone = phoneCandidates.find(v => typeof v === 'string' && v.trim().length > 0 && v !== '—' && v !== '-' && v !== 'null') || null;

    const orgObj = p.seller?.organization || p.sellerOrganization || p.organization || details.organization || {};
    const sellerProf = p.seller?.sellerProfile || p.sellerProfile || {};
    const buyerProf = p.seller?.buyerProfile || {};

    const city = first(
      orgObj.city,
      p.city,
      p.sellerCity,
      respData.city,
      details.city,
      sellerProf.city,
      buyerProf.city
    );

    const district = first(
      orgObj.district,
      p.district,
      p.sellerDistrict,
      respData.district,
      details.district,
      sellerProf.district,
      buyerProf.district
    );

    const state = first(
      orgObj.state,
      p.state,
      p.sellerState,
      respData.state,
      details.state,
      sellerProf.state,
      buyerProf.state
    );

    const addressLine = first(
      orgObj.addressLine1,
      orgObj.address,
      p.address,
      p.sellerAddress
    );

    const pincode = first(
      orgObj.pincode,
      p.pincode
    );

    const locParts = [city, district && district !== city ? district : null, state].filter(Boolean);
    let location: string | null = locParts.length > 0 ? locParts.join(', ') : null;

    if (!location && addressLine) {
      location = pincode ? `${addressLine}, ${pincode}` : String(addressLine);
    }

    if (!location && pincode) {
      location = `PIN: ${pincode}`;
    }

    return {
      raw: p,
      totalAmount,
      baseAmount,
      taxAmount,
      gstPercentage,
      offeredQty,
      deliveryTimeline,
      deliveryTerms,
      paymentTerms,
      warranty,
      serviceSupport,
      makeBrand,
      model,
      techSpecs,
      complianceStatement,
      complianceRemarks,
      techStatus,
      techScore,
      sellerOrg,
      contactPerson,
      email,
      phone,
      location,
      lineItems,
      submittedAt: p.submittedAt || p.createdAt
    };
  }, [bid]);

  // Filter and Sort participations
  const filteredAndSortedItems = useMemo(() => {
    if (!bid || !Array.isArray(bid.participations)) return [];
    
    let rawItems = [...bid.participations];

    // Optional user multi-selection filter
    if (selectedIds.length > 0) {
      rawItems = rawItems.filter(p => selectedIds.includes(p.id));
    }

    const parsedList = rawItems.map(p => parseQuotationData(p)).filter(Boolean) as NonNullable<ReturnType<typeof parseQuotationData>>[];

    // Status Filtering
    const filtered = parsedList.filter(item => {
      if (filterStatus === 'technically-qualified') return item.techStatus === 'QUALIFIED';
      if (filterStatus === 'disqualified') return item.techStatus === 'DISQUALIFIED' || item.techStatus === 'NOT_QUALIFIED';
      return true;
    });

    // Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'lowest-price') return a.totalAmount - b.totalAmount;
      if (sortBy === 'highest-price') return b.totalAmount - a.totalAmount;
      if (sortBy === 'supplier-name') return a.sellerOrg.localeCompare(b.sellerOrg);
      if (sortBy === 'earliest-submission') return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      return a.totalAmount - b.totalAmount;
    });

    // Assign ranking L1, L2, L3...
    return filtered.map((item, idx) => ({
      ...item,
      rank: idx + 1,
      isL1: idx === 0 && item.totalAmount > 0
    }));
  }, [bid, selectedIds, filterStatus, sortBy, parseQuotationData]);

  // Derived L1, L2, Savings and Spread metrics
  const comparisonMetrics = useMemo(() => {
    if (filteredAndSortedItems.length === 0) return null;

    const l1 = filteredAndSortedItems[0];
    const l2 = filteredAndSortedItems.length > 1 ? filteredAndSortedItems[1] : null;

    const l1Price = l1.totalAmount;
    const l2Price = l2 ? l2.totalAmount : l1Price;
    const prices = filteredAndSortedItems.map(p => p.totalAmount).filter(v => v > 0);
    const maxPrice = prices.length ? Math.max(...prices) : l1Price;

    const l1Savings = l2Price > l1Price ? l2Price - l1Price : 0;
    const savingsPercent = l2Price > 0 && l1Savings > 0 ? ((l1Savings / l2Price) * 100).toFixed(1) : '0.0';

    const qualifiedCount = filteredAndSortedItems.filter(p => p.techStatus === 'QUALIFIED').length;
    const disqualifiedCount = filteredAndSortedItems.filter(p => p.techStatus === 'DISQUALIFIED' || p.techStatus === 'NOT_QUALIFIED').length;

    const isAnomalouslyLow = Number(savingsPercent) >= 35.0;

    return {
      l1,
      l2,
      l1Price,
      l2Price,
      maxPrice,
      l1Savings,
      savingsPercent,
      isAnomalouslyLow,
      qualifiedCount,
      disqualifiedCount,
      totalCount: filteredAndSortedItems.length
    };
  }, [filteredAndSortedItems]);

  const checkDiffers = (values: any[]) => {
    const normalized = values.map(v => String(v || '').trim().toLowerCase());
    const unique = new Set(normalized);
    return unique.size > 1;
  };

  const handlePreviewDoc = (d: any) => {
    const assetId = d.fileAssetId || (typeof d.id === 'number' ? d.id : null);
    const title = d.name || d.fileName || 'Quotation Document';
    if (assetId) {
      openFileAsset({
        id: assetId,
        fileAssetId: assetId,
        originalName: title,
        url: d.fileUrl || `/api/files/${assetId}/view`
      }, title).catch(() => {
        window.open(d.fileUrl || `/api/files/${assetId}/view`, '_blank', 'noopener');
      });
      return;
    }
    if (d.fileUrl || d.url) {
      window.open(d.fileUrl || d.url, '_blank', 'noopener');
      return;
    }
    toast.error('Document preview is not available.');
  };

  const handleExportCsv = () => {
    if (!filteredAndSortedItems.length) return;
    const headers = ['Evaluation Parameter', ...filteredAndSortedItems.map(p => `[L${p.rank}] ${p.sellerOrg}`)];
    
    const rows: string[][] = [
      headers,
      ['Commercial Rank', ...filteredAndSortedItems.map(p => `L${p.rank}`)],
      ['Total Landed Quoted (INR)', ...filteredAndSortedItems.map(p => String(p.totalAmount))],
      ['Base Amount (excl. Tax) (INR)', ...filteredAndSortedItems.map(p => String(p.baseAmount))],
      ['GST Rate (%)', ...filteredAndSortedItems.map(p => `${p.gstPercentage}%`)],
      ['Tax Amount (INR)', ...filteredAndSortedItems.map(p => String(p.taxAmount))],
      ['Offered Scope & Quantity', ...filteredAndSortedItems.map(p => p.offeredQty)],
      ['Promised Delivery Timeline', ...filteredAndSortedItems.map(p => p.deliveryTimeline)],
      ['Delivery Terms & Freight', ...filteredAndSortedItems.map(p => p.deliveryTerms)],
      ['Payment Terms', ...filteredAndSortedItems.map(p => p.paymentTerms)],
      ['Warranty Terms', ...filteredAndSortedItems.map(p => p.warranty)],
      ['Technical Status', ...filteredAndSortedItems.map(p => p.techStatus)],
      ['Compliance Statement', ...filteredAndSortedItems.map(p => p.complianceStatement)],
      ['Make / Brand', ...filteredAndSortedItems.map(p => p.makeBrand)],
      ['Model / Part Reference', ...filteredAndSortedItems.map(p => p.model)],
      ['Contact Person', ...filteredAndSortedItems.map(p => p.contactPerson)],
      ['Email Address', ...filteredAndSortedItems.map(p => p.email || '—')],
      ['Mobile Number', ...filteredAndSortedItems.map(p => p.phone || '—')],
      ['Location', ...filteredAndSortedItems.map(p => p.location)],
      ['Quotation Documents Count', ...filteredAndSortedItems.map(p => String(normalizeQuotationDocuments(p.raw).length))]
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Procurement_Quotation_Comparison_${bidId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Official comparison matrix exported to CSV!');
  };

  if (isLoading) {
    return (
      <PageShell>
        <div className="container mx-auto p-6 max-w-7xl">
          <ProcurementLoadingState message="Analyzing and computing quotation comparison matrix..." />
        </div>
      </PageShell>
    );
  }

  if (error || !bid) {
    return (
      <PageShell>
        <div className="container mx-auto p-6 max-w-7xl">
          <ProcurementErrorState message="Could not fetch bid comparison details." onRetry={refetch} />
        </div>
      </PageShell>
    );
  }

  // Statutory Guard: Double-Packet Financial Opening Gate
  if (isTwoPacket && !isFinancialOpened) {
    const formattedFinDate = candidateFinDate
      ? new Date(candidateFinDate).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : null;

    return (
      <PageShell>
        <div className="container mx-auto p-6 max-w-4xl space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 shadow-xs">
              <Lock className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 border border-blue-200 px-3 py-1 text-xs font-black text-blue-900 uppercase tracking-wide">
                <Layers className="h-3.5 w-3.5" /> Two-Packet Procurement Statutory Guard
              </span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Stage 2 Financial Opening Pending
              </h1>
              <p className="text-sm font-medium text-slate-600 max-w-xl mx-auto leading-relaxed">
                In strict compliance with Two-Packet procurement rules, financial quotations and commercial ranking remain encrypted and sealed until Stage 1 Technical Scrutiny has been formally concluded and qualified.
              </p>
            </div>

            {formattedFinDate && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-800">
                <Clock className="h-4 w-4 text-blue-600" />
                <span>Scheduled Financial Opening: <strong className="text-slate-900">{formattedFinDate}</strong></span>
              </div>
            )}

            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => router.push(`/bids/${bidId}`)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0b2447] px-6 text-xs font-black text-white hover:bg-[#12335f] transition shadow-xs cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Return to Technical Scrutiny</span>
              </button>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="container mx-auto space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl">
        
        {/* Top Breadcrumb & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back();
                } else {
                  router.push(`/bids/${bidId}/results`);
                }
              }}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-slate-250 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 text-slate-500" />
              <span>Back to Results</span>
            </button>

            <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-500 ml-2">
              <span
                className="hover:text-slate-800 cursor-pointer"
                onClick={() => router.push('/bids')}
              >
                Procurements
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <span
                className="font-mono text-slate-700 hover:text-slate-900 cursor-pointer font-bold"
                onClick={() => router.push(`/bids/${bidId}/results`)}
              >
                {bidId}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <span className="text-slate-900 font-extrabold bg-slate-100 border border-slate-250 px-2 py-0.5 rounded-md text-[11px]">
                Side-by-Side Quotation Comparison
              </span>
            </nav>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => router.push(`/bids/${bidId}/results`)}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-[#0b2447] hover:bg-[#12335f] text-white px-3.5 text-xs font-black shadow-2xs transition cursor-pointer"
            >
              <span>Evaluation & Award Console</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-slate-250 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-emerald-700 transition cursor-pointer"
              title="Download Side-by-Side Comparison as CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-slate-250 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer"
              title="Print / Save as PDF"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              <span>Print</span>
            </button>

            <button
              type="button"
              onClick={() => router.push(`/bids/${bidId}/results`)}
              className="flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              title="Close Comparison"
              aria-label="Close Comparison"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main Comparison Container Shell */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-xs space-y-6">
          
          {/* Header & Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-150 pb-5">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0b2447] text-white shadow-xs">
                <Scale className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    Commercial & Technical Quotation Comparison
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 uppercase tracking-wide">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" /> Statutory L1 Evaluation
                  </span>
                  {isTwoPacket ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                      Two-Packet Mode
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-250 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      Single-Packet Mode
                    </span>
                  )}
                </div>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Comparing <strong className="text-slate-800">{filteredAndSortedItems.length}</strong> participating seller quotation{filteredAndSortedItems.length === 1 ? '' : 's'} for tender <strong className="font-mono text-slate-800">{bidId}</strong>.
                </p>
              </div>
            </div>

            {/* Quick Controls: Filter & Selection Reset */}
            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              {selectedIds.length > 0 && (
                <button
                  onClick={() => setSelectedIds([])}
                  className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-250 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer shadow-2xs"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                  <span>Show All ({bid?.participations?.length || 0})</span>
                </button>
              )}

              <select
                aria-label="Filter quotations by status"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="h-8 rounded-xl border border-slate-250 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="all">Filter: All Quotes</option>
                <option value="technically-qualified">Technically Qualified Only</option>
                <option value="disqualified">Disqualified Only</option>
              </select>

              <select
                aria-label="Sort quotations"
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="h-8 rounded-xl border border-slate-250 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-2xs focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="lowest-price">Sort: Lowest Price (L1 First)</option>
                <option value="highest-price">Sort: Highest Price</option>
                <option value="supplier-name">Sort: Supplier Name</option>
                <option value="earliest-submission">Sort: Submission Date</option>
              </select>
            </div>
          </div>

          {/* Decision Support Command Bar (4 Rigorous KPI Cards) */}
          {comparisonMetrics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Card 1: L1 Lowest Evaluated Bidder */}
              <div className="rounded-2xl border border-emerald-250 bg-emerald-50/40 p-4 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                    <Trophy className="h-3.5 w-3.5 text-emerald-700" /> L1 Lowest Evaluated Quote
                  </span>
                  <span className="inline-block rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-black text-white uppercase">
                    Rank 1
                  </span>
                </div>
                <div>
                  <p className="text-xl font-black text-emerald-950 tracking-tight">
                    {money(comparisonMetrics.l1Price)}
                  </p>
                  <p className="text-xs font-extrabold text-slate-800 truncate uppercase mt-0.5" title={comparisonMetrics.l1.sellerOrg}>
                    {comparisonMetrics.l1.sellerOrg}
                  </p>
                </div>
                <p className="text-[10.5px] font-semibold text-slate-500">
                  Landed cost including GST & all applicable charges
                </p>
              </div>

              {/* Card 2: L1 vs L2 Spread & Viability Assessment */}
              <div className={`rounded-2xl border p-4 space-y-2 shadow-2xs ${comparisonMetrics.isAnomalouslyLow ? 'border-amber-300 bg-amber-50/50' : 'border-blue-200 bg-blue-50/30'}`}>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider ${comparisonMetrics.isAnomalouslyLow ? 'text-amber-900' : 'text-blue-900'}`}>
                    <Scale className="h-3.5 w-3.5" /> L1 vs L2 Spread & Viability
                  </span>
                  <span className="text-[9.5px] font-bold text-slate-600 bg-white/80 border border-slate-200 px-1.5 py-0.5 rounded">
                    Price Delta
                  </span>
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900 tracking-tight">
                    {comparisonMetrics.l1Savings > 0 ? money(comparisonMetrics.l1Savings) : '₹0.00'}
                  </p>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">
                    {comparisonMetrics.savingsPercent}% lower than L2
                  </p>
                </div>
                {comparisonMetrics.isAnomalouslyLow ? (
                  <p className="text-[10.5px] font-bold text-amber-800 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" /> High variance (&gt;35%). Verify GST & BOQ breakdown.
                  </p>
                ) : (
                  <p className="text-[10.5px] font-semibold text-slate-500">
                    Competitive price variance within normal market threshold
                  </p>
                )}
              </div>

              {/* Card 3: Technical Clearance Gate */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-slate-700 text-[10px] font-black uppercase tracking-wider">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-700" /> Technical Clearance Gate
                  </span>
                  <span className="text-[9.5px] font-bold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                    Scrutiny
                  </span>
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900 tracking-tight">
                    {comparisonMetrics.qualifiedCount} / {comparisonMetrics.totalCount}
                  </p>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">
                    Suppliers Technically Qualified
                  </p>
                </div>
                <p className="text-[10.5px] font-semibold text-slate-500">
                  {comparisonMetrics.disqualifiedCount > 0 ? `${comparisonMetrics.disqualifiedCount} disqualified • ` : ''}{comparisonMetrics.qualifiedCount} cleared for commercial evaluation
                </p>
              </div>

              {/* Card 4: Statutory Procurement Packet Mode */}
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-indigo-900 text-[10px] font-black uppercase tracking-wider">
                    <Layers className="h-3.5 w-3.5 text-indigo-700" /> Statutory Packet Mode
                  </span>
                  <span className="text-[9.5px] font-bold text-indigo-800 bg-indigo-100 px-1.5 py-0.5 rounded">
                    Policy
                  </span>
                </div>
                <div>
                  <p className="text-base font-black text-indigo-950 tracking-tight">
                    {isTwoPacket ? 'Two-Packet (Stage 2 Opened)' : 'Single-Packet Tender'}
                  </p>
                  <p className="text-xs font-bold text-indigo-900 mt-0.5">
                    L1 Lowest Evaluated Criteria
                  </p>
                </div>
                <p className="text-[10.5px] font-semibold text-slate-500">
                  Statutory evaluation & audit record active
                </p>
              </div>

            </div>
          )}

          {/* Comparison Matrix Table */}
          <div className="w-full rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table data-ux-wrapped="true" className="w-full min-w-[960px] border-collapse text-left text-xs">
                
                {/* Header Columns per Supplier */}
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="p-4 w-[260px] font-black text-slate-800 uppercase tracking-wider bg-slate-100 border-r border-slate-200 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center gap-1.5">
                        <Scale className="h-4 w-4 text-slate-600" />
                        <span>Evaluation Parameter</span>
                      </div>
                    </th>
                    {filteredAndSortedItems.map((p, index) => {
                      const isL1 = p.isL1;
                      const diff = p.totalAmount - (comparisonMetrics?.l1Price || 0);
                      const diffPct = comparisonMetrics?.l1Price && comparisonMetrics.l1Price > 0
                        ? ((diff / comparisonMetrics.l1Price) * 100).toFixed(1)
                        : '0.0';

                      return (
                        <th 
                          key={p.raw.id || index} 
                          className={`p-4 border-r border-slate-200 align-top min-w-[280px] ${isL1 ? 'bg-emerald-50/50 border-t-4 border-t-emerald-600' : 'bg-slate-50/30'}`}
                        >
                          <div className="space-y-3">
                            {/* Rank Badge */}
                            <div>
                              {isL1 ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-700 px-3 py-1 text-[10.5px] font-black text-white shadow-2xs uppercase tracking-wider">
                                  L1 — LOWEST EVALUATED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-300 px-3 py-1 text-[10.5px] font-extrabold text-slate-800 shadow-2xs">
                                  L{p.rank} (+{money(diff)} • +{diffPct}%)
                                </span>
                              )}
                            </div>

                            {/* Organization & Representative */}
                            <div>
                              <p className="text-[13px] font-black text-slate-900 uppercase tracking-tight leading-snug break-words" title={p.sellerOrg}>
                                {p.sellerOrg}
                              </p>
                              <p className="text-xs font-semibold text-slate-600 mt-0.5 flex items-center gap-1">
                                <span className="text-slate-400">👤</span> {p.contactPerson}
                              </p>
                              <p className="text-[11px] font-medium text-slate-400 truncate mt-0.5">
                                📍 {p.location}
                              </p>
                            </div>

                            {/* Clean Status Pill (Award actions live on Results page) */}
                            <div>
                              {(() => {
                                const existingAward = (bid?.awards || []).find((a: any) => a.participationId === p.raw.id || a.sellerId === p.raw.sellerId);
                                const isOffered = p.raw.finalStatus === 'AWARD_OFFERED' || existingAward?.awardStatus === 'OFFERED';
                                const isAccepted = p.raw.finalStatus === 'AWARD_ACCEPTED' || existingAward?.awardStatus === 'ACCEPTED';
                                const isPoIssued = p.raw.finalStatus === 'PO_ISSUED' || p.raw.finalStatus === 'ORDERED';

                                if (isPoIssued) {
                                  return (
                                    <div className="flex h-8.5 items-center justify-center gap-1.5 rounded-xl border border-slate-250 bg-slate-100 px-3 text-xs font-bold text-slate-700 shadow-2xs">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" />
                                      <span>Purchase Order Issued</span>
                                    </div>
                                  );
                                }

                                if (isAccepted) {
                                  return (
                                    <div className="flex h-8.5 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-100 px-3 text-xs font-bold text-emerald-900 shadow-2xs">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                      <span>Award Accepted by Supplier</span>
                                    </div>
                                  );
                                }

                                if (isOffered) {
                                  return (
                                    <div className="flex h-8.5 items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-100 px-3 text-xs font-bold text-amber-900 shadow-2xs">
                                      <Clock className="h-3.5 w-3.5 text-amber-600" />
                                      <span>Award Offered (Pending Acceptance)</span>
                                    </div>
                                  );
                                }

                                if (p.techStatus === 'DISQUALIFIED') {
                                  return (
                                    <div className="flex h-8.5 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700">
                                      <XCircle className="h-3.5 w-3.5 text-rose-600" />
                                      <span>Technically Disqualified</span>
                                    </div>
                                  );
                                }

                                if (isL1) {
                                  return (
                                    <div className="flex h-8.5 items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-black text-emerald-800 shadow-2xs">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                      <span>Evaluated L1 (Lowest Compliant)</span>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="flex h-8.5 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700">
                                    <span>Qualified Bidder (L{p.rank})</span>
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* Table Body Rows */}
                <tbody className="divide-y divide-slate-150">
                  
                  {/* ======================================================== */}
                  {/* CATEGORY 1: COMMERCIAL & PRICING BREAKDOWN */}
                  {/* ======================================================== */}
                  <tr className="bg-slate-100 font-black text-slate-900 text-[11px] uppercase tracking-wider">
                    <td colSpan={filteredAndSortedItems.length + 1} className="p-3 pl-4 border-b border-slate-200 bg-slate-100 font-black">
                      <span className="flex items-center gap-1.5 text-[#0b2447]">
                        <span className="h-3.5 w-1 bg-[#0b2447] rounded-full" />
                        1. Commercial & Price Breakdown
                      </span>
                    </td>
                  </tr>

                  {/* 1.1 Commercial Rank */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Commercial Rank
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200 font-black">
                        {p.isL1 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-0.5 text-[10px] text-white">
                            L1 (Lowest Bidder)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-300 px-2.5 py-0.5 text-[10px] text-slate-700 font-bold">
                            L{p.rank}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* 1.2 Total Landed Amount (incl. GST) */}
                  <tr className="hover:bg-emerald-50/20 bg-emerald-50/10 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-black text-slate-900 bg-slate-50/70 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Total Quoted Amount (incl. GST)
                      {checkDiffers(filteredAndSortedItems.map(p => p.totalAmount)) && (
                        <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[8.5px] font-black text-amber-800 uppercase tracking-wider border border-amber-200">
                          DIFFERS
                        </span>
                      )}
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200">
                        <div className="font-black text-base text-slate-900">{money(p.totalAmount)}</div>
                        {p.isL1 ? (
                          <span className="inline-block rounded-md bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[9.5px] font-black text-emerald-800 uppercase tracking-wide mt-1">
                            Lowest Evaluated Benchmark
                          </span>
                        ) : (
                          <span className="inline-block rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[9.5px] font-bold text-slate-600 mt-1">
                            +{money(p.totalAmount - (comparisonMetrics?.l1Price || 0))} (+{comparisonMetrics?.l1Price ? (((p.totalAmount - comparisonMetrics.l1Price) / comparisonMetrics.l1Price) * 100).toFixed(1) : 0}%)
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* 1.3 Price Variance vs L1 Benchmark */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Price Variance vs. L1
                    </td>
                    {filteredAndSortedItems.map((p) => {
                      const diff = p.totalAmount - (comparisonMetrics?.l1Price || 0);
                      const diffPct = comparisonMetrics?.l1Price && comparisonMetrics.l1Price > 0
                        ? ((diff / comparisonMetrics.l1Price) * 100).toFixed(1)
                        : '0.0';

                      return (
                        <td key={p.raw.id} className="p-3.5 border-r border-slate-200">
                          {p.isL1 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-black text-emerald-900">
                              <CheckCircle2 className="h-3 w-3 text-emerald-700" />
                              L1 Benchmark (Lowest)
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-slate-700">
                              +{money(diff)}{" "}
                              <span className="text-rose-600 font-extrabold text-[11px]">
                                (+{diffPct}%)
                              </span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* 1.4 Base Price (excl. Tax) */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Base Value (excl. GST)
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200 font-extrabold text-slate-800">
                        {money(p.baseAmount)}
                      </td>
                    ))}
                  </tr>

                  {/* 1.5 GST & Taxes */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Applicable GST & Tax Value
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200 font-bold text-slate-700">
                        {p.gstPercentage > 0 ? `${p.gstPercentage}%` : 'Standard Rate'}{" "}
                        <span className="text-slate-500 font-normal">
                          ({money(p.taxAmount)})
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* 1.6 Payment Terms */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Payment Terms
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200 font-medium text-slate-700">
                        {p.paymentTerms}
                      </td>
                    ))}
                  </tr>

                  {/* ======================================================== */}
                  {/* CATEGORY 2: SCOPE, QUANTITY & DELIVERY SLA */}
                  {/* ======================================================== */}
                  <tr className="bg-slate-100 font-black text-slate-900 text-[11px] uppercase tracking-wider">
                    <td colSpan={filteredAndSortedItems.length + 1} className="p-3 pl-4 border-b border-slate-200 bg-slate-100 font-black">
                      <span className="flex items-center gap-1.5 text-[#0b2447]">
                        <span className="h-3.5 w-1 bg-[#0b2447] rounded-full" />
                        2. Scope, Quantity & Delivery Fulfillment SLA
                      </span>
                    </td>
                  </tr>

                  {/* 2.1 Offered Scope & Quantity */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Offered Scope & Quantity
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200 font-black text-slate-900">
                        <span className="inline-flex items-center gap-1">
                          <Package className="h-3.5 w-3.5 text-slate-400" />
                          {p.offeredQty}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* 2.2 Promised Delivery Timeline */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Promised Delivery Timeline SLA
                      {checkDiffers(filteredAndSortedItems.map(p => p.deliveryTimeline)) && (
                        <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[8.5px] font-black text-amber-800 uppercase tracking-wider border border-amber-200">
                          DIFFERS
                        </span>
                      )}
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200 font-black text-slate-800">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-blue-600" />
                          {p.deliveryTimeline}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* 2.3 Delivery Terms & Freight */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Delivery Location & Freight
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200 font-semibold text-slate-700">
                        {p.deliveryTerms && p.deliveryTerms !== '—' ? (
                          <span className="inline-flex items-center gap-1">
                            <Truck className="h-3.5 w-3.5 text-slate-400" />
                            {p.deliveryTerms}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal italic">—</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* 2.4 Warranty & Guarantee */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Warranty & Guarantee Terms
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200 font-semibold text-slate-800">
                        {p.warranty && p.warranty !== '—' ? (
                          p.warranty
                        ) : (
                          <span className="text-slate-400 font-normal italic">—</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* 2.5 Post-Sale Support */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Post-Sale Service Support
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200 font-medium text-slate-600">
                        {p.serviceSupport && p.serviceSupport !== '—' ? (
                          p.serviceSupport
                        ) : (
                          <span className="text-slate-400 font-normal italic">—</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* ======================================================== */}
                  {/* CATEGORY 3: TECHNICAL SPECIFICATIONS & COMPLIANCE */}
                  {/* ======================================================== */}
                  <tr className="bg-slate-100 font-black text-slate-900 text-[11px] uppercase tracking-wider">
                    <td colSpan={filteredAndSortedItems.length + 1} className="p-3 pl-4 border-b border-slate-200 bg-slate-100 font-black">
                      <span className="flex items-center gap-1.5 text-[#0b2447]">
                        <span className="h-3.5 w-1 bg-[#0b2447] rounded-full" />
                        3. Technical Specifications & Compliance
                      </span>
                    </td>
                  </tr>

                  {/* 3.1 Technical Scrutiny Status */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Stage 1 Technical Scrutiny
                    </td>
                    {filteredAndSortedItems.map((p) => {
                      const isQual = p.techStatus === 'QUALIFIED';
                      const isDisq = p.techStatus === 'DISQUALIFIED' || p.techStatus === 'NOT_QUALIFIED';

                      return (
                        <td key={p.raw.id} className="p-3.5 border-r border-slate-200">
                          {isQual ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-800 shadow-2xs">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Qualified
                            </span>
                          ) : isDisq ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-0.5 text-[10px] font-black text-rose-800 shadow-2xs">
                              <XCircle className="h-3.5 w-3.5 text-rose-600" /> Disqualified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-black text-amber-800 shadow-2xs">
                              <Clock className="h-3.5 w-3.5 text-amber-600" /> Pending Review
                            </span>
                          )}
                          {p.techScore != null && (
                            <span className="block text-[10px] font-bold text-slate-500 mt-1">
                              Scrutiny Score: {p.techScore}/100
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* 3.2 Technical Compliance Statement */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Technical Compliance Statement
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200">
                        {p.complianceStatement === 'WITH_DEVIATION' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            <AlertTriangle className="h-3 w-3 text-amber-600" /> Minor Deviation
                          </span>
                        ) : p.complianceStatement === 'ALTERNATIVE_OFFERED' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-purple-50 border border-purple-200 px-2 py-0.5 text-[10px] font-bold text-purple-800">
                            Alternative Offered
                          </span>
                        ) : p.complianceStatement === 'COMPLIANT' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            <Check className="h-3 w-3 text-emerald-600" /> Compliant
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal italic">—</span>
                        )}
                        {p.complianceRemarks && (
                          <p className="text-[10px] text-slate-500 mt-1 italic">
                            {p.complianceRemarks}
                          </p>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* 3.3 Make / Brand */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Brand / Make Offered
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200 font-bold text-slate-800">
                        {p.makeBrand && p.makeBrand !== '—' ? (
                          p.makeBrand
                        ) : (
                          <span className="text-slate-400 font-normal italic">—</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* 3.4 Model / Part Reference */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Model / Part Reference No
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200 font-bold text-slate-800">
                        {p.model && p.model !== '—' ? (
                          p.model
                        ) : (
                          <span className="text-slate-400 font-normal italic">—</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* 3.5 Offered Technical Specs */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Offered Technical Details
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200 font-medium text-slate-600 text-[11.5px] leading-relaxed">
                        {p.techSpecs || 'Fully compliant with tender technical schedule requirements'}
                      </td>
                    ))}
                  </tr>

                  {/* ======================================================== */}
                  {/* CATEGORY 4: BIDDER PROFILE & AUDIT TRAIL */}
                  {/* ======================================================== */}
                  <tr className="bg-slate-100 font-black text-slate-900 text-[11px] uppercase tracking-wider">
                    <td colSpan={filteredAndSortedItems.length + 1} className="p-3 pl-4 border-b border-slate-200 bg-slate-100 font-black">
                      <span className="flex items-center gap-1.5 text-[#0b2447]">
                        <span className="h-3.5 w-1 bg-[#0b2447] rounded-full" />
                        4. Supplier Profile & Submitted Records
                      </span>
                    </td>
                  </tr>

                  {/* 4.1 Organization & Location */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Registered Organization
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200">
                        <p className="font-black text-slate-900 uppercase">{p.sellerOrg}</p>
                        {p.location ? (
                          <p className="text-[11px] font-semibold text-slate-600 mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-rose-500 shrink-0" />
                            <span>{p.location}</span>
                          </p>
                        ) : (
                          <p className="text-[11px] font-normal text-slate-400 mt-0.5 italic">
                            Location not specified
                          </p>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* 4.2 Representative & Contact */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Authorized Representative
                    </td>
                    {filteredAndSortedItems.map((p) => (
                      <td key={p.raw.id} className="p-3.5 border-r border-slate-200">
                        <p className="font-bold text-slate-800">{p.contactPerson}</p>
                        {p.phone && (
                          <p className="text-[11px] font-bold text-slate-600 mt-0.5 flex items-center gap-1">
                            <Phone className="h-3 w-3 text-emerald-600" />
                            <a href={`tel:${p.phone.replace(/[^0-9+]/g, '')}`} className="hover:underline text-slate-800">
                              {p.phone}
                            </a>
                          </p>
                        )}
                        {p.email && (
                          <p className="text-[11px] font-medium text-blue-600 truncate mt-0.5">
                            <a href={`mailto:${p.email}`} className="hover:underline">
                              {p.email}
                            </a>
                          </p>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* 4.3 Uploaded Documents */}
                  <tr className="hover:bg-slate-50/60 transition-colors bg-slate-50/30">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] align-top">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-blue-600" />
                          <span>Submitted Documents</span>
                        </div>
                        <span className="text-[10px] font-normal text-slate-400 block">
                          Technical & Commercial attachments
                        </span>
                      </div>
                    </td>
                    {filteredAndSortedItems.map((p) => {
                      const docs = normalizeQuotationDocuments(p.raw);
                      return (
                        <td key={p.raw.id} className="p-3.5 border-r border-slate-200 align-top">
                          {docs.length > 0 ? (
                            <div className="flex flex-col gap-2">
                              {docs.map((d, dIdx) => (
                                <button
                                  key={dIdx}
                                  type="button"
                                  onClick={() => handlePreviewDoc(d)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-slate-250 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:border-blue-400 hover:bg-blue-50/60 hover:text-blue-800 transition shadow-2xs text-left group cursor-pointer"
                                  title={`Click to view/download ${d.name}`}
                                >
                                  <FileText className="h-4 w-4 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" />
                                  <span className="truncate max-w-[200px]">{d.name}</span>
                                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-blue-600 ml-auto shrink-0 transition-colors" />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                              <Info className="h-3.5 w-3.5 text-slate-400" />
                              <span>No documents attached</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* 4.4 Submission Timestamp */}
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3.5 pl-4 border-r border-slate-200 font-bold text-slate-700 bg-slate-50/60 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      Submission Timestamp
                    </td>
                    {filteredAndSortedItems.map((p) => {
                      const dateVal = p.submittedAt;
                      const formatted = dateVal ? new Date(dateVal).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : '—';
                      return (
                        <td key={p.raw.id} className="p-3.5 border-r border-slate-200 font-semibold text-slate-600">
                          {formatted}
                        </td>
                      );
                    })}
                  </tr>

                </tbody>
              </table>
            </div>
          </div>

          {/* Sticky Bottom Helper Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-150 pt-4 text-xs">
            <p className="text-slate-500 font-semibold text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>
                Formal statutory actions (Contract Award, MSE Match L1, Reverse Auction) are executed on the Results Console.
              </span>
            </p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => router.push(`/bids/${bidId}`)}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-250 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
              >
                Back to Tender
              </button>
              <button
                type="button"
                onClick={() => router.push(`/bids/${bidId}/results`)}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#0b2447] px-5 text-xs font-black text-white hover:bg-[#12335f] transition shadow-xs cursor-pointer"
              >
                <span>Proceed to Award & Evaluation Console</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </PageShell>
  );
}
