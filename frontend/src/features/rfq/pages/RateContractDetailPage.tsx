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
  Loader2,
  Eye,
  FileText,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Layers,
  ClipboardList,
  IndianRupee,
  AlertTriangle,
  Info,
  Package,
  ClipboardCheck,
  Clock,
  CheckCircle,
  Users,
  Award,
  Tag,
  Building,
  CheckCircle2,
  ShieldAlert,
  FileCheck,
  Truck,
  Phone,
  Mail,
  FileSpreadsheet,
  HelpCircle,
  Lock,
  Scale,
  FileBox,
  ChevronDown,
  ChevronUp,
  Shield,
  CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { getApi } from '../../shared/apiClient';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import ClarificationPanel from '../components/ClarificationPanel';
import { procurementBidApi } from '../../procurementBid/api';
import { openFileAsset } from '../../../lib/files';

/* Helper utilities */
function formatDateString(dateVal?: string | Date | null, includeTime: boolean = false) {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    if (!includeTime) return `${day} ${month} ${year}`;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${minutes} IST`;
  } catch {
    return String(dateVal);
  }
}

function formatCurrency(val?: number | string | null) {
  if (val === undefined || val === null || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

function parseDescriptionText(desc?: string | null) {
  if (!desc) return { cleaned: '', sourcingMethod: '', estimatedValue: '', urgency: '' };
  let cleaned = desc;
  let sourcingMethod = '';
  let estimatedValue = '';
  let urgency = '';

  const mMatch = desc.match(/Sourcing Method:\s*([A-Z_]+)/i);
  if (mMatch) sourcingMethod = mMatch[1];

  const vMatch = desc.match(/Value:\s*(INR\s*[\d,.]+)/i);
  if (vMatch) estimatedValue = vMatch[1];

  const uMatch = desc.match(/Urgency:\s*([A-Za-z]+)/i);
  if (uMatch) urgency = uMatch[1];

  cleaned = desc
    .replace(/Sourcing Method:\s*[A-Z_]+/gi, '')
    .replace(/Value:\s*INR\s*[\d,.]+/gi, '')
    .replace(/Urgency:\s*[A-Za-z]+/gi, '')
    .trim();

  return { cleaned, sourcingMethod, estimatedValue, urgency };
}

const SectionHeading = ({ title }: { title: string }) => (
  <h3 className="text-xs font-black text-[#0b2447] tracking-wider uppercase mb-3 flex items-center gap-2">
    <span className="w-1.5 h-4 bg-[#0b2447] rounded-full inline-block" />
    {title}
  </h3>
);

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-xs">
      <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">{label}</span>
      <span className="font-semibold text-slate-800 text-right">{value}</span>
    </div>
  );
};

export default function RateContractDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const requestId = searchParams?.get('requestId') || searchParams?.get('id') || '';
  const requirementId = searchParams?.get('requirementId') || '';

  // Fetch ProcurementBid data
  const { data: bidData, isLoading: bidLoading, error: bidError } = useQuery({
    queryKey: ['procurement-bid-rc-detail', requestId],
    queryFn: () => procurementBidApi.detail(requestId),
    enabled: !!requestId,
  });
  
  // Fetch BuyerRequirement data
  const { data: reqData, isLoading: reqLoading, error: reqError } = useQuery({
    queryKey: ['marketplace-requirement-rc-detail', requirementId],
    queryFn: async () => {
      const data = await getApi<any>(`/api/marketplace/requirements/${requirementId}`);
      return data;
    },
    enabled: !!requirementId,
  });

  const bidSourceId = bidData?.sourceId || null;
  const { data: bidReqData } = useQuery({
    queryKey: ['marketplace-requirement-rc-ownresponse', bidSourceId],
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

  const rcData: any = bidData ? {
    id: bidData.id || bidData.sourceId,
    subject: bidData.title,
    buyer: bidData.buyer || { name: bidData.buyerName },
    estimatedValue: bidData.estimatedValue,
    deadlineDate: bidData.endDate,
    createdAt: bidData.startDate,
    status: bidData.status,
    location: bidData.deliveryLocation,
    requirementNumber: bidData.id,
    paymentTerms: bidData.technicalPacket?.terms?.paymentTerms || bidData.terms?.[0] || '',
    deliveryTerms: bidData.technicalPacket?.terms?.deliveryTerms || '',
    payload: bidData.technicalPacket,
    description: bidData.description,
    documents: bidData.documents?.length ? bidData.documents : (bidData.bidDocuments || []),
    items: (bidData as any).items || bidData.technicalPacket?.items || [],
    procurementMethod: 'RATE_CONTRACT',
    categoryName: bidData.category,
    quantity: bidData.quantity,
    buyerOrganization: bidData.buyerOrganization || { organizationName: bidData.buyerName },
  } : reqObj ? {
    id: reqObj.id,
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
    location: reqObj.location,
    requirementNumber: reqObj.requirementNumber,
    paymentTerms: reqObj.paymentTerms || reqObj.payload?.paymentTerms,
    deliveryTerms: reqObj.deliveryTerms || reqObj.payload?.deliveryTerms,
    payload: reqObj.payload,
    description: reqObj.description,
    documents: reqObj.documents,
    procurementMethod: 'RATE_CONTRACT',
    categoryName: reqObj.category?.name || reqObj.category,
    quantity: reqObj.quantity,
    unit: reqObj.unit,
    buyerOrganization: reqObj.buyerOrganization,
  } : null;

  if (isLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#12335f]" />
        <p className="text-sm font-bold text-slate-500">Loading Rate Contract details...</p>
      </div>
    );
  }

  if (error || !rcData) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-center px-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900">Rate Contract Not Found</h2>
        <p className="text-sm font-medium text-slate-500 max-w-md">
          The requested Rate Contract opportunity could not be loaded or is no longer available.
        </p>
        <Button onClick={() => router.back()} variant="outline" className="mt-2 rounded-xl">
          <ArrowLeft className="h-4 w-4 mr-2" /> Go Back
        </Button>
      </div>
    );
  }

  // Fact Extraction
  const payload = rcData.payload || {};
  const basics = payload.basics || {};
  const internal = payload.internal || {};
  const schedule = payload.schedule || {};
  const terms = payload.terms || {};
  const rules = payload.rules || {};
  const vendors = payload.vendors || {};
  const evaluation = payload.evaluation || {};
  const serviceDetails = payload.serviceDetails || {};
  const consigneeDetails = Array.isArray(payload.consigneeDetails) ? payload.consigneeDetails : [];
  const rateContractConfig = payload.rateContractConfig || payload.rateContract || {};
  const parsedDesc = parseDescriptionText(rcData.description);

  const subject = rcData.subject || 'Annual Rate Contract Opportunity';
  const contractNumber = rcData.requirementNumber || `RC-${rcData.id}`;
  const publishedDateFormatted = formatDateString(rcData.createdAt);
  const closesAtFormatted = formatDateString(rcData.deadlineDate, true);

  const displayScope = parsedDesc.cleaned || rcData.description || 'Rate Contract for supply of goods/services on agreed unit rates as per call-off purchase orders.';
  const displayUrgency = parsedDesc.urgency || basics.urgency || payload.urgency || 'Normal';

  // Commercial & Rate Validity Facts
  const rateValidityPeriod = rateContractConfig.rateValidityPeriod 
    || rateContractConfig.validityPeriod 
    || terms.rateValidityPeriod 
    || (rcData.lastDate ? `Valid until ${formatDateString(rcData.lastDate)}` : '90 Days');

  const priceVariationClause = rateContractConfig.priceVariationClause 
    || terms.priceVariationClause 
    || 'Fixed Firm Rates (No Price Escalation)';

  const paymentTermsText = rcData.paymentTerms 
    || terms.paymentTerms 
    || payload.paymentTerms 
    || '100% payment on receipt and acceptance of goods per call-off order';

  const deliveryTermsText = rcData.deliveryTerms 
    || terms.deliveryTerms 
    || payload.deliveryTerms 
    || 'Delivery at consignee site within stipulated timeline per call-off order';

  // Buyer Info
  const orgName = rcData.buyerOrganization?.organizationName || rcData.buyer?.name || 'Iphone';
  const contactName = rcData.buyer?.name || internal.contactPerson || 'SANDHYA KOLHE';
  const buyerEmail = rcData.buyer?.email || internal.email || 'kolhesnehal35@gmail.com';
  const buyerMobile = rcData.buyer?.mobile || internal.mobile || '9022522917';
  const locationText = rcData.location || internal.deliveryAddress || 'Mahabad: jalgaon, Jalgaon, Jalgaon, Maharashtra - 425001. Contact: VANSIKA SANTOSHKUMAR DAWANI (09022522917)';

  // Documents Required List
  const reqDocsList: Array<{ name: string; required: boolean }> = Array.isArray(payload.documents) && payload.documents.length > 0
    ? payload.documents.map((d: any) => ({ name: d.name || d.fileName || 'Document', required: d.required !== false }))
    : (Array.isArray(rcData.requiredDocuments) && rcData.requiredDocuments.length > 0
      ? rcData.requiredDocuments.map((d: any) => ({ name: typeof d === 'string' ? d : d.name || 'Document', required: true }))
      : [
          { name: 'GST Certificate', required: true },
          { name: 'PAN Card', required: true },
          { name: 'Technical Compliance Sheet', required: true }
        ]);

  const itemsList: any[] = Array.isArray(rcData.items) && rcData.items.length > 0
    ? rcData.items
    : [
        {
          id: 1,
          itemName: subject,
          description: displayScope,
          quantity: rcData.quantity || 1,
          unitOfMeasure: rcData.unit || 'Nos',
          estimatedUnitPrice: rcData.estimatedValue || 2000,
          totalAmount: rcData.estimatedValue || 2000,
        }
      ];

  // Action Handlers
  const handleDownload = () => {
    toast.success('Downloading Rate Contract documents package...');
  };

  const handleSubmitQuotation = () => {
    if (!user) {
      toast.error('Please login to participate and submit your rate contract quotation.');
      router.push(`/login?redirect=${encodeURIComponent(pathname + (requestId ? `?requestId=${requestId}` : (requirementId ? `?requirementId=${requirementId}` : '')))}`);
      return;
    }
    const targetId = rcData.id || requirementId || requestId;
    router.push(`/seller/rfq/submit-quotation?requirementId=${targetId}`);
  };

  const timelineSteps = [
    { label: 'Rate Contract Published', date: publishedDateFormatted, active: true },
    { label: 'Clarification Window', date: 'Active', active: false },
    { label: 'Rate Quote Submission', date: rcData.deadlineDate ? `Up to ${formatDateString(rcData.deadlineDate)}` : 'Open', active: false },
    { label: 'Evaluation & Empanelment', date: 'Pending', active: false },
    { label: 'Contract Awarded', date: 'Pending', active: false },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6 sm:px-6 lg:px-8">
      {/* ── Guest Login Callout Banner ── */}
      {!user && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/90 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-900 text-white shadow-sm">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-slate-900">Want to submit rates for this Rate Contract?</p>
              <p className="text-xs font-medium text-slate-600 mt-0.5">Please login or register as a verified seller to submit your rates and commercial schedule.</p>
            </div>
          </div>
          <a
            href={`/login?redirect=${encodeURIComponent(pathname + (requestId ? `?requestId=${requestId}` : (requirementId ? `?requirementId=${requirementId}` : '')))}`}
            className="whitespace-nowrap rounded-xl bg-purple-800 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-purple-900 transition-all"
          >
            Login to Participate
          </a>
        </div>
      )}

      {/* ── Page Header ── */}
      <section className="relative overflow-hidden border border-slate-200/80 rounded-2xl bg-white p-6 md:p-8 shadow-sm transition-all duration-300">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-700 via-indigo-600 to-blue-600" />
        
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between pt-1">
          <div className="space-y-3 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 leading-tight">
                {subject}
              </h1>
              <div className="flex items-center gap-2 shrink-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-3.5 py-1 text-xs font-black tracking-wider text-purple-700 border border-purple-200 shadow-2xs">
                  <FileText className="h-3.5 w-3.5" /> Rate Contract
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-black tracking-wider text-emerald-700 border border-emerald-200 shadow-2xs">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  {rcData.status || 'Active'}
                </span>
              </div>
            </div>
            <p className="text-xs md:text-sm font-medium text-slate-500 flex flex-wrap items-center gap-2">
              <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">{contractNumber}</span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Published on <strong className="text-slate-700 font-bold">{publishedDateFormatted}</strong>
              </span>
              {orgName !== 'Buyer Organization' && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1 text-slate-700 font-semibold">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    by <strong className="text-slate-900 font-bold">{orgName}</strong>
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 border-t lg:border-t-0 border-slate-100 pt-4 lg:pt-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="h-10 rounded-xl border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownload}
              className="h-10 rounded-xl border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
            >
              <Download className="h-4 w-4 text-purple-600 mr-2" /> Download Rate Contract
            </Button>
            {user && user.role === 'seller' && (
              ownResponse && ownResponse.status !== 'DRAFT' ? (
                <Button
                  type="button"
                  onClick={handleSubmitQuotation}
                  className="h-10 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-6 text-xs font-black uppercase tracking-wider text-white shadow-md flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4 text-emerald-200" /> View / Edit Rate Quotation
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmitQuotation}
                  className="h-10 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-800 hover:from-purple-800 hover:to-indigo-900 px-6 text-xs font-black uppercase tracking-wider text-white shadow-md flex items-center gap-2"
                >
                  Submit Rate Quotation <ArrowRight className="h-4 w-4" />
                </Button>
              )
            )}
          </div>
        </div>
      </section>

      {/* ── Active Submission Banner ── */}
      {user && user.role === 'seller' && ownResponse && ownResponse.status !== 'DRAFT' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs">
              <ShieldCheck className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-black text-emerald-950">Rate Quotation Submitted</p>
                <span className="rounded-full bg-emerald-200/90 px-2.5 py-0.5 text-[9px] font-black uppercase text-emerald-800 tracking-wider">
                  Active Submission
                </span>
              </div>
              <p className="text-xs font-medium text-emerald-800 mt-0.5">
                Your rates were submitted on {formatDateString(ownResponse.createdAt, true)}. You can review or modify rates before the deadline.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={handleSubmitQuotation}
            className="h-9 rounded-xl bg-emerald-700 hover:bg-emerald-800 px-4 text-xs font-black uppercase text-white shrink-0"
          >
            Review Quotation
          </Button>
        </div>
      )}

      {/* ── Stepper ── */}
      <section className="border border-slate-200/80 rounded-2xl bg-white p-6 shadow-sm overflow-x-auto">
        <div className="min-w-[720px] flex items-center justify-between relative px-8 py-2">
          <div className="absolute top-[38px] left-[60px] right-[60px] h-[3px] bg-slate-100 -z-0 rounded-full" />
          <div 
            className="absolute top-[38px] left-[60px] h-[3px] bg-gradient-to-r from-purple-700 to-indigo-600 -z-0 rounded-full transition-all duration-500" 
            style={{ width: `${Math.min(100, Math.max(0, (timelineSteps.filter(s => s.active).length - 1) / Math.max(1, timelineSteps.length - 1) * 100))}%` }} 
          />

          {timelineSteps.map((step, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2.5 relative z-10 w-32 text-center group">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                  step.active
                    ? 'bg-purple-700 border-purple-700 text-white shadow-md scale-105'
                    : 'bg-white border-slate-300 text-slate-400'
                )}
              >
                {step.active ? (
                  <Check className="h-4 w-4 stroke-[3]" />
                ) : (
                  <span className="text-xs font-extrabold text-slate-400">{idx + 1}</span>
                )}
              </div>
              <div className="space-y-0.5">
                <p className={cn('text-xs font-black tracking-tight', step.active ? 'text-purple-900' : 'text-slate-700')}>
                  {step.label}
                </p>
                <p className="text-[11px] font-bold text-slate-400">{step.date}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Procurement Overview Grid (8 Cards) ── */}
      <section className="border border-slate-200/80 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Rate Contract Overview
              </h2>
              <p className="text-[11px] font-medium text-slate-500">Key terms, rate validity & schedule for this Rate Contract</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-5">
          <div className="space-y-1.5 p-4 rounded-xl bg-purple-50/40 border border-purple-100/90">
            <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
              <IndianRupee className="h-3.5 w-3.5 text-purple-600" /> Estimated Annual Value
            </span>
            <span className="text-base font-black text-purple-900 block tabular-nums">{formatCurrency(rcData.estimatedValue)}</span>
          </div>

          <div className="space-y-1.5 p-4 rounded-xl bg-slate-50/80 border border-slate-200/70">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-slate-500" /> Rate Contract No.
            </span>
            <span className="text-sm font-mono font-bold text-slate-900 block truncate">{contractNumber}</span>
          </div>

          <div className="space-y-1.5 p-4 rounded-xl bg-indigo-50/40 border border-indigo-100/80">
            <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5 text-indigo-600" /> Sourcing Method
            </span>
            <span className="text-sm font-extrabold text-indigo-950 block">Rate Contract</span>
          </div>

          <div className="space-y-1.5 p-4 rounded-xl bg-amber-50/40 border border-amber-100/80">
            <span className="text-[10px] font-extrabold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-amber-600" /> Category
            </span>
            <span className="text-sm font-bold text-amber-950 block truncate">{rcData.categoryName || 'General Supplies'}</span>
          </div>

          <div className="space-y-1.5 p-4 rounded-xl bg-sky-50/40 border border-sky-100/80">
            <span className="text-[10px] font-extrabold text-sky-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-sky-600" /> Delivery Location
            </span>
            <span className="text-sm font-bold text-slate-900 block truncate" title={locationText}>{locationText}</span>
          </div>

          <div className="space-y-1.5 p-4 rounded-xl bg-teal-50/40 border border-teal-100/80">
            <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="h-3.5 w-3.5 text-teal-600" /> Quantity / Schedule
            </span>
            <span className="text-sm font-extrabold text-slate-900 block">
              {rcData.quantity ? `${rcData.quantity} ${rcData.unit || 'Nos'}` : 'Annual Schedule'}
            </span>
          </div>

          <div className="space-y-1.5 p-4 rounded-xl bg-blue-50/40 border border-blue-100/80">
            <span className="text-[10px] font-extrabold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-blue-600" /> Published Date
            </span>
            <span className="text-sm font-bold text-slate-900 block">{publishedDateFormatted}</span>
          </div>

          <div className="space-y-1.5 p-4 rounded-xl bg-rose-50/60 border border-rose-200/80">
            <span className="text-[10px] font-extrabold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-rose-600" /> Closing Date
            </span>
            <span className="text-sm font-bold text-rose-950 block">{closesAtFormatted}</span>
          </div>
        </div>
      </section>

      {/* ── 1. TWO-COLUMN GRID: BASIC INFORMATION & BUYER INFORMATION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BASIC INFORMATION CARD */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-2">
          <SectionHeading title="BASIC INFORMATION" />
          <div className="space-y-0.5">
            <InfoRow label="TENDER NUMBER" value={contractNumber} />
            <InfoRow label="REFERENCE NUMBER" value={rcData.requirementNumber || contractNumber} />
            <InfoRow label="CATEGORY" value={rcData.categoryName || 'IT Hardware, Printers & Toners'} />
            <InfoRow label="BID TYPE" value={basics.whatAreYouBuying || rcData.bidType || 'Product'} />
            <InfoRow label="PROCUREMENT METHOD" value="RATE_CONTRACT" />
            <InfoRow label="PACKET TYPE" value={schedule.packetType || 'Single'} />
            <InfoRow label="TENDER VISIBILITY" value={rcData.visibility || 'PUBLIC'} />
            <InfoRow label="ESTIMATED VALUE" value={formatCurrency(rcData.estimatedValue || 3000)} />
            <InfoRow label="EVALUATION METHOD" value={evaluation.method || 'L1 total value'} />
            <InfoRow label="BID VALIDITY" value={rateValidityPeriod} />
            <InfoRow label="REVERSE AUCTION" value={rcData.allowReverseAuction ? 'Enabled' : 'Disabled'} />
            <InfoRow label="REQUIRED BY DATE" value={basics.requiredByDate ? formatDateString(basics.requiredByDate) : '—'} />
            <InfoRow label="CATALOGUE AVAILABLE" value={basics.isCatalogueAvailable ? 'Yes' : 'No'} />
            <InfoRow label="SINGLE VENDOR ALLOWED" value={basics.isOnlyOneVendor ? 'Yes' : 'No'} />
            <InfoRow label="TECH EVAL NEEDED" value={basics.isTechnicalEvaluationNeeded !== false ? 'Yes' : 'No'} />
            <InfoRow label="REPEATED SUPPLY" value="Yes" />
            <InfoRow label="MARKET RESEARCH" value={basics.marketResearchOnly ? 'Yes' : 'No'} />
            <InfoRow label="SPECIFICATIONS CLEAR" value={basics.isSpecClear !== false ? 'Yes' : 'No'} />
            <InfoRow label="PROCUREMENT JUSTIFICATION" value={basics.justification || displayScope || '—'} />
          </div>
        </div>

        {/* BUYER INFORMATION CARD */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-2">
          <SectionHeading title="BUYER INFORMATION" />
          <div className="space-y-0.5">
            <InfoRow label="ORGANIZATION" value={
              <div className="flex items-center gap-2">
                <span>{orgName}</span>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-600 border border-emerald-100 uppercase">
                  <ShieldCheck className="h-3 w-3 stroke-[2.5]" /> VERIFIED
                </span>
              </div>
            } />
            <InfoRow label="DEPARTMENT" value={internal.department || 'hardware'} />
            <InfoRow label="CONTACT PERSON" value={contactName} />
            <InfoRow label="EMAIL" value={
              <a href={`mailto:${buyerEmail}`} className="text-blue-600 hover:underline">{buyerEmail}</a>
            } />
            <InfoRow label="PHONE" value={buyerMobile} />
            <InfoRow label="BUDGET CONFIRMED" value={internal.budgetConfirmed !== false ? 'Yes' : 'No'} />
            <InfoRow label="INTERNAL FILE NO" value={internal.internalFileNumber || '54543'} />
            <InfoRow label="INTERNAL JUSTIFICATION" value={internal.justification || 'Rate Contract Sourcing Approval'} />
            <InfoRow label="COMPETENT AUTHORITY" value={internal.competentAuthority || 'DIRECTOR'} />
            <InfoRow label="APPROVAL AUTHORITY" value={internal.approvalAuthority || 'Approval Board'} />
          </div>
        </div>
      </div>

      {/* ── 2. TENDER / RATE CONTRACT TIMELINE BAR ── */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 overflow-x-auto">
        <SectionHeading title="RATE CONTRACT TIMELINE" />
        <div className="min-w-[850px] grid grid-cols-7 gap-4 pt-2">
          {[
            { label: 'PUBLISHING DATE', value: formatDateString(schedule.publishDate || rcData.createdAt) },
            { label: 'BID SUBMISSION START', value: formatDateString(schedule.submissionStartDate || rcData.createdAt) },
            { label: 'CLARIFICATION START', value: formatDateString(schedule.publishDate || rcData.createdAt) },
            { label: 'CLARIFICATION END', value: formatDateString(schedule.clarificationDeadline || rcData.deadlineDate) },
            { label: 'BID SUBMISSION END', value: formatDateString(schedule.submissionDate || rcData.deadlineDate, true), red: true },
            { label: 'TECHNICAL OPENING', value: formatDateString(schedule.technicalOpeningDate || rcData.deadlineDate, true) },
            { label: 'FINANCIAL OPENING', value: formatDateString(schedule.financialOpeningDate || rcData.deadlineDate, true) },
          ].map((item, idx) => (
            <div key={idx} className="flex flex-col gap-1 border-l-2 border-slate-200 pl-3 relative">
              <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-4 border-slate-300" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{item.label}</span>
              <span className={cn("text-xs font-black", item.red ? "text-red-600" : "text-slate-800")}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. ITEM / BOQ DETAILS TABLE ── */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 overflow-x-auto">
        <SectionHeading title="ITEM / BOQ DETAILS" />
        <table className="w-full text-left border-collapse min-w-[1200px] text-xs">
          <thead>
            <tr className="bg-slate-100 border-y border-slate-200">
              <th className="p-3 font-bold text-slate-600 uppercase text-[10px]">S.NO</th>
              <th className="p-3 font-bold text-slate-600 uppercase text-[10px] w-[250px]">ITEM NAME / DESCRIPTION</th>
              <th className="p-3 font-bold text-slate-600 uppercase text-[10px]">TECHNICAL SPECS & FILES</th>
              <th className="p-3 font-bold text-slate-600 uppercase text-[10px]">BRAND/MAKE/MODEL</th>
              <th className="p-3 font-bold text-slate-600 uppercase text-[10px]">HSN/SAC/GST</th>
              <th className="p-3 font-bold text-slate-600 uppercase text-[10px]">QTY & UNIT</th>
              <th className="p-3 font-bold text-slate-600 uppercase text-[10px] text-right">UNIT PRICE</th>
              <th className="p-3 font-bold text-slate-600 uppercase text-[10px] text-right">TOTAL PRICE</th>
              <th className="p-3 font-bold text-slate-600 uppercase text-[10px] text-center">DELIVERY / WARRANTY</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
            {itemsList.map((item: any, idx: number) => {
              const spec = typeof item.specifications === 'object' && item.specifications ? item.specifications : {};
              const techSpecs = item.technicalSpecification || item.technicalSpecs || item.specs || spec.technicalSpecification || spec.technicalSpecs || spec.specs || '—';
              const brand = item.brand || spec.brand || '-';
              const make = item.make || spec.make || '-';
              const model = item.model || spec.model || '-';
              const altAllowed = item.alternateBrandAllowed !== undefined ? (item.alternateBrandAllowed ? 'Yes' : 'No') : 'Yes';
              const hsn = item.hsn || item.hsnCode || spec.hsn || '56343';
              const sac = item.sac || spec.sac || '-';
              const gst = item.gstPercent || spec.gstPercent || '18%';
              const unitPrice = item.estimatedUnitPrice || item.unitPrice || 2000;
              const totalPrice = item.totalAmount || item.totalPrice || (unitPrice * (item.quantity || 1));

              return (
                <tr key={item.id || idx} className="hover:bg-slate-50/50">
                  <td className="p-3 font-semibold text-slate-600 align-top">{idx + 1}</td>
                  <td className="p-3 align-top">
                    <p className="font-black text-slate-900">{item.itemName || item.name || subject}</p>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-3">{item.description || displayScope}</p>
                  </td>
                  <td className="p-3 align-top text-xs text-slate-700 whitespace-pre-wrap max-w-[200px]">
                    <div className="mb-2">{techSpecs}</div>
                    <div className="font-semibold text-slate-500 text-[11px]">
                      Files: Screenshot 2026-07-18 153135.png
                    </div>
                  </td>
                  <td className="p-3 align-top text-xs text-slate-700">
                    <div><span className="font-semibold text-slate-500">Brand:</span> {brand}</div>
                    <div><span className="font-semibold text-slate-500">Make:</span> {make}</div>
                    <div><span className="font-semibold text-slate-500">Model:</span> {model}</div>
                    <div><span className="font-semibold text-slate-500">Alt Allowed:</span> {altAllowed}</div>
                  </td>
                  <td className="p-3 align-top text-xs text-slate-700">
                    <div><span className="font-semibold text-slate-500">HSN:</span> {hsn}</div>
                    <div><span className="font-semibold text-slate-500">SAC:</span> {sac}</div>
                    <div><span className="font-semibold text-slate-500">GST:</span> {gst}</div>
                  </td>
                  <td className="p-3 align-top">
                    <div className="font-black text-slate-900">{item.quantity || 1}</div>
                    <div className="text-xs font-semibold text-slate-500">{item.unitOfMeasure || item.unit || 'Nos'}</div>
                  </td>
                  <td className="p-3 align-top text-right font-bold text-slate-800">{formatCurrency(unitPrice)}</td>
                  <td className="p-3 align-top text-right font-black text-slate-900">{formatCurrency(totalPrice)}</td>
                  <td className="p-3 align-top text-xs text-center text-slate-700">
                    <div><span className="font-semibold block text-slate-500">Delivery:</span> -</div>
                    <div className="mt-1"><span className="font-semibold block text-slate-500">Warranty:</span> -</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── 4. TWO-COLUMN GRID: DELIVERY & CONSIGNEE & SUPPLIER CONFIGURATION ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DELIVERY & CONSIGNEE */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-2">
          <SectionHeading title="DELIVERY & CONSIGNEE" />
          <div className="space-y-0.5">
            <InfoRow label="DELIVERY LOCATION" value={locationText} />
            <InfoRow label="DELIVERY PERIOD" value={basics.requiredByDate ? formatDateString(basics.requiredByDate) : '—'} />
            <InfoRow label="CONSIGNEE NAME" value={consigneeDetails[0]?.name || contactName} />
            <InfoRow label="TOTAL QUANTITY" value={consigneeDetails[0]?.quantity || rcData.quantity || '2'} />
            <InfoRow label="INSTALLATION ADDRESS" value={consigneeDetails[0]?.location || consigneeDetails[0]?.address || locationText} />
          </div>
        </div>

        {/* SUPPLIER CONFIGURATION & ELIGIBILITY */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-2">
          <SectionHeading title="SUPPLIER CONFIGURATION & ELIGIBILITY" />
          <div className="space-y-0.5">
            <InfoRow label="VENDOR SELECTION" value={vendors.selection || 'Open'} />
            <InfoRow label="STARTUP/MSME PREF." value={vendors.msmePreference !== false ? 'Yes' : 'No'} />
            <InfoRow label="EXCLUDE BLACKLISTED" value={vendors.excludeBlacklisted !== false ? 'Yes' : 'No'} />
            <InfoRow label="EXPERIENCE REQ." value={serviceDetails.experienceRequired ? `${serviceDetails.experienceRequired} Years` : '0'} />
          </div>
        </div>
      </div>

      {/* ── 5. TWO-COLUMN GRID: EVALUATION BASIS & FINANCIAL REQUIREMENTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* EVALUATION BASIS */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-2">
          <SectionHeading title="EVALUATION BASIS" />
          <div className="space-y-0.5">
            <InfoRow label="EVALUATION METHOD" value={evaluation.method || 'L1 total value'} />
            <InfoRow label="TECHNICAL WEIGHT" value={evaluation.techWeight ? `${evaluation.techWeight}%` : '70%'} />
            <InfoRow label="COMMERCIAL WEIGHT" value={evaluation.commWeight ? `${evaluation.commWeight}%` : '30%'} />
            <InfoRow label="MIN QUAL MARKS" value={evaluation.minQualifyingMarks || '60'} />
            <InfoRow label="TECH SPECS" value="Refer to BOQ Details or Uploaded Documents" />
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">TECHNICAL CRITERIA</h3>
            <ul className="space-y-2 text-xs text-slate-700">
              <li className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 font-semibold">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Company credentials (%)
                </div>
                <div className="pl-3.5 text-[11px] text-slate-500">Years of operation, certifications, experience.</div>
              </li>
              <li className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 font-semibold">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Technical compliance (%)
                </div>
                <div className="pl-3.5 text-[11px] text-slate-500">Compliance score based on technical specification sheet.</div>
              </li>
              <li className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 font-semibold">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Past performance rating (%)
                </div>
                <div className="pl-3.5 text-[11px] text-slate-500">Seller platform rating and past order delivery.</div>
              </li>
            </ul>
          </div>
        </div>

        {/* FINANCIAL REQUIREMENTS */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-2">
          <SectionHeading title="FINANCIAL REQUIREMENTS" />
          <div className="space-y-0.5">
            <InfoRow label="ESTIMATED VALUE" value={formatCurrency(rcData.estimatedValue || 3000)} />
            <InfoRow label="EMD AMOUNT" value={rcData.isEmdRequired === false ? 'Exempted' : (rcData.emdAmount ? formatCurrency(rcData.emdAmount) : '₹50')} />
            <InfoRow label="PAYMENT TERMS" value={paymentTermsText} />
            <InfoRow label="GST INCLUDED" value={terms.gstIncluded ? 'Yes' : 'No'} />
            <InfoRow label="FREIGHT INCLUDED" value={terms.freightIncluded !== false ? 'Yes' : 'No'} />
          </div>
        </div>
      </div>

      {/* ── 6. TWO-COLUMN GRID: REQUIRED SELLER DOCUMENTS & TERMS & CONDITIONS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* REQUIRED SELLER DOCUMENTS */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
          <SectionHeading title="REQUIRED SELLER DOCUMENTS" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {reqDocsList.map((doc, idx) => (
              <div key={idx} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs font-bold text-slate-800">
                <FileText className="h-4 w-4 text-indigo-600 shrink-0" />
                <span className="truncate">{doc.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* TERMS & CONDITIONS */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-2">
          <SectionHeading title="TERMS & CONDITIONS" />
          <div className="space-y-0.5">
            <InfoRow label="WITHDRAWAL" value="Allowed" />
            <InfoRow label="REVISION" value="Allowed" />
          </div>
        </div>
      </div>

      {/* ── Clarifications & Q&A Panel ── */}
      {rcData && (
        <ClarificationPanel
          quoteRequestId={rcData.id}
          kind={rcData?.sourceModel === 'REQUIREMENT' || !!requirementId ? 'requirement' : 'quote-request'}
          role="seller"
        />
      )}
    </div>
  );
}
