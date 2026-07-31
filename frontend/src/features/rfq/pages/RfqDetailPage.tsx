'use client';

import React, { useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import {
  Download,
  Calendar,
  MapPin,
  Building2,
  Check,
  ChevronRight,
  Loader2,
  Eye,
  FileText,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Layers,
  Paperclip,
  ClipboardList,
  IndianRupee,
  AlertTriangle,
  Info,
  Package,
  CalendarDays,
  ClipboardCheck,
  Clock,
  CheckCircle,
  Users,
  Award,
  Wrench,
  Gavel,
  TrendingUp,
  Tag,
  Building,
  Zap,
  UserCheck,
  CheckCircle2,
  Sparkles,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { EmdCard, EmdInfo } from '../components/EmdCard';
import { EmdPaymentModal } from '../components/EmdPaymentModal';
import { getApi } from '../../shared/apiClient';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { openFileAsset } from '../../../lib/files';
import { PdfEngine } from '../../../lib/pdfEngine';
import ClarificationPanel from '../components/ClarificationPanel';
import { procurementBidApi } from '../../procurementBid/api';

/* ═══════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════ */

const isPresentValue = (value: any): boolean => {
  if (value === null || value === undefined || value === '' || value === '—' || value === '-') return false;
  if (typeof value === 'number' && value === 0) return false;
  if (Array.isArray(value)) return value.length > 0 && value.some(isPresentValue);
  if (typeof value === 'object') return Object.values(value).some(isPresentValue);
  return true;
};

const humanizeKey = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

const formatDetailValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString('en-IN');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (item && typeof item === 'object') {
          return String(item.name || item.title || item.label || item.supplierName || item.itemName || item.fileName || item.location || item.id || JSON.stringify(item));
        }
        return String(item);
      })
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, v]) => isPresentValue(v))
      .map(([k, v]) => `${humanizeKey(k)}: ${formatDetailValue(v)}`)
      .join(' • ');
  }
  return String(value);
};

const detailFieldsFromObject = (source: any, labelMap: Record<string, string> = {}) => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return [];
  return Object.entries(source)
    .filter(([key, value]) => isPresentValue(value) && !['id', 'documents', 'items', 'boqTable'].includes(key))
    .map(([key, value]) => ({
      label: labelMap[key] || humanizeKey(key),
      value: formatDetailValue(value)
    }))
    .filter(field => field.value);
};

const detailSection = (title: string, source: any, labelMap?: Record<string, string>) => {
  const fields = detailFieldsFromObject(source, labelMap);
  return fields.length ? { title, fields } : null;
};

const formatCurrency = (val?: number) => {
  if (!val) return '—';
  return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const formatDateString = (dateStr?: string | Date, includeTime = false) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = d.getDate().toString().padStart(2, '0');
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    let base = `${day} ${month} ${year}`;
    if (includeTime) {
      const hours = d.getHours().toString().padStart(2, '0');
      const minutes = d.getMinutes().toString().padStart(2, '0');
      base += ` ${hours}:${minutes} IST`;
    }
    return base;
  } catch {
    return String(dateStr);
  }
};

