'use client';

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  Info,
  Layers,
  Loader2,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../hooks/useAuth';
import { openFileAsset } from '../../../lib/files';
import { cn } from '../../../lib/utils';
import { getApi } from '../../shared/apiClient';
import { procurementBidApi } from '../../procurementBid/api';
import ClarificationPanel from '../components/ClarificationPanel';

type IconComponent = React.ComponentType<{ className?: string }>;
type Tone = 'slate' | 'emerald' | 'rose' | 'amber' | 'sky' | 'indigo' | 'violet';

type DisplayDocument = {
  id?: string | number;
  name: string;
  meta?: string;
  fileAssetId?: string | number;
  url?: string;
  required?: boolean;
};

const toneStyles: Record<Tone, { card: string; icon: string; text: string; badge: string }> = {
  slate: {
    card: 'border-slate-200 bg-white',
    icon: 'bg-slate-100 text-slate-700',
    text: 'text-slate-900',
    badge: 'border-slate-200 bg-slate-50 text-slate-700',
  },
  emerald: {
    card: 'border-emerald-200 bg-emerald-50',
    icon: 'bg-emerald-100 text-emerald-700',
    text: 'text-emerald-950',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  rose: {
    card: 'border-rose-200 bg-rose-50',
    icon: 'bg-rose-100 text-rose-700',
    text: 'text-rose-950',
    badge: 'border-rose-200 bg-rose-50 text-rose-700',
  },
  amber: {
    card: 'border-amber-200 bg-amber-50',
    icon: 'bg-amber-100 text-amber-700',
    text: 'text-amber-950',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  sky: {
    card: 'border-sky-200 bg-sky-50',
    icon: 'bg-sky-100 text-sky-700',
    text: 'text-sky-950',
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  indigo: {
    card: 'border-indigo-200 bg-indigo-50',
    icon: 'bg-indigo-100 text-indigo-700',
    text: 'text-indigo-950',
    badge: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  },
  violet: {
    card: 'border-violet-200 bg-violet-50',
    icon: 'bg-violet-100 text-violet-700',
    text: 'text-violet-950',
    badge: 'border-violet-200 bg-violet-50 text-violet-700',
  },
};

const noisyDetailKeys = new Set([
  '_id',
  'assetId',
  'createdById',
  'deletedAt',
  'draftMeta',
  'fileAssetId',
  'id',
  'originalPayload',
  'password',
  'payloadSnapshot',
  'raw',
  'rawPayload',
  'sourcePayload',
  'technicalPacket',
  'token',
  'updatedById',
]);

const preferredArrayColumns = [
  'itemName',
  'name',
  'title',
  'description',
  'scopeOfWork',
  'quantity',
  'unit',
  'unitOfMeasure',
  'estimatedUnitPrice',
  'price',
  'amount',
  'technicalSpecification',
  'specification',
  'specifications',
  'fileName',
  'documentType',
];

const knownPayloadKeys = new Set([
  'approval',
  'approvalStatus',
  'auctionConfig',
  'basics',
  'boq',
  'boqFileAssetId',
  'boqFileName',
  'boqTable',
  'buyerType',
  'buyingType',
  'consigneeDetails',
  'documents',
  'draftStep',
  'evaluation',
  'fullProcurementMethod',
  'id',
  'internal',
  'items',
  'limitedTenderJustification',
  'linkedProcurementBidId',
  'linkedProcurementBidNumber',
  'questionnaire',
  'rateContract',
  'rateContractConfig',
  'recommendation',
  'requireDemo',
  'requiredDocs',
  'requirementId',
  'requirementNumber',
  'rfqType',
  'rules',
  'schedule',
  'sealedSubmissionFlag',
  'serviceDetails',
  'sourceRequirementId',
  'tender',
  'tenderType',
  'terms',
  'type',
  'updatedAt',
  'vendors',
  'workflowStatus',
]);

const seedRfps: Record<number, any> = {
  100: {
    title: '[SEED] Implementation of Cloud-Based Inventory System',
    number: 'SEED-BID-RFP-100-8451',
    category: 'IT & Computer Equipment',
    subCategory: 'Cloud Inventory',
    estimatedValue: 7500000,
    scope: 'Sourcing a cloud-based inventory tracking and storage reconciliation platform integrated with internal ERP modules.',
    buyerOrg: 'Govt. Buyer Org',
    contactPerson: 'M. R. Patnaik',
    email: 'tenders@govorg.in',
    phone: '+91 94370 67890',
    address: 'Secretariat Main Annex, Bhubaneswar - 751001, Odisha',
    location: 'Mumbai, Maharashtra',
    publishedDate: '16 Jul 2026',
    closingDate: '26 Jul 2026 05:00 PM',
    clarificationDate: '15 Jul 2026 11:00 AM',
    technicalDate: '30 Sep 2026',
    presentationDate: '05 Aug 2026',
    financialDate: '30 Sep 2026',
    awardDate: '10 Aug 2026 (Tentative)',
    responses: 9,
  },
  101: {
    title: '[SEED] Structural Design Consultancy for Nagpur Plant',
    number: 'SEED-BID-RFP-101-9214',
    category: 'Engineering Services',
    subCategory: 'Structural Design',
    estimatedValue: 1800000,
    scope: 'Consultancy contract for designing the load bearing structural framework of Nagpur factory assembly plant expansion.',
    buyerOrg: 'Govt. Buyer Org',
    contactPerson: 'M. R. Patnaik',
    email: 'tenders@govorg.in',
    phone: '+91 94370 67890',
    address: 'Secretariat Main Annex, Bhubaneswar - 751001, Odisha',
    location: 'Mumbai, Maharashtra',
    publishedDate: '16 Jul 2026',
    closingDate: '28 Jul 2026 05:00 PM',
    clarificationDate: '17 Jul 2026 11:00 AM',
    technicalDate: '28 Jul 2026 - 05 Aug 2026',
    presentationDate: '07 Aug 2026',
    financialDate: '08 Aug 2026 - 11 Aug 2026',
    awardDate: '12 Aug 2026 (Tentative)',
    responses: 4,
  },
  102: {
    title: '[SEED] Hazardous Chemical Waste Disposal Service',
    number: 'SEED-BID-RFP-102-7634',
    category: 'Environmental Services',
    subCategory: 'Waste Management',
    estimatedValue: 2400000,
    scope: 'Safe disposal, packaging, logistics, and compliance reporting of hazardous chemical byproducts from manufacturing plant.',
    buyerOrg: 'Govt. Buyer Org',
    contactPerson: 'M. R. Patnaik',
    email: 'tenders@govorg.in',
    phone: '+91 94370 67890',
    address: 'Secretariat Main Annex, Bhubaneswar - 751001, Odisha',
    location: 'Mumbai, Maharashtra',
    publishedDate: '16 Jul 2026',
    closingDate: '30 Jul 2026 05:00 PM',
    clarificationDate: '19 Jul 2026 11:00 AM',
    technicalDate: '30 Jul 2026 - 07 Aug 2026',
    presentationDate: '09 Aug 2026',
    financialDate: '10 Aug 2026 - 13 Aug 2026',
    awardDate: '15 Aug 2026 (Tentative)',
    responses: 7,
  },
  103: {
    title: '[SEED] Warehouse Robot Sorting Automation Integration',
    number: 'SEED-BID-RFP-103-3482',
    category: 'Automation & Robotics',
    subCategory: 'Robotics Sorting',
    estimatedValue: 9500000,
    scope: 'Integration and programming of automated robotic arm sorting systems along shipping conveyors in main sorting zone.',
    buyerOrg: 'Govt. Buyer Org',
    contactPerson: 'M. R. Patnaik',
    email: 'tenders@govorg.in',
    phone: '+91 94370 67890',
    address: 'Secretariat Main Annex, Bhubaneswar - 751001, Odisha',
    location: 'Mumbai, Maharashtra',
    publishedDate: '16 Jul 2026',
    closingDate: '02 Aug 2026 05:00 PM',
    clarificationDate: '15 Jul 2026 11:00 AM',
    technicalDate: '30 Sep 2026',
    presentationDate: '05 Aug 2026',
    financialDate: '30 Sep 2026',
    awardDate: '10 Aug 2026 (Tentative)',
    responses: 15,
  },
  104: {
    title: '[SEED] Annual Maintenance Contract for HVAC Systems',
    number: 'SEED-BID-RFP-104-5109',
    category: 'Maintenance Services',
    subCategory: 'HVAC AMC',
    estimatedValue: 1500000,
    scope: 'Annual Maintenance Contract for heavy industrial centralized ventilation, air filter chambers, and HVAC overhauls.',
    buyerOrg: 'Govt. Buyer Org',
    contactPerson: 'M. R. Patnaik',
    email: 'tenders@govorg.in',
    phone: '+91 94370 67890',
    address: 'Secretariat Main Annex, Bhubaneswar - 751001, Odisha',
    location: 'Mumbai, Maharashtra',
    publishedDate: '16 Jul 2026',
    closingDate: '04 Aug 2026 05:00 PM',
    clarificationDate: '15 Jul 2026 11:00 AM',
    technicalDate: '30 Sep 2026',
    presentationDate: '05 Aug 2026',
    financialDate: '30 Sep 2026',
    awardDate: '10 Aug 2026 (Tentative)',
    responses: 15,
  },
};

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function isNoisyDetailKey(key: string) {
  const normalized = key.toLowerCase();
  return (
    noisyDetailKeys.has(key) ||
    normalized.includes('draftmeta') ||
    normalized.includes('rawpayload') ||
    normalized.includes('payloadsnapshot')
  );
}

function isPresentValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (Array.isArray(value)) return value.some(isPresentValue);
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return true;
}

function detailEntries(source: unknown) {
  if (!isPlainObject(source)) return [] as Array<[string, any]>;
  return Object.entries(source).filter(([key, value]) => !isNoisyDetailKey(key) && hasDetailData(value));
}

function hasDetailData(value: unknown): boolean {
  if (!isPresentValue(value)) return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  if (Array.isArray(value)) return value.some(hasDetailData);
  if (isPlainObject(value)) return detailEntries(value).length > 0;
  return true;
}

function compactObject(source: Record<string, any>) {
  return Object.fromEntries(Object.entries(source).filter(([, value]) => hasDetailData(value)));
}

function firstPresent<T = any>(...values: T[]): T | undefined {
  return values.find(value => hasDetailData(value));
}

function asArray(value: any): any[] {
  if (!hasDetailData(value)) return [];
  return Array.isArray(value) ? value : [value];
}

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function parseDateValue(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const trimmed = String(value).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateString(value?: string | Date | null, includeTime = false) {
  if (!value) return 'N/A';

  const parsed = parseDateValue(value);
  if (!parsed) return String(value);

  const day = String(parsed.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const datePart = `${day} ${months[parsed.getMonth()]} ${parsed.getFullYear()}`;
  const hasExplicitTime = value instanceof Date || /T|\d{1,2}:\d{2}/.test(String(value));

  if (!includeTime || !hasExplicitTime) return datePart;

  let hours = parsed.getHours();
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${datePart} ${String(hours).padStart(2, '0')}:${minutes} ${suffix}`;
}

function formatCurrency(value?: number | string | null) {
  if (value === undefined || value === null || value === '') return 'N/A';
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return 'N/A';
  return `INR ${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatPrimitiveValue(value: unknown, key = ''): string {
  if (!hasDetailData(value)) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) return formatDateString(value, true);

  const keyLower = key.toLowerCase();
  if (typeof value === 'number') {
    if (/(amount|budget|cost|deposit|fee|price|rate|value)/i.test(keyLower)) {
      return formatCurrency(value);
    }
    return value.toLocaleString('en-IN');
  }

  const text = String(value).trim();
  if (!text) return 'N/A';

  if (/(date|deadline|opening|closing|submitted|published|updated|created|start|end|validity|time)/i.test(keyLower)) {
    const parsed = parseDateValue(text);
    if (parsed) return formatDateString(text, /time|deadline|closing|opening/i.test(keyLower));
  }

  if (/^[A-Z0-9_ -]+$/.test(text) && /[_-]/.test(text)) {
    return humanizeKey(text.toLowerCase());
  }

  return text;
}

function getArrayColumns(items: Record<string, any>[]) {
  const columns = new Set<string>();
  items.forEach(item => {
    detailEntries(item).forEach(([key]) => columns.add(key));
  });

  return Array.from(columns)
    .sort((a, b) => {
      const aIndex = preferredArrayColumns.indexOf(a);
      const bIndex = preferredArrayColumns.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    })
    .slice(0, 9);
}

function getStatusTone(status?: string): Tone {
  const normalized = String(status || '').toLowerCase();
  if (/open|active|publish|approved|live/.test(normalized)) return 'emerald';
  if (/close|cancel|reject|expire|lost/.test(normalized)) return 'rose';
  if (/evaluation|pending|draft|review|progress/.test(normalized)) return 'amber';
  return 'slate';
}

function DetailValue({ value, valueKey = '', depth = 0 }: { value: any; valueKey?: string; depth?: number }) {
  if (!hasDetailData(value)) {
    return <span className="text-slate-400">N/A</span>;
  }

  if (Array.isArray(value)) {
    const values = value.filter(hasDetailData);
    if (!values.length) return <span className="text-slate-400">N/A</span>;

    if (values.every(isPlainObject)) {
      const columns = getArrayColumns(values as Record<string, any>[]);
      return (
        <div className={cn('grid gap-3', depth > 0 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2')}>
          {values.map((item, index) => (
            <div key={item.id || item._id || `${valueKey}-${index}`} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {humanizeKey(valueKey || 'Entry')} {index + 1}
                </span>
                {item.quantity && (
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-700">
                    Qty {formatPrimitiveValue(item.quantity, 'quantity')}
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {columns.map(column => (
                  <div key={column} className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{humanizeKey(column)}</p>
                    <div className="mt-0.5 text-xs font-semibold leading-relaxed text-slate-800">
                      <DetailValue value={item[column]} valueKey={column} depth={depth + 1} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="flex flex-wrap gap-2">
        {values.map((item, index) => (
          <span key={`${valueKey}-${index}`} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700">
            {formatPrimitiveValue(item, valueKey)}
          </span>
        ))}
      </div>
    );
  }

  if (isPlainObject(value)) {
    const entries = detailEntries(value);
    if (!entries.length) return <span className="text-slate-400">N/A</span>;

    return (
      <div className={cn('grid gap-2', depth > 0 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
        {entries.map(([key, nestedValue]) => (
          <div key={key} className="min-w-0 rounded-lg bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{humanizeKey(key)}</p>
            <div className="mt-1 text-xs font-semibold leading-relaxed text-slate-800">
              <DetailValue value={nestedValue} valueKey={key} depth={depth + 1} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return <span className="whitespace-pre-wrap break-words">{formatPrimitiveValue(value, valueKey)}</span>;
}

function SectionHeader({ title, icon: Icon }: { title: string; icon: IconComponent }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="text-base font-black uppercase tracking-wide text-slate-950">{title}</h2>
    </div>
  );
}

function FieldCard({ label, value, className }: { label: string; value: any; className?: string }) {
  if (!hasDetailData(value)) return null;
  const isComplex = Array.isArray(value) || isPlainObject(value);

  return (
    <article className={cn('min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm', isComplex && 'sm:col-span-2 xl:col-span-3', className)}>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <div className="mt-2 text-sm font-semibold leading-relaxed text-slate-900">
        <DetailValue value={value} valueKey={label} />
      </div>
    </article>
  );
}

function DetailSection({ title, icon, data }: { title: string; icon: IconComponent; data: any }) {
  if (!hasDetailData(data)) return null;

  const entries = Array.isArray(data) ? [] : detailEntries(data);

  return (
    <section className="space-y-3">
      <SectionHeader title={title} icon={icon} />
      {Array.isArray(data) ? (
        <DetailValue value={data} valueKey={title} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map(([key, value]) => (
            <FieldCard key={key} label={humanizeKey(key)} value={value} />
          ))}
        </div>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  icon: IconComponent;
  tone: Tone;
}) {
  const styles = toneStyles[tone];

  return (
    <article className={cn('min-h-[118px] rounded-lg border p-4 shadow-sm', styles.card)}>
      <div className="flex items-center justify-between gap-3">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', styles.icon)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <div className={cn('mt-1 break-words text-lg font-black leading-tight', styles.text)}>{value || 'N/A'}</div>
    </article>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const tone = getStatusTone(status);
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider', toneStyles[tone].badge)}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {status || 'Published'}
    </span>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-slate-500">
      {message}
    </div>
  );
}

function normalizeDocument(doc: any, index: number): DisplayDocument {
  if (typeof doc === 'string') {
    return {
      id: `doc-${index}`,
      name: doc,
      meta: 'Required document',
      required: true,
    };
  }

  const fileUrl = doc?.fileUrl || doc?.url || doc?.documentUrl || doc?.downloadUrl;
  let fileAssetId = doc?.fileAssetId;
  if (!fileAssetId && fileUrl) {
    const match = String(fileUrl).match(/\/api\/(?:public\/)?files\/(\d+)/);
    if (match?.[1]) fileAssetId = match[1];
  }

  const documentType = firstPresent(doc?.documentType, doc?.type, doc?.category);
  const mimeType = firstPresent(doc?.mimeType, doc?.contentType);

  return {
    id: firstPresent(doc?.id, doc?.fileAssetId, `doc-${index}`),
    name: firstPresent(doc?.name, doc?.title, doc?.originalName, doc?.fileName, documentType, `Document ${index + 1}`) as string,
    meta: [documentType, mimeType].filter(Boolean).join(' - ') || 'Uploaded document',
    fileAssetId,
    url: fileUrl,
    required: String(documentType || '').toUpperCase() === 'REQUIRED',
  };
}

function uniqueDocuments(documents: DisplayDocument[]) {
  const seen = new Set<string>();
  return documents.filter(doc => {
    const key = String(doc.fileAssetId || doc.url || doc.id || doc.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function RfpDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || '';
  const { user } = useAuth();
  const currentUser: any = user;

  const requestId = searchParams?.get('requestId') || searchParams?.get('id') || '';
  const requirementId = searchParams?.get('requirementId') || '';
  const seedProfile = seedRfps[Number(requestId)] || null;

  const { data: bidData, isLoading: bidLoading, error: bidError } = useQuery({
    queryKey: ['procurement-bid-rfp-detail', requestId],
    queryFn: () => procurementBidApi.detail(requestId),
    enabled: !!requestId,
  });

  const { data: reqData, isLoading: reqLoading, error: reqError } = useQuery({
    queryKey: ['marketplace-requirement-rfp-detail', requirementId, currentUser?.role],
    queryFn: async () => {
      const ownerEndpoint = `/api/requirements/${requirementId}`;
      const marketplaceEndpoint = `/api/marketplace/requirements/${requirementId}`;

      if (currentUser?.role === 'buyer') {
        try {
          return await getApi<any>(ownerEndpoint, true);
        } catch {
          return getApi<any>(marketplaceEndpoint, true);
        }
      }

      return getApi<any>(marketplaceEndpoint, true);
    },
    enabled: !!requirementId,
  });

  const bidSourceRequirementId = (bidData as any)?.sourceModel === 'REQUIREMENT' ? (bidData as any)?.sourceId : null;
  const { data: bidRequirementData } = useQuery({
    queryKey: ['marketplace-requirement-rfp-ownresponse', bidSourceRequirementId, currentUser?.role],
    queryFn: () => getApi<any>(`/api/marketplace/requirements/${bidSourceRequirementId}`, true),
    enabled: !!requestId && !!bidSourceRequirementId && currentUser?.role === 'seller',
    staleTime: 30_000,
  });

  const isLoading = (!!requestId && bidLoading) || (!!requirementId && reqLoading);
  const reqObj: any = (reqData as any)?.requirement || reqData;
  const ownParticipation = currentUser?.role === 'seller'
    ? ((bidData as any)?.participations || []).find((participation: any) =>
        Number(participation.sellerId) === Number(currentUser?.id) ||
        (currentUser?.organizationId && participation.seller?.organizationId === currentUser.organizationId)
      )
    : null;
  const ownResponse = (reqData as any)?.ownResponse || (bidRequirementData as any)?.ownResponse || null;
  const hasSubmittedProposal = Boolean(
    (ownParticipation && ['SUBMITTED', 'QUALIFIED', 'DISQUALIFIED'].includes(String(ownParticipation.submissionStatus || ownParticipation.status).toUpperCase())) ||
    (ownResponse && ['SUBMITTED', 'QUALIFIED', 'DISQUALIFIED'].includes(String(ownResponse.submissionStatus || ownResponse.status).toUpperCase()))
  );

  const bid: any = bidData;
  const rfpData: any = bid ? {
    id: bid.sourceId || bid.id,
    displayId: bid.id,
    sourceId: bid.sourceId,
    sourceModel: bid.sourceModel,
    subject: bid.title,
    buyer: bid.buyer || {
      name: bid.buyerName || '',
      email: bid.buyerEmail || '',
      mobile: bid.buyerMobile || '',
      buyerProfile: bid.buyerOrganization || null,
    },
    estimatedValue: bid.estimatedValue,
    deadlineDate: bid.endDate,
    createdAt: bid.startDate || bid.createdAt,
    status: bid.status,
    location: bid.deliveryLocation || bid.location,
    requirementNumber: bid.bidNumber || bid.referenceNumber || bid.id,
    paymentTerms: bid.technicalPacket?.terms?.paymentTerms || bid.terms?.[0] || '',
    deliveryTerms: bid.technicalPacket?.terms?.deliveryTerms || bid.terms?.[1] || '',
    description: bid.description,
    payload: bid.technicalPacket || bid.payload || {},
    documents: bid.documents?.length ? bid.documents : (bid.bidDocuments || []),
    items: bid.items || bid.technicalPacket?.items || [],
    category: bid.category,
    buyerOrganization: bid.buyerOrganization || { organizationName: bid.buyerName || bid.buyerOrganizationName },
    buyerOrganizationName: bid.buyerName || bid.buyerOrganizationName,
    emdAmount: bid.emdAmount,
    isEmdRequired: bid.isEmdRequired,
    evaluationMethod: bid.evaluationMethod,
    technicalOpeningDate: bid.technicalOpeningDate,
    financialOpeningDate: bid.financialOpeningDate,
    participations: bid.participations || [],
    participantsCount: bid.participantsCount ?? bid.participations?.length,
    responsesCount: bid.participantsCount ?? bid.participations?.length,
    terms: bid.terms,
    eligibility: bid.eligibility,
  } : reqObj ? {
    id: reqObj.id,
    displayId: reqObj.requirementNumber || reqObj.id,
    sourceModel: 'REQUIREMENT',
    sourceId: reqObj.id,
    subject: reqObj.title || reqObj.description,
    buyer: {
      name: reqObj.buyerOrganization?.organizationName || reqObj.organization?.organizationName || reqObj.payload?.internal?.orgName || 'Buyer',
      email: reqObj.buyerEmail || reqObj.buyer?.email || reqObj.createdBy?.email || reqObj.payload?.internal?.email || '',
      mobile: reqObj.buyerMobile || reqObj.buyer?.mobile || reqObj.createdBy?.mobile || reqObj.payload?.internal?.mobile || '',
      buyerProfile: reqObj.buyerOrganization || reqObj.organization || reqObj.buyer?.buyerProfile,
    },
    estimatedValue: reqObj.estimatedValue || reqObj.budgetMax || reqObj.budgetMin || reqObj.payload?.basics?.estimatedValue,
    deadlineDate: reqObj.lastDate || reqObj.requiredBy || reqObj.payload?.schedule?.submissionDate || reqObj.payload?.tender?.bidClosingDate,
    createdAt: reqObj.createdAt,
    status: reqObj.status,
    tenders: reqObj.tenders,
    location: reqObj.location || reqObj.payload?.basics?.deliveryLocation || reqObj.payload?.internal?.deliveryAddress || reqObj.organization?.district || reqObj.buyerOrganization?.district,
    requirementNumber: reqObj.requirementNumber,
    paymentTerms: reqObj.paymentTerms || reqObj.payload?.terms?.paymentTerms || reqObj.payload?.paymentTerms,
    deliveryTerms: reqObj.deliveryTerms || reqObj.payload?.terms?.deliveryTerms || reqObj.payload?.deliveryTerms,
    description: reqObj.description || reqObj.payload?.basics?.description || reqObj.payload?.basics?.justification,
    payload: reqObj.payload || {},
    documents: reqObj.documents || reqObj.payload?.documents || reqObj.payload?.requiredDocs,
    items: reqObj.payload?.items || reqObj.items || reqObj.payload?.boqTable || reqObj.payload?.boq,
    category: reqObj.category?.name || reqObj.category || reqObj.payload?.basics?.category,
    buyerOrganization: reqObj.buyerOrganization || reqObj.organization,
    technicalOpeningDate: reqObj.technicalOpeningDate || reqObj.payload?.schedule?.technicalOpeningDate || reqObj.payload?.tender?.technicalEvaluationDate,
    financialOpeningDate: reqObj.financialOpeningDate || reqObj.payload?.schedule?.financialOpeningDate || reqObj.payload?.tender?.financialEvaluationDate,
    contactPerson: reqObj.contactPerson || reqObj.payload?.internal?.contactPerson || reqObj.buyer?.name || reqObj.createdBy?.name || '',
    buyerEmail: reqObj.buyerEmail || reqObj.payload?.internal?.email || reqObj.buyer?.email || reqObj.createdBy?.email || '',
    buyerMobile: reqObj.buyerMobile || reqObj.payload?.internal?.mobile || reqObj.buyer?.mobile || reqObj.createdBy?.mobile || '',
    participations: reqObj.participations || reqObj.responses || [],
    participantsCount: reqObj.responsesCount ?? reqObj.responses?.length ?? reqObj._count?.responses,
    responsesCount: reqObj.responsesCount ?? reqObj.responses?.length ?? reqObj._count?.responses,
  } : null;

  if (isLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-slate-700" />
        <p className="text-sm font-bold text-slate-500">Loading RFP details...</p>
      </div>
    );
  }

  const hasFatalError = (bidError || reqError || !rfpData) && !seedProfile;
  if (hasFatalError) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-black text-slate-950">RFP details unavailable</h1>
        <p className="max-w-md text-sm font-semibold leading-relaxed text-slate-500">
          {(bidError as Error)?.message || (reqError as Error)?.message || 'The requested RFP procurement record could not be loaded.'}
        </p>
        <Button type="button" variant="outline" onClick={() => router.back()} className="mt-1">
          <ArrowLeft className="h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  const payload = rfpData?.payload || {};
  const basics = payload.basics || {};
  const internal = payload.internal || {};
  const schedule = payload.schedule || {};
  const tender = payload.tender || {};
  const terms = payload.terms || {};
  const rules = payload.rules || {};
  const evaluation = payload.evaluation || {};
  const serviceDetails = payload.serviceDetails || {};
  const buyerProfile = rfpData?.buyer?.buyerProfile || {};
  const buyerOrg = rfpData?.buyerOrganization || rfpData?.buyer?.organization || {};

  const subject = firstPresent(
    rfpData?.subject,
    rfpData?.title,
    basics.title,
    serviceDetails.title,
    seedProfile?.title,
    'RFP Sourcing Opportunity'
  ) as string;

  const rfpNumber = firstPresent(
    rfpData?.requirementNumber,
    payload.requirementNumber,
    payload.linkedProcurementBidNumber,
    rfpData?.displayId,
    seedProfile?.number,
    rfpData?.id ? `RFP-${rfpData.id}` : undefined
  ) as string;

  const orgName = firstPresent(
    internal.orgName,
    basics.organizationName,
    rfpData?.buyerOrganizationName,
    buyerOrg.organizationName,
    buyerProfile.organizationName,
    rfpData?.buyer?.name,
    seedProfile?.buyerOrg
  ) || 'N/A';

  const contactPerson = firstPresent(
    rfpData?.contactPerson,
    internal.contactPerson,
    buyerOrg.contactPerson,
    buyerProfile.representativeName,
    buyerProfile.contactPersonName,
    buyerProfile.contactPerson,
    rfpData?.buyer?.name,
    seedProfile?.contactPerson
  ) || 'N/A';

  const email = firstPresent(
    rfpData?.buyerEmail,
    internal.email,
    buyerOrg.email,
    buyerProfile.contactPersonEmail,
    buyerProfile.email,
    rfpData?.buyer?.email,
    seedProfile?.email
  ) || 'N/A';

  const phone = firstPresent(
    rfpData?.buyerMobile,
    internal.mobile,
    buyerOrg.mobile,
    buyerProfile.contactPersonMobile,
    buyerProfile.mobile,
    rfpData?.buyer?.mobile,
    seedProfile?.phone
  ) || 'N/A';

  const addressParts = [
    buyerOrg.registeredAddress || buyerOrg.address || buyerProfile.registeredAddress || buyerProfile.address,
    buyerOrg.city || buyerProfile.city,
    buyerOrg.district || buyerProfile.district,
    buyerOrg.state || buyerProfile.state,
  ].filter(Boolean);

  const buyerAddress = firstPresent(addressParts.join(', '), seedProfile?.address) || 'N/A';
  const deliveryLocation = firstPresent(
    tender.deliveryAddress,
    tender.deliveryLocation,
    basics.deliveryLocation,
    internal.deliveryAddress,
    rfpData?.location,
    seedProfile?.location
  ) || 'N/A';

  const category = firstPresent(rfpData?.category, basics.category, seedProfile?.category) || 'N/A';
  const subCategory = firstPresent(basics.subCategory, basics.subcategory, seedProfile?.subCategory) || 'N/A';
  const procurementMethod = firstPresent(payload.fullProcurementMethod, payload.type, rfpData?.procurementType, 'RFP') || 'RFP';
  const buyingType = firstPresent(payload.buyingType, basics.whatAreYouBuying, basics.buyingType, rfpData?.bidType) || 'Service';
  const projectDuration = firstPresent(basics.projectDuration, basics.duration, serviceDetails.duration, terms.contractPeriod, terms.projectDuration) || 'N/A';
  const paymentTerms = firstPresent(rfpData?.paymentTerms, terms.paymentTerms, terms.paymentMode) || 'N/A';
  const evaluationMethod = firstPresent(rfpData?.evaluationMethod, evaluation.evaluationMethod, rules.evaluationMethod) || 'N/A';
  const statusLabel = firstPresent(rfpData?.status, payload.workflowStatus, seedProfile ? 'Published' : undefined, 'Published') as string;

  const publishedDateValue = firstPresent(
    schedule.publishDate,
    tender.publishDate,
    tender.bidStartDate,
    schedule.submissionStartDate,
    rfpData?.createdAt
  );
  const closingDateValue = firstPresent(
    tender.bidClosingDate,
    schedule.submissionDate,
    schedule.bidClosingDate,
    schedule.submissionEndDate,
    rfpData?.deadlineDate
  );
  const clarificationDateValue = firstPresent(
    schedule.clarificationEndDate,
    schedule.clarificationDeadline,
    tender.clarificationEndDate,
    rfpData?.clarificationEndDate,
    schedule.preBidDate,
    schedule.preBidMeetingDate,
    tender.preBidDate,
    tender.preBidMeetingDate
  );
  const technicalDateValue = firstPresent(tender.technicalEvaluationDate, schedule.technicalOpeningDate, rfpData?.technicalOpeningDate);
  const presentationDateValue = firstPresent(schedule.presentationDate, tender.presentationDate);
  const financialDateValue = firstPresent(tender.financialEvaluationDate, schedule.financialOpeningDate, schedule.finalEvaluationDate, rfpData?.financialOpeningDate);
  const awardDateValue = firstPresent(tender.awardDate, schedule.awardDate, schedule.awardingDate);

  const publishedDate = publishedDateValue ? formatDateString(publishedDateValue) : (seedProfile?.publishedDate || 'N/A');
  const closingDate = closingDateValue ? formatDateString(closingDateValue, true) : (seedProfile?.closingDate || 'N/A');
  const clarificationDate = clarificationDateValue ? formatDateString(clarificationDateValue, true) : (seedProfile?.clarificationDate || 'N/A');
  const technicalDate = technicalDateValue ? formatDateString(technicalDateValue, true) : (seedProfile?.technicalDate || 'N/A');
  const presentationDate = presentationDateValue ? formatDateString(presentationDateValue, true) : (seedProfile?.presentationDate || 'N/A');
  const financialDate = financialDateValue ? formatDateString(financialDateValue, true) : (seedProfile?.financialDate || 'N/A');
  const awardDate = awardDateValue ? formatDateString(awardDateValue, true) : (seedProfile?.awardDate || 'N/A');

  const estimatedValue = Number(firstPresent(rfpData?.estimatedValue, basics.estimatedValue, seedProfile?.estimatedValue, 0) || 0);
  const emdAmount = Number(firstPresent(rfpData?.emdAmount, rules.emdAmount, terms.emdAmount, 0) || 0);
  const emdRequired = firstPresent(rfpData?.isEmdRequired, rules.isEmdRequired, rules.emdRequired, terms.emdRequired);
  const emdDisplay = emdAmount > 0
    ? formatCurrency(emdAmount)
    : emdRequired === true || String(emdRequired).toLowerCase() === 'true'
      ? 'Required'
      : emdRequired === false || String(emdRequired).toLowerCase() === 'false'
        ? 'Not required'
        : 'N/A';

  const scopeText = firstPresent(
    rfpData?.description,
    basics.description,
    basics.justification,
    serviceDetails.scopeOfWork,
    serviceDetails.description,
    seedProfile?.scope
  ) || 'No scope description provided.';

  const rawDocuments = [
    ...asArray(rfpData?.documents),
    ...asArray((reqData as any)?.documents),
    ...asArray((bidData as any)?.bidDocuments),
  ];
  const documents = uniqueDocuments(rawDocuments.map(normalizeDocument));
  if (rfpData?.documentUrl) {
    documents.push({
      id: rfpData.id,
      name: String(rfpData.documentUrl).split('/').pop() || 'RFP document',
      meta: 'Document link',
      url: rfpData.documentUrl,
    });
  }

  const requiredDocuments = firstPresent(payload.requiredDocs, payload.documents, rfpData?.requiredDocuments);
  const lineItems = firstPresent(payload.items, rfpData?.items, payload.boqTable, payload.boq);
  const additionalPayloadFields = compactObject(Object.fromEntries(Object.entries(payload).filter(([key]) => !knownPayloadKeys.has(key))));
  const totalResponses = Number(firstPresent(rfpData?.participantsCount, rfpData?.responsesCount, rfpData?.participations?.length, seedProfile?.responses, 0) || 0);
  const totalClarifications = Number(firstPresent(rfpData?.clarifications?.length, 0) || 0);
  const submittedParticipations = asArray(rfpData?.participations).filter((participation: any) =>
    ['SUBMITTED', 'QUALIFIED', 'DISQUALIFIED'].includes(String(participation.submissionStatus || participation.status || '').toUpperCase())
  );
  const deadlineDate = closingDateValue ? parseDateValue(closingDateValue) : null;
  const deadlinePassed = Boolean(deadlineDate && deadlineDate.getTime() < Date.now());

  const redirectQuery = requestId
    ? `?requestId=${encodeURIComponent(requestId)}`
    : requirementId
      ? `?requirementId=${encodeURIComponent(requirementId)}`
      : '';
  const redirectTarget = `${pathname}${redirectQuery}`;

  const handleOpenDocument = (doc: DisplayDocument) => {
    if (!doc.fileAssetId && !doc.url) {
      toast.error('No file is attached to this document.');
      return;
    }

    openFileAsset({
      fileAssetId: doc.fileAssetId,
      id: doc.fileAssetId || doc.id,
      originalName: doc.name,
      url: doc.url,
      fileUrl: doc.url,
    }, doc.name).catch(error => {
      toast.error(error instanceof Error ? error.message : 'Unable to open document');
    });
  };

  const handleDownload = () => {
    const openableDocument = documents.find(doc => doc.fileAssetId || doc.url);
    if (!openableDocument) {
      toast.info('No RFP documents are available for this procurement.');
      return;
    }
    handleOpenDocument(openableDocument);
  };

  const handleSubmitProposal = () => {
    if (!currentUser) {
      toast.error('Please login to participate and submit your proposal.');
      router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`);
      return;
    }

    const targetBidId = firstPresent(
      requestId,
      payload.linkedProcurementBidId,
      rfpData?.tenders?.[0]?.id,
      requirementId && !Number.isNaN(Number(requirementId)) ? Math.abs(Number(requirementId)) : requirementId
    );

    if (!targetBidId) {
      toast.error('Unable to locate the participation record for this RFP.');
      return;
    }

    router.push(`/bids/${targetBidId}/participate`);
  };

  const summaryCards = [
    { label: 'Status', value: statusLabel, icon: ShieldCheck, tone: getStatusTone(statusLabel) },
    { label: 'Submission Deadline', value: closingDate, icon: Clock, tone: 'rose' as Tone },
    { label: 'Estimated Value', value: formatCurrency(estimatedValue), icon: IndianRupee, tone: 'emerald' as Tone },
    { label: 'EMD', value: emdDisplay, icon: ShieldCheck, tone: 'amber' as Tone },
    { label: 'Evaluation', value: formatPrimitiveValue(evaluationMethod, 'evaluationMethod'), icon: ClipboardCheck, tone: 'violet' as Tone },
    { label: 'Responses', value: totalResponses.toLocaleString('en-IN'), icon: Users, tone: 'sky' as Tone },
  ];

  const procurementInfo = compactObject({
    rfpNumber,
    procurementMethod,
    buyingType,
    category,
    subCategory,
    publishedDate,
    submissionDeadline: closingDate,
    deliveryLocation,
    projectDuration,
    paymentTerms,
  });

  const buyerInfo = compactObject({
    organization: orgName,
    contactPerson,
    email,
    phone,
    address: buyerAddress,
    department: internal.departmentName || buyerOrg.departmentName || buyerProfile.departmentName,
  });

  const keyDates = [
    { label: 'Published', value: publishedDate, icon: Calendar, tone: 'emerald' as Tone },
    { label: 'Clarification', value: clarificationDate, icon: Info, tone: 'sky' as Tone },
    { label: 'Submission', value: closingDate, icon: Clock, tone: 'rose' as Tone },
    { label: 'Technical Opening', value: technicalDate, icon: ClipboardCheck, tone: 'indigo' as Tone },
    { label: 'Presentation', value: presentationDate, icon: User, tone: 'violet' as Tone },
    { label: 'Financial Opening', value: financialDate, icon: IndianRupee, tone: 'amber' as Tone },
    { label: 'Award', value: awardDate, icon: ShieldCheck, tone: 'slate' as Tone },
  ];

  const detailSections = [
    {
      title: 'Scope, Services & BOQ',
      icon: FileText,
      data: compactObject({
        scope: scopeText,
        serviceDetails,
        lineItems,
        boqTable: payload.boqTable || payload.boq,
        boqFileName: payload.boqFileName,
      }),
    },
    {
      title: 'Tender Schedule & Rules',
      icon: CalendarDays,
      data: compactObject({
        schedule,
        tender,
        rules,
        sealedSubmissionFlag: payload.sealedSubmissionFlag,
        limitedTenderJustification: payload.limitedTenderJustification,
      }),
    },
    {
      title: 'Commercial Terms',
      icon: IndianRupee,
      data: compactObject({
        paymentTerms,
        deliveryTerms: firstPresent(rfpData?.deliveryTerms, terms.deliveryTerms),
        contractPeriod: firstPresent(terms.contractPeriod, terms.projectDuration),
        emdRequired: emdDisplay,
        documentFee: firstPresent(rules.documentFee, terms.documentFee),
        termsAndConditions: rfpData?.terms || terms.termsAndConditions,
        eligibilityCriteria: rfpData?.eligibility || terms.eligibilityCriteria || basics.eligibilityCriteria,
      }),
    },
    {
      title: 'Evaluation Criteria',
      icon: ClipboardCheck,
      data: compactObject({
        evaluationMethod,
        evaluation,
        questionnaire: payload.questionnaire,
        requireDemo: payload.requireDemo,
      }),
    },
    {
      title: 'Supplier & Approval Controls',
      icon: Users,
      data: compactObject({
        supplierSelection: payload.vendors,
        approval: payload.approval,
        recommendation: payload.recommendation,
        workflowStatus: payload.workflowStatus,
        approvalStatus: payload.approvalStatus,
      }),
    },
    {
      title: 'Consignee & Delivery',
      icon: MapPin,
      data: compactObject({
        deliveryLocation,
        consigneeDetails: payload.consigneeDetails,
        deliveryTerms: firstPresent(rfpData?.deliveryTerms, terms.deliveryTerms),
      }),
    },
    {
      title: 'System Links & Additional Fields',
      icon: Layers,
      data: compactObject({
        sourceRequirementId: payload.sourceRequirementId,
        requirementId: payload.requirementId,
        linkedProcurementBidId: payload.linkedProcurementBidId,
        linkedProcurementBidNumber: payload.linkedProcurementBidNumber,
        additionalPayloadFields,
      }),
    },
  ].filter(section => hasDetailData(section.data));

  const clarificationKind = rfpData?.sourceModel === 'REQUIREMENT' || !!requirementId ? 'requirement' : 'quote-request';
  const clarificationId = clarificationKind === 'requirement'
    ? firstPresent(requirementId, rfpData?.sourceId, rfpData?.id)
    : firstPresent(requestId, rfpData?.id);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8">
        <nav className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
          <button
            type="button"
            onClick={() => router.push(pathname.startsWith('/buyer') ? '/buyer/my-procurements' : '/seller/opportunities/rfps')}
            className="hover:text-slate-900"
          >
            {pathname.startsWith('/buyer') ? 'My Procurements' : 'RFP Opportunities'}
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-slate-900">{rfpNumber || 'RFP Details'}</span>
        </nav>

        {!currentUser && (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-black text-amber-950">Login required for participation</p>
                <p className="mt-0.5 text-xs font-semibold text-amber-800">Sellers can login to submit or view their RFP proposal.</p>
              </div>
            </div>
            <Button type="button" onClick={() => router.push(`/login?redirect=${encodeURIComponent(redirectTarget)}`)} className="shrink-0 bg-slate-950 text-white hover:bg-slate-800">
              Login
            </Button>
          </div>
        )}

        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={statusLabel} />
                <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-indigo-700">
                  <Building2 className="h-3.5 w-3.5" />
                  {formatPrimitiveValue(orgName, 'organization')}
                </span>
                {hasSubmittedProposal && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Proposal Submitted
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-black leading-tight tracking-tight text-slate-950 md:text-4xl">{subject}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-slate-800">{rfpNumber || 'RFP'}</span>
                  <span>{formatPrimitiveValue(procurementMethod, 'procurementMethod')}</span>
                  <span>{formatPrimitiveValue(category, 'category')}</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4" />
                Download
              </Button>
              {currentUser?.role === 'seller' && (
                <Button type="button" onClick={handleSubmitProposal} className="bg-slate-950 text-white hover:bg-slate-800">
                  {hasSubmittedProposal ? 'View Proposal' : 'Submit Proposal'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {summaryCards.map(card => (
            <MetricCard key={card.label} {...card} />
          ))}
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <section className="space-y-3">
            <SectionHeader title="Buyer RFP Procurement Information" icon={ClipboardList} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {detailEntries(procurementInfo).map(([key, value]) => (
                <FieldCard key={key} label={humanizeKey(key)} value={value} />
              ))}
              <FieldCard label="RFP Scope" value={scopeText} className="sm:col-span-2 xl:col-span-3" />
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader title="Buyer Information" icon={Building2} />
            <div className="grid gap-3">
              <FieldCard label="Organization" value={buyerInfo.organization} />
              <FieldCard label="Contact Person" value={buyerInfo.contactPerson} />
              <FieldCard label="Email" value={buyerInfo.email} />
              <FieldCard label="Phone" value={buyerInfo.phone} />
              <FieldCard label="Address" value={buyerInfo.address} />
              <FieldCard label="Department" value={buyerInfo.department} />
            </div>
          </section>
        </div>

        <section className="space-y-3">
          <SectionHeader title="Key Dates" icon={CalendarDays} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {keyDates.map(date => {
              const Icon = date.icon;
              const styles = toneStyles[date.tone];
              return (
                <article key={date.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', styles.icon)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{date.label}</p>
                      <p className="mt-0.5 break-words text-sm font-black text-slate-900">{date.value}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <SectionHeader title="RFP Documents" icon={FileSpreadsheet} />
          {documents.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc, index) => (
                <article key={doc.id || `${doc.name}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-black text-slate-950">{doc.name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={cn(
                          'rounded-md border px-2 py-1 text-[10px] font-black uppercase tracking-wider',
                          doc.required ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-slate-50 text-slate-600'
                        )}>
                          {doc.required ? 'Required' : doc.meta || 'Document'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDocument(doc)}
                    disabled={!doc.fileAssetId && !doc.url}
                    className="mt-4 w-full"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Document
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <EmptyBlock message="No documents uploaded for this RFP." />
          )}
          {hasDetailData(requiredDocuments) && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FieldCard label="Required Submission Documents" value={requiredDocuments} />
            </div>
          )}
        </section>

        {detailSections.map(section => (
          <DetailSection key={section.title} title={section.title} icon={section.icon} data={section.data} />
        ))}

        {(currentUser?.role === 'buyer' || currentUser?.id === rfpData?.buyer?.id) && submittedParticipations.length > 0 && (
          <section className="space-y-3">
            <SectionHeader title="Seller Proposals" icon={Users} />
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <th className="px-4 py-3">Seller</th>
                      <th className="px-4 py-3">Submission</th>
                      <th className="px-4 py-3">Technical Status</th>
                      <th className="px-4 py-3">Submitted At</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submittedParticipations.map((participation: any) => (
                      <tr key={participation.id || participation.sellerId} className="text-sm font-semibold text-slate-700">
                        <td className="px-4 py-3 text-slate-950">
                          {participation.seller?.sellerProfile?.organizationName || participation.seller?.organization?.organizationName || participation.seller?.name || `Seller #${participation.sellerId}`}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-black uppercase text-emerald-700">
                            {participation.submissionStatus || participation.status || 'Submitted'}
                          </span>
                        </td>
                        <td className="px-4 py-3">{formatPrimitiveValue(participation.technicalStatus || 'Pending', 'technicalStatus')}</td>
                        <td className="px-4 py-3">{formatDateString(participation.updatedAt || participation.createdAt, true)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/bids/${requestId || rfpData?.id}/results`)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FieldCard label="Clarification Threads" value={totalClarifications.toLocaleString('en-IN')} />
          <FieldCard label="Proposal Status" value={hasSubmittedProposal ? 'Submitted' : currentUser?.role === 'seller' ? 'Not submitted' : 'N/A'} />
          <FieldCard label="Deadline Status" value={deadlinePassed ? 'Closed' : 'Open'} />
          <FieldCard label="Source Record" value={clarificationKind === 'requirement' ? 'Buyer Requirement' : 'Procurement Bid'} />
        </section>

        {clarificationId && (
          <ClarificationPanel
            quoteRequestId={clarificationId}
            kind={clarificationKind}
            role={currentUser?.role === 'buyer' ? 'buyer' : 'seller'}
            deadlinePassed={deadlinePassed}
          />
        )}
      </div>
    </div>
  );
}
