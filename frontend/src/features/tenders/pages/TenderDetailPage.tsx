'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import {
  Download,
  Calendar,
  Building2,
  ChevronRight,
  Loader2,
  FileText,
  ShieldCheck,
  CheckCircle,
  ArrowRight,
  Info,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { getApi, peekApi } from '../../shared/apiClient';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { openFileAsset } from '../../../lib/files';
import { PdfEngine } from '../../../lib/pdfEngine';
import { api } from '../../../lib/api';
import { ProcurementDetailUnifiedView } from '../../rfq/components/ProcurementDetailUnifiedView';

// --- Types ---
interface TenderDetail {
  id: number;
  tenderId: string;
  title: string;
  category: string;
  subCategory?: string;
  budget: number;
  description: string;
  status: string;
  statusEnum?: string;
  visibility?: string;
  publishedAt?: string | Date;
  closesAt?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  paymentTerms?: string;
  deliveryType?: string;
  itemCondition?: string;
  bidValidityDays?: number;
  emdAmount?: number;
  evaluationMethod?: string;
  buyerId?: number;
  buyer?: {
    id: number;
    name: string;
    email: string;
    buyerProfile?: {
      id: number;
      organizationName?: string;
      department?: string;
      contactPerson?: string;
      email?: string;
      phone?: string;
      address?: string;
      state?: string;
      district?: string;
      pincode?: string;
    };
  };
  tenderItems?: Array<{
    id: number;
    itemName: string;
    quantity: number;
    unitOfMeasure: string;
    description?: string;
    estimatedUnitPrice?: number;
    estimatedTotal?: number;
    technicalSpecification?: string;
    brand?: string;
    make?: string;
    model?: string;
    hsn?: string;
    sac?: string;
    warranty?: string;
    deliverySchedule?: string;
    gst?: number;
    alternateBrandAllowed?: boolean;
    uploadedSpecificationFiles?: any;
  }>;
  tenderDocuments?: Array<{
    id: number;
    documentType: string;
    title?: string;
    fileAsset?: {
      id: number;
      originalName: string;
    };
    url?: string;
  }>;
  activitySnapshot?: {
    totalQueries?: number;
    totalResponses?: number;
    totalViews?: number;
    interestedSuppliers?: number;
  };
  isEmdRequired?: boolean;
  documentFee?: number;
  allowClarification?: boolean;
  allowReverseAuction?: boolean;
  allowBoq?: boolean;
  packetType?: string;
  technicalPacket?: any;
  financialPacket?: any;
  termsAndConditions?: string[];
  eligibilityCriteria?: string[];
  requiredDocuments?: string[];
  technicalOpeningDate?: string | Date;
  financialOpeningDate?: string | Date;
  bidValidityDate?: string | Date;
}

