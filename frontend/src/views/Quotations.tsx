import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Search,
  Send,
  Trophy,
  XCircle,
  LayoutGrid,
  List,
  FileSpreadsheet,
  CalendarDays,
  Building2,
  UserRound,
  Percent,
  IndianRupee,
  ShieldCheck,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Power,
  Eye,
  Edit3,
  Trash2,
  Paperclip,
  Upload,
  User2, Mail, PhoneCall, Tag, Download, X, Calendar
} from 'lucide-react';
import { Loader2 } from '@/components/ui/loader';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { KpiCard } from '../features/shared/KpiCard';
import { Pagination } from '../features/shared/Pagination';
import { EntityIdLink } from '../features/shared/EntityIdLink';
import { ViewModeToggle } from '../features/shared/ViewModeToggle';
import { ResponsiveFilterBar } from '../components/ui/ResponsiveFilterBar';
import { usePagination, useResponsiveViewMode } from '../features/shared/hooks';
import { normalizeList } from '../features/shared/apiClient';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import { getFileAssetPreview, type DocumentPreview } from '../lib/files';
import { compressImage } from '../lib/compress';
import { GstTaxPicker } from '../features/shared/gstTax';
import { useQueryClient } from '@tanstack/react-query';

type BidStatus = 'pending' | 'submitted' | 'technical_qualified' | 'technical_rejected' | 'financial_evaluated' | 'accepted' | 'rejected' | 'withdrawn' | 'draft' | 'modified';

interface Quotation {
  id: number;
  source?: 'bid' | 'rfq';
  responseId?: number;
  sellerId: number;
  buyerId?: number;
  tenderId?: number;
  unitPrice: number;
  quantity: number;
  taxRate?: number;
  discountAmount?: number;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  deliveryDays: number;
  warranty?: string;
  validTill?: string;
  status: BidStatus;
  note?: string;
  isLowest?: boolean;
  bidNumber?: string;
  documentUrl?: string;
  documentName?: string;
  rfqDocumentUrl?: string | null;
  rfqDocumentName?: string | null;
  fileAssetId?: number | null;
  fileAsset?: {
    id?: number;
    fileAssetId?: number;
    fileId?: number;
    originalName?: string;
    mimeType?: string;
    url?: string;
    signedUrl?: string;
    documentUrl?: string;
  } | null;
  tender?: {
    id?: number;
    tenderId?: string;
    title?: string;
    category?: string;
    budget?: number;
    status?: string;
    closesAt?: string;
  };
  seller?: {
    name: string;
    email?: string;
    mobile?: string;
    sellerProfile?: {
      businessName?: string;
      organizationType?: string;
      offices?: Array<{ city?: string; state?: string; }>;
    };
  };
  buyer?: {
    name: string;
    buyerProfile?: {
      organizationName?: string;
      organizationType?: string;
      city?: string;
      state?: string;
    };
  };
  quoteResponses?: Array<{
    id: number;
    status?: string;
    totalAmount?: number;
    deliveryDays?: number;
    validityDate?: string;
    notes?: string;
    documentUrl?: string;
    documentName?: string;
    fileAssetId?: number | null;
    fileAsset?: Quotation['fileAsset'];
  }>;
}

type ProcurementIntakeSummary = {
  id: string;
  createdAt: string;
  method?: string;
  methodLabel?: string;
  title?: string;
  category?: string;
  department?: string;
  estimatedValue?: number;
  submissionDate?: string;
  deliveryDate?: string;
  documents?: Array<{ name: string; requirement: string; fileName: string; version: number }>;
  items?: Array<{ name: string; quantity: number; unit: string; specification?: string; total?: number }>;
};

const PROCUREMENT_SUMMARIES_KEY = 'msme:procurement-intake-summaries:v1';

const normalizeBidStatus = (value?: string): BidStatus => {
  const normalized = String(value || 'pending').toLowerCase();
  if (normalized === 'sent') return 'pending';
  if (normalized === 'responded') return 'submitted';
  if (normalized === 'closed' || normalized === 'cancelled' || normalized === 'withdrawn') return 'withdrawn';
  if (normalized === 'approved') return 'accepted';
  if (normalized === 'draft') return 'draft';
  if (normalized === 'accepted') return 'accepted';
  if (normalized === 'rejected') return 'rejected';
  if (normalized === 'submitted') return 'submitted';
  return 'pending';
};

const quoteRequestToRecord = (rfq: any): Quotation => {
  const response = Array.isArray(rfq.quoteResponses) ? rfq.quoteResponses[0] : null;
  const amount = response ? Number(response.totalAmount || 0) : Number(rfq.estimatedValue || 0);
  return {
    id: Number(rfq.id),
    source: 'rfq',
    responseId: response?.id ? Number(response.id) : undefined,
    sellerId: Number(rfq.sellerId),
    buyerId: Number(rfq.buyerId),
    tenderId: 0,
    unitPrice: amount,
    quantity: amount ? 1 : 0,
    deliveryDays: Number(response?.deliveryDays || 0),
    validTill: response?.validityDate,
    status: response ? normalizeBidStatus(response.status) : normalizeBidStatus(rfq.statusEnum || rfq.status),
    note: response?.notes || rfq.message,
    documentUrl: response?.documentUrl || null,
    documentName: response?.documentName || null,
    rfqDocumentUrl: rfq.documentUrl || null,
    rfqDocumentName: rfq.documentName || null,
    fileAssetId: response?.fileAssetId || rfq.fileAssetId || null,
    fileAsset: response?.fileAsset || rfq.fileAsset || null,
    tender: {
      id: Number(rfq.id),
      tenderId: `RFQ-${String(rfq.id).padStart(4, '0')}`,
      title: rfq.subject || `RFQ #${rfq.id}`,
      category: 'Request for Quote',
      status: rfq.status,
      closesAt: rfq.deadlineDate
    },
    seller: rfq.seller,
    buyer: rfq.buyer,
    quoteResponses: Array.isArray(rfq.quoteResponses) ? rfq.quoteResponses : []
  };
};

const statusStyles: Record<BidStatus, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-800',
  submitted: 'border-blue-200 bg-slate-50 text-blue-800',
  technical_qualified: 'border-teal-200 bg-teal-50 text-teal-800',
  technical_rejected: 'border-red-200 bg-red-50 text-red-800',
  financial_evaluated: 'border-purple-200 bg-purple-50 text-purple-800',
  accepted: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  rejected: 'border-red-200 bg-red-50 text-red-800',
  withdrawn: 'border-slate-200 bg-slate-100 text-slate-700',
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  modified: 'border-indigo-200 bg-indigo-50 text-[#12335f]'
};

const statusIcons: Record<BidStatus, React.ElementType> = {
  pending: Clock,
  submitted: Clock,
  technical_qualified: CheckCircle2,
  technical_rejected: XCircle,
  financial_evaluated: ClipboardCheck,
  accepted: CheckCircle2,
  rejected: XCircle,
  withdrawn: Power,
  draft: FileText,
  modified: Clock
};

const getStatusLabel = (status: BidStatus) => {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'submitted':
      return 'Submitted';
    case 'technical_qualified':
      return 'Tech Qualified';
    case 'technical_rejected':
      return 'Tech Rejected';
    case 'financial_evaluated':
      return 'Fin Evaluated';
    case 'accepted':
      return 'Accepted';
    case 'rejected':
      return 'Rejected';
    case 'withdrawn':
      return 'Inactive';
    case 'draft':
      return 'Draft';
    case 'modified':
      return 'Modified';
    default:
      return String(status || '').toUpperCase();
  }
};

const formatMoney = (value?: number) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
const getQuotePricing = (quote: Quotation) => {
  const subtotal = Number(quote.subtotal ?? (Number(quote.unitPrice || 0) * Number(quote.quantity || 0)));
  const taxRate = Number(quote.taxRate || 0);
  const taxAmount = Number(quote.taxAmount ?? (subtotal * taxRate / 100));
  const discountAmount = Number(quote.discountAmount || 0);
  const totalAmount = Number(quote.totalAmount ?? (subtotal + taxAmount - discountAmount));
  const discountPercent = subtotal > 0 ? Number((discountAmount / subtotal * 100).toFixed(2)) : 0;
  return { subtotal, taxRate, taxAmount, discountAmount, discountPercent, totalAmount };
};
const formatDateTime = (val?: string) => val ? new Date(val).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', hour12: true }) : '-';
const formatDate = (val?: string) => val ? new Date(val).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '-';
const toDateInputValue = (val?: string) => val ? val.split('T')[0] : '';
const getQuoteSubmittedAt = (q: Quotation) => (q as any).createdAt || (q as any).submittedAt;
const getQuoteUpdatedAt = (q: Quotation) => (q as any).updatedAt || (q as any).lastModified;
const getFileNameFromUrl = (url?: string, fallback = 'Quotation document') => {
  if (!url) return fallback;
  const cleanUrl = String(url).split('?')[0];
  const name = cleanUrl.substring(cleanUrl.lastIndexOf('/') + 1);
  try {
    return decodeURIComponent(name || fallback);
  } catch {
    return name || fallback;
  }
};

