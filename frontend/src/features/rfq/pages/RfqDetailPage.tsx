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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   HELPERS
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

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

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   MAIN COMPONENT
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

export default function RfqDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || '';
  const { user } = useAuth();
  const requestId = searchParams?.get('requestId') || '';
  const requirementId = searchParams?.get('requirementId') || '';

  // activeMainTab: which top nav tab is highlighted (visual only)
  const [activeMainTab, setActiveMainTab] = useState<string>('overview');
  const [isDescExpanded, setIsDescExpanded] = useState<boolean>(false);
  // expandedSpecSection: which detailSections accordion panel is open (index)
  const [expandedSpecSection, setExpandedSpecSection] = useState<number>(0);

  const scrollToSection = (id: string) => {
    setActiveMainTab(id);
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const handleSpecSectionClick = (idx: number) => {
    setExpandedSpecSection(idx);
    // Scroll the main metadata section into view smoothly
    const el = document.getElementById('additional-metadata');
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

  // â”€â”€ Enterprise EMD Feature State & Query â”€â”€
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

  /* â”€â”€ Data Extraction â”€â”€ */
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
  let rfqNumberString = rfqData?.requirementNumber || (rfqData?.id ? `RFQ-2026-0101${Math.abs(Number(rfqData.id))}` : 'â€”');
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

  // Service procurement detection
  const buyingTypeStr = String(payload.buyingType || basics.buyingType || rfqData?.buyingType || '').toLowerCase();

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
      itemName: item.itemName || item.name || item.description || '-',
      quantity: item.quantity || 0,
      unitOfMeasure: item.unitOfMeasure || item.unit || 'Nos',
      description: item.description,
      estimatedUnitPrice: item.estimatedUnitPrice,
      specifications: item.specifications,
    }));
  } else if (payload.items && Array.isArray(payload.items) && payload.items.length > 0) {
    itemsList = payload.items.map((item: any) => ({
      itemName: item.name || item.itemName || item.description || '-',
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

  const isServiceProcurement = buyingTypeStr.includes('service') || itemsList.some(item => String((item as any)?.itemType || item.specifications?.itemType || '').toLowerCase() === 'service');

  // Detail Sections for Accordion
  const detailSections = rfqData?.payload ? [
    detailSection('Procurement Intent', {
      ...(payload.basics || {}),
      buyerType: payload.buyerType,
      buyingType: payload.buyingType,
      recommendedMethod: payload.recommendation?.id,
      recommendationReason: payload.recommendation?.reason,
    }),
    detailSection('Vendor / Supplier Selection', payload.vendors),
    detailSection('Timeline & Rules', { ...(payload.schedule || {}), ...(payload.tender || {}), ...(payload.rules || {}) }),
    detailSection('Commercial Terms', payload.terms),
    detailSection('Evaluation Basis', payload.evaluation),
    detailSection('Approval Notes', payload.approval),
    isServiceProcurement ? detailSection('Service Details', payload.serviceDetails) : null,
    isRateContract ? detailSection('Rate Contract', payload.rateContractConfig || payload.rateContract) : null,
    (payload.auctionConfig?.enabled || rules.reverseAuction) ? detailSection('Reverse Auction', payload.auctionConfig) : null,
  ].filter(Boolean) as Array<{ title: string; fields: Array<{ label: string; value: string }> }> : [];

  // Buyer Info
  const orgName = rfqData?.buyerOrganization?.organizationName
    || rfqData?.buyer?.buyerProfile?.organizationName
    || rfqData?.buyerOrganizationName
    || rfqData?.buyer?.name
    || internal.orgName
    || basics.buyerOrganizationName
    || (isSeedId ? 'Govt. Buyer Org' : '-');

  const contactPerson = rfqData?.contactPerson
    || rfqData?.buyer?.buyerProfile?.contactPerson
    || internal.contactPerson
    || (isSeedId ? 'A. K. Mohanty' : '-');

  const email = rfqData?.buyer?.email
    || rfqData?.buyerEmail
    || internal.email
    || (isSeedId ? 'procurement@govorg.in' : '-');

  const phone = rfqData?.buyer?.mobile
    || rfqData?.buyerMobile
    || internal.mobile
    || (isSeedId ? '+91 94370 12345' : '-');

  let address = '-';
  if (rfqData?.buyer?.buyerProfile?.city) {
    address = `${rfqData.buyer.buyerProfile.organizationName || orgName}, ${rfqData.buyer.buyerProfile.city}, ${rfqData.buyer.buyerProfile.state || ''}`;
  } else if (rfqData?.buyerOrganization?.city) {
    address = [rfqData.buyerOrganization.city, rfqData.buyerOrganization.district, rfqData.buyerOrganization.state].filter(Boolean).join(', ');
  } else if (internal.deliveryAddress || basics.deliveryLocation || rfqData?.location) {
    address = internal.deliveryAddress || basics.deliveryLocation || rfqData?.location || '-';
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
  let category = rfqData?.categoryName || rfqData?.category?.name || basics.category || (isSeedId ? 'General Sourcing' : '-');
  let subCategory = basics.subCategory || (isSeedId ? 'Standard Sourcing' : '');
  if (!rfqData?.payload && isSeedId) {
    if (isCopper) { category = 'Electrical & Power'; subCategory = 'Copper Wire Winding'; }
    else if (isStationery) { category = 'Office Supplies'; subCategory = 'Paper & Stationery'; }
    else if (isCNC) { category = 'Industrial Machinery'; subCategory = 'CNC & Milling Parts'; }
    else if (isFire) { category = 'Safety & Security'; subCategory = 'Fire Fighting Equipment'; }
  }

  // Dates
  let closesAtFormatted = '-';
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
    : (schedule.publishDate ? formatDateString(schedule.publishDate) : (isSeedId ? '10 Jul 2026' : '-'));

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
    : '-';

  const timelineSteps = [
    { label: isRateContract ? 'Rate Contract Published' : 'RFQ Published', date: publishedDateFormatted, active: true },
    { label: 'Clarification', date: clarificationDeadlineStr, active: false },
    { label: 'Quotation Submission', date: rfqData?.deadlineDate ? `Up to ${formatDateString(rfqData.deadlineDate)}` : (schedule.submissionDate ? `Up to ${formatDateString(schedule.submissionDate)}` : 'Pending'), active: false },
    { label: 'Evaluation', date: 'Pending', active: false },
    { label: 'Order', date: 'Pending', active: false },
  ];


  /* Handlers */
  const handleDownload = () => {
    try {
      toast.info('Generating official RFQ PDF package...');

      const engine = new PdfEngine();

      const tableHeaders = ['Item Description', 'Quantity', 'Unit', 'Est. Price (INR)', 'GST %'];
      const tableData = itemsList.map(item => [
        item.itemName,
        String(item.quantity || 0),
        item.unitOfMeasure || 'Nos',
        item.estimatedUnitPrice ? `Rs ${item.estimatedUnitPrice.toLocaleString('en-IN')}` : '-',
        item.specifications?.gst ? `${item.specifications.gst}%` : '-'
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
            email: email !== '-' ? email : undefined,
            phone: phone !== '-' ? phone : undefined,
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

  /* ─────────────────────────────────────────────────────────────
     RENDER
     ───────────────────────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-4 md:px-8 pb-16 font-sans text-slate-900 bg-slate-50/60 min-h-screen scroll-smooth animate-in fade-in duration-200">

      {/* ── Breadcrumb Navigation ── */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-slate-400 uppercase">
        {pathname.startsWith('/buyer') ? (
          <>
            <span className="hover:text-[#5B5BD6] transition-colors cursor-pointer" onClick={() => router.push('/buyer/my-procurements')}>
              MARKETPLACE
            </span>
            <span>•</span>
            <span className="hover:text-[#5B5BD6] transition-colors cursor-pointer" onClick={() => router.push('/buyer/my-procurements')}>
              MY PROCUREMENTS
            </span>
          </>
        ) : (
          <>
            <span className="hover:text-[#5B5BD6] transition-colors cursor-pointer" onClick={() => router.push('/seller/opportunities')}>
              MARKETPLACE
            </span>
            <span>•</span>
            <span className="hover:text-[#5B5BD6] transition-colors cursor-pointer" onClick={() => router.push('/seller/opportunities/rfqs')}>
              RFQS
            </span>
          </>
        )}
        <span>•</span>
        <span className="text-slate-600 font-extrabold">{rfqNumberString}</span>
      </nav>

      {/* Guest login banner */}
      {!user && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/90 px-5 py-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#5B5BD6] text-white shadow-xs">
              <Info className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Want to participate in this procurement?</p>
              <p className="text-[11px] text-slate-600 font-medium">Please login or register as a verified seller to submit your quotation.</p>
            </div>
          </div>
          <a
            href={`/login?redirect=${encodeURIComponent(pathname + (requestId ? `?requestId=${requestId}` : (requirementId ? `?requirementId=${requirementId}` : '')))}`}
            className="whitespace-nowrap rounded-xl bg-[#5B5BD6] px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-xs hover:bg-[#4B4BC6] transition-all"
          >
            Login to Participate
          </a>
        </div>
      )}

      {/* ── Main Compact Hero Header ── */}
      <section className="bg-white border border-slate-200/90 rounded-2xl p-5 md:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Title & Metadata Left Container */}
          <div className="space-y-2 max-w-4xl min-w-0">
            <div className="flex flex-wrap items-center gap-3 max-w-full min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight truncate" title={subject}>
                {subject}
              </h1>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-bold uppercase tracking-wider shrink-0">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                {rfqData?.status ? `${rfqData.status} OPEN` : 'BIDDING OPEN'}
              </span>
            </div>

            <p className="text-sm font-medium text-slate-500 leading-relaxed">
              Published on <strong className="text-slate-800 font-bold">{publishedDateFormatted}</strong> by <strong className="text-slate-800 font-bold">{orgName}</strong> for {address} delivery site.
            </p>
          </div>

          {/* Action Buttons Right Aligned */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownload}
              className="h-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-semibold text-slate-700 px-4 flex items-center gap-2 transition-all shadow-xs"
            >
              <Download className="h-4 w-4 text-[#5B5BD6]" /> Download RFQ
            </Button>
            {user && user.role === 'seller' && (
              emdInfo?.isEmdRequired && !isEmdPaid ? (
                <Button
                  type="button"
                  onClick={() => setIsEmdModalOpen(true)}
                  className="h-10 rounded-xl bg-[#5B5BD6] hover:bg-[#4B4BC6] text-white font-bold text-sm px-5 flex items-center gap-2 transition-all shadow-sm"
                >
                  <CreditCard className="h-4 w-4 text-emerald-200" /> Pay EMD to Unlock Submission
                </Button>
              ) : ownResponse && ownResponse.status !== 'DRAFT' ? (
                <Button
                  type="button"
                  onClick={handleSubmitQuotation}
                  className="h-10 rounded-xl bg-[#5B5BD6] hover:bg-[#4B4BC6] text-white font-bold text-sm px-5 flex items-center gap-2 transition-all shadow-sm"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-200" /> View / Edit Quotation
                </Button>
              ) : ownResponse && ownResponse.status === 'DRAFT' ? (
                <Button
                  type="button"
                  onClick={handleSubmitQuotation}
                  className="h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm px-5 flex items-center gap-2 transition-all shadow-sm"
                >
                  <Clock className="h-4 w-4 text-amber-200" /> Continue Draft
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmitQuotation}
                  className="h-10 rounded-xl bg-[#5B5BD6] hover:bg-[#4B4BC6] text-white font-bold text-sm px-5 flex items-center gap-2 transition-all shadow-sm"
                >
                  Submit Quotation <ArrowRight className="h-4 w-4" />
                </Button>
              )
            )}
          </div>
        </div>

        {/* ── Horizontal Stepper Milestone Tracker ── */}
        <div className="pt-4 border-t border-slate-100 overflow-x-auto">
          <div className="min-w-[650px] w-full flex items-center justify-between relative px-8 py-2">
            {/* Base Connection Line */}
            <div className="absolute top-[21px] left-[60px] right-[60px] h-[2px] bg-slate-200 -z-0 rounded-full" />
            {/* Active Progress Line */}
            <div
              className="absolute top-[21px] left-[60px] h-[2px] bg-[#5B5BD6] -z-0 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, (timelineSteps.filter(s => s.active).length - 1) / Math.max(1, timelineSteps.length - 1) * 100))}%` }}
            />

            {timelineSteps.map((step, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1.5 relative z-10 text-center flex-1">
                <div
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all duration-200 text-xs font-bold',
                    step.active
                      ? 'bg-[#5B5BD6] border-[#5B5BD6] text-white shadow-xs ring-4 ring-indigo-50'
                      : 'bg-white border-slate-300 text-slate-400'
                  )}
                >
                  {step.active ? (
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <div className="space-y-0 leading-tight">
                  <p className={cn('text-xs font-extrabold uppercase tracking-wider', step.active ? 'text-[#5B5BD6]' : 'text-slate-400')}>
                    {step.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise EMD Mandatory Unpaid Warning Banner */}
      {user && user.role === 'seller' && emdInfo?.isEmdRequired && !isEmdPaid && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 px-5 py-3 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-xs font-bold text-sm">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-amber-950">Earnest Money Deposit (EMD) Mandatory</p>
                <span className="rounded bg-amber-200/80 px-2.5 py-0.5 text-[9px] font-extrabold uppercase text-amber-900 tracking-wider border border-amber-300">
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
            className="h-9 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-4 text-xs font-extrabold uppercase tracking-wider shadow-2xs shrink-0 self-end sm:self-center flex items-center gap-1.5"
          >
            <CreditCard className="h-4 w-4" /> Pay EMD (₹{emdInfo.emdAmount.toLocaleString('en-IN')})
          </Button>
        </div>
      )}

      {/* Active Submission Banner */}
      {user && user.role === 'seller' && ownResponse && ownResponse.status !== 'DRAFT' && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-xs">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-emerald-950">Quotation Already Submitted</p>
                <span className="rounded bg-emerald-100 px-2.5 py-0.5 text-[9px] font-extrabold uppercase text-emerald-800 tracking-wider border border-emerald-200">
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
            className="h-9 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white px-4 text-xs font-extrabold uppercase tracking-wider shadow-2xs shrink-0 self-end sm:self-center"
          >
            <Eye className="h-4 w-4 mr-1.5" /> View / Edit Quotation
          </Button>
        </div>
      )}

      {/* ── Compact Navigation Tabs Bar ── */}
      <div className="sticky top-3 z-40 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl px-4 h-12 flex items-center shadow-xs">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar w-full">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'scope-items', label: 'Scope' },
            { id: 'key-dates', label: 'Key Dates' },
            ...(documents.length > 0 ? [{ id: 'documents', label: 'Documents' }] : []),
            ...(itemsList.length > 0 ? [{ id: 'line-items', label: 'Items' }] : []),
            ...(detailSections.length > 0 ? [{ id: 'additional-metadata', label: 'Specs' }] : []),
          ].map(tab => {
            const isActive = activeMainTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => scrollToSection(tab.id)}
                className={cn(
                  "h-12 border-b-2 font-bold text-sm transition-all whitespace-nowrap px-1",
                  isActive
                    ? "border-[#5B5BD6] text-[#5B5BD6]"
                    : "border-transparent text-slate-500 hover:text-slate-900 font-medium"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MAIN 12-COLUMN DASHBOARD GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        {/* ── LEFT MAIN CONTENT (8 COLUMNS ON DESKTOP) ── */}
        <div className="lg:col-span-8 space-y-4 self-start">

          {/* 1. Procurement Overview Card */}
          <section id="overview" className="scroll-mt-24 border border-slate-200/90 rounded-2xl bg-white p-5 md:p-6 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-3">
              PROCUREMENT OVERVIEW
            </h2>

            {(() => {
              const parsed = parseDescription(rfqData?.description);
              const displayUrgency = parsed.urgency ? formatDisplayValue(parsed.urgency) : urgency ? formatDisplayValue(urgency) : 'Normal';

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">

                  {/* Sourcing Method */}
                  <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 flex flex-col justify-center space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">SOURCING METHOD</span>
                    <span className="text-sm font-bold text-slate-800 block truncate" title={isRateContract ? 'Rate Contract' : `RFQ (${formatDisplayValue(String(methodLabel))})`}>
                      {isRateContract ? 'Rate Contract' : `RFQ (${formatDisplayValue(String(methodLabel))})`}
                    </span>
                  </div>

                  {/* Category */}
                  <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 flex flex-col justify-center space-y-1 min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">CATEGORY</span>
                    <span className="text-sm font-bold text-slate-800 block truncate" title={category}>{category}</span>
                  </div>

                  {/* Quantity */}
                  <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 flex flex-col justify-center space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">QUANTITY</span>
                    <span className="text-sm font-bold text-slate-800 block truncate" title={rfqData?.quantity ? (rfqData.unit ? `${rfqData.quantity} ${rfqData.unit}` : rfqData.quantity) : '2 Nos'}>
                      {rfqData?.quantity ? (rfqData.unit ? `${rfqData.quantity} ${rfqData.unit}` : rfqData.quantity) : '2 Nos'}
                    </span>
                  </div>

                  {/* Delivery Location */}
                  <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 flex flex-col justify-center space-y-1 min-w-0 sm:col-span-2 md:col-span-3">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">DELIVERY LOCATION</span>
                    <span className="text-sm font-bold text-slate-800 block truncate" title={rfqData?.location || address}>
                      {rfqData?.location || address}
                    </span>
                  </div>

                  {/* Payment Terms */}
                  <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 flex flex-col justify-center space-y-1 min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">PAYMENT TERMS</span>
                    <span className="text-sm font-bold text-slate-800 block truncate" title={rfqData?.paymentTerms || terms.paymentTerms || '-'}>
                      {rfqData?.paymentTerms || terms.paymentTerms || '-'}
                    </span>
                  </div>

                  {/* Delivery Terms */}
                  <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 flex flex-col justify-center space-y-1 min-w-0">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">DELIVERY TERMS</span>
                    <span className="text-sm font-bold text-slate-800 block truncate" title={rfqData?.deliveryTerms || terms.deliveryTerms || '-'}>
                      {rfqData?.deliveryTerms || terms.deliveryTerms || '-'}
                    </span>
                  </div>

                  {/* GST Compliance */}
                  <div className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 flex flex-col justify-center space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">GST COMPLIANCE</span>
                    <span className="text-sm font-bold text-slate-800 block">{terms.gstInclusion || 'Mandatory (18% Slab)'}</span>
                  </div>

                </div>
              );
            })()}
          </section>

          {/* 2. RFQ Scope & Collapsible Description */}
          <section id="scope-items" className="scroll-mt-24 border border-slate-200/90 rounded-2xl bg-white p-5 md:p-6 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-3">
              SCOPE OF WORK
            </h2>

            {(() => {
              const parsed = parseDescription(rfqData?.description);
              const urgencyVal = basics.urgency || payload.urgency || 'Normal';
              const summaryLine = `Sourcing Method: ${formatDisplayValue(String(methodLabel))} | Estimated Value: ${formatCurrency(estimatedValueVal)} | Urgency: ${urgencyVal}`;

              return (
                <div className="space-y-3">
                  <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">PROCUREMENT SUMMARY</span>
                    <p className="text-sm font-bold text-slate-800">{summaryLine}</p>
                  </div>

                  {parsed.text && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">DETAILED REQUIREMENT SPECIFICATION</span>
                      <p className={cn(
                        "text-sm font-medium leading-relaxed text-slate-700 whitespace-pre-wrap break-words transition-all duration-200",
                        !isDescExpanded && "line-clamp-3"
                      )}>
                        {parsed.text}
                      </p>
                      {parsed.text.length > 200 && (
                        <button
                          type="button"
                          onClick={() => setIsDescExpanded(!isDescExpanded)}
                          className="text-xs font-bold text-[#5B5BD6] hover:text-[#4B4BC6] transition-colors inline-flex items-center gap-1 cursor-pointer pt-1"
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

          {/* 3. RFP Documents Grid */}
          <section id="documents" className="scroll-mt-24 border border-slate-200/90 rounded-2xl bg-white p-5 md:p-6 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-3">
              RFP DOCUMENTS ({documents.length})
            </h2>

            {documents.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                      className="h-11 px-3.5 flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-[#5B5BD6] hover:shadow-xs transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="h-4 w-4 text-[#5B5BD6] shrink-0" />
                        <span className="text-xs font-bold text-slate-800 truncate" title={doc.fileName}>{doc.fileName}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 shrink-0 ml-1.5">
                        {isUploaded ? 'Uploaded' : 'Required'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 font-medium py-3 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
                No documents attached for this RFQ.
              </p>
            )}
          </section>

          {/* 4. Items & Line Specifications Table */}
          {itemsList.length > 0 && (
            <section id="line-items" className="scroll-mt-24 border border-slate-200/90 rounded-2xl bg-white p-5 md:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  LINE ITEMS & SPECIFICATIONS
                </h2>
                <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200">
                  {itemsList.length} {itemsList.length === 1 ? 'Item' : 'Items'}
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200/80 rounded-xl bg-white">
                <table className="min-w-[750px] w-full text-left border-collapse table-fixed">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr className="h-10">
                      <th className="px-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider w-[240px]">Item Details</th>
                      <th className="px-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider w-[100px] text-right">Qty / Unit</th>
                      <th className="px-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider w-[120px] text-right">Est. Unit Price</th>
                      <th className="px-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider w-[80px] text-center">GST Rate</th>
                      <th className="px-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider w-[180px]">Brand / Specs</th>
                      <th className="px-4 text-[11px] font-bold uppercase text-slate-400 tracking-wider w-[120px] text-center">Attachments</th>
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
                        <tr key={idx} className="h-[44px] hover:bg-slate-50/80 transition-colors align-middle">
                          {/* Item Details */}
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-bold text-slate-900 truncate" title={item.itemName}>{item.itemName}</span>
                              {itemType && (
                                <span className={cn(
                                  "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase border shrink-0",
                                  itemType.toLowerCase() === 'service'
                                    ? "border-purple-200 bg-purple-50 text-purple-700"
                                    : "border-indigo-200 bg-indigo-50 text-[#5B5BD6]"
                                )}>
                                  {itemType}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Quantity */}
                          <td className="px-4 py-2 text-right font-bold text-slate-900 text-xs sm:text-sm tabular-nums">
                            {item.quantity} <span className="text-[10px] font-medium text-slate-500 uppercase">{item.unitOfMeasure}</span>
                          </td>

                          {/* Est Unit Price */}
                          <td className="px-4 py-2 text-right font-bold text-slate-900 text-xs sm:text-sm tabular-nums">
                            {item.estimatedUnitPrice ? (
                              <span className="text-emerald-700">{formatCurrency(item.estimatedUnitPrice)}</span>
                            ) : (
                              <span className="text-slate-400 font-normal">-</span>
                            )}
                          </td>

                          {/* GST */}
                          <td className="px-4 py-2 text-center text-xs font-semibold text-slate-700 tabular-nums">
                            {gstVal !== undefined && gstVal !== null && Number(gstVal) > 0 ? (
                              <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-bold text-[11px]">{gstVal}%</span>
                            ) : '-'}
                          </td>

                          {/* Specifications & Preferences */}
                          <td className="px-4 py-2 text-xs text-slate-700">
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
                          <td className="px-4 py-2 text-center text-xs">
                            {files.length > 0 ? (
                              <div className="flex items-center justify-center gap-1">
                                {files.map((file: any, fidx: number) => (
                                  <button
                                    key={fidx}
                                    type="button"
                                    onClick={() => openFileAsset({ id: file.fileAssetId, fileAssetId: file.fileAssetId, originalName: file.fileName }, file.fileName)}
                                    className="inline-flex items-center gap-1 text-[#5B5BD6] hover:underline font-bold text-[10px] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100"
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
                                className="inline-flex items-center gap-1 text-[#5B5BD6] hover:underline font-bold text-[10px] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 mx-auto"
                              >
                                <FileText className="h-3 w-3 shrink-0" />
                                <span className="truncate max-w-[80px]" title={fileName || 'Specification file'}>{fileName || 'Spec'}</span>
                              </button>
                            ) : (
                              <span className="text-slate-400">-</span>
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
            <section className="border border-slate-200/90 rounded-2xl bg-white p-5 md:p-6 shadow-2xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-3">
                TERMS & CONDITIONS
              </h2>
              {eligibilityCriteria.length > 0 && (
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">ELIGIBILITY CRITERIA</span>
                  <ul className="list-disc pl-4 space-y-1 text-sm font-medium text-slate-800">
                    {eligibilityCriteria.map((c, idx) => (
                      <li key={idx}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {termsAndConditions.length > 0 && (
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">SPECIAL TERMS & CONDITIONS</span>
                  <ul className="list-disc pl-4 space-y-1 text-sm font-medium text-slate-800">
                    {termsAndConditions.map((t, idx) => (
                      <li key={idx}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* ── Specifications & Metadata Browser ── */}
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

            const getSectionStatus = (sec: { title: string; fields: Array<{ label: string; value: string }> }) => {
              if (!sec.fields || sec.fields.length === 0) {
                return { label: 'Optional', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' };
              }
              const filledCount = sec.fields.filter(f => {
                const val = String(f.value || '').trim();
                return val && val !== '-' && val !== 'N/A' && val !== 'None';
              }).length;

              if (filledCount === sec.fields.length && filledCount > 0) {
                return { label: 'COMPLETED', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 font-bold' };
              } else if (filledCount > 0) {
                return { label: `${filledCount}/${sec.fields.length} FILLED`, badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 font-bold' };
              } else {
                return { label: 'OPTIONAL', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' };
              }
            };

            return (
              <section id="additional-metadata" className="scroll-mt-24 space-y-4">
                {/* Header Banner */}
                <div className="rounded-2xl bg-white border border-slate-200/90 shadow-2xs overflow-hidden">
                  <div className="h-1 w-full bg-[#5B5BD6]" />
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100 shrink-0">
                        <Layers className="h-4 w-4 text-[#5B5BD6]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-bold text-slate-900 tracking-tight">Procurement Specification Details</h2>
                          <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-[#5B5BD6] border border-indigo-200">
                            <Sparkles className="h-3 w-3" />
                            RFQ Specs
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">All parameters, terms, and configurations for this procurement</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 border border-slate-200 px-3 py-1 text-xs font-bold text-slate-700 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      {detailSections.length} Sections
                    </span>
                  </div>
                </div>

                {/* Mobile Navigation */}
                <div className="block lg:hidden bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-2xs">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Jump to section</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {detailSections.map((sec, idx) => {
                      const isActive = expandedSpecSection === idx;
                      const SectionIcon = getSectionIcon(sec.title);
                      return (
                        <button
                          key={`mob-${sec.title}-${idx}`}
                          type="button"
                          onClick={() => handleSpecSectionClick(idx)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all shrink-0 border",
                            isActive
                              ? "bg-[#5B5BD6] text-white border-[#5B5BD6] shadow-xs"
                              : "bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:text-[#5B5BD6]"
                          )}
                        >
                          <SectionIcon className="h-3.5 w-3.5" />
                          {sec.title}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Master-Detail Accordion Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

                  {/* Left Sidebar Navigation */}
                  <div className="hidden lg:block lg:col-span-3 xl:w-[220px] sticky top-16">
                    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
                      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sections</span>
                        <span className="text-[10px] font-bold text-slate-500">{detailSections.length} total</span>
                      </div>

                      <div className="p-1.5 space-y-1">
                        {detailSections.map((sec, idx) => {
                          const isActive = expandedSpecSection === idx;
                          const SectionIcon = getSectionIcon(sec.title);
                          const status = getSectionStatus(sec);
                          const isCompleted = status.label.includes('COMPLETED');

                          return (
                            <button
                              key={`nav-${sec.title}-${idx}`}
                              type="button"
                              onClick={() => handleSpecSectionClick(idx)}
                              className={cn(
                                "w-full h-[40px] flex items-center justify-between px-3 py-1.5 rounded-xl text-left transition-all duration-150 group text-xs",
                                isActive
                                  ? "bg-indigo-50/80 border border-indigo-200 text-[#5B5BD6] font-bold shadow-2xs"
                                  : "hover:bg-slate-50 border border-transparent text-slate-700 font-medium"
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={cn(
                                  "flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md text-xs font-bold border transition-colors",
                                  isActive
                                    ? "bg-[#5B5BD6] text-white border-[#5B5BD6]"
                                    : isCompleted
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-slate-100 text-slate-400 border-slate-200"
                                )}>
                                  {isCompleted && !isActive ? (
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                  ) : (
                                    <SectionIcon className="h-3 w-3" />
                                  )}
                                </div>
                                <span className="truncate text-xs leading-tight">
                                  {sec.title}
                                </span>
                              </div>

                              <ChevronRight className={cn(
                                "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                                isActive ? "text-[#5B5BD6] rotate-90" : "text-slate-300 group-hover:text-slate-500"
                              )} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right-Side: Section Content */}
                  <div className="lg:col-span-9">
                    {detailSections.map((sec, idx) => {
                      const SectionIcon = getSectionIcon(sec.title);
                      const status = getSectionStatus(sec);
                      const isActive = expandedSpecSection === idx;

                      return (
                        <div
                          key={`content-${sec.title}-${idx}`}
                          id={`sec-content-${idx}`}
                          className={cn(
                            "rounded-2xl bg-white border transition-all duration-200 overflow-hidden",
                            isActive
                              ? "border-indigo-300 shadow-xs ring-1 ring-indigo-100"
                              : "hidden"
                          )}
                        >
                          <div className="h-1 w-full bg-[#5B5BD6]" />

                          {/* Section Header */}
                          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/40">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border bg-indigo-50 text-[#5B5BD6] border-indigo-200">
                                <SectionIcon className="h-4 w-4" />
                              </div>
                              <div>
                                <h3 className="text-base font-bold tracking-tight text-slate-900">{sec.title}</h3>
                                <p className="text-xs text-slate-400 font-medium">{sec.fields.length} parameters</p>
                              </div>
                            </div>
                            <span className={cn("px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase border tracking-wider", status.badgeClass)}>
                              {status.label}
                            </span>
                          </div>

                          {/* Section Body */}
                          <div className="p-4 sm:p-5 animate-in fade-in duration-200">
                            {(() => {
                              const longTextFields = sec.fields.filter(f => {
                                const val = String(f.value || '');
                                return val.length > 100 || f.label.toLowerCase().includes('description') || f.label.toLowerCase().includes('reason') || f.label.toLowerCase().includes('justification') || f.label.toLowerCase().includes('notes') || f.label.toLowerCase().includes('scope') || f.label.toLowerCase().includes('terms');
                              });
                              const propertyFields = sec.fields.filter(f => !longTextFields.includes(f));

                              return (
                                <div className="space-y-4">
                                  {propertyFields.filter(f => f.label.toLowerCase().includes('title')).map((field, fieldIdx) => (
                                    <div key={`title-${fieldIdx}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">{field.label}</span>
                                      <p className="text-base font-bold text-slate-900 leading-snug break-words">
                                        {formatDisplayValue(field.value, field.label)}
                                      </p>
                                    </div>
                                  ))}

                                  {propertyFields.filter(f => !f.label.toLowerCase().includes('title')).length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                                      {propertyFields.filter(f => !f.label.toLowerCase().includes('title')).map((field, fieldIdx) => {
                                        const formattedVal = formatDisplayValue(field.value, field.label);
                                        return (
                                          <div
                                            key={`card-${field.label}-${fieldIdx}`}
                                            className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-1"
                                          >
                                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                                              {field.label}
                                            </span>
                                            <span className="text-sm font-bold text-slate-900 block leading-snug break-words">
                                              {formattedVal}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {longTextFields.length > 0 && (
                                    <div className="space-y-3">
                                      {longTextFields.map((field, fieldIdx) => (
                                        <div key={`long-${fieldIdx}`} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-1">{field.label}</span>
                                          <p className="text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                                            {formatDisplayValue(field.value, field.label)}
                                          </p>
                                        </div>
                                      ))}
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

        {/* ── RIGHT STICKY SIDEBAR (4 COLUMNS ON DESKTOP) ── */}
        <div id="buyer-info" className="lg:col-span-4 sticky top-16 space-y-4">

          {/* Card 1: Quotation Deadline & Countdown (Dark Navy Theme strictly matching mockup) */}
          <section className="rounded-2xl bg-[#0B0F19] p-5 text-white shadow-md space-y-4 border border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#5B5BD6]" /> DEADLINE COUNTDOWN
              </span>
              <span className="rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold uppercase">
                {rfqData?.status || 'OPEN'}
              </span>
            </div>

            <div className="space-y-1">
              {timeRemainingStr && timeRemainingStr !== 'Expired' ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-white">{timeRemainingStr.split(' ')[0]}</span>
                  <span className="text-sm font-bold text-slate-300">{timeRemainingStr.split(' ')[1] || ''}</span>
                  {timeRemainingStr.split(' ')[2] && (
                    <>
                      <span className="text-3xl sm:text-4xl font-black text-white ml-2">{timeRemainingStr.split(' ')[2]}</span>
                      <span className="text-sm font-bold text-slate-300">{timeRemainingStr.split(' ')[3] || ''}</span>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-xl font-bold text-white">{closesAtFormatted}</p>
              )}
              <p className="text-xs text-slate-400 font-medium">Closes {closesAtFormatted}</p>
            </div>

            {user && user.role === 'seller' && (
              <Button
                type="button"
                onClick={handleSubmitQuotation}
                className="w-full h-11 rounded-xl bg-[#5B5BD6] hover:bg-[#4B4BC6] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                Submit Quotation Now <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </section>

          {/* Card 2: Estimated Value & EMD Amount */}
          <section className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">ESTIMATED VALUE</span>
                <p className="text-2xl font-black text-slate-900 tabular-nums mt-0.5">{formatCurrency(estimatedValueVal)}</p>
              </div>
              {emdInfo && (
                <div className="text-right">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">EMD AMOUNT</span>
                  <p className="text-sm font-bold text-emerald-600 mt-0.5">
                    ₹{emdInfo.emdAmount.toLocaleString('en-IN')} {isEmdPaid ? 'Paid •' : ''}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Card 3: Enterprise Earnest Money Deposit (EMD) Card */}
          {user?.role === 'seller' && (
            <EmdCard
              emdInfo={emdInfo}
              loading={emdLoading}
              onPayClick={() => setIsEmdModalOpen(true)}
            />
          )}

          {/* Card 4: Buyer Metadata Card (Clean Cards matching mockup) */}
          <section className="border border-slate-200/90 rounded-2xl bg-white p-5 shadow-2xs space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3">
              BUYER METADATA
            </h2>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 border border-slate-200/80 text-slate-700 font-bold">
                  <Building2 className="h-5 w-5 text-slate-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate" title={orgName}>{orgName}</p>
                  <p className="text-xs text-slate-400 font-medium">Verified Enterprise Buyer</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 border border-slate-200/80">
                  MSME Category
                </span>
                <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 border border-slate-200/80">
                  4.8 Rating
                </span>
              </div>

              <div className="space-y-2 text-xs pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Contact</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[170px]" title={contactPerson}>{contactPerson}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Email</span>
                  <span className="font-mono font-semibold text-[#5B5BD6] truncate max-w-[170px]" title={email}>{email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Phone</span>
                  <span className="font-semibold text-slate-900">{phone}</span>
                </div>
                {address !== '-' && (
                  <div className="flex items-start justify-between gap-2 pt-0.5">
                    <span className="text-slate-400 font-bold uppercase text-[10px] shrink-0">Location</span>
                    <span className="font-semibold text-slate-800 text-right truncate" title={address}>{address}</span>
                  </div>
                )}
              </div>

              {/* Assistance Box */}
              <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-200/70 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  Need assistance? Contact our procurement desk at 1800-GE-SUPPLY for technical queries regarding this RFQ.
                </p>
              </div>
            </div>
          </section>

          {/* Card 5: Budget & Financial Sanction */}
          {hasBudget && budgetDetails && (
            <section className="border border-slate-200/90 rounded-2xl bg-white p-5 shadow-2xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 pb-3 flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-emerald-600" />
                <span>BUDGET & FINANCIAL SANCTION</span>
              </h2>

              <div className="space-y-2 text-xs">
                {budgetDetails.budgetHead && (
                  <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Budget Head</span>
                    <span className="text-xs font-bold text-slate-900">{budgetDetails.budgetHead}</span>
                  </div>
                )}
                {budgetDetails.financialYear && (
                  <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Financial Year</span>
                    <span className="text-xs font-semibold text-slate-900">{budgetDetails.financialYear}</span>
                  </div>
                )}
                {budgetDetails.sanctionAmount && (
                  <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Sanction Amount</span>
                    <span className="text-xs font-bold text-emerald-700">{formatCurrency(budgetDetails.sanctionAmount)}</span>
                  </div>
                )}
                {budgetDetails.sanctionOrderNumber && (
                  <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Sanction Order</span>
                    <span className="text-xs font-mono font-bold text-slate-900">{budgetDetails.sanctionOrderNumber}</span>
                  </div>
                )}
                {budgetDetails.approvingAuthority && (
                  <div className="flex justify-between items-center pb-1 border-b border-slate-100">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Approving Authority</span>
                    <span className="text-xs font-semibold text-slate-900">{budgetDetails.approvingAuthority}</span>
                  </div>
                )}
                {budgetDetails.costCenter && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">Cost Center</span>
                    <span className="text-xs font-semibold text-slate-900">{budgetDetails.costCenter}</span>
                  </div>
                )}
              </div>

              {budgetDetails.justification && (
                <div className="rounded-xl bg-amber-50/80 border border-amber-200/90 p-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-0.5">Justification</span>
                  <p className="text-xs font-medium text-slate-800 leading-relaxed">{budgetDetails.justification}</p>
                </div>
              )}
            </section>
          )}

        </div>

      </div>




      {/* â”€â”€ Clarifications & Q&A Panel â”€â”€ */}
      {rfqData && (
        <ClarificationPanel
          quoteRequestId={requirementId || rfqData?.sourceId || (typeof rfqData?.id === 'number' ? rfqData.id : (typeof rfqData?.id === 'string' && !isNaN(Number(rfqData.id)) ? Number(rfqData.id) : undefined))}
          kind={rfqData?.sourceModel === 'REQUIREMENT' || !!requirementId || !!rfqData?.sourceId ? 'requirement' : 'quote-request'}
          role={user?.role === 'buyer' ? 'buyer' : 'seller'}
          deadlinePassed={!!rfqData?.deadlineDate && new Date(rfqData.deadlineDate).getTime() < Date.now()}
        />
      )}

      {/* â”€â”€ Enterprise EMD Payment Modal â”€â”€ */}
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