export default function TenderDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || '';
  const { user } = useAuth();
  const tenderRef = searchParams?.get('tender') || '';

  const [tender, setTender] = useState<TenderDetail | null>(() => tenderRef ? peekApi<TenderDetail>(`/api/tenders/${tenderRef}`) : null);
  const [loading, setLoading] = useState(!tender);

  useEffect(() => {
    if (!tenderRef) {
      setLoading(false);
      return;
    }

    const fetchTenderDetails = async () => {
      try {
        if (!tender) setLoading(true);
        const data = await getApi<TenderDetail>(`/api/tenders/${tenderRef}`);
        setTender(data);
      } catch (err: any) {
        console.error(err);
        if (!tender) toast.error('Failed to load tender details');
      } finally {
        setLoading(false);
      }
    };

    fetchTenderDetails();
  }, [tenderRef]);

  const formatCurrency = (val?: number) => {
    if (!val && val !== 0) return '—';
    return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
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
        let hours = d.getHours();
        const minutes = d.getMinutes().toString().padStart(2, '0');
        const ampm = 'IST';
        const formattedHours = hours.toString().padStart(2, '0');
        base += ` ${formattedHours}:${minutes} ${ampm}`;
      }
      return base;
    } catch {
      return String(dateStr);
    }
  };

  if (loading && !tender) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Page Header Skeleton */}
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 bg-slate-200 rounded"></div>
          <div className="h-8 w-2/3 bg-slate-200 rounded"></div>
          <div className="h-4 w-1/2 bg-slate-200 rounded"></div>
        </div>

        {/* KPI Cards Skeleton Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="h-3 w-20 bg-slate-200 rounded"></div>
                <div className="h-8 w-8 rounded-full bg-slate-200"></div>
              </div>
              <div className="h-6 w-28 bg-slate-200 rounded"></div>
              <div className="h-3 w-16 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>

        {/* Detail Sections Skeleton */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
              <div className="h-5 w-40 bg-slate-200 rounded"></div>
              <div className="h-4 w-full bg-slate-200 rounded"></div>
              <div className="h-4 w-5/6 bg-slate-200 rounded"></div>
              <div className="h-4 w-4/6 bg-slate-200 rounded"></div>
            </div>
            <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
              <div className="h-5 w-48 bg-slate-200 rounded"></div>
              <div className="h-20 w-full bg-slate-200 rounded"></div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
              <div className="h-5 w-36 bg-slate-200 rounded"></div>
              <div className="h-4 w-full bg-slate-200 rounded"></div>
              <div className="h-4 w-3/4 bg-slate-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!tender) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
          <FileText className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-black text-slate-900">Tender Not Found</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          We couldn't retrieve details for tender reference "{tenderRef}". Please verify the URL or link.
        </p>
        <div className="mt-6">
          <Button onClick={() => router.back()} className="bg-[#12335f] text-xs font-black uppercase text-white hover:bg-[#0b2445]">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const rawTenderTitles = [
    tender.title,
    tender.technicalPacket?.basics?.title,
    tender.description && tender.description.length < 80 ? tender.description : null,
  ];
  const validTenderTitle = rawTenderTitles.find(t => {
    if (!t) return false;
    const s = String(t).trim().toLowerCase();
    return !(s === 'procurement bid' || s.startsWith('procurement bid #') || s.startsWith('procurement #') || s === 'untitled procurement bid' || s === 'procurement requirement' || s === 'n/a' || s === '—');
  });
  const tenderIdString = tender.tenderId || 'N/A';
  const title = validTenderTitle ? String(validTenderTitle).trim() : (tenderIdString !== 'N/A' ? `Tender #${tenderIdString}` : 'Procurement Tender');
  const publishedDateFormatted = formatDateString(tender.publishedAt);
  const closesAtFormatted = formatDateString(tender.closesAt, true);
  const orgName = tender.buyer?.buyerProfile?.organizationName || tender.buyer?.name || 'N/A';

  const handleParticipate = () => {
    router.push(`/bids/${tender.id}/participate`);
  };

  const handlePreviewDoc = (doc: any) => {
    const fileId = doc.fileAsset?.id || doc.id;
    if (!fileId) {
      toast.error('File ID not found');
      return;
    }
    openFileAsset({
      id: fileId,
      fileAssetId: fileId,
      originalName: doc.title || doc.fileAsset?.originalName || 'document',
      url: doc.url
    }, doc.title || doc.fileAsset?.originalName || 'Document').catch((err: any) => {
      toast.error(err instanceof Error ? err.message : 'Unable to open document');
    });
  };

  const handleDownloadDoc = async (doc: any) => {
    const fileId = doc.fileAsset?.id || doc.id;
    if (!fileId) {
      toast.error('File ID not found');
      return;
    }
    const toastId = toast.loading('Downloading document...');
    try {
      const res = await api.fetch(`/api/files/${fileId}/view`, { method: 'GET', skipCache: true });
      if (!res.ok) throw new Error('Failed to download file');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = doc.title || doc.fileAsset?.originalName || 'document';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success('Download complete', { id: toastId });
    } catch (err) {
      toast.error('Failed to download document', { id: toastId });
    }
  };

  const InfoRow = ({ label, value, red }: { label: string; value: any; red?: boolean }) => {
    if (value === undefined || value === null || value === '' || value === 'N/A' || value === 'Not Applicable' || value === 'Not Required' || value === 'Not Allowed') return null;
    return (
      <div className="grid grid-cols-3 items-start gap-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider col-span-1">{label}</span>
        <span className={cn("text-sm font-semibold col-span-2", red ? "text-red-600" : "text-slate-800")}>{value}</span>
      </div>
    );
  };

  const SectionHeading = ({ title }: { title: string }) => (
    <h2 className="text-sm font-black text-[#12335f] pb-3 border-b-2 border-[#12335f]/10 uppercase tracking-widest mb-4 flex items-center gap-2">
      <div className="w-1.5 h-4 bg-[#12335f] rounded-full" />
      {title}
    </h2>
  );

  const draft = tender.technicalPacket || {};
  const basics = draft.basics || {};
  const internal = draft.internal || {};
  const vendors = draft.vendors || {};
  const schedule = draft.schedule || {};
  const terms = draft.terms || {};
  const evaluation = draft.evaluation || {};
  const approval = draft.approval || {};
  const serviceDetails = draft.serviceDetails || {};
  const consigneeDetails = draft.consigneeDetails || [];
  const auctionConfig = draft.auctionConfig || {};

  const tenderItems = (tender.tenderItems || []).map((it, idx) => ({
    id: it.id || idx + 1,
    name: it.itemName,
    quantity: it.quantity,
    unit: it.unitOfMeasure,
    specification: it.technicalSpecification || it.description,
    brand: it.brand || it.make,
    estimatedUnitPrice: it.estimatedUnitPrice,
    estimatedTotal: it.estimatedTotal,
    warranty: it.warranty,
  }));

  const tenderDocs = (tender.tenderDocuments || []).map((doc, idx) => ({
    id: doc.id || idx + 1,
    name: doc.title || doc.fileAsset?.originalName || `Document ${idx + 1}`,
    meta: doc.documentType || 'Tender Document',
    fileAssetId: doc.fileAsset?.id,
    url: doc.url,
    required: true,
  }));

  return (
    <ProcurementDetailUnifiedView
      procurementType={tender.category?.includes('LIMITED') || tender.visibility === 'LIMITED' ? 'LIMITED_TENDER' : 'OPEN_TENDER'}
      procurementLabel={tender.category?.includes('LIMITED') || tender.visibility === 'LIMITED' ? 'Limited Tender' : 'Open Tender'}
      id={tender.id}
      displayId={tenderIdString}
      subject={title}
      status={tender.status || 'OPEN'}
      buyerName={tender.buyer?.buyerProfile?.contactPerson || tender.buyer?.name}
      orgName={orgName}
      buyer={tender.buyer}
      estimatedValue={tender.budget}
      deadlineDate={tender.closesAt}
      createdAt={tender.publishedAt || tender.createdAt}
      publishedDate={publishedDateFormatted}
      closingDate={closesAtFormatted}
      clarificationDate={schedule.clarificationDeadline ? formatDateString(schedule.clarificationDeadline, true) : undefined}
      technicalDate={schedule.technicalOpeningDate ? formatDateString(schedule.technicalOpeningDate, true) : undefined}
      financialDate={schedule.financialOpeningDate ? formatDateString(schedule.financialOpeningDate, true) : undefined}
      bidValidityDate={schedule.bidValidityDate ? formatDateString(schedule.bidValidityDate) : undefined}
      requiredByDate={basics.requiredByDate ? formatDateString(basics.requiredByDate) : ((tender as any).deliveryDate ? formatDateString((tender as any).deliveryDate) : undefined)}
      category={tender.category}
      procurementMethod={tender.visibility === 'LIMITED' ? 'Limited Tender' : 'Open Tender'}
      buyingType={basics.buyingType || 'Goods'}
      deliveryLocation={basics.deliveryLocation || internal.deliveryAddress || tender.buyer?.buyerProfile?.address}
      paymentTerms={tender.paymentTerms || terms.paymentTerms}
      deliveryTerms={tender.deliveryType || terms.deliveryTerms}
      description={tender.description}
      payload={draft}
      documents={tenderDocs}
      items={tenderItems}
      evaluationMethod={
        [
          draft.evaluation?.method,
          draft.evaluation?.evaluationMethod,
          draft.evaluationMethod,
          draft.rules?.evaluationMethod,
          tender.evaluationMethod,
        ].find(c => typeof c === 'string' && c.trim().length > 0 && !['l1', 'l1 basis', 'l1 evaluation'].includes(c.trim().toLowerCase())) ||
        tender.evaluationMethod ||
        'L1 Basis'
      }
      emdAmount={tender.emdAmount}
      isEmdRequired={Boolean(tender.emdAmount && tender.emdAmount > 0)}
      backRoute={user?.role === 'seller' ? '/seller/opportunities' : '/buyer/tenders'}
      backRouteLabel="Tender Opportunities"
      submitButtonLabel="Submit Tender Proposal"
      onSubmitClick={handleParticipate}
    />
  );
}