const loadProcurementSummaries = (): ProcurementIntakeSummary[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(PROCUREMENT_SUMMARIES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const findProcurementContext = (quote: Quotation) => {
  const summaries = loadProcurementSummaries();
  if (summaries.length === 0) return null;
  const title = String(quote.tender?.title || '').toLowerCase();
  const category = String(quote.tender?.category || '').toLowerCase();
  return summaries.find(summary => {
    const summaryTitle = String(summary.title || '').toLowerCase();
    const summaryCategory = String(summary.category || '').toLowerCase();
    if (summaryTitle && title && (summaryTitle.includes(title) || title.includes(summaryTitle))) return true;
    if (summaryCategory && category && summaryCategory === category) return true;
    return quote.source === 'rfq' && summary.method === 'rfq';
  }) || summaries[0];
};

const getPartyInfo = (quote: Quotation, role?: string) => {
  const sellerName = quote.seller?.sellerProfile?.businessName || quote.seller?.name || '-';
  const sellerLocation = quote.seller?.sellerProfile?.offices?.[0]
    ? [quote.seller.sellerProfile.offices[0].city, quote.seller.sellerProfile.offices[0].state].filter(Boolean).join(', ')
    : '-';
  const buyerName = quote.buyer?.buyerProfile?.organizationName || quote.buyer?.name || '-';
  const buyerLocation = [quote.buyer?.buyerProfile?.city, quote.buyer?.buyerProfile?.state].filter(Boolean).join(', ') || '-';
  return {
    sellerName,
    sellerLocation,
    buyerName,
    buyerLocation,
    counterpartyName: role === 'seller' ? buyerName : sellerName,
    counterpartyLabel: role === 'seller' ? 'Buyer' : 'Supplier'
  };
};

const getValidityState = (quote: Quotation) => {
  if (!quote.validTill) return { label: 'Validity not provided', tone: 'slate' as const };
  const validDate = new Date(quote.validTill);
  const now = new Date();
  const diffDays = Math.ceil((validDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'} ago`, tone: 'red' as const };
  if (diffDays <= 7) return { label: `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`, tone: 'amber' as const };
  return { label: `Valid for ${diffDays} day${diffDays === 1 ? '' : 's'}`, tone: 'green' as const };
};

const getDocumentCount = (quote: Quotation) => Number(Boolean(getQuoteDocument(quote))) + Number(Boolean(quote.rfqDocumentUrl));

const getQuoteDocument = (quote: Quotation) => {
  const responseDocument = quote.quoteResponses?.find(response => response.fileAssetId || response.documentUrl || response.fileAsset);
  const fileAsset = quote.fileAsset || responseDocument?.fileAsset || undefined;
  const fileAssetId = Number(quote.fileAssetId || responseDocument?.fileAssetId || fileAsset?.id || fileAsset?.fileAssetId || fileAsset?.fileId || 0) || undefined;
  const documentUrl = quote.documentUrl || responseDocument?.documentUrl || fileAsset?.documentUrl || fileAsset?.signedUrl || fileAsset?.url;
  const label = quote.documentName || responseDocument?.documentName || fileAsset?.originalName || getFileNameFromUrl(documentUrl) || 'Quotation document';

  if (!fileAssetId && !documentUrl) return null;
  return {
    label,
    fileAsset: {
      ...fileAsset,
      id: fileAssetId,
      fileAssetId,
      fileId: fileAssetId,
      url: documentUrl,
      documentUrl
    }
  };
};

const canSellerManageBid = (quote: Quotation, role?: string) =>
  role === 'seller' && quote.source !== 'rfq' && !['accepted', 'rejected'].includes(quote.status);
const isDecisionOpen = (quote: Quotation) =>
  quote.source === 'rfq'
    ? Boolean(quote.responseId) && quote.status === 'submitted'
    : ['pending', 'submitted', 'technical_qualified', 'financial_evaluated', 'modified'].includes(quote.status);

function InfoBox({ label, value, strong = false }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn('mt-1 break-words text-sm font-bold text-slate-800', strong && 'text-[#12335f]')}>
        {value}
      </p>
    </div>
  );
}

function DetailMetric({
  label,
  value,
  icon: Icon,
  tone = 'slate'
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red';
}) {
  const toneClass = tone === 'green'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : tone === 'amber'
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : tone === 'red'
        ? 'bg-red-50 text-red-700 border-red-100'
        : tone === 'blue'
          ? 'bg-blue-50 text-[#12335f] border-blue-100'
          : 'bg-slate-50 text-slate-700 border-slate-200';
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md border', toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
          <p className="mt-0.5 break-words text-sm font-black text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function DocumentRow({
  title,
  label,
  tone,
  onOpen
}: {
  title: string;
  label: string;
  tone: 'blue' | 'green';
  onOpen: () => void;
}) {
  const toneClass = tone === 'green'
    ? 'border-emerald-200 bg-emerald-50/50 text-emerald-700'
    : 'border-blue-200 bg-blue-50/50 text-[#12335f]';
  return (
    <div className={cn('rounded-md border p-3', toneClass)}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em]">{title}</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-black text-slate-900">{label}</p>
        <Button type="button" variant="outline" onClick={onOpen} className="h-8 shrink-0 bg-white px-3 text-[10px] font-black uppercase">
          <FileText className="mr-1.5 h-3.5 w-3.5" />
          View
        </Button>
      </div>
    </div>
  );
}

function DocumentEmpty({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
      {label}
    </div>
  );
}


function parseTechnicalCompliance(rawInput?: string): {
  isJson: boolean;
  fields: { key: string; label: string; value: string }[];
  extractedMakeBrand?: string;
  extractedModel?: string;
  rawText: string;
} {
  if (!rawInput) return { isJson: false, fields: [], rawText: '' };
  try {
    const parsed = JSON.parse(rawInput);
    if (typeof parsed === 'object' && parsed !== null) {
      const fields = Object.entries(parsed)
        .filter(([_, val]) => val !== undefined && val !== null && val !== '')
        .map(([k, v]) => ({
          key: k,
          label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase()),
          value: String(v),
        }));
      return {
        isJson: true,
        fields,
        extractedMakeBrand: parsed.makeBrand || parsed.Make || parsed.Brand,
        extractedModel: parsed.model || parsed.Model || parsed.modelNumber,
        rawText: rawInput,
      };
    }
  } catch (e) {
    // Ignore JSON parse errors, treat as raw text
  }
  return { isJson: false, fields: [], rawText: rawInput };
}