const formatDisplayValue = (val: string, label?: string) => {
  if (!val || val === '—' || val === '-') return '—';

  // Currency formatting for price / value / amount / budget / cost fields
  if (label) {
    const l = label.toLowerCase();
    if (l.includes('price') || l.includes('value') || l.includes('budget') || l.includes('amount') || l.includes('cost')) {
      const cleanVal = String(val).replace(/[^0-9.]/g, '');
      const num = Number(cleanVal);
      if (!isNaN(num) && num > 0) {
        return `₹${num.toLocaleString('en-IN')}`;
      }
    }
  }

  // Date / ISO String formatting (e.g. 2026-07-25T18:55 or 2026-07-25)
  if (typeof val === 'string') {
    if (val.match(/^\d{4}-\d{2}-\d{2}/)) {
      return formatDateString(val, val.includes('T') || val.includes(':'));
    }
  }

  // System concatenated description cleanup
  if (typeof val === 'string' && val.includes('Sourcing Method:')) {
    return val
      .replace(/Sourcing Method:\s*/gi, 'Sourcing Method: ')
      .replace(/RFQValue:\s*/gi, 'RFQ • Value: ')
      .replace(/Value:\s*INR\s*/gi, 'Value: ₹')
      .replace(/Urgency:\s*/gi, ' • Urgency: ');
  }

  // Capitalized CONSTANT_CASE strings
  if (typeof val === 'string' && val.match(/^[A-Z][A-Z0-9_]*$/)) {
    return val
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  return String(val);
};

const parseDescription = (desc?: string) => {
  if (!desc) return { method: '', value: '', urgency: '', text: '' };
  const cleanedDesc = desc.replace(/\r/g, '');
  const methodMatch = cleanedDesc.match(/Sourcing Method:\s*([^V\n]*?)(?=(?:Value:|Urgency:|$))/i);
  const valueMatch = cleanedDesc.match(/Value:\s*([^U\n]*?)(?=(?:Urgency:|$))/i);
  const urgencyMatch = cleanedDesc.match(/Urgency:\s*(.*?)(?=\n|$)/i);

  let cleanText = cleanedDesc;
  if (methodMatch || valueMatch || urgencyMatch) {
    cleanText = cleanedDesc
      .replace(/Sourcing Method:\s*.*?(?=(?:Value:|Urgency:|$))/gi, '')
      .replace(/Value:\s*.*?(?=(?:Urgency:|$))/gi, '')
      .replace(/Urgency:\s*.*?(?=\n|$)/gi, '')
      .replace(/\n+/g, '\n')
      .trim();
  }
  return {
    method: methodMatch ? methodMatch[1].trim() : '',
    value: valueMatch ? valueMatch[1].trim() : '',
    urgency: urgencyMatch ? urgencyMatch[1].trim() : '',
    text: cleanText
  };
};

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */

export default function RfqDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || '';
  const { user } = useAuth();
  const requestId = searchParams?.get('requestId') || '';
  const requirementId = searchParams?.get('requirementId') || '';

  const [activeSection, setActiveSection] = useState<number | null>(0);
  const [isDescExpanded, setIsDescExpanded] = useState<boolean>(false);

  // Auto-update activeSection based on manual page scroll position
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
      const elements = document.querySelectorAll('[id^="sec-content-"]');
      if (!elements || elements.length === 0) return;

      const scrollPosition = window.scrollY + 160;
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i] as HTMLElement;
        if (el) {
          const top = el.offsetTop;
          if (scrollPosition >= top) {
            setActiveSection(i);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Fetch ProcurementBid data when requestId is provided (numeric ID or REQ-* reference ID)
  const { data: bidData, isLoading: bidLoading, error: bidError } = useQuery({
    queryKey: ['procurement-bid-rfq-detail', requestId],
    queryFn: () => procurementBidApi.detail(requestId),
    enabled: !!requestId,
  });

  // Fetch BuyerRequirement data when requirementId is provided
  const { data: reqData, isLoading: reqLoading, error: reqError } = useQuery({
    queryKey: ['marketplace-requirement-rfq-detail', requirementId],
    queryFn: async () => {
      const data = await getApi<any>(`/api/marketplace/requirements/${requirementId}`);
      return data;
    },
    enabled: !!requirementId,
  });

  // When page is accessed via requestId (procurement bid path), bidData doesn't include ownResponse.
  // After bidData resolves and gives us a numeric sourceId, fetch the marketplace requirement
  // to get the seller's own quotation status (ownResponse) for the Submit button state.
  const bidSourceId = bidData?.sourceId || null;
  const { data: bidReqData } = useQuery({
    queryKey: ['marketplace-requirement-rfq-ownresponse', bidSourceId],
    queryFn: async () => {
      const data = await getApi<any>(`/api/marketplace/requirements/${bidSourceId}`);
      return data;
    },
    enabled: !!requestId && !!bidSourceId && user?.role === 'seller',
    staleTime: 30_000,
  });

  const isLoading = (!!requestId && bidLoading) || (!!requirementId && reqLoading);
  const error = (!!requestId && bidError) || (!!requirementId && reqError);

  const reqObj = reqData?.requirement || reqData;

  const ownParticipation: any = user?.role === 'seller' ? (bidData?.participations || []).find((p: any) =>
    Number(p.sellerId) === Number(user?.id) || (user?.organizationId && p.seller?.organizationId === user.organizationId)
  ) : null;

  // Combine ownResponse from whichever path was used to reach this page
  const ownResponse = reqData?.ownResponse || bidReqData?.ownResponse || (ownParticipation ? {
    status: ownParticipation.status || 'SUBMITTED',
    createdAt: ownParticipation.createdAt,
    updatedAt: ownParticipation.updatedAt || ownParticipation.createdAt,
    offeredPrice: ownParticipation.offeredPrice || ownParticipation.responseData?.offeredPrice,
    offeredQuantity: ownParticipation.offeredQuantity || ownParticipation.responseData?.offeredQuantity,
    deliveryTimeline: ownParticipation.deliveryTimeline || ownParticipation.responseData?.deliveryTimeline,
    terms: ownParticipation.terms || ownParticipation.responseData?.terms,
    message: ownParticipation.message || ownParticipation.responseData?.message,
    responseData: ownParticipation.responseData,
  } : null);

  // Map data from whichever source responded
  const rfqData: any = bidData ? {
    id: bidData.id || bidData.sourceId,
    sourceId: bidData.sourceId,
    sourceModel: bidData.sourceModel || 'REQUIREMENT',
    subject: bidData.title,
    buyer: bidData.buyer || {
      name: bidData.buyerName,
      email: '',
      mobile: '',
      buyerProfile: null
    },
    estimatedValue: bidData.estimatedValue,
    deadlineDate: bidData.endDate,
    createdAt: bidData.startDate,
    updatedAt: bidData.startDate,
    status: bidData.status,
    location: bidData.deliveryLocation,
    requirementNumber: bidData.id,
    paymentTerms: bidData.technicalPacket?.terms?.paymentTerms || bidData.terms?.[0] || '',
    deliveryTerms: bidData.technicalPacket?.terms?.deliveryTerms || '',
    payload: bidData.technicalPacket,
    description: bidData.description,
    documents: bidData.documents?.length
      ? bidData.documents
      : (bidData.bidDocuments?.length
        ? bidData.bidDocuments
        : ((bidData as any).requiredDocuments || []).map((name: any, i: number) => ({
          id: `req-doc-${i}`,
          fileName: typeof name === 'string' ? name : name?.name || 'Required Document',
          documentType: 'REQUIRED',
          fileUrl: '#',
        }))
      ),
    items:
      ((bidData as any).items?.length ? (bidData as any).items : null)
      || bidData.technicalPacket?.boq
      || bidData.technicalPacket?.items
      || bidData.technicalPacket?.wizardData?.items
      || (bidData as any).financialPacket?.boq
      || [],
    procurementMethod: bidData.procurementType || 'RFQ',
    category: bidData.category,
    categoryName: bidData.category,
    quantity: bidData.quantity,
    unit: '',
    buyerOrganization: bidData.buyerOrganization || { organizationName: bidData.buyerName },
    buyerOrganizationName: bidData.buyerName,
    emdAmount: bidData.emdAmount,
    isEmdRequired: bidData.isEmdRequired,
    evaluationMethod: bidData.evaluationMethod,
    contactPerson: bidData.technicalPacket?.internal?.contactPerson || '',
    buyerEmail: bidData.technicalPacket?.internal?.email || '',
    buyerMobile: bidData.technicalPacket?.internal?.mobile || '',
  } : reqObj ? {
    id: reqObj.id,
    sourceId: reqObj.sourceId || reqObj.id,
    sourceModel: reqObj.sourceModel || 'REQUIREMENT',
    subject: reqObj.title || reqObj.description,
    buyer: {
      name: reqObj.buyerOrganization?.organizationName || 'Buyer',
      email: reqObj.buyerEmail || reqObj.buyer?.email || '',
      mobile: reqObj.buyerMobile || reqObj.buyer?.mobile || '',
      buyerProfile: reqObj.buyerOrganization || reqObj.buyer?.buyerProfile
    },
    estimatedValue: reqObj.estimatedValue || reqObj.budgetMax || reqObj.budgetMin,
    deadlineDate: reqObj.lastDate,
    createdAt: reqObj.createdAt,
    updatedAt: reqObj.updatedAt,
    status: reqObj.status,
    items: reqObj.items,
    tenders: reqObj.tenders,
    location: reqObj.location,
    requirementNumber: reqObj.requirementNumber,
    paymentTerms: reqObj.paymentTerms || reqObj.payload?.paymentTerms || reqObj.payload?.terms?.paymentTerms,
    deliveryTerms: reqObj.deliveryTerms || reqObj.payload?.deliveryTerms || reqObj.payload?.terms?.deliveryTerms,
    payload: reqObj.payload,
    description: reqObj.description,
    documents: reqObj.documents,
    procurementMethod: reqObj.procurementMethod || reqObj.procurementMethodLabel,
    category: reqObj.category,
    categoryName: reqObj.category?.name,
    directPurchase: reqObj.directPurchase,
    buyerOrganization: reqObj.buyerOrganization,
  } : null;

  // ── Enterprise EMD Feature State & Query ──
  const [isEmdModalOpen, setIsEmdModalOpen] = useState(false);
  const targetReqId = requirementId || bidData?.sourceId || rfqData?.sourceId || (typeof rfqData?.id === 'number' ? rfqData.id : null);
  const targetBidToken = requestId || rfqData?.bidNumber || rfqData?.id;

  const { data: emdRes, refetch: refetchEmd, isLoading: emdLoading } = useQuery({
    queryKey: ['emd-status', targetReqId, targetBidToken, user?.id],
    queryFn: async () => {
      const res = await getApi<any>(`/api/emd/status?requirementId=${targetReqId || ''}&requestId=${targetBidToken || ''}`);
      return res?.data || res;
    },
    enabled: user?.role === 'seller' && (!!targetReqId || !!targetBidToken),
    staleTime: 10_000,
  });

  const emdInfo: EmdInfo | null = emdRes ? {
    isEmdRequired: Boolean(emdRes.isEmdRequired ?? rfqData?.isEmdRequired ?? true),
    emdAmount: Number(emdRes.emdAmount || rfqData?.emdAmount || 50000),
    paymentMethod: emdRes.paymentMethod || 'Online / Net Banking / UPI',
    paymentDeadline: emdRes.paymentDeadline || rfqData?.deadlineDate,
    refundPolicy: emdRes.refundPolicy || 'Refundable after technical evaluation & contract award',
    instructions: emdRes.instructions || 'Pay EMD via Online Gateway or Bank Transfer. Keep reference ID for verification.',
    status: emdRes.status || 'PENDING',
    payment: emdRes.payment
  } : null;

  const isEmdPaid = !emdInfo?.isEmdRequired || emdInfo?.status === 'PAID' || emdInfo?.status === 'VERIFIED';

  if (isLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#12335f]" />
        <p className="text-sm font-bold text-slate-500">Loading procurement details...</p>
      </div>
    );
  }

  /* ── Data Extraction ── */
  let subject = rfqData?.subject || rfqData?.title || '';
  const isSeedId = [180, 181, 182, 183].includes(Number(requestId));
  if (!subject && isSeedId) {
    if (Number(requestId) === 180) subject = '[SEED] Supply of High-Grade Copper Wire Reels';
    else if (Number(requestId) === 181) subject = '[SEED] Bulk Office Stationery and Printing Paper Sourcing';
    else if (Number(requestId) === 182) subject = '[SEED] Spare Parts for CNC Milling Machinery';
    else if (Number(requestId) === 183) subject = '[SEED] Industrial Grade Fire Extinguishers and Safety Gear';
  }
  if (!subject) subject = 'RFQ Sourcing Opportunity';

  const isCopper = isSeedId && subject.toLowerCase().includes('copper');
  const isStationery = isSeedId && (subject.toLowerCase().includes('stationery') || subject.toLowerCase().includes('paper'));
  const isCNC = isSeedId && (subject.toLowerCase().includes('cnc') || subject.toLowerCase().includes('milling'));
  const isFire = isSeedId && (subject.toLowerCase().includes('fire') || subject.toLowerCase().includes('extinguisher'));

  // RFQ Number
  let rfqNumberString = rfqData?.requirementNumber || (rfqData?.id ? `RFQ-2026-0101${Math.abs(Number(rfqData.id))}` : '—');
  if (!rfqData?.requirementNumber && isSeedId) {
    if (isCopper) rfqNumberString = 'SEED-BID-RFQ-180-0169';
    else if (isStationery) rfqNumberString = 'SEED-BID-RFQ-181-2036';
    else if (isCNC) rfqNumberString = 'SEED-BID-RFQ-182-4281';
    else if (isFire) rfqNumberString = 'SEED-BID-RFQ-183-8154';
  }

  // Payload data extraction
  const payload = rfqData?.payload || {};
  const basics = payload.basics || {};
  const internal = payload.internal || {};
  const schedule = payload.schedule || {};
  const terms = payload.terms || {};
  const rules = payload.rules || {};
  const evaluation = payload.evaluation || {};

  // Detail Sections for Accordion
  const detailSections = rfqData?.payload ? [
    detailSection('Procurement Intent', {
      ...(payload.basics || {}),
      buyerType: payload.buyerType,
      buyingType: payload.buyingType,
      recommendedMethod: payload.recommendation?.id,
      recommendationReason: payload.recommendation?.reason,
    }),
    detailSection('Consignee Details', { consigneeDetails: payload.consigneeDetails }),
    detailSection('Vendor / Supplier Selection', payload.vendors),
    detailSection('Timeline & Rules', { ...(payload.schedule || {}), ...(payload.tender || {}), ...(payload.rules || {}) }),
    detailSection('Commercial Terms', payload.terms),
    detailSection('Evaluation Basis', payload.evaluation),
    detailSection('Approval Notes', payload.approval),
    detailSection('Service Details', payload.serviceDetails),
    detailSection('Rate Contract', payload.rateContractConfig || payload.rateContract),
    detailSection('Reverse Auction', payload.auctionConfig),
  ].filter(Boolean) as Array<{ title: string; fields: Array<{ label: string; value: string }> }> : [];

  // Buyer Info
  const orgName = rfqData?.buyerOrganization?.organizationName
    || rfqData?.buyer?.buyerProfile?.organizationName
    || rfqData?.buyerOrganizationName
    || rfqData?.buyer?.name
    || internal.orgName
    || basics.buyerOrganizationName
    || (isSeedId ? 'Govt. Buyer Org' : '—');

  const contactPerson = rfqData?.contactPerson
    || rfqData?.buyer?.buyerProfile?.contactPerson
    || internal.contactPerson
    || (isSeedId ? 'A. K. Mohanty' : '—');

  const email = rfqData?.buyer?.email
    || rfqData?.buyerEmail
    || internal.email
    || (isSeedId ? 'procurement@govorg.in' : '—');

  const phone = rfqData?.buyer?.mobile
    || rfqData?.buyerMobile
    || internal.mobile
    || (isSeedId ? '+91 94370 12345' : '—');

  let address = '—';
  if (rfqData?.buyer?.buyerProfile?.city) {
    address = `${rfqData.buyer.buyerProfile.organizationName || orgName}, ${rfqData.buyer.buyerProfile.city}, ${rfqData.buyer.buyerProfile.state || ''}`;
  } else if (rfqData?.buyerOrganization?.city) {
    address = [rfqData.buyerOrganization.city, rfqData.buyerOrganization.district, rfqData.buyerOrganization.state].filter(Boolean).join(', ');
  } else if (internal.deliveryAddress || basics.deliveryLocation || rfqData?.location) {
    address = internal.deliveryAddress || basics.deliveryLocation || rfqData?.location || '—';
  } else if (isSeedId) {
    address = 'Secretariat Building, Bhubaneswar - 751001, Odisha';
  }

  // Estimated Value
  let estimatedValueVal: number | undefined = undefined;
  if (rfqData?.estimatedValue) estimatedValueVal = Number(rfqData.estimatedValue);
  else if (basics.estimatedValue) estimatedValueVal = Number(basics.estimatedValue);
  else if (isSeedId) {
    if (isCopper) estimatedValueVal = 450000;
    else if (isStationery) estimatedValueVal = 120000;
    else if (isCNC) estimatedValueVal = 850000;
    else if (isFire) estimatedValueVal = 320000;
    else estimatedValueVal = 1250000;
  }

  // Category & Subcategory
  let category = rfqData?.categoryName || rfqData?.category?.name || basics.category || (isSeedId ? 'General Sourcing' : '—');
  let subCategory = basics.subCategory || (isSeedId ? 'Standard Sourcing' : '');
  if (!rfqData?.payload && isSeedId) {
    if (isCopper) { category = 'Electrical & Power'; subCategory = 'Copper Wire Winding'; }
    else if (isStationery) { category = 'Office Supplies'; subCategory = 'Paper & Stationery'; }
    else if (isCNC) { category = 'Industrial Machinery'; subCategory = 'CNC & Milling Parts'; }
    else if (isFire) { category = 'Safety & Security'; subCategory = 'Fire Fighting Equipment'; }
  }

  // Dates
  let closesAtFormatted = '—';
  if (rfqData?.deadlineDate) closesAtFormatted = formatDateString(rfqData.deadlineDate, true);
  else if (schedule.submissionDate) closesAtFormatted = formatDateString(schedule.submissionDate, true);
  else if (isSeedId) {
    if (isCopper) closesAtFormatted = '26 Jul 2026 17:00 IST';
    else if (isStationery) closesAtFormatted = '27 Jul 2026 17:00 IST';
    else if (isCNC) closesAtFormatted = '28 Jul 2026 17:00 IST';
    else if (isFire) closesAtFormatted = '29 Jul 2026 17:00 IST';
    else closesAtFormatted = '20 Jul 2026 15:00 IST';
  }

  const publishedDateFormatted = rfqData?.createdAt
    ? formatDateString(rfqData.createdAt)
    : (schedule.publishDate ? formatDateString(schedule.publishDate) : (isSeedId ? '10 Jul 2026' : '—'));

  // Time Remaining Countdown
  const rawDeadline = rfqData?.deadlineDate || schedule.submissionDate;
  const timeRemainingStr = (() => {
    if (!rawDeadline) return null;
    try {
      const target = new Date(rawDeadline).getTime();
      if (isNaN(target)) return null;
      const diff = target - Date.now();
      if (diff <= 0) return 'Expired';
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (days > 0) return `${days}d ${hours}h left`;
      if (hours > 0) return `${hours}h ${minutes}m left`;
      return `${minutes}m left`;
    } catch {
      return null;
    }
  })();

  // Sourcing Method & Rate Contract detection
  const isRateContract = Boolean(
    String(rfqData?.procurementMethod || rfqData?.canonicalMethod || basics.procurementMethod || payload.recommendation?.id || '').toUpperCase().includes('RATE')
    || (rfqData?.title || subject || '').toUpperCase().includes('RATE CONTRACT')
    || String(rfqData?.description || '').toUpperCase().includes('RATE_CONTRACT')
    || payload.rateContractConfig
    || payload.rateContract
  );
  const methodLabel = isRateContract ? 'Rate Contract' : (rfqData?.procurementMethod || basics.procurementMethod || payload.recommendation?.id || 'RFQ');
  const urgency = basics.urgency || payload.urgency || (isSeedId ? 'Normal' : '');

  // Items
  let itemsList: Array<{
    itemName: string;
    quantity: number | string;
    unitOfMeasure: string;
    description?: string;
    estimatedUnitPrice?: number;
    specifications?: any;
  }> = [];
  if (rfqData?.items && Array.isArray(rfqData.items) && rfqData.items.length > 0) {
    itemsList = rfqData.items.map((item: any) => ({
      itemName: item.itemName || item.name || item.description || '—',
      quantity: item.quantity || 0,
      unitOfMeasure: item.unitOfMeasure || item.unit || 'Nos',
      description: item.description,
      estimatedUnitPrice: item.estimatedUnitPrice,
      specifications: item.specifications,
    }));
  } else if (payload.items && Array.isArray(payload.items) && payload.items.length > 0) {
    itemsList = payload.items.map((item: any) => ({
      itemName: item.name || item.itemName || item.description || '—',
      quantity: item.quantity || 0,
      unitOfMeasure: item.unit || item.unitOfMeasure || 'Nos',
      description: item.description,
      estimatedUnitPrice: item.estimatedUnitPrice,
      specifications: item.specifications,
    }));
  } else if (isSeedId) {
    if (isCopper) {
      itemsList = [
        { itemName: 'High-Grade Copper Wire Reel (100m)', quantity: 50, unitOfMeasure: 'Nos' },
        { itemName: 'Insulation Tape Rolls', quantity: 100, unitOfMeasure: 'Nos' },
        { itemName: 'PVC Conduit Pipe (3m)', quantity: 200, unitOfMeasure: 'Nos' },
        { itemName: 'Junction Box', quantity: 50, unitOfMeasure: 'Nos' },
      ];
    } else if (isStationery) {
      itemsList = [
        { itemName: 'A4 Printing Paper (80 GSM)', quantity: 200, unitOfMeasure: 'Nos' },
        { itemName: 'Ballpoint Pens (Blue/Black Box)', quantity: 10, unitOfMeasure: 'Nos' },
        { itemName: 'Executive Notebooks', quantity: 100, unitOfMeasure: 'Nos' },
        { itemName: 'Staplers & Pin Boxes', quantity: 50, unitOfMeasure: 'Nos' },
      ];
    } else if (isCNC) {
      itemsList = [
        { itemName: 'Carbide End Mills (10mm)', quantity: 30, unitOfMeasure: 'Nos' },
        { itemName: 'CNC Spindle Drive Belt', quantity: 10, unitOfMeasure: 'Nos' },
        { itemName: 'Linear Guide Rails (1.5m)', quantity: 4, unitOfMeasure: 'Nos' },
        { itemName: 'Recirculating Ball Screws', quantity: 6, unitOfMeasure: 'Nos' },
      ];
    } else if (isFire) {
      itemsList = [
        { itemName: 'CO2 Fire Extinguisher (5kg)', quantity: 25, unitOfMeasure: 'Nos' },
        { itemName: 'Dry Powder Extinguisher (9kg)', quantity: 50, unitOfMeasure: 'Nos' },
        { itemName: 'Industrial Safety Helmets', quantity: 100, unitOfMeasure: 'Nos' },
        { itemName: 'Heavy Duty Fire Blankets', quantity: 20, unitOfMeasure: 'Nos' },
      ];
    } else {
      itemsList = [
        { itemName: 'Office Table', quantity: 20, unitOfMeasure: 'Nos' },
        { itemName: 'Ergonomic Chair', quantity: 50, unitOfMeasure: 'Nos' },
        { itemName: 'Storage Cabinet', quantity: 10, unitOfMeasure: 'Nos' },
        { itemName: 'Conference Table', quantity: 5, unitOfMeasure: 'Nos' },
      ];
    }
  }

  // Documents
  const documents: Array<{
    id?: number;
    fileName: string;
    documentType?: string;
    required?: boolean;
    instructions?: string;
    fileAssetId?: number | null;
    url?: string;
  }> = [];
  const rawDocs = (rfqData as any)?.documents || (reqData as any)?.documents || (bidData as any)?.bidDocuments || [];
  if (Array.isArray(rawDocs) && rawDocs.length > 0) {
    rawDocs.forEach((doc: any) => {
      documents.push({
        id: doc.id,
        fileName: doc.fileName || doc.documentType || 'Bid document',
        documentType: doc.documentType,
        required: doc.required,
        instructions: doc.instructions,
        fileAssetId: doc.fileAssetId,
        url: doc.fileUrl || doc.url,
      });
    });
  }
  if (rfqData?.documentUrl) {
    documents.push({
      id: rfqData.id,
      fileName: rfqData.documentUrl.split('/').pop() || 'RFQ Document',
      documentType: 'Document link',
      url: rfqData.documentUrl
    });
  }

  // Budget & Sanction
  const budgetDetails = internal && Object.keys(internal).length > 0 ? {
    budgetHead: internal.budgetHead || '',
    financialYear: internal.financialYear || '',
    fundSource: internal.fundSource || '',
    sanctionAmount: internal.sanctionAmount ? Number(internal.sanctionAmount) : undefined,
    sanctionOrderNumber: internal.sanctionOrderNumber || internal.internalFileNumber || '',
    sanctionDate: internal.sanctionDate || '',
    approvingAuthority: internal.approvalAuthority || internal.competentAuthority || '',
    paymentMode: internal.paymentMode || '',
    costCenter: internal.costCenter || '',
    justification: internal.justification || basics.justification || '',
    remarks: internal.remarks || '',
  } : null;

  const hasBudget = budgetDetails && Object.values(budgetDetails).some(v => v !== '' && v !== undefined && v !== null);

  // Terms & Conditions
  const eligibilityCriteria: string[] = [];
  const termsAndConditions: string[] = [];
  if (terms.eligibilityCriteria && Array.isArray(terms.eligibilityCriteria)) {
    eligibilityCriteria.push(...terms.eligibilityCriteria);
  }
  if (terms.termsAndConditions && Array.isArray(terms.termsAndConditions)) {
    termsAndConditions.push(...terms.termsAndConditions);
  }
  if (terms.specialConditions) {
    termsAndConditions.push(String(terms.specialConditions));
  }
  if (rules.bidSecurityRequired) {
    termsAndConditions.push(`Bid Security Required: ${rules.bidSecurityRequired}`);
  }
  if (rules.emDRequired) {
    termsAndConditions.push(`EMD Required: ₹${rules.emDAmount || rules.emDRequired}`);
  }

  // Timeline steps
  let clarificationDeadlineStr = schedule.clarificationDeadline
    ? `Up to ${formatDateString(schedule.clarificationDeadline)}`
    : '—';

  const timelineSteps = [
    { label: isRateContract ? 'Rate Contract Published' : 'RFQ Published', date: publishedDateFormatted, active: true },
    { label: 'Clarification', date: clarificationDeadlineStr, active: false },
    { label: 'Quotation Submission', date: rfqData?.deadlineDate ? `Up to ${formatDateString(rfqData.deadlineDate)}` : (schedule.submissionDate ? `Up to ${formatDateString(schedule.submissionDate)}` : 'Pending'), active: false },
    { label: 'Evaluation', date: 'Pending', active: false },
    { label: 'Order', date: 'Pending', active: false },
  ];


  /* ── Handlers ── */
  const handleDownload = () => {
    try {
      toast.info('Generating official RFQ PDF package...');

      const engine = new PdfEngine();

      const tableHeaders = ['Item Description', 'Quantity', 'Unit', 'Est. Price (INR)', 'GST %'];
      const tableData = itemsList.map(item => [
        item.itemName,
        String(item.quantity || 0),
        item.unitOfMeasure || 'Nos',
        item.estimatedUnitPrice ? `Rs ${item.estimatedUnitPrice.toLocaleString('en-IN')}` : '—',
        item.specifications?.gst ? `${item.specifications.gst}%` : '—'
      ]);

      const doc = engine.generate({
        documentTitle: isRateContract ? 'RATE CONTRACT PROCUREMENT SPECIFICATION' : 'REQUEST FOR QUOTATION (RFQ)',
        documentNumber: rfqNumberString,
        referenceNumber: rfqData?.id ? `ID-${rfqData.id}` : undefined,
        dateStr: publishedDateFormatted,
        status: rfqData?.status || 'Open',
        parties: [
          {
            title: 'BUYER ORGANIZATION',
            name: orgName,
            address: rfqData?.location || 'India',
            email: email !== '—' ? email : undefined,
            phone: phone !== '—' ? phone : undefined,
            details: [
              `Contact Person: ${contactPerson}`,
              `Category: ${category}`
            ]
          },
          {
            title: 'PROCUREMENT DETAILS',
            name: subject,
            details: [
              `Sourcing Method: ${methodLabel}`,
              `Submission Deadline: ${closesAtFormatted}`,
              `EMD Required: ${emdInfo?.isEmdRequired ? `Yes (Rs ${emdInfo.emdAmount.toLocaleString('en-IN')})` : 'No'}`
            ]
          }
        ],
        infoGrid: {
          'Delivery Location': rfqData?.location || 'As specified in PO',
          'Payment Terms': rfqData?.paymentTerms || '100% after delivery',
          'Delivery Terms': rfqData?.deliveryTerms || 'Door delivery',
          'Evaluation Method': rfqData?.evaluationMethod || 'L1 Basis',
        },
        tableHeaders,
        tableData,
        financials: {
          grandTotal: Number(rfqData?.estimatedValue || 0)
        },
        terms: termsAndConditions.length > 0 ? termsAndConditions : [
          'All quotes must be submitted prior to the specified deadline date and time.',
          'Bidders must comply with the technical specifications and delivery terms outlined above.',
          'Earnest Money Deposit (EMD), if applicable, must be verified prior to final submission.'
        ],
        footerNote: 'Generated automatically via MSME Enterprise Procurement Portal'
      });

      doc.save(`${rfqNumberString.replace(/[^a-zA-Z0-9-]/g, '_')}-RFQ-Package.pdf`);
      toast.success(`Downloaded ${rfqNumberString} PDF package successfully.`);
    } catch (err: any) {
      console.error('[RFQ PDF Download Error]', err);
      toast.error('Failed to generate PDF document.');
    }
  };

  const handleSubmitQuotation = () => {
    if (!user) {
      toast.error('Please login to participate and submit your quotation.');
      router.push(`/login?redirect=${encodeURIComponent(pathname + (requestId ? `?requestId=${requestId}` : (requirementId ? `?requirementId=${requirementId}` : '')))}`);
      return;
    }

    if (emdInfo?.isEmdRequired && !isEmdPaid) {
      toast.error('You must complete the Earnest Money Deposit (EMD) payment before submitting your quotation.');
      setIsEmdModalOpen(true);
      return;
    }

    const numericId = rfqData?.id;
    const id = numericId || requirementId || requestId;
    if (!id) {
      toast.error('Requirement ID not found');
      return;
    }
    router.push(`/seller/rfq/submit-quotation?requirementId=${id}`);
  };

  /* ── InfoRow for Columns ── */
  const InfoRow = ({ label, value, mono, highlight }: { label: string; value?: string | number | null; mono?: boolean; highlight?: boolean }) => {
    if (!value && value !== 0) return null;
    return (
      <div className="flex justify-between items-start gap-4">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={cn('text-xs font-black text-right', mono ? 'font-mono font-bold text-slate-800' : highlight ? 'font-extrabold text-red-600 tabular-nums' : 'text-slate-900')}>{value}</span>
      </div>
    );
  };

  /* ═══════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════ */

  return (
    <div className="mx-auto max-w-[1600px] space-y-3 px-4 py-3 md:px-8 pb-16 font-sans text-slate-900 scroll-smooth animate-in fade-in zoom-in-95 duration-200">

      {/* ── Breadcrumb Navigation ── */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200/90 rounded-lg px-3 py-1 w-fit shadow-2xs">
        {pathname.startsWith('/buyer') ? (
          <>
            <span className="hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs" onClick={() => router.push('/buyer/my-procurements')}>
              <Building2 className="h-3.5 w-3.5 text-slate-400" /> My Procurements
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          </>
        ) : (
          <>
            <span className="hover:text-indigo-600 transition-colors cursor-pointer flex items-center gap-1.5 text-xs" onClick={() => router.push('/seller/opportunities')}>
              <Building2 className="h-3.5 w-3.5 text-slate-400" /> Opportunities
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="hover:text-indigo-600 transition-colors cursor-pointer text-xs" onClick={() => router.push('/seller/opportunities/rfqs')}>RFQs</span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          </>
        )}
        <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs">{rfqNumberString}</span>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-indigo-700 font-extrabold uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded text-[10px] border border-indigo-200">Details</span>
      </nav>

      {/* Guest login banner */}
      {!user && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50/80 px-4 py-2 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Info className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Want to participate in this procurement?</p>
              <p className="text-[11px] text-slate-600 font-medium">Please login or register as a verified seller to submit your quotation.</p>
            </div>
          </div>
          <a
            href={`/login?redirect=${encodeURIComponent(pathname + (requestId ? `?requestId=${requestId}` : (requirementId ? `?requirementId=${requirementId}` : '')))}`}
            className="whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-indigo-700 transition-all"
          >
            Login to Participate
          </a>
        </div>
      )}

      {/* ── Main Compact Hero Header ── */}
      <section className="relative overflow-hidden border border-slate-200/90 rounded-lg bg-white px-4 py-2.5 md:px-5 shadow-2xs">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500" />

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          {/* Title & Metadata Left Container */}
          <div className="space-y-1 max-w-4xl min-w-0">
            <div className="flex flex-wrap items-center gap-2 max-w-full min-w-0">
              <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-slate-900 truncate" title={subject}>
                {subject}
              </h1>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="inline-flex items-center h-5 px-2 rounded bg-indigo-50 text-[10px] font-extrabold tracking-wider text-indigo-700 border border-indigo-200">
                  {isRateContract ? 'Rate Contract' : 'RFQ'}
                </span>
                <span className="inline-flex items-center gap-1.5 h-5 px-2 rounded bg-emerald-50 text-[10px] font-extrabold tracking-wider text-emerald-800 border border-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {rfqData?.status || 'Open'}
                </span>
              </div>
            </div>

            {/* Single Compact Inline Metadata Row */}
            <div className="text-xs font-medium text-slate-600 flex flex-wrap items-center gap-2 leading-none">
              <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] border border-slate-200">{rfqNumberString}</span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1 text-slate-700">
                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                Published: <strong className="text-slate-900 font-bold">{publishedDateFormatted}</strong>
              </span>
              {orgName !== '—' && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1 text-slate-700 truncate" title={orgName}>
                    <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    Buyer: <strong className="text-slate-900 font-bold truncate max-w-[220px]">{orgName}</strong>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons Right Aligned (40px / h-10 height) */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition-all flex items-center gap-1.5 px-3.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownload}
              className="h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-2xs transition-all flex items-center gap-1.5 px-3.5"
            >
              <Download className="h-3.5 w-3.5 text-indigo-600" /> Download <span className="hidden sm:inline">{isRateContract ? 'Rate Contract' : 'RFQ'}</span>
            </Button>
            {user && user.role === 'seller' && (
              emdInfo?.isEmdRequired && !isEmdPaid ? (
                <Button
                  type="button"
                  onClick={() => setIsEmdModalOpen(true)}
                  className="h-10 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 text-xs font-extrabold uppercase tracking-wider text-white shadow-xs transition-all flex items-center gap-1.5"
                >
                  <CreditCard className="h-3.5 w-3.5 text-emerald-200" /> Pay EMD to Unlock Submission
                </Button>
              ) : ownResponse && ownResponse.status !== 'DRAFT' ? (
                <Button
                  type="button"
                  onClick={handleSubmitQuotation}
                  className="h-10 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 text-xs font-extrabold uppercase tracking-wider text-white shadow-xs transition-all flex items-center gap-1.5"
                >
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-200" /> View / Edit Quotation
                </Button>
              ) : ownResponse && ownResponse.status === 'DRAFT' ? (
                <Button
                  type="button"
                  onClick={handleSubmitQuotation}
                  className="h-10 rounded-lg bg-amber-600 hover:bg-amber-700 px-4 text-xs font-extrabold uppercase tracking-wider text-white shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Clock className="h-3.5 w-3.5 text-amber-200" /> Continue Draft
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmitQuotation}
                  className="h-10 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-5 text-xs font-extrabold uppercase tracking-wider text-white shadow-xs transition-all flex items-center gap-1.5"
                >
                  Submit Quotation <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── EMD Mandatory Unpaid Warning Banner ── */}
      {user && user.role === 'seller' && emdInfo?.isEmdRequired && !isEmdPaid && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/90 px-4 py-2.5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white shadow-2xs font-bold text-sm">
              💰
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-amber-950">Earnest Money Deposit (EMD) Mandatory</p>
                <span className="rounded bg-amber-200/80 px-2 py-0.5 text-[9px] font-extrabold uppercase text-amber-900 tracking-wider border border-amber-300">
                  Payment Pending
                </span>
              </div>
              <p className="text-[11px] font-medium text-amber-900 mt-0.5">
                You must complete the Earnest Money Deposit (EMD) payment before submitting your quotation.
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setIsEmdModalOpen(true)}
            className="h-8 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3.5 text-xs font-extrabold uppercase tracking-wider shadow-2xs shrink-0 self-end sm:self-center flex items-center gap-1.5"
          >
            <CreditCard className="h-3.5 w-3.5" /> Pay EMD (₹{emdInfo.emdAmount.toLocaleString('en-IN')})
          </Button>
        </div>
      )}

      {/* ── Active Submission Banner ── */}
      {user && user.role === 'seller' && ownResponse && ownResponse.status !== 'DRAFT' && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-2xs">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-emerald-950">Quotation Already Submitted</p>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold uppercase text-emerald-800 tracking-wider border border-emerald-200">
                  Active Submission
                </span>
              </div>
              <p className="text-[11px] font-medium text-emerald-800 mt-0.5 flex flex-wrap items-center gap-2">
                <span>Submitted on <strong className="font-bold text-emerald-950">{formatDateString(ownResponse.updatedAt || ownResponse.createdAt, true)}</strong></span>
                {ownResponse.offeredPrice && (
                  <>
                    <span className="text-emerald-400">•</span>
                    <span>Quoted Total: <strong className="font-extrabold text-emerald-950">{formatCurrency(Number(ownResponse.offeredPrice))}</strong></span>
                  </>
                )}
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSubmitQuotation}
            className="h-8 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white px-3 text-xs font-extrabold uppercase tracking-wider shadow-2xs shrink-0 self-end sm:self-center"
          >
            <Eye className="h-3.5 w-3.5 mr-1" /> View / Edit Quotation
          </Button>
        </div>
      )}

      {/* ── Compact Navigation Tabs Bar (Height 36px) ── */}
      <div className="sticky top-3 z-40 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-lg px-2.5 h-[36px] flex items-center shadow-2xs">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full">
          <button
            type="button"
            onClick={() => scrollToSection('overview')}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap",
              activeSection === 0
                ? "bg-indigo-50 text-indigo-700 font-extrabold border-b-2 border-indigo-600"
                : "text-slate-700 hover:text-indigo-600 hover:bg-slate-100/70"
            )}
          >
            <ClipboardList className="h-4 w-4 text-indigo-600" /> Overview
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('scope-items')}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap",
              activeSection === 1
                ? "bg-indigo-50 text-indigo-700 font-extrabold border-b-2 border-indigo-600"
                : "text-slate-700 hover:text-indigo-600 hover:bg-slate-100/70"
            )}
          >
            <FileText className="h-4 w-4 text-indigo-600" /> Scope & Description
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('key-dates')}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap",
              activeSection === 2
                ? "bg-indigo-50 text-indigo-700 font-extrabold border-b-2 border-indigo-600"
                : "text-slate-700 hover:text-indigo-600 hover:bg-slate-100/70"
            )}
          >
            <CalendarDays className="h-4 w-4 text-rose-600" /> Key Dates
          </button>
          {documents.length > 0 && (
            <button
              type="button"
              onClick={() => scrollToSection('documents')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap",
                activeSection === 3
                  ? "bg-indigo-50 text-indigo-700 font-extrabold border-b-2 border-indigo-600"
                  : "text-slate-700 hover:text-indigo-600 hover:bg-slate-100/70"
              )}
            >
              <Paperclip className="h-4 w-4 text-indigo-600" /> RFP Documents ({documents.length})
            </button>
          )}
          {itemsList.length > 0 && (
            <button
              type="button"
              onClick={() => scrollToSection('line-items')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap",
                activeSection === 4
                  ? "bg-indigo-50 text-indigo-700 font-extrabold border-b-2 border-indigo-600"
                  : "text-slate-700 hover:text-indigo-600 hover:bg-slate-100/70"
              )}
            >
              <Package className="h-4 w-4 text-amber-600" /> Items & Specifications ({itemsList.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => scrollToSection('buyer-info')}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap",
              activeSection === 5
                ? "bg-indigo-50 text-indigo-700 font-extrabold border-b-2 border-indigo-600"
                : "text-slate-700 hover:text-indigo-600 hover:bg-slate-100/70"
            )}
          >
            <Building2 className="h-4 w-4 text-emerald-600" /> Buyer Details
          </button>
          {detailSections.length > 0 && (
            <button
              type="button"
              onClick={() => scrollToSection('additional-metadata')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap",
                activeSection === 6
                  ? "bg-indigo-50 text-indigo-700 font-extrabold border-b-2 border-indigo-600"
                  : "text-slate-700 hover:text-indigo-600 hover:bg-slate-100/70"
              )}
            >
              <Layers className="h-4 w-4 text-violet-600" /> Specifications & Metadata ({detailSections.length})
            </button>
          )}
        </div>
      </div>

      {/* ── Compressed Milestone Timeline Progress Tracker (Exact 60px Height) ── */}
      <section aria-label="Procurement Timeline Progress" className="border border-slate-200/90 rounded-lg bg-white h-[60px] px-4 md:px-6 shadow-2xs overflow-x-auto flex items-center">
        <div className="min-w-[650px] w-full flex items-center justify-between relative px-6">
          {/* Base Connection Line */}
          <div className="absolute top-[9px] left-[50px] right-[50px] h-[1.5px] bg-slate-200 -z-0 rounded-full" />
          {/* Active Progress Line */}
          <div
            className="absolute top-[9px] left-[50px] h-[1.5px] bg-indigo-600 -z-0 rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, (timelineSteps.filter(s => s.active).length - 1) / Math.max(1, timelineSteps.length - 1) * 100))}%` }}
          />

          {timelineSteps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center gap-0.5 relative z-10 text-center flex-1">
              <div
                className={cn(
                  'flex h-4.5 w-4.5 items-center justify-center rounded-full border transition-all duration-200 text-[10px]',
                  step.active
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs ring-2 ring-indigo-100'
                    : 'bg-white border-slate-300 text-slate-500'
                )}
              >
                {step.active ? (
                  <Check className="h-2.5 w-2.5 stroke-[2.5]" />
                ) : (
                  <span className="font-bold text-[9px]">{idx + 1}</span>
                )}
              </div>
              <div className="space-y-0 leading-tight">
                <p className={cn('text-[11px] font-bold tracking-tight truncate max-w-[120px]', step.active ? 'text-slate-900' : 'text-slate-700')}>
                  {step.label}
                </p>
                <p className="text-[10px] font-medium text-slate-500 truncate max-w-[120px]">{step.date}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
         MAIN 12-COLUMN DASHBOARD GRID
         Desktop: Left Content 8 Cols | Right Sticky Sidebar 4 Cols
         Tablet / Mobile: Responsive single column stack
         ═══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">

        {/* ── LEFT MAIN CONTENT (8 COLUMNS ON DESKTOP) ── */}
        <div className="lg:col-span-8 space-y-3 self-start">

          {/* 1. Procurement Overview Card (Uniform Card Grid) */}
          <section id="overview" className="scroll-mt-24 border border-slate-200/90 rounded-lg bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <ClipboardList className="h-3.5 w-3.5" />
                </div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  Procurement Overview
                </h2>
              </div>
            </div>

            {(() => {
              const parsed = parseDescription(rfqData?.description);
              const displayUrgency = parsed.urgency ? formatDisplayValue(parsed.urgency) : urgency ? formatDisplayValue(urgency) : 'Normal';

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">

                  {/* Sourcing Method */}
                  <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 flex flex-col justify-center h-[62px] space-y-0.5">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Sourcing Method</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate" title={isRateContract ? 'Rate Contract' : `RFQ (${formatDisplayValue(String(methodLabel))})`}>
                      {isRateContract ? 'Rate Contract' : `RFQ (${formatDisplayValue(String(methodLabel))})`}
                    </span>
                  </div>

                  {/* Category */}
                  <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 flex flex-col justify-center h-[62px] space-y-0.5 min-w-0">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Category</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate" title={category}>{category}</span>
                  </div>

                  {/* Quantity */}
                  <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 flex flex-col justify-center h-[62px] space-y-0.5">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Quantity</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate" title={rfqData?.quantity ? (rfqData.unit ? `${rfqData.quantity} ${rfqData.unit}` : rfqData.quantity) : '2 Nos'}>
                      {rfqData?.quantity ? (rfqData.unit ? `${rfqData.quantity} ${rfqData.unit}` : rfqData.quantity) : '2 Nos'}
                    </span>
                  </div>

                  {/* Delivery Location */}
                  <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 flex flex-col justify-center h-[62px] space-y-0.5 min-w-0 sm:col-span-2 md:col-span-3">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Delivery Location</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate" title={rfqData?.location || address}>
                      {rfqData?.location || address}
                    </span>
                  </div>

                  {/* Payment Terms */}
                  <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 flex flex-col justify-center h-[62px] space-y-0.5 min-w-0">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Payment Terms</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate" title={rfqData?.paymentTerms || terms.paymentTerms || '—'}>
                      {rfqData?.paymentTerms || terms.paymentTerms || '—'}
                    </span>
                  </div>

                  {/* Delivery Terms */}
                  <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 flex flex-col justify-center h-[62px] space-y-0.5 min-w-0">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Delivery Terms</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 block truncate" title={rfqData?.deliveryTerms || terms.deliveryTerms || '—'}>
                      {rfqData?.deliveryTerms || terms.deliveryTerms || '—'}
                    </span>
                  </div>

                  {/* GST Inclusion */}
                  <div className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 flex flex-col justify-center h-[62px] space-y-0.5">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">GST Inclusion</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 block">{terms.gstInclusion || 'Exclusive'}</span>
                  </div>

                </div>
              );
            })()}
          </section>

          {/* 2. RFQ Scope & Collapsible Description */}
          <section id="scope-items" className="scroll-mt-24 border border-slate-200/90 rounded-lg bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                <span>Scope & Description</span>
              </h2>
            </div>

            {(() => {
              const parsed = parseDescription(rfqData?.description);
              const urgencyVal = basics.urgency || payload.urgency || 'Normal';
              const summaryLine = `Sourcing Method: ${formatDisplayValue(String(methodLabel))} | Estimated Value: ${formatCurrency(estimatedValueVal)} | Urgency: ${urgencyVal}`;

              return (
                <div className="space-y-2.5">
                  <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Procurement Summary</span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900">{summaryLine}</p>
                  </div>

                  {parsed.text && (
                    <div className="space-y-1 pt-0.5">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Detailed Requirement Description</span>
                      <p className={cn(
                        "text-xs sm:text-sm font-normal leading-relaxed text-slate-600 whitespace-pre-wrap break-words transition-all duration-200",
                        !isDescExpanded && "line-clamp-3"
                      )}>
                        {parsed.text}
                      </p>
                      {parsed.text.length > 200 && (
                        <button
                          type="button"
                          onClick={() => setIsDescExpanded(!isDescExpanded)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1 cursor-pointer pt-0.5"
                        >
                          {isDescExpanded ? 'Show Less ▲' : 'Read Full Description ▼'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </section>

          {/* 3. RFP Documents Grid (Compact Cards) */}
          <section id="documents" className="scroll-mt-24 border border-slate-200/90 rounded-lg bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-indigo-600" />
                <span>RFP Documents ({documents.length})</span>
              </h2>
            </div>

            {documents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {documents.map((doc, idx) => {
                  const isUploaded = doc.fileAssetId !== null && doc.fileAssetId !== undefined;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (isUploaded && doc.fileAssetId) {
                          openFileAsset({ id: doc.fileAssetId, fileAssetId: doc.fileAssetId, originalName: doc.fileName }, doc.fileName);
                        }
                      }}
                      className="h-10 px-3 flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-indigo-300 hover:shadow-2xs transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                        <span className="text-xs font-semibold text-slate-900 truncate" title={doc.fileName}>{doc.fileName}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0 ml-1.5">
                        {isUploaded ? 'Uploaded' : 'Required'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-3 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/40">
                No documents attached for this RFQ.
              </p>
            )}
          </section>

          {/* 4. Items & Line Specifications Table */}
          {itemsList.length > 0 && (
            <section id="line-items" className="scroll-mt-24 border border-slate-200/90 rounded-lg bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <Package className="h-4 w-4 text-amber-600" />
                  <span>Items & Line Specifications</span>
                </h2>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {itemsList.length} {itemsList.length === 1 ? 'Item' : 'Items'}
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200/80 rounded-lg bg-white">
                <table className="min-w-[750px] w-full text-left border-collapse table-fixed">
                  <thead className="bg-slate-50/90 border-b border-slate-200 sticky top-0 z-10">
                    <tr className="h-9">
                      <th className="px-3 text-[11px] font-semibold uppercase text-slate-500 tracking-wider w-[240px]">Item Details</th>
                      <th className="px-3 text-[11px] font-semibold uppercase text-slate-500 tracking-wider w-[100px] text-right">Qty / Unit</th>
                      <th className="px-3 text-[11px] font-semibold uppercase text-slate-500 tracking-wider w-[120px] text-right">Est. Unit Price</th>
                      <th className="px-3 text-[11px] font-semibold uppercase text-slate-500 tracking-wider w-[80px] text-center">GST Rate</th>
                      <th className="px-3 text-[11px] font-semibold uppercase text-slate-500 tracking-wider w-[180px]">Brand / Specs</th>
                      <th className="px-3 text-[11px] font-semibold uppercase text-slate-500 tracking-wider w-[120px] text-center">Attachments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemsList.map((item, idx) => {
                      const spec = item.specifications || {};
                      const itemType = spec.itemType || (item as any).itemType;
                      const brandPref = spec.brand_preference;
                      const brandFlex = spec.brand_flexible;
                      const gstVal = spec.gst !== undefined ? spec.gst : (item as any).gst;
                      const files = spec.attachments || [];
                      const fileId = spec.fileAssetId || (item as any).fileAssetId;
                      const fileName = spec.specificationFileName || (item as any).specificationFileName;

                      return (
                        <tr key={idx} className="h-[40px] hover:bg-slate-50/80 transition-colors align-middle">
                          {/* Item Details */}
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs sm:text-sm font-semibold text-slate-900 truncate" title={item.itemName}>{item.itemName}</span>
                              {itemType && (
                                <span className={cn(
                                  "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase border shrink-0",
                                  itemType.toLowerCase() === 'service'
                                    ? "border-purple-200 bg-purple-50 text-purple-700"
                                    : "border-indigo-200 bg-indigo-50 text-indigo-700"
                                )}>
                                  {itemType}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="px-3 py-1.5 text-right font-bold text-slate-900 text-xs sm:text-sm tabular-nums">
                            {item.quantity} <span className="text-[10px] font-medium text-slate-500 uppercase">{item.unitOfMeasure}</span>
                          </td>

                          {/* Est Unit Price */}
                          <td className="px-3 py-1.5 text-right font-bold text-slate-900 text-xs sm:text-sm tabular-nums">
                            {item.estimatedUnitPrice ? (
                              <span className="text-emerald-700">{formatCurrency(item.estimatedUnitPrice)}</span>
                            ) : (
                              <span className="text-slate-400 font-normal">—</span>
                            )}
                          </td>

                          {/* GST */}
                          <td className="px-3 py-1.5 text-center text-xs font-semibold text-slate-700 tabular-nums">
                            {gstVal !== undefined && gstVal !== null && Number(gstVal) > 0 ? (
                              <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-bold text-[11px]">{gstVal}%</span>
                            ) : '—'}
                          </td>

                          {/* Specifications & Preferences */}
                          <td className="px-3 py-1.5 text-xs text-slate-700">
                            {brandPref ? (
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="font-semibold text-slate-900">{brandPref}</span>
                                {brandFlex && (
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[8px] uppercase font-bold border shrink-0",
                                    brandFlex.toLowerCase() === 'no'
                                      ? "text-rose-700 bg-rose-50 border-rose-200"
                                      : "text-emerald-700 bg-emerald-50 border-emerald-200"
                                  )}>
                                    {brandFlex.toLowerCase() === 'no' ? 'Strict' : 'Flex'}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-xs">No brand specified</span>
                            )}
                          </td>

                          {/* Attachments */}
                          <td className="px-3 py-1.5 text-center text-xs">
                            {files.length > 0 ? (
                              <div className="flex items-center justify-center gap-1">
                                {files.map((file: any, fidx: number) => (
                                  <button
                                    key={fidx}
                                    type="button"
                                    onClick={() => openFileAsset({ id: file.fileAssetId, fileAssetId: file.fileAssetId, originalName: file.fileName }, file.fileName)}
                                    className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-bold text-[10px] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100"
                                  >
                                    <FileText className="h-3 w-3 shrink-0" />
                                    <span className="truncate max-w-[80px]" title={file.fileName}>{file.fileName}</span>
                                  </button>
                                ))}
                              </div>
                            ) : fileId ? (
                              <button
                                type="button"
                                onClick={() => openFileAsset({ id: fileId, fileAssetId: fileId, originalName: fileName || 'Specification' }, fileName || 'Specification')}
                                className="inline-flex items-center gap-1 text-indigo-600 hover:underline font-bold text-[10px] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 mx-auto"
                              >
                                <FileText className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-[80px]" title={fileName || 'Specification file'}>{fileName || 'Spec'}</span>
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 5. Terms & Conditions */}
          {(eligibilityCriteria.length > 0 || termsAndConditions.length > 0) && (
            <section className="border border-slate-200/90 rounded-lg bg-white p-4 shadow-2xs space-y-3">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
                <ClipboardCheck className="h-4 w-4 text-indigo-600" />
                <span>Terms & Conditions</span>
              </h2>
              {eligibilityCriteria.length > 0 && (
                <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Eligibility Criteria</span>
                  <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm font-medium text-slate-800">
                    {eligibilityCriteria.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {termsAndConditions.length > 0 && (
                <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Special Terms & Conditions</span>
                  <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm font-medium text-slate-800">
                    {termsAndConditions.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* ── Specifications & Metadata Browser (inside left column, no gap from sidebar) ── */}
          {detailSections.length > 0 && (() => {
            const getSectionIcon = (title: string) => {
              const t = title.toLowerCase();
              if (t.includes('intent') || t.includes('scope')) return ClipboardList;
              if (t.includes('consignee') || t.includes('location') || t.includes('address')) return MapPin;
              if (t.includes('vendor') || t.includes('supplier') || t.includes('seller')) return Users;
              if (t.includes('timeline') || t.includes('schedule') || t.includes('date') || t.includes('rule')) return CalendarDays;
              if (t.includes('commercial') || t.includes('payment') || t.includes('price') || t.includes('budget')) return IndianRupee;
              if (t.includes('evaluation') || t.includes('basis') || t.includes('score')) return Award;
              if (t.includes('approval') || t.includes('notes')) return ShieldCheck;
              if (t.includes('service')) return Wrench;
              if (t.includes('rate') || t.includes('contract')) return FileText;
              if (t.includes('auction')) return Gavel;
              return Layers;
            };

            const getFieldIcon = (label: string) => {
              const l = label.toLowerCase();
              if (l.includes('title') || l.includes('name')) return FileText;
              if (l.includes('category')) return Tag;
              if (l.includes('buyer') || l.includes('org')) return Building;
              if (l.includes('value') || l.includes('amount') || l.includes('budget') || l.includes('price') || l.includes('rate')) return IndianRupee;
              if (l.includes('location') || l.includes('address') || l.includes('consignee')) return MapPin;
              if (l.includes('buying') || l.includes('item') || l.includes('product') || l.includes('what')) return Package;
              if (l.includes('method') || l.includes('strategy') || l.includes('type')) return Zap;
              if (l.includes('date') || l.includes('time') || l.includes('deadline')) return CalendarDays;
              if (l.includes('user') || l.includes('person') || l.includes('contact')) return UserCheck;
              if (l.includes('status') || l.includes('state')) return CheckCircle2;
              return Info;
            };

            const getSectionStatus = (sec: { title: string; fields: Array<{ label: string; value: string }> }) => {
              if (!sec.fields || sec.fields.length === 0) {
                return { label: 'Optional', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' };
              }
              const filledCount = sec.fields.filter(f => {
                const val = String(f.value || '').trim();
                return val && val !== '—' && val !== '-' && val !== 'N/A' && val !== 'None';
              }).length;

              if (filledCount === sec.fields.length && filledCount > 0) {
                return { label: 'Completed', badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
              } else if (filledCount > 0) {
                return { label: `${filledCount}/${sec.fields.length} Filled`, badgeClass: 'bg-blue-50 text-blue-800 border-blue-300' };
              } else {
                return { label: 'Optional', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' };
              }
            };

            return (
              <section id="additional-metadata" className="scroll-mt-24 space-y-4">
                {/* Header Banner */}
                <div className="rounded-lg bg-white border border-slate-200/90 shadow-2xs overflow-hidden">
                  <div className="h-1 w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 border border-indigo-100 shrink-0">
                        <Layers className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-slate-900 tracking-tight">Procurement Specification Details</h2>
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200">
                            <Sparkles className="h-3 w-3" />
                            RFQ Specs
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">All parameters, terms, and configurations for this procurement</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        {detailSections.length} Sections
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile Navigation (< lg screens) */}
                <div className="block lg:hidden bg-white border border-slate-200/90 rounded-lg p-3 shadow-2xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Jump to section</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {detailSections.map((sec, idx) => {
                      const isActive = (activeSection === null && idx === 0) || activeSection === idx;
                      const SectionIcon = getSectionIcon(sec.title);
                      return (
                        <button
                          key={`mob-${sec.title}-${idx}`}
                          type="button"
                          onClick={() => {
                            setActiveSection(idx);
                            const el = document.getElementById(`sec-content-${idx}`);
                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap transition-all duration-150 shrink-0 border",
                            isActive
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                              : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                          )}
                        >
                          <SectionIcon className="h-3.5 w-3.5" />
                          {sec.title}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Master-Detail Layout (220px Sidebar Navigation) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

                  {/* Left Sidebar Navigation (220px width on desktop) */}
                  <div className="hidden lg:block lg:col-span-3 xl:w-[220px] sticky top-16">
                    <div className="bg-white border border-slate-200/90 rounded-lg shadow-2xs overflow-hidden">
                      <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Sections</span>
                        <span className="text-[10px] font-bold text-slate-500">{detailSections.length} total</span>
                      </div>

                      <div className="p-1 space-y-0.5">
                        {detailSections.map((sec, idx) => {
                          const isActive = (activeSection === null && idx === 0) || activeSection === idx;
                          const SectionIcon = getSectionIcon(sec.title);
                          const status = getSectionStatus(sec);
                          const isCompleted = status.label === 'Completed';

                          return (
                            <button
                              key={`nav-${sec.title}-${idx}`}
                              type="button"
                              onClick={() => {
                                setActiveSection(idx);
                                const el = document.getElementById(`sec-content-${idx}`);
                                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }}
                              className={cn(
                                "w-full h-[38px] flex items-center justify-between px-3 py-1.5 rounded-md text-left transition-all duration-150 group text-xs",
                                isActive
                                  ? "bg-indigo-50/80 border border-indigo-200 text-indigo-900 font-bold shadow-2xs"
                                  : "hover:bg-slate-50 border border-transparent text-slate-700 font-medium"
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={cn(
                                  "flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-bold border",
                                  isActive
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : isCompleted
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-slate-100 text-slate-500 border-slate-200"
                                )}>
                                  {isCompleted && !isActive ? (
                                    <CheckCircle2 className="h-3 w-3" />
                                  ) : (
                                    <SectionIcon className="h-3 w-3" />
                                  )}
                                </div>
                                <span className="truncate text-xs leading-tight">
                                  {sec.title}
                                </span>
                              </div>

                              <ChevronRight className={cn(
                                "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
                                isActive ? "text-indigo-600" : "text-slate-300 group-hover:text-slate-500"
                              )} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right-Side Section Content */}
                  <div className="lg:col-span-9 space-y-3.5">
                    {detailSections.map((sec, idx) => {
                      const SectionIcon = getSectionIcon(sec.title);
                      const status = getSectionStatus(sec);
                      const isActive = (activeSection === null && idx === 0) || activeSection === idx;

                      return (
                        <div
                          key={`content-${sec.title}-${idx}`}
                          id={`sec-content-${idx}`}
                          className={cn(
                            "scroll-mt-24 rounded-lg bg-white border transition-all duration-200 overflow-hidden",
                            isActive
                              ? "border-indigo-300 shadow-sm ring-1 ring-indigo-100"
                              : "border-slate-200/90 shadow-2xs hover:border-slate-300"
                          )}
                        >
                          {isActive && <div className="h-1 w-full bg-gradient-to-r from-indigo-600 to-violet-500" />}

                          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/40">
                            <div className="flex items-center gap-2.5">
                              <div className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                                isActive ? "bg-indigo-50 text-indigo-600 border-indigo-200" : "bg-slate-100 text-slate-500 border-slate-200"
                              )}>
                                <SectionIcon className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <h3 className={cn(
                                  "text-[15px] font-semibold tracking-tight",
                                  isActive ? "text-indigo-900" : "text-slate-900"
                                )}>{sec.title}</h3>
                                <p className="text-[11px] text-slate-500 font-medium">{sec.fields.length} parameters</p>
                              </div>
                            </div>
                            <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase border tracking-wider", status.badgeClass)}>
                              {status.label}
                            </span>
                          </div>

                          <div className="p-3.5">
                            {(() => {
                              const longTextFields = sec.fields.filter(f => {
                                const val = String(f.value || '');
                                return val.length > 100 || f.label.toLowerCase().includes('description') || f.label.toLowerCase().includes('reason') || f.label.toLowerCase().includes('justification') || f.label.toLowerCase().includes('notes') || f.label.toLowerCase().includes('scope') || f.label.toLowerCase().includes('terms');
                              });
                              const propertyFields = sec.fields.filter(f => !longTextFields.includes(f));

                              return (
                                <div className="space-y-3">
                                  {/* Title field */}
                                  {propertyFields.filter(f => f.label.toLowerCase().includes('title')).map((field, fieldIdx) => (
                                    <div key={`title-${fieldIdx}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                      <span className="text-[12px] font-medium uppercase tracking-wider text-slate-500 block mb-0.5">{field.label}</span>
                                      <p className="text-[15px] font-bold text-slate-900 leading-snug break-words">
                                        {formatDisplayValue(field.value, field.label)}
                                      </p>
                                    </div>
                                  ))}

                                  {/* Non-title fields grid */}
                                  {propertyFields.filter(f => !f.label.toLowerCase().includes('title')).length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                                      {propertyFields.filter(f => !f.label.toLowerCase().includes('title')).map((field, fieldIdx) => {
                                        const formattedVal = formatDisplayValue(field.value, field.label);
                                        return (
                                          <div
                                            key={`card-${field.label}-${fieldIdx}`}
                                            className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50/50 space-y-0.5"
                                          >
                                            <span className="text-[12px] font-medium text-slate-500 uppercase tracking-wider block truncate">
                                              {field.label}
                                            </span>
                                            <span className="text-[14px] font-semibold text-slate-900 block leading-snug break-words">
                                              {formattedVal}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              </section>
            );
          })()}

        </div>

        {/* ── RIGHT STICKY SIDEBAR (4 COLUMNS ON DESKTOP: STICKY TOP-16) ── */}
        <div id="buyer-info" className="lg:col-span-4 sticky top-16 space-y-3">

          {/* Card 1: Quotation Deadline & Countdown */}
          <section className="border border-rose-200/90 rounded-lg bg-rose-50/40 p-4 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-rose-100">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-rose-600" /> Quotation Deadline
              </span>
              <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-900 border border-rose-200 uppercase">
                {rfqData?.status || 'Open'}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-medium text-rose-700 block">Closing Date & Time</span>
              <p className="text-sm sm:text-base font-extrabold text-rose-950 block">{closesAtFormatted}</p>
              {timeRemainingStr && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-100/90 border border-rose-200 text-rose-900 text-[11px] font-bold mt-1">
                  <Clock className="h-3 w-3 text-rose-600 animate-pulse shrink-0" />
                  <span>Time Remaining: <strong className="font-extrabold text-rose-950">{timeRemainingStr}</strong></span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-rose-100/90 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-medium text-slate-500 block">Estimated Value</span>
                <p className="text-xl sm:text-2xl font-black text-slate-900 tabular-nums">{formatCurrency(estimatedValueVal)}</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-medium text-slate-500 block">Urgency</span>
                <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                  {basics.urgency || payload.urgency || 'Normal'}
                </span>
              </div>
            </div>
          </section>

          {/* Card 2: Enterprise Earnest Money Deposit (EMD) Card */}
          {user?.role === 'seller' && (
            <EmdCard
              emdInfo={emdInfo}
              loading={emdLoading}
              onPayClick={() => setIsEmdModalOpen(true)}
            />
          )}

          {/* Card 2: Buyer Information (Compact Clean Key-Value Rows) */}
          <section className="border border-slate-200/90 rounded-lg bg-white p-4 shadow-2xs space-y-2.5">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" />
              <span>Buyer Information</span>
            </h2>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[11px] font-medium text-slate-500">Buyer</span>
                <span className="text-xs font-bold text-slate-900 truncate max-w-[170px]" title={orgName}>{orgName}</span>
              </div>

              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[11px] font-medium text-slate-500">Contact</span>
                <span className="text-xs font-semibold text-slate-900 truncate max-w-[170px]" title={contactPerson}>{contactPerson}</span>
              </div>

              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[11px] font-medium text-slate-500">Email</span>
                <span className="text-xs font-mono font-semibold text-indigo-700 truncate max-w-[170px]" title={email}>{email}</span>
              </div>

              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[11px] font-medium text-slate-500">Phone</span>
                <span className="text-xs font-semibold text-slate-900">{phone}</span>
              </div>

              {address !== '—' && (
                <div className="flex items-start justify-between gap-2 pt-0.5">
                  <span className="text-[11px] font-medium text-slate-500 shrink-0">Location</span>
                  <span className="text-xs font-semibold text-slate-800 text-right truncate" title={address}>{address}</span>
                </div>
              )}
            </div>
          </section>

          {/* Card 3: Budget & Financial Sanction */}
          {hasBudget && budgetDetails && (
            <section className="border border-slate-200/90 rounded-lg bg-white p-4 shadow-2xs space-y-2.5">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-emerald-600" />
                <span>Budget & Financial Sanction</span>
              </h2>

              <div className="space-y-1.5 text-xs">
                {budgetDetails.budgetHead && (
                  <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                    <span className="text-[11px] font-medium text-slate-500">Budget Head</span>
                    <span className="text-xs font-bold text-slate-900">{budgetDetails.budgetHead}</span>
                  </div>
                )}
                {budgetDetails.financialYear && (
                  <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                    <span className="text-[11px] font-medium text-slate-500">Financial Year</span>
                    <span className="text-xs font-semibold text-slate-900">{budgetDetails.financialYear}</span>
                  </div>
                )}
                {budgetDetails.sanctionAmount && (
                  <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                    <span className="text-[11px] font-medium text-slate-500">Sanction Amount</span>
                    <span className="text-xs font-bold text-emerald-700">{formatCurrency(budgetDetails.sanctionAmount)}</span>
                  </div>
                )}
                {budgetDetails.sanctionOrderNumber && (
                  <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                    <span className="text-[11px] font-medium text-slate-500">Sanction Order</span>
                    <span className="text-xs font-mono font-bold text-slate-900">{budgetDetails.sanctionOrderNumber}</span>
                  </div>
                )}
                {budgetDetails.approvingAuthority && (
                  <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                    <span className="text-[11px] font-medium text-slate-500">Approving Authority</span>
                    <span className="text-xs font-semibold text-slate-900">{budgetDetails.approvingAuthority}</span>
                  </div>
                )}
                {budgetDetails.costCenter && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-medium text-slate-500">Cost Center</span>
                    <span className="text-xs font-semibold text-slate-900">{budgetDetails.costCenter}</span>
                  </div>
                )}
              </div>

              {budgetDetails.justification && (
                <div className="rounded-lg bg-amber-50/80 border border-amber-200/90 p-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-0.5">Justification</span>
                  <p className="text-xs font-medium text-slate-800 leading-relaxed">{budgetDetails.justification}</p>
                </div>
              )}
            </section>
          )}

        </div>

      </div>




      {/* ── Clarifications & Q&A Panel ── */}
      {rfqData && (
        <ClarificationPanel
          quoteRequestId={requirementId || rfqData?.sourceId || (typeof rfqData?.id === 'number' ? rfqData.id : (typeof rfqData?.id === 'string' && !isNaN(Number(rfqData.id)) ? Number(rfqData.id) : undefined))}
          kind={rfqData?.sourceModel === 'REQUIREMENT' || !!requirementId || !!rfqData?.sourceId ? 'requirement' : 'quote-request'}
          role={user?.role === 'buyer' ? 'buyer' : 'seller'}
          deadlinePassed={!!rfqData?.deadlineDate && new Date(rfqData.deadlineDate).getTime() < Date.now()}
        />
      )}

      {/* ── Enterprise EMD Payment Modal ── */}
      <EmdPaymentModal
        isOpen={isEmdModalOpen}
        onClose={() => setIsEmdModalOpen(false)}
        requirementId={targetReqId}
        requestId={targetBidToken}
        rfqTitle={subject}
        rfqNumber={rfqNumberString}
        emdAmount={emdInfo?.emdAmount || 50000}
        buyerName={orgName}
        onSuccess={(paymentData) => {
          setIsEmdModalOpen(false);
          toast.success('EMD Payment verified & completed successfully!');
          refetchEmd();
        }}
      />

    </div>
  );
}