function QuotationDetailsModal({
  quote,
  role,
  onClose,
  onOpenDocument
}: {
  quote: Quotation;
  role?: string;
  onClose: () => void;
  onOpenDocument: (url: string, label: string, fileAssetId?: number | null) => void;
}) {
  const responseData = quote.quoteResponses?.[0] || ({} as any);
  const acknowledgement = responseData.acknowledgement || {};
  
  const sellerName = quote.seller?.sellerProfile?.businessName || quote.seller?.name || 'Unknown Seller';
  const contactPerson = quote.seller?.name || '';
  const email = quote.seller?.email || '';
  const mobile = quote.seller?.mobile || '';
  
  const rawLineItems = Array.isArray(acknowledgement.lineItems)
    ? acknowledgement.lineItems
    : (Array.isArray(acknowledgement.lineQuotes) ? acknowledgement.lineQuotes : []);
    
  const deliveryTimeline = quote.deliveryDays ? `${quote.deliveryDays} Days` : (acknowledgement.deliveryTimeline || 'Not Provided');
  const terms = acknowledgement.terms || acknowledgement.paymentTerms || quote.note;
  const offeredItemDescription = quote.note || responseData.notes || acknowledgement.offeredItemDescription;
  
  const techStatus = responseData.technicalStatus || quote.status;
  
  const calculatedTotal = rawLineItems.reduce((acc: number, item: any) => {
    const qty = Number(item.quantity || 1);
    const price = Number(item.unitPrice || item.price || item.unitRate || 0);
    const tax = Number(item.gstPercent || item.taxPercent || 0);
    const lineVal = qty * price;
    const lineTax = lineVal * (tax / 100);
    return acc + lineVal + lineTax;
  }, 0);
  
  const displayTotalAmount = responseData.totalAmount || quote.totalAmount || quote.unitPrice || (calculatedTotal > 0 ? calculatedTotal : 0);
  
  const parsedTech = parseTechnicalCompliance(offeredItemDescription);
  const displayMakeBrand = responseData.makeBrand || acknowledgement.makeBrand || parsedTech.extractedMakeBrand || 'Not Provided';
  const displayModel = responseData.model || acknowledgement.model || parsedTech.extractedModel || 'Not Provided';
  const detailedFields = parsedTech.fields.filter(
    (f) => f.key !== 'makeBrand' && f.key !== 'model' && f.key !== 'modelNumber'
  );

  const docs: any[] = [];
  if (responseData.documentUrl || responseData.fileAssetId || responseData.documentName || responseData.fileAsset) {
     docs.push({
        id: 'doc-1',
        documentName: responseData.documentName || 'Quotation Document',
        fileUrl: responseData.documentUrl || (responseData.fileAsset ? responseData.fileAsset.url : null),
        fileAssetId: responseData.fileAssetId || (responseData.fileAsset ? responseData.fileAsset.id : null),
        documentCategory: 'TECHNICAL_PROPOSAL'
     });
  }
  if (Array.isArray(acknowledgement.documents)) {
     acknowledgement.documents.forEach((d: any, idx: number) => {
         docs.push({
           id: d.id || `rdoc-${quote.id}-${idx}`,
           documentName: d.documentName || d.name || d.fileName || `Document ${idx + 1}`,
           fileName: d.fileName || d.name || 'file.pdf',
           fileUrl: d.fileUrl || d.url || null,
           fileKey: d.fileKey || null,
           fileAssetId: d.fileAssetId || null,
           documentCategory: d.documentCategory || d.category || 'TECHNICAL_PROPOSAL',
           mimeType: d.mimeType || 'application/pdf',
           documentStatus: d.documentStatus || 'UPLOADED',
           uploadedAt: d.uploadedAt || null,
         });
     });
  }
  
  // Status Badge Component inner
  const StatusBadge = ({ label }: { label: string }) => {
    let color = 'bg-slate-100 text-slate-600 border-slate-200';
    const l = label.toLowerCase();
    if (l.includes('qualified') || l.includes('accepted')) color = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (l.includes('rejected')) color = 'bg-red-50 text-red-700 border-red-200';
    if (l.includes('submitted')) color = 'bg-blue-50 text-blue-700 border-blue-200';
    if (l.includes('evaluated')) color = 'bg-purple-50 text-purple-700 border-purple-200';
    
    return (
      <span className={`px-2.5 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${color}`}>
        {label.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 backdrop-blur-xs p-0 sm:items-center sm:p-4 transition-all duration-300 animate-in fade-in">
      <div className="max-h-[92dvh] w-full max-w-4xl overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl flex flex-col animate-in slide-in-from-bottom-8 duration-300">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-150 bg-gradient-to-r from-slate-900 via-[#0b2447] to-indigo-950 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-indigo-300 border border-white/10 shadow-inner">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight text-white">{sellerName}</h2>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-black uppercase text-indigo-200 border border-white/10">
                  {quote.source === 'rfq' ? `RFQ-${String(quote.id).padStart(4, '0')}` : `BID-${String(quote.id).padStart(4, '0')}`}
                </span>
              </div>
              <p className="text-xs text-slate-300 font-semibold mt-0.5">Seller Quotation Details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white hover:bg-white/20 transition duration-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-6 space-y-6 max-h-[75dvh] bg-slate-50/40 scroll-smooth">

          {/* Seller Profile & Contact Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <User2 className="h-4 w-4 text-indigo-600" /> Seller Organization & Contact Details
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 pt-1">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Company Name</span>
                <p className="text-xs font-extrabold text-slate-900 mt-1 truncate">{sellerName}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Contact Person</span>
                <p className="text-xs font-extrabold text-slate-800 mt-1 truncate">{contactPerson || 'N/A'}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Mail className="h-3 w-3 text-slate-400" /> Email Address
                </span>
                <p className="text-xs font-bold text-slate-800 mt-1 truncate">{email || 'Not Provided'}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <PhoneCall className="h-3 w-3 text-slate-400" /> Mobile / Phone
                </span>
                <p className="text-xs font-bold text-slate-800 mt-1 truncate">{mobile || 'Not Provided'}</p>
              </div>
            </div>
          </div>

          {/* Commercial & Financial Overview Cards */}
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="rounded-2xl border border-indigo-150 p-4 bg-gradient-to-br from-indigo-50/50 to-white shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 leading-none flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-indigo-600" /> Quoted Amount
              </span>
              <p className="mt-2 text-base font-black text-[#0b2447]">
                {displayTotalAmount ? formatMoney(displayTotalAmount) : 'N/A'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 bg-white shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-400" /> Delivery Timeline
              </span>
              <p className="mt-2 text-xs font-extrabold text-slate-800">{deliveryTimeline || 'Standard Delivery'}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 bg-white shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" /> Submitted At
              </span>
              <p className="mt-2 text-xs font-extrabold text-slate-800">{formatDateTime(responseData.createdAt || quote.tender?.closesAt)}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 bg-white shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none flex items-center gap-1">
                <StatusBadge label={techStatus || 'Pending'} />
              </span>
              <div className="mt-2">
                <span className="text-[10px] font-bold text-slate-400">Current Status</span>
              </div>
            </div>
          </div>

          {/* Line Item Pricing Breakdown Table (if items exist) */}
          {rawLineItems.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-indigo-600" /> Quotation Item Breakdown
                </h3>
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  {rawLineItems.length} {rawLineItems.length === 1 ? 'Item' : 'Items'} Quoted
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-150">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Item Description / Specs</th>
                      <th className="py-2.5 px-3">Make / Brand</th>
                      <th className="py-2.5 px-3">Model</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Rate</th>
                      <th className="py-2.5 px-3 text-right">GST / Tax</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                    {rawLineItems.map((item: any, idx: number) => {
                      const qty = Number(item.quantity || 1);
                      const unitPrice = Number(item.unitPrice || item.price || item.unitRate || 0);
                      const gst = Number(item.gstPercent || item.taxPercent || 0);
                      const lineTotal = item.lineTotal || item.totalPrice || (qty * unitPrice * (1 + gst / 100));

                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-3 text-slate-400 font-bold">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <p className="font-extrabold text-slate-900">{item.itemName || item.itemDescription || item.description || `Item #${idx + 1}`}</p>
                            {item.remarks && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{item.remarks}</p>}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-600">{item.makeBrand || acknowledgement.makeBrand || 'Not Provided'}</td>
                          <td className="py-3 px-3 font-medium text-slate-600">{item.model || acknowledgement.model || 'Not Provided'}</td>
                          <td className="py-3 px-3 text-center font-bold">{qty} {item.unit || item.uom || ''}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{formatMoney(unitPrice)}</td>
                          <td className="py-3 px-3 text-right tabular-nums">{gst ? `${gst}%` : '-'}</td>
                          <td className="py-3 px-3 text-right font-extrabold text-slate-950 tabular-nums">{formatMoney(lineTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200 font-black text-slate-900 text-xs">
                    <tr>
                      <td colSpan={7} className="py-2.5 px-3 text-right uppercase tracking-wider text-[10px] text-slate-500">Total Quoted Amount:</td>
                      <td className="py-2.5 px-3 text-right text-indigo-700 text-sm font-black tabular-nums">
                        {formatMoney(displayTotalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : null}

          {/* Technical Specifications & Notes Box */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 hover:shadow-md transition-all duration-200">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600" /> Product Specifications & Seller Remarks
            </h3>

            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 transition">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Make / Brand</span>
                <p className="font-extrabold text-slate-800 mt-1">{displayMakeBrand}</p>
              </div>
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 transition">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Model Number</span>
                <p className="font-extrabold text-slate-800 mt-1">{displayModel}</p>
              </div>
            </div>

            {offeredItemDescription && (
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Detailed Description / Technical Compliance:
                </span>

                {parsedTech.isJson ? (
                  detailedFields.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2">
                      {detailedFields.map((field) => {
                        const isFullWidth =
                          field.key === 'offeredItemDescription' ||
                          field.key === 'complianceRemarks' ||
                          field.key === 'rfqNotes' ||
                          field.value.length > 60;
                        return (
                          <div
                            key={field.key}
                            className={cn(
                              "bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 hover:border-indigo-200 hover:bg-slate-50 transition-all duration-200 shadow-2xs",
                              isFullWidth ? "md:col-span-2" : ""
                            )}
                          >
                            <span className="text-[10px] font-black uppercase tracking-wider text-[#12335f] block">
                              {field.label}
                            </span>
                            <p className="text-xs font-semibold text-slate-800 mt-1 leading-relaxed whitespace-pre-wrap">
                              {field.value || 'Not Provided'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 text-xs font-medium text-slate-500 italic">
                      No specific technical remarks or description populated.
                    </div>
                  )
                ) : (
                  <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {parsedTech.rawText}
                  </div>
                )}
              </div>
            )}

            {terms && (
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">Payment & Delivery Terms:</span>
                <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {terms}
                </div>
              </div>
            )}
          </div>

          {/* Submitted Documents Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Download className="h-4 w-4 text-indigo-600" /> Submitted Documents ({docs.length})
              </h3>
            </div>

            {docs.length > 0 ? (
              <div className="space-y-2.5">
                {docs.map((doc: any, index: number) => {
                  const fileName = doc.documentName || doc.fileName || doc.name || `Attachment #${index + 1}`;
                  const category = doc.documentCategory || 'TECHNICAL_PROPOSAL';

                  return (
                    <div key={doc.id || index} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 bg-slate-50/50 hover:bg-slate-50 transition shadow-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 text-xs font-bold">
                          <FileText className="h-4.5 w-4.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-800 truncate">{fileName}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{category}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (!doc.fileAssetId && !doc.fileUrl && !doc.url) {
                              toast.info("This document file is not uploaded on the server.");
                              return;
                            }
                            onOpenDocument(doc.fileUrl || doc.url || '', fileName, doc.fileAssetId);
                          }}
                          className="h-8 px-2.5 text-[10px] font-black uppercase text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                        >
                          <Eye className="mr-1 h-3.5 w-3.5" /> View
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (!doc.fileAssetId && !doc.fileUrl && !doc.url) {
                              toast.info("This document file is not uploaded on the server.");
                              return;
                            }
                            onOpenDocument(doc.fileUrl || doc.url || '', fileName, doc.fileAssetId);
                          }}
                          className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-100"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <FileText className="mx-auto h-7 w-7 text-slate-300 stroke-[1.5]" />
                <p className="mt-2 text-xs font-bold text-slate-500">No document attachments submitted with this quotation.</p>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-150 p-4 bg-white flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

function BidEditModal({
  quote,
  saving,
  onClose,
  onSubmit
}: {
  quote: Quotation;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [splitTaxRate, setSplitTaxRate] = useState('');
  const [igstTaxRate, setIgstTaxRate] = useState(quote.taxRate ? String(quote.taxRate) : '');
  const [otherTaxRate, setOtherTaxRate] = useState('');
  const taxableAmount = Number(quote.subtotal ?? (Number(quote.unitPrice || 0) * Number(quote.quantity || 0)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Edit Quotation</p>
            <h2 className="mt-1 text-lg font-black text-[#071632]">{quote.tender?.title || `BID #${quote.id}`}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">Update pricing, delivery, validity, and seller notes.</p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-100" title="Close">
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Unit Rate
              <input name="unitPrice" type="number" min="1" step="0.01" required defaultValue={quote.unitPrice || ''} className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20" />
            </label>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Quantity
              <input name="quantity" type="number" min="1" required defaultValue={quote.quantity || ''} className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20" />
            </label>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Delivery Days
              <input name="deliveryDays" type="number" min="1" required defaultValue={quote.deliveryDays || ''} className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <GstTaxPicker
                splitRate={splitTaxRate}
                igstRate={igstTaxRate}
                additionalRate={otherTaxRate}
                taxableAmount={taxableAmount}
                totalInputName="taxRate"
                onChange={next => {
                  setSplitTaxRate(next.splitRate);
                  setIgstTaxRate(next.igstRate);
                  setOtherTaxRate(next.additionalRate);
                }}
              />
            </div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Discount Percentage
              <div className="relative mt-1">
                <input name="discountPercent" type="number" min="0" max="100" step="0.01" defaultValue={taxableAmount > 0 && quote.discountAmount ? Number((Number(quote.discountAmount) / taxableAmount * 100).toFixed(2)) : ''} className="h-11 w-full rounded-md border border-slate-200 px-3 pr-8 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
              </div>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Warranty
              <input name="warranty" type="text" maxLength={500} defaultValue={quote.warranty || ''} className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20" />
            </label>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Valid Till
              <input name="validTill" type="date" defaultValue={toDateInputValue(quote.validTill)} className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20" />
            </label>
          </div>

          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
            Seller Note
            <textarea name="note" rows={4} defaultValue={quote.note || ''} maxLength={2000} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20" />
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="h-10 text-xs font-black uppercase">Cancel</Button>
            <Button type="submit" disabled={saving} className="h-10 bg-[#12335f] text-xs font-black uppercase text-white hover:bg-[#0b2445] disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Quotations({ inline = false }: { inline?: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const authOptions = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
  const cachedSellerBids = user?.role === 'seller' ? api.peek('/api/bids/my', authOptions) : null;
  const cachedBuyerTenders = user?.role === 'buyer' ? api.peek('/api/tenders', authOptions) : null;

  const [quotes, setQuotes] = useState<Quotation[]>(normalizeList<Quotation>(cachedSellerBids));
  const [tenders, setTenders] = useState<any[]>(normalizeList<any>(cachedBuyerTenders));
  const [loading, setLoading] = useState(!(cachedSellerBids || cachedBuyerTenders));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BidStatus>('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedTenderId, setSelectedTenderId] = useState('all');
  const [viewMode, setViewMode] = useResponsiveViewMode();
  const [buyerTendersReady, setBuyerTendersReady] = useState(false);
  const [responseTarget, setResponseTarget] = useState<Quotation | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Quotation | null>(null);
  const [editTarget, setEditTarget] = useState<Quotation | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DocumentPreview | null>(null);
  const [responding, setResponding] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [processedDeepLink, setProcessedDeepLink] = useState('');

  const [sortField, setSortField] = useState<'id' | 'title' | 'seller' | 'rate' | 'qty' | 'netValue' | 'status'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (field: 'id' | 'title' | 'seller' | 'rate' | 'qty' | 'netValue' | 'status') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const SortHeader = ({ label, field, className = '' }: { label: string; field: 'id' | 'title' | 'seller' | 'rate' | 'qty' | 'netValue' | 'status'; className?: string }) => {
    const isActive = sortField === field;
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={cn(
          "inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-[#12335f] transition-colors",
          isActive && "text-[#12335f]",
          className
        )}
      >
        {label}
        {isActive ? (
          sortOrder === 'asc' ? (
            <ArrowUp className="h-3 w-3 text-[#12335f]" />
          ) : (
            <ArrowDown className="h-3 w-3 text-[#12335f]" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-45" />
        )}
      </button>
    );
  };

  useEffect(() => {
    if (user?.role === 'seller') fetchMyBids();
    if (user?.role === 'buyer') fetchMyTenders();
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === 'buyer' && buyerTendersReady) fetchBuyerBids();
  }, [user?.role, tenders.length, selectedTenderId, buyerTendersReady]);

  useEffect(() => {
    const bidId = Number(searchParams?.get('bidId') || 0);
    const tenderId = Number(searchParams?.get('tenderId') || 0);
    const deepLinkKey = bidId ? `bid:${bidId}` : tenderId ? `tender:${tenderId}` : '';
    if (!deepLinkKey || processedDeepLink === deepLinkKey || quotes.length === 0) return;
    const target = bidId
      ? quotes.find(quote => quote.source !== 'rfq' && quote.id === bidId)
      : quotes.find(quote => quote.source !== 'rfq' && Number(quote.tenderId || quote.tender?.id) === tenderId);
    if (!target) return;
    setProcessedDeepLink(deepLinkKey);
    handleViewQuote(target);
  }, [searchParams, quotes, processedDeepLink]);

  const fetchMyTenders = async () => {
    if (tenders.length === 0) setLoading(true);
    try {
      const res = await api.get('/api/tenders?take=500', authOptions);
      if (!res.ok) throw new Error('Failed to load tenders');
      const data = await res.json();
      const tenderList = normalizeList<any>(data);
      setTenders(tenderList);
      if (tenderList.length === 0) {
        // No tenders → no bids to load. Safe to clear loading and quotes here.
        setQuotes([]);
        setLoading(false);
      }
      // If tenders exist, leave `loading=true` so the spinner stays visible
      // until fetchBuyerBids() resolves (avoids the empty-state flash).
    } catch {
      toast.error('Failed to load your tenders');
      setLoading(false);
    } finally {
      setBuyerTendersReady(true);
    }
  };

  const fetchMyBids = async () => {
    if (quotes.length === 0) setLoading(true);
    try {
      const [bidsRes, rfqRes] = await Promise.all([
        api.get('/api/bids/my', authOptions).catch(() => null),
        api.get('/api/quote-requests', authOptions).catch(() => null)
      ]);
      const bidsData = bidsRes?.ok ? await bidsRes.json() : [];
      const rfqData = rfqRes?.ok ? await rfqRes.json() : [];
      const tenderBids = normalizeList<Quotation>(bidsData).map(bid => ({ ...bid, source: 'bid' as const }));
      const rfqs = normalizeList<any>(rfqData).map(quoteRequestToRecord);
      setQuotes([...rfqs, ...tenderBids]);
    } catch {
      toast.error('Failed to load your bids and RFQs');
    } finally {
      setLoading(false);
    }
  };

  const handleRfqResponse = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!responseTarget) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      totalAmount: Number(form.get('totalAmount') || 0),
      deliveryDays: Number(form.get('deliveryDays') || 0) || undefined,
      validityDate: String(form.get('validityDate') || '') || undefined,
      notes: String(form.get('notes') || '').trim() || undefined,
      documentUrl: String(form.get('documentUrl') || '').trim() || undefined
    };
    setResponding(true);
    try {
      const res = await api.post(`/api/quote-requests/${responseTarget.id}/responses`, payload, authOptions);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Unable to submit RFQ response');
      }
      toast.success('RFQ response submitted successfully');
      setResponseTarget(null);
      await fetchMyBids();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to submit RFQ response');
    } finally {
      setResponding(false);
    }
  };

  const fetchBuyerBids = async () => {
    if (quotes.length === 0) setLoading(true);
    try {
      const bidsRes = await api.get('/api/bids/my', authOptions);
      if (!bidsRes.ok) throw new Error('Failed to load quotation bids');
      const bidsData = await bidsRes.json();
      const selectedId = selectedTenderId === 'all' ? null : Number(selectedTenderId);
      const tenderBids = normalizeList<Quotation>(bidsData)
        .filter((bid: Quotation) => !selectedId || Number(bid.tenderId || bid.tender?.id) === selectedId)
        .map(bid => ({ ...bid, source: 'bid' as const }));
      const lowestByTender = new Map<number, number>();
      const bidCountByTender = new Map<number, number>();
      tenderBids.forEach((bid) => {
        const key = Number(bid.tenderId || bid.tender?.id || 0);
        if (!key) return;
        const total = getQuotePricing(bid).totalAmount;
        const current = lowestByTender.get(key);
        if (current === undefined || total < current) lowestByTender.set(key, total);
        bidCountByTender.set(key, (bidCountByTender.get(key) || 0) + 1);
      });
      let allBids: Quotation[] = tenderBids.map((bid) => {
        const key = Number(bid.tenderId || bid.tender?.id || 0);
        return {
          ...bid,
          tender: bid.tender || tenders.find(item => item.id === key),
          isLowest: key > 0 && (bidCountByTender.get(key) || 0) > 1 && getQuotePricing(bid).totalAmount === lowestByTender.get(key)
        };
      });

      if (selectedTenderId === 'all') {
        const rfqRes = await api.get('/api/quote-requests', authOptions).catch(() => null);
        if (rfqRes?.ok) {
          const rfqData = await rfqRes.json();
          const rfqs = normalizeList<any>(rfqData).map(quoteRequestToRecord);
          allBids = [...rfqs, ...allBids];
        }
      }

      setQuotes(allBids);
    } catch {
      toast.error('Failed to load quotations');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (quote: Quotation, status: BidStatus) => {
    try {
      if (quote.source === 'rfq' && !quote.responseId) {
        throw new Error('The seller has not submitted a response yet');
      }
      const endpoint = quote.source === 'rfq'
        ? `/api/quote-responses/${quote.responseId}/${status === 'accepted' ? 'accept' : 'reject'}`
        : `/api/bids/${quote.id}/status`;
      const payload = quote.source === 'rfq' ? {} : { status };
      const res = await api.post(endpoint, payload, authOptions);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Update failed');
      }
      toast.success(`Quotation ${status === 'accepted' ? 'accepted' : 'rejected'} successfully`);
      if (status === 'accepted') {
        // Clear both caching layers so the PO page shows fresh data:
        // 1. Low-level fetch cache (api.ts in-memory Map)
        api.invalidate('/api/purchase-orders');
        // 2. React Query cache
        queryClient.invalidateQueries({ predicate: (query) => {
          const key = query.queryKey[1];
          return typeof key === 'string' && key.includes('/api/purchase-orders');
        }});
      }
      fetchBuyerBids();
    } catch (err: any) {
      toast.error(err?.message || 'Network error');
    }
  };

  const handleViewQuote = async (quote: Quotation) => {
    setDetailsTarget(quote);
    try {
      const endpoint = quote.source === 'rfq'
        ? `/api/quote-requests/${quote.id}`
        : `/api/bids/${quote.id}`;
      const res = await api.get(endpoint, authOptions);
      if (res.ok) {
        const body = await res.json();
        const data = body?.data || body;
        if (quote.source === 'rfq') {
          setDetailsTarget(quoteRequestToRecord(data));
        } else {
          setDetailsTarget({ ...quote, ...data, source: 'bid' });
        }
      }
    } catch {
      // Keep row-level details visible if the full detail endpoint is unavailable.
    }
  };

  const handleOpenQuoteDocument = async (url: string, label: string, fileAssetId?: number | null) => {
    try {
      const asset = { url, id: fileAssetId, fileAssetId, fileId: fileAssetId };
      setPreviewDocument(await getFileAssetPreview(asset, label));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to open document');
    }
  };

  const handleEditBid = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editTarget) return;

    const form = new FormData(event.currentTarget);
    const unitPrice = Number(form.get('unitPrice') || 0);
    const quantity = Number(form.get('quantity') || 0);
    const discountPercent = Math.min(100, Math.max(0, Number(form.get('discountPercent') || 0)));
    const discountAmount = Number((unitPrice * quantity * discountPercent / 100).toFixed(2));
    const payload = {
      unitPrice,
      quantity,
      taxRate: Number(form.get('taxRate') || 0),
      discountAmount,
      deliveryDays: Number(form.get('deliveryDays') || 0),
      warranty: String(form.get('warranty') || '').trim() || null,
      validTill: String(form.get('validTill') || '') || null,
      note: String(form.get('note') || '').trim() || null
    };

    setSavingEdit(true);
    try {
      const res = await api.put(`/api/bids/${editTarget.id}`, payload, authOptions);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Unable to update quotation');
      }
      toast.success('Quotation updated successfully');
      setEditTarget(null);
      await fetchMyBids();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update quotation');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteBid = async (quote: Quotation) => {
    if (!window.confirm(`Delete ${quote.source === 'rfq' ? 'RFQ' : 'BID'}-${String(quote.id).padStart(4, '0')}? This cannot be undone.`)) return;

    setDeletingId(quote.id);
    try {
      const res = await api.delete(`/api/bids/${quote.id}`, authOptions);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Unable to delete quotation');
      }
      toast.success('Quotation deleted successfully');
      setQuotes(current => current.filter(item => !(item.source !== 'rfq' && item.id === quote.id)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to delete quotation');
    } finally {
      setDeletingId(null);
    }
  };

  const categories = useMemo(() => {
    return Array.from(new Set(quotes.map(q => q.tender?.category || 'General').filter(Boolean))).sort();
  }, [quotes]);

  // Trigger Next.js SWC recompilation to clear stale build errors
  const filteredQuotes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const list = quotes.filter((quote) => {
      const tenderText = `${quote.tender?.tenderId || ''} ${quote.tender?.title || ''} ${quote.tender?.category || ''}`.toLowerCase();
      const sellerText = `${quote.seller?.name || ''} ${quote.seller?.sellerProfile?.businessName || ''}`.toLowerCase();
      const buyerText = `${quote.buyer?.name || ''} ${quote.note || ''}`.toLowerCase();
      const matchesSearch = !query || tenderText.includes(query) || sellerText.includes(query) || buyerText.includes(query);
      const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
      const matchesMethod = methodFilter === 'all' || 
        (methodFilter === 'rfq' && quote.source === 'rfq') || 
        (methodFilter === 'bid' && quote.source !== 'rfq');
      const matchesCategory = categoryFilter === 'all' || 
        (quote.tender?.category || 'General') === categoryFilter;

      return matchesSearch && matchesStatus && matchesMethod && matchesCategory;
    });

    return list.sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';

      if (sortField === 'id') {
        aVal = a.id;
        bVal = b.id;
      } else if (sortField === 'title') {
        aVal = a.tender?.title || '';
        bVal = b.tender?.title || '';
      } else if (sortField === 'seller') {
        aVal = a.seller?.sellerProfile?.businessName || a.seller?.name || '';
        bVal = b.seller?.sellerProfile?.businessName || b.seller?.name || '';
      } else if (sortField === 'rate') {
        aVal = Number(a.unitPrice || 0);
        bVal = Number(b.unitPrice || 0);
      } else if (sortField === 'qty') {
        aVal = Number(a.quantity || 0);
        bVal = Number(b.quantity || 0);
      } else if (sortField === 'netValue') {
        aVal = getQuotePricing(a).totalAmount;
        bVal = getQuotePricing(b).totalAmount;
      } else if (sortField === 'status') {
        aVal = a.status || '';
        bVal = b.status || '';
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
  }, [quotes, searchTerm, statusFilter, methodFilter, categoryFilter, sortField, sortOrder]);
  const { page, pageSize, pageItems: pagedQuotes, total, setPage, setPageSize } = usePagination(filteredQuotes, 10);

  const stats = useMemo(() => {
    const total = quotes.length;
    const evaluableStatuses: BidStatus[] = ['pending', 'submitted', 'technical_qualified', 'financial_evaluated', 'modified'];
    const pending = quotes.filter(quote => evaluableStatuses.includes(quote.status)).length;
    const accepted = quotes.filter(quote => quote.status === 'accepted').length;
    const rejected = quotes.filter(quote => quote.status === 'rejected' || quote.status === 'technical_rejected').length;
    const totalValue = quotes.reduce((sum, quote) => sum + getQuotePricing(quote).totalAmount, 0);
    const quotedValues = quotes.map(quote => getQuotePricing(quote).totalAmount).filter(value => value > 0);
    const lowestValue = quotedValues.length ? Math.min(...quotedValues) : 0;
    const averageValue = quotedValues.length ? totalValue / quotedValues.length : 0;
    const documentCount = quotes.reduce((sum, quote) => sum + Number(getDocumentCount(quote) > 0), 0);
    const decisionRate = total ? Math.round(((accepted + rejected) / total) * 100) : 0;
    return { total, pending, accepted, rejected, totalValue, lowestValue, averageValue, documentCount, decisionRate };
  }, [quotes]);

  return (
    <div className={cn(!inline && "min-h-screen px-3 py-5 text-slate-900 sm:px-5 md:px-8")}>
      <div className={cn("mx-auto space-y-5", !inline && "max-w-[118rem]")}>
        {!inline && (
          <div className="rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                {user?.role === 'buyer' ? 'Bid Evaluation' : 'Market Participation'}
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#071632] md:text-3xl">
                {user?.role === 'buyer' ? 'Quotations' : 'Bids & RFQs'}
              </h1>
              <p className="mt-1 max-w-2xl text-sm font-medium text-slate-600">
                {user?.role === 'buyer'
                  ? 'Review submitted quotations, compare pricing, and record procurement decisions.'
                  : 'Track submitted tender bids and respond to buyer RFQ requests from marketplace.'}
              </p>
            </div>

            <Button
              onClick={() => router.push(user?.role === 'seller' ? '/seller/catalogue' : '/buyer/tenders')}
              className="h-10 w-full rounded-lg bg-[#12335f] px-5 text-xs font-bold uppercase tracking-wide text-white shadow-sm shadow-[#12335f]/20 hover:bg-[#0b2445] sm:w-auto"
            >
              <Send className="mr-2 h-4 w-4" />
              {user?.role === 'seller' ? 'My Catalogue' : 'View Tenders'}
            </Button>
            </div>
          </div>
        )}

        {/* <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryTile label={user?.role === 'buyer' ? 'Total Quotations' : 'Bids / RFQs'} value={stats.total} icon={ClipboardCheck} />
          <SummaryTile label="Pending Review" value={stats.pending} icon={Clock} tone="amber" />
          <SummaryTile label="Accepted" value={stats.accepted} icon={CheckCircle2} tone="green" />
          <SummaryTile label={user?.role === 'buyer' ? 'Quoted Value' : 'Response Value'} value={formatMoney(stats.totalValue)} icon={FileText} />
        </div> */}

        {!inline && (
          <div className="grid gap-3 lg:grid-cols-4">
            <InsightTile icon={IndianRupee} label="Lowest quote" value={stats.lowestValue ? formatMoney(stats.lowestValue) : '-'} helper="Best available commercial value in the current quotation pool." />
            <InsightTile icon={FileSpreadsheet} label="Average quote" value={stats.averageValue ? formatMoney(Math.round(stats.averageValue)) : '-'} helper="Useful baseline before comparing supplier outliers." />
            <InsightTile icon={ShieldCheck} label="Decision progress" value={`${stats.decisionRate}%`} helper={`${stats.accepted + stats.rejected} of ${stats.total} quotation records finalized.`} />
            <InsightTile icon={Percent} label="Document coverage" value={`${stats.documentCount}/${stats.total}`} helper="Records with RFQ or proposal documents attached." />
          </div>
        )}

        <div className="space-y-3 rounded-[24px] bg-slate-50/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/70">
          <ResponsiveFilterBar
            activeFilterCount={
              (user?.role === 'buyer' && selectedTenderId !== 'all' ? 1 : 0) +
              (statusFilter !== 'all' ? 1 : 0) +
              (methodFilter !== 'all' ? 1 : 0) +
              (categoryFilter !== 'all' ? 1 : 0)
            }
            className="p-0 border-none bg-transparent shadow-none"
            searchInput={
              <div className="relative w-full flex-1 sm:min-w-[300px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder={user?.role === 'buyer' ? 'Search by seller, tender ID, or category' : 'Search by RFQ, buyer, tender ID, or title'}
                  className="h-10 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-[#0b2447] focus:ring-2 focus:ring-[#0b2447]/10"
                />
              </div>
            }
            filters={
              <>
                {user?.role === 'buyer' && (
                  <select value={selectedTenderId} onChange={e => setSelectedTenderId(e.target.value)} className="h-10 w-full sm:w-auto flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#0b2447] focus:ring-2 focus:ring-[#0b2447]/10">
                    <option value="all">All tenders</option>
                    {tenders.map(tender => <option key={tender.id} value={String(tender.id)}>{tender.tenderId} - {tender.title}</option>)}
                  </select>
                )}
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | BidStatus)} className="h-10 w-full sm:w-auto flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#0b2447] focus:ring-2 focus:ring-[#0b2447]/10">
                  <option value="all">All status</option>
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
                <select value={methodFilter} onChange={e => setMethodFilter(e.target.value)} className="h-10 w-full sm:w-auto flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#0b2447] focus:ring-2 focus:ring-[#0b2447]/10">
                  <option value="all">All Methods</option>
                  <option value="rfq">Quick Quote (RFQ)</option>
                  <option value="bid">Tender Bid (BID)</option>
                </select>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-10 w-full sm:w-auto flex-1 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#0b2447] focus:ring-2 focus:ring-[#0b2447]/10">
                  <option value="all">All Categories</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </>
            }
            endContent={<ViewModeToggle className="flex justify-end" value={viewMode} onChange={setViewMode} />}
          />
          <div className="flex items-center justify-between border-t border-slate-200/60 pt-2.5 text-[10px] font-bold text-slate-500">
            <span>{filteredQuotes.length} matching record{filteredQuotes.length === 1 ? '' : 's'} from {quotes.length} total</span>
            <span>{stats.pending} pending decision{stats.pending === 1 ? '' : 's'}{user?.role === 'buyer' ? ' for buyer review' : ' across submitted bids and RFQs'}</span>
          </div>
        </div>

        {loading && quotes.length === 0 ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-slate-200 bg-white">
            <div className="space-y-3 text-center">
              <div className="flex justify-center">
                <Loader2 className="h-9 w-9" />
              </div>
              <p className="text-sm font-semibold text-slate-600">Loading bid records...</p>
            </div>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <EmptyState
            role={user?.role}
            hasQuotes={quotes.length > 0}
            onPrimary={() => router.push(user?.role === 'seller' ? '/seller/catalogue' : '/buyer/tenders')}
          />
        ) : viewMode === 'list' ? (
          <div className="overflow-hidden rounded-[24px] bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/70">
            <div className="overflow-x-auto bg-slate-50/70 p-2 pb-3">
              <div className="hidden sm:block overflow-x-auto w-full">
                <table className="w-full border-separate border-spacing-y-2 text-left min-w-[1240px]">
                <thead className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 w-16">Sr.No</th>
                    <th className="px-4 py-3 w-28"><SortHeader label="Bid ID" field="id" /></th>
                    <th className="px-4 py-3"><SortHeader label="RFQ / Tender" field="title" /></th>
                    <th className="px-4 py-3 w-44"><SortHeader label={user?.role === 'seller' ? 'Buyer' : 'Seller'} field="seller" /></th>
                    <th className="px-4 py-3 text-right w-32"><SortHeader label="Rate" field="rate" className="w-full justify-end" /></th>
                    <th className="px-4 py-3 text-center w-20"><SortHeader label="Qty" field="qty" className="w-full justify-center" /></th>
                    <th className="px-4 py-3 text-right w-36"><SortHeader label="Net Value" field="netValue" className="w-full justify-end" /></th>
                    <th className="px-4 py-3 text-center w-32"><SortHeader label="Status" field="status" className="w-full justify-center" /></th>
                    {(user?.role === 'buyer' || user?.role === 'seller') && <th className="px-4 py-3 text-right w-52">Manage</th>}
                  </tr>
                </thead>
                <tbody className="text-xs">
                  {pagedQuotes.map((quote, index) => {
                    const StatusIcon = statusIcons[quote.status] || Clock;
                    const totalValue = getQuotePricing(quote).totalAmount;
                    return (
                      <tr key={`${quote.source || 'bid'}-${quote.id}`} className="bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)] transition hover:shadow-sm group">
                        <td className="rounded-l-2xl px-4 py-3.5 text-xs font-black text-slate-400 whitespace-nowrap">{String((page - 1) * pageSize + index + 1).padStart(2, '0')}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono font-bold text-[#12335f]">
                          <button
                            type="button"
                            onClick={() => handleViewQuote(quote)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black text-[#c86413] hover:bg-slate-100 hover:border-[#12335f] transition-all"
                          >
                            {quote.source === 'rfq' ? 'RFQ' : 'BID'}-{String(quote.id).padStart(4, '0')}
                          </button>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="break-words font-black text-slate-900 leading-snug line-clamp-1">{quote.tender?.title || '-'}</div>
                          <div className="break-words text-[10px] font-bold text-slate-500 mt-0.5">
                            {quote.source === 'rfq' ? 'Request for Quote' : 'Tender Bid'} | {quote.tender?.tenderId} | {quote.tender?.category}
                          </div>
                          <div className="mt-1 text-[9px] font-semibold text-slate-400">
                            Delivery: {quote.deliveryDays ? `${quote.deliveryDays} days` : '-'} | Valid: {formatDate(quote.validTill)}
                            {quote.tender?.closesAt && <> | {quote.source === 'rfq' ? 'Deadline' : 'Closing'}: {formatDateTime(quote.tender.closesAt)}</>}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="break-words text-xs font-black text-slate-800 leading-tight">
                            {user?.role === 'seller' ? quote.buyer?.name || '-' : quote.seller?.sellerProfile?.businessName || quote.seller?.name || '-'}
                          </div>
                          <div className="mt-0.5 text-[10px] font-bold text-slate-500">
                            Updated: {formatDate(getQuoteUpdatedAt(quote))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-700 whitespace-nowrap">
                          {formatMoney(quote.unitPrice)}
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold text-slate-700 whitespace-nowrap">
                          {quote.quantity}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-[#12335f] whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {quote.isLowest && <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                            <span>{formatMoney(totalValue)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide shadow-sm', statusStyles[quote.status])}>
                            {getStatusLabel(quote.status)}
                          </span>
                        </td>
                        {user?.role === 'buyer' && (
                          <td className="rounded-r-2xl px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button type="button" onClick={() => handleViewQuote(quote)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-505 hover:border-[#12335f] hover:text-[#12335f] transition-all" title="View details">
                                <Eye className="h-4 w-4" />
                              </button>
                              {isDecisionOpen(quote) && (
                                <>
                                  <button onClick={() => handleStatusUpdate(quote, 'rejected')} className="h-8 w-8 rounded border border-red-200 bg-white flex items-center justify-center text-red-600 hover:bg-red-50" title="Reject quotation">
                                    <XCircle className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => handleStatusUpdate(quote, 'accepted')} className="h-8 w-8 rounded border border-emerald-200 bg-white flex items-center justify-center text-emerald-600 hover:bg-emerald-50" title="Accept quotation">
                                    <CheckCircle2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              {!isDecisionOpen(quote) && (
                                <span className={cn(
                                  'inline-flex h-7 items-center rounded border px-2 text-[10px] font-black uppercase',
                                  quote.source === 'rfq' && !quote.responseId
                                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                                    : 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                )}>
                                  {quote.source === 'rfq' && !quote.responseId ? 'Awaiting Response' : 'Finalized'}
                                </span>
                              )}
                            </div>
                          </td>
                        )}
                        {user?.role === 'seller' && (
                          <td className="rounded-r-2xl px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button type="button" onClick={() => handleViewQuote(quote)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-505 hover:border-[#12335f] hover:text-[#12335f] transition-all" title="View details">
                                <Eye className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => setEditTarget(quote)} disabled={!canSellerManageBid(quote, user?.role)} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-550 hover:border-blue-600 hover:text-blue-600 disabled:opacity-40 disabled:hover:text-slate-350 disabled:hover:border-slate-200 transition-all" title="Edit quotation">
                                <Edit3 className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => handleDeleteBid(quote)} disabled={!canSellerManageBid(quote, user?.role) || deletingId === quote.id} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-550 hover:border-red-600 hover:text-red-600 disabled:opacity-40 disabled:hover:text-slate-350 disabled:hover:border-slate-200 transition-all" title="Delete quotation">
                                <Trash2 className="h-4 w-4" />
                              </button>
                              {quote.source === 'rfq' && (!quote.quoteResponses || quote.quoteResponses.length === 0) && (
                                <Button onClick={() => setResponseTarget(quote)} className="h-8 rounded-md bg-[#12335f] px-3 text-[10px] font-black uppercase text-white hover:bg-[#0b2445] transition-all">
                                  Respond
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:hidden mt-2">
                {pagedQuotes.map((quote, index) => (
                  <QuotationCard
                    key={`${quote.source || 'bid'}-${quote.id}`}
                    quote={quote}
                    role={user?.role}
                    index={(page - 1) * pageSize + index}
                    onView={() => handleViewQuote(quote)}
                    onAccept={() => handleStatusUpdate(quote, 'accepted')}
                    onReject={() => handleStatusUpdate(quote, 'rejected')}
                    onRespond={() => setResponseTarget(quote)}
                  />
                ))}
              </div>
            </div>
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} label="quotations" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {pagedQuotes.map((quote, index) => (
                <React.Fragment key={`${quote.source || 'bid'}-${quote.id}`}>
                  <QuotationCard
                    quote={quote}
                    role={user?.role}
                    index={(page - 1) * pageSize + index}
                    onView={() => handleViewQuote(quote)}
                    onAccept={() => handleStatusUpdate(quote, 'accepted')}
                    onReject={() => handleStatusUpdate(quote, 'rejected')}
                    onRespond={() => setResponseTarget(quote)}
                  />
                </React.Fragment>
              ))}
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} label="quotations" />
            </div>
          </>
        )}
        {responseTarget && (
          <RfqResponseModal
            quote={responseTarget}
            saving={responding}
            onClose={() => setResponseTarget(null)}
            onSubmit={handleRfqResponse}
          />
        )}
        {detailsTarget && (
          <QuotationDetailsModal
            quote={detailsTarget}
            role={user?.role}
            onClose={() => setDetailsTarget(null)}
            onOpenDocument={handleOpenQuoteDocument}
          />
        )}
        {editTarget && (
          <BidEditModal
            quote={editTarget}
            saving={savingEdit}
            onClose={() => setEditTarget(null)}
            onSubmit={handleEditBid}
          />
        )}
        <DocumentPreviewModal previewDocument={previewDocument} onClose={() => setPreviewDocument(null)} />
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon: Icon,
  tone = 'blue'
}: {
  label: string;
  value: string | number;
  icon: any;
  tone?: 'blue' | 'amber' | 'green';
}) {
  return (
    <KpiCard
      label={label}
      value={value}
      icon={Icon}
      tone={tone}
    />
  );
}

function InsightTile({
  icon: Icon,
  label,
  value,
  helper
}: {
  icon: any;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <KpiCard
      label={label}
      value={value}
      subtext={helper}
      icon={Icon}
      tone="blue"
    />
  );
}

function QuotationCard({
  quote,
  role,
  index,
  onView,
  onAccept,
  onReject,
  onRespond
}: {
  quote: Quotation;
  role?: string;
  index: number;
  onView: () => void;
  onAccept: () => void;
  onReject: () => void;
  onRespond?: () => void;
}) {
  const StatusIcon = statusIcons[quote.status] || Clock;
  const sellerName = quote.seller?.sellerProfile?.businessName || quote.seller?.name || 'Submitted Bid';
  const counterpartyName = role === 'seller' && quote.source === 'rfq' ? quote.buyer?.name || 'Buyer RFQ' : sellerName;
  const pricing = getQuotePricing(quote);
  const isUnansweredRfq = role === 'seller' && quote.source === 'rfq' && (!quote.quoteResponses || quote.quoteResponses.length === 0);

  return (
    <Card className={cn(
      'overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:shadow-md relative',
      quote.status === 'accepted' && 'border-emerald-300'
    )}>
      <CardContent className="p-0">
        <div className="border-b border-slate-200 bg-[#f8fafc] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black text-[#12335f] bg-slate-200/70 px-1.5 py-0.5 rounded min-w-[20px] text-center">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p className="font-mono text-[11px] font-bold uppercase text-slate-500">
                  {quote.source === 'rfq' ? 'RFQ' : 'BID'}-{String(quote.id).padStart(4, '0')}
                </p>
                {quote.isLowest && (
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                    <Trophy className="h-3 w-3" />
                    Lowest
                  </span>
                )}
              </div>
              <h3 className="mt-2 truncate text-base font-extrabold text-[#071632]">
                {role === 'buyer' ? sellerName : quote.tender?.title || 'Tender Quotation'}
              </h3>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {quote.tender?.tenderId || `Tender #${quote.tenderId}`} | {quote.tender?.category || 'General Procurement'}{role === 'seller' ? ` | ${counterpartyName}` : ''}
              </p>
            </div>
            <span className={cn('inline-flex shrink-0 items-center gap-1 rounded border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide', statusStyles[quote.status])}>
              <StatusIcon className="h-3.5 w-3.5" />
              {getStatusLabel(quote.status)}
            </span>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <InfoBox label={quote.source === 'rfq' ? 'Quoted Amount' : 'Unit Price'} value={quote.unitPrice ? formatMoney(quote.unitPrice) : 'Awaiting response'} />
            <InfoBox label="Quantity" value={quote.quantity || '-'} />
            <InfoBox label="Total Value" value={formatMoney(pricing.totalAmount)} strong />
            <InfoBox label="Delivery" value={quote.deliveryDays ? `${quote.deliveryDays} days` : '-'} />
            <InfoBox label={quote.source === 'rfq' ? 'RFQ Deadline' : 'Tender Closing'} value={formatDateTime(quote.tender?.closesAt)} />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <InfoBox label="Subtotal" value={formatMoney(pricing.subtotal)} />
            <InfoBox label="Tax" value={`${pricing.taxRate.toFixed(2)}% (${formatMoney(pricing.taxAmount)})`} />
            <InfoBox label="Discount" value={`${pricing.discountPercent.toFixed(2)}% (${formatMoney(pricing.discountAmount)})`} />
            <InfoBox label="Warranty" value={quote.warranty || 'Not Provided'} />
            <InfoBox label="Valid Till" value={quote.validTill ? new Date(quote.validTill).toLocaleDateString() : 'Not Provided'} />
          </div>

          {quote.note && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{quote.source === 'rfq' ? 'RFQ Message' : 'Seller Note'}</p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-700">{quote.note}</p>
            </div>
          )}

          <Button variant="outline" onClick={onView} className="h-10 w-full rounded-md border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50">
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </Button>

          {role === 'buyer' ? (
            isDecisionOpen(quote) ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="outline" onClick={onReject} className="h-10 rounded-md border-red-200 font-bold text-red-700 hover:bg-red-50">
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button onClick={onAccept} className="h-10 rounded-md bg-[#12335f] font-bold text-white hover:bg-[#0b2445]">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Accept
                </Button>
              </div>
            ) : (
              <div className={cn('flex h-10 items-center justify-center rounded-md border text-sm font-bold', statusStyles[quote.status])}>
                <StatusIcon className="mr-2 h-4 w-4" />
                {quote.status === 'accepted' ? 'Quotation Accepted' :
                  quote.status === 'rejected' || quote.status === 'technical_rejected' ? 'Quotation Rejected' :
                    'Status: ' + getStatusLabel(quote.status)}
              </div>
            )
          ) : (
            isUnansweredRfq ? (
              <Button onClick={onRespond} className="h-10 w-full rounded-md bg-[#12335f] font-bold text-white hover:bg-[#0b2445]">
                <Send className="mr-2 h-4 w-4" />
                Respond to RFQ
              </Button>
            ) : (
              <div className={cn('flex h-10 items-center justify-center rounded-md border text-sm font-bold', statusStyles[quote.status])}>
                <StatusIcon className="mr-2 h-4 w-4" />
                {quote.source === 'rfq' && quote.status === 'submitted' ? 'RFQ response submitted' :
                  quote.status === 'pending' ? 'Pending buyer review' :
                    quote.status === 'submitted' ? 'Submitted (Awaiting Review)' :
                      quote.status === 'technical_qualified' ? 'Technically Qualified' :
                        quote.status === 'technical_rejected' ? 'Technically Rejected' :
                          quote.status === 'financial_evaluated' ? 'Financial Evaluated' :
                            quote.status === 'accepted' ? 'Accepted by buyer' :
                              quote.status === 'withdrawn' ? 'Inactive quotation' :
                                quote.status === 'rejected' ? 'Not selected' : 'Status: ' + getStatusLabel(quote.status)}
              </div>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}


function RfqResponseModal({
  quote,
  saving,
  onClose,
  onSubmit
}: {
  quote: Quotation;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [documentUrl, setDocumentUrl] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [uploadingDocument, setUploadingDocument] = useState(false);

  const handleUploadDocument = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingDocument(true);
    try {
      const optimizedFile = file.type.startsWith('image/') ? await compressImage(file) : file;
      const body = new FormData();
      body.append('file', optimizedFile);
      const response = await api.fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Unable to upload document');

      const upload = data?.data || data;
      const fileId = Number(upload?.fileId || upload?.file?.id || 0) || null;
      const uploadedUrl = fileId
        ? `/api/files/${fileId}/view`
        : upload?.url || upload?.file?.documentUrl || upload?.file?.url || '';
      if (!uploadedUrl) throw new Error('Uploaded document link is unavailable');

      setDocumentUrl(uploadedUrl);
      setDocumentName(upload?.file?.originalName || upload?.originalName || file.name);
      toast.success('Response document attached');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to upload document');
    } finally {
      setUploadingDocument(false);
      event.target.value = '';
    }
  };

  const handleRemoveDocument = () => {
    setDocumentUrl('');
    setDocumentName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Respond to RFQ</p>
          <h2 className="mt-1 text-lg font-black text-[#071632]">{quote.tender?.title || `RFQ #${quote.id}`}</h2>
          <p className="mt-1 text-xs font-semibold text-slate-500">{quote.buyer?.name || 'Buyer'} requested a quote.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 p-5">
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
            Total Amount
            <input name="totalAmount" type="number" min="0" step="0.01" required className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Delivery Days
              <input name="deliveryDays" type="number" min="1" className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20" />
            </label>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
              Validity Date
              <input name="validityDate" type="date" className="mt-1 h-11 w-full rounded-md border border-slate-200 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20" />
            </label>
          </div>
          <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500">
            Notes
            <textarea name="notes" rows={4} defaultValue="" className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#12335f]/20" />
          </label>
          <div className="space-y-1.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Upload Document (Optional)</p>
            <div className={cn(
              'flex items-center justify-between gap-3 rounded-md border border-dashed p-3',
              documentUrl ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50'
            )}>
              <div className="flex min-w-0 items-center gap-2">
                <Paperclip className={cn('h-4 w-4 shrink-0', documentUrl ? 'text-emerald-700' : 'text-slate-400')} />
                <p className={cn('truncate text-xs font-semibold', documentUrl ? 'text-emerald-700' : 'text-slate-500')}>
                  {documentName || (uploadingDocument ? 'Uploading document...' : 'Attach proposal PDF or supporting file')}
                </p>
              </div>
              {documentUrl ? (
                <button type="button" onClick={handleRemoveDocument} className="shrink-0 rounded px-2 py-1 text-[10px] font-black uppercase text-red-600 hover:bg-red-50">
                  Remove
                </button>
              ) : (
                <>
                  <input id={`rfq-response-document-${quote.id}`} type="file" accept=".pdf,.doc,.docx,.csv,.jpg,.jpeg,.png" onChange={handleUploadDocument} disabled={uploadingDocument} className="hidden" />
                  <label htmlFor={`rfq-response-document-${quote.id}`} className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-md bg-[#12335f] px-3 text-[10px] font-black uppercase text-white hover:bg-[#0b2445]">
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {uploadingDocument ? 'Uploading...' : 'Upload'}
                  </label>
                </>
              )}
            </div>
            <input type="hidden" name="documentUrl" value={documentUrl} />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="h-10 text-xs font-black uppercase">Cancel</Button>
            <Button type="submit" disabled={saving || uploadingDocument} className="h-10 bg-[#12335f] text-xs font-black uppercase text-white hover:bg-[#0b2445]">
              {saving ? 'Submitting...' : 'Submit Response'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmptyState({
  role,
  hasQuotes,
  onPrimary
}: {
  role?: string;
  hasQuotes: boolean;
  onPrimary: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-md bg-slate-50 text-[#12335f]">
        {hasQuotes ? <Search className="h-7 w-7" /> : <AlertCircle className="h-7 w-7" />}
      </div>
      <h2 className="mt-4 text-lg font-extrabold text-slate-900">
        {hasQuotes ? 'No matching bid records' : role === 'buyer' ? 'No quotations received yet' : 'No bids or RFQs yet'}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm font-medium text-slate-600">
        {hasQuotes
          ? 'Adjust the search or status filter to view more bid records.'
          : role === 'buyer'
            ? 'Published tenders will show supplier quotations here once sellers submit their bids.'
            : 'Buyer RFQ requests from marketplace and your submitted tender bids will appear here.'}
      </p>
      {!hasQuotes && (
        <Button onClick={onPrimary} className="mt-5 h-10 rounded-md bg-[#12335f] px-5 text-xs font-bold uppercase tracking-wide text-white hover:bg-[#0b2445]">
          {role === 'buyer' ? 'View Tenders' : 'Open Marketplace'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
