'use client';

import React, { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Download,
  ExternalLink,
  Eye,
  Paperclip,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  Info,
  Layers,
  Loader2,
  MapPin,
  MessageSquare,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  PhoneCall,
  Mail,
  CheckCircle2,
  CheckCircle,
  Scale,
  Sparkles,
  X,
  Package,
  Award,
  Trash2,
  Tag,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../hooks/useAuth';
import { openFileAsset } from '../../../lib/files';
import { cn } from '../../../lib/utils';
import { PdfEngine } from '../../../lib/pdfEngine';
import { getApi } from '../../shared/apiClient';
import { procurementBidApi } from '../../procurementBid/api';
import { KpiCard } from '../../shared/KpiCard';
import ClarificationPanel from './ClarificationPanel';
import { EmdCard, EmdInfo, isEmdApplicable } from './EmdCard';
import { EmdPaymentModal } from './EmdPaymentModal';

type IconComponent = React.ComponentType<{ className?: string }>;
type Tone = 'slate' | 'emerald' | 'rose' | 'amber' | 'sky' | 'indigo' | 'violet';

export type DisplayDocument = {
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

const formatMoney = (val: any) => {
  const n = Number(val);
  return isNaN(n) || n <= 0 ? 'Refer Specs' : `₹${n.toLocaleString('en-IN')}`;
};

const noisyDetailKeys = new Set([
  '_id',
  'id',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'createdBy',
  'updatedBy',
  'tenantId',
  'organizationId',
  'buyerId',
  'sellerId',
  'bidId',
  'requirementId',
  'authUserId',
  'userId',
  'creatorId',
  'internalId',
  'sourceId',
  'sourceModel',
  'linkedProcurementBidId',
  'isDeleted',
  'originalPayload',
  'password',
  'token',
  'sourcePayload',
  'rawPayload',
  'technicalPacket',
  'fileAssetId',
  'assetId',
  'draftMeta',
  'draftStep',
  '__v',
  'statusEnum',
  'metadata',
  'hash',
  'signature',
  'emdRequired',
  'emdAmount',
  'isEmdRequired',
  'emdDisplay',
  'emd',
  'pbgRequired',
  'pbgAmount',
  'isPbgRequired',
  'pbg',
  'documentFee',
  'documentFeeAmount',
  'documentFeeRequired',
  'docFee',
  'documentCost',
  'documentCostFee',
  'document_cost_fee',
  'document_cost',
  'costFee',
  'docCost',
  'performanceSecurity',
  'retentionAmount',
  'retention_amount',
  'retention',
  'retentionPercentage',
  'retention_percentage',
  'isRetentionApplicable',
  'retentionApplicable',
  'securityDeposit',
  'security_deposit',
  'securityDepositAmount',
  'security_deposit_amount',
  'securityDepositPercentage',
  'security_deposit_percentage',
  'securityDepositRequired',
  'security_deposit_required',
]);

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, char => char.toUpperCase())
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
}

function hasDetailData(val: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return !isNaN(val);
  if (typeof val === 'string') return val.trim().length > 0 && val.trim() !== 'null' && val.trim() !== 'undefined';
  if (Array.isArray(val)) return val.some(hasDetailData);
  if (typeof val === 'object') return Object.values(val).some(hasDetailData);
  return false;
}

function isPlainObject(val: any): boolean {
  return !!val && typeof val === 'object' && !Array.isArray(val);
}

function compactObject(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (noisyDetailKeys.has(key)) continue;
    if (hasDetailData(val)) {
      result[key] = val;
    }
  }
  return result;
}

function detailEntries(obj: Record<string, any>): [string, any][] {
  return Object.entries(compactObject(obj));
}

function firstPresent(...vals: any[]): any {
  for (const val of vals) {
    if (hasDetailData(val)) return val;
  }
  return undefined;
}

function asArray(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return [val];
  return [val];
}

function formatDateString(dateVal?: string | Date | null, includeTime: boolean = false) {
  if (!dateVal) return null;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    if (!includeTime) return `${day} ${month} ${year}`;
    const isMidnightUtc = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
    const hours = isMidnightUtc ? '23' : String(d.getHours()).padStart(2, '0');
    const minutes = isMidnightUtc ? '59' : String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes} IST`;
  } catch {
    return String(dateVal);
  }
}

function formatCurrency(val?: number | string | null) {
  if (val === undefined || val === null || val === '') return 'N/A';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num) || num <= 0) return 'N/A';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
}

function formatPrimitiveValue(val: any, valueKey?: string): string {
  if (val === null || val === undefined || val === '') return 'N/A';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') {
    const lk = (valueKey || '').toLowerCase();
    const isCurrency = (
      lk.includes('amount') ||
      lk.includes('budget') ||
      lk.includes('value') ||
      lk.includes('price') ||
      lk.includes('cost') ||
      lk.includes('fee') ||
      lk.includes('deposit') ||
      (lk.includes('rate') && !lk.includes('contract') && !lk.includes('rating'))
    ) && !lk.includes('day') && !lk.includes('period') && !lk.includes('validity') && !lk.includes('count') && !lk.includes('qty') && !lk.includes('quantity') && !lk.includes('percent');

    if (isCurrency) {
      return formatCurrency(val);
    }
    if (lk.includes('day') || lk.includes('period') || lk.includes('validity')) {
      return `${val} Days`;
    }
    return val.toLocaleString('en-IN');
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === '[object Object]') return 'N/A';
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const formattedDate = formatDateString(trimmed, trimmed.includes('T') || trimmed.includes(':'));
      if (formattedDate) return formattedDate;
    }
    // Format ALL_CAPS_WITH_UNDERSCORE enums to title case (e.g. ON_DELIVERY -> On Delivery)
    if (/^[A-Z0-9_ -]+$/.test(trimmed) && trimmed.includes('_')) {
      return humanizeKey(trimmed.toLowerCase());
    }
    if (valueKey && valueKey.toLowerCase().includes('evaluation')) {
      const lower = trimmed.toLowerCase();
      if (lower.includes('qcbs') || lower.includes('quality and cost') || lower.includes('weighted technical')) {
        return 'Quality and Cost Based Selection (QCBS)';
      }
      if (lower === 'l1' || lower === 'l1 basis') {
        return 'L1 Basis';
      }
      if (lower.includes('item-wise') || lower.includes('item wise')) {
        return 'Item-wise L1';
      }
      if (lower.includes('package-wise') || lower.includes('package wise')) {
        return 'Package-wise L1';
      }
      if (lower.includes('technical qualification then l1') || lower.includes('technical then l1')) {
        return 'Technical Qualification then L1';
      }
      if (lower.includes('reverse auction')) {
        return 'Reverse Auction Final Bid Rank';
      }
      if (lower.includes('lowest landed cost')) {
        return 'Lowest Landed Cost';
      }
      if (lower.includes('l1 total value') || lower.includes('l1 total')) {
        return 'L1 Total Value';
      }
    }
    return trimmed;
  }
  if (Array.isArray(val)) {
    const cleanList = val.map(v => formatPrimitiveValue(v, valueKey)).filter(v => v !== 'N/A' && v !== '');
    return cleanList.length ? cleanList.join(', ') : 'N/A';
  }
  if (typeof val === 'object') {
    return 'N/A';
  }
  return String(val);
}

function parseDateValue(dateVal?: string | Date | null): Date | null {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  const isMidnightUtc = d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  if (isMidnightUtc) {
    const endOfDay = new Date(d.getTime());
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay;
  }
  return d;
}

function DeadlineCountdown({ targetDate }: { targetDate: Date | string }) {
  const dateObj = useMemo(() => parseDateValue(targetDate), [targetDate]);
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; isPassed: boolean }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPassed: false,
  });

  React.useEffect(() => {
    if (!dateObj) return;

    const calc = () => {
      const ms = dateObj.getTime() - Date.now();
      if (ms <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPassed: true });
        return;
      }
      const days = Math.floor(ms / 86_400_000);
      const hours = Math.floor((ms % 86_400_000) / 3_600_000);
      const minutes = Math.floor((ms % 3_600_000) / 60_000);
      const seconds = Math.floor((ms % 60_000) / 1000);
      setTimeLeft({ days, hours, minutes, seconds, isPassed: false });
    };

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [dateObj]);

  if (!dateObj) return null;

  if (timeLeft.isPassed) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-rose-700">
        <Clock className="h-3.5 w-3.5 text-rose-600" />
        Submission Closed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-amber-800 shadow-2xs">
      <Clock className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
      <span className="font-mono">
        {timeLeft.days > 0 ? `${timeLeft.days}d ` : ''}
        {String(timeLeft.hours).padStart(2, '0')}h {String(timeLeft.minutes).padStart(2, '0')}m {String(timeLeft.seconds).padStart(2, '0')}s left
      </span>
    </span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const label = (status || 'ACTIVE').toUpperCase();
  const isClosed = ['CLOSED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'AWARDED'].includes(label);

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider',
      isClosed ? 'border-slate-300 bg-slate-100 text-slate-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
    )}>
      <span className={cn('h-1.5 w-1.5 rounded-full', isClosed ? 'bg-slate-500' : 'bg-emerald-500 animate-pulse')} />
      {label}
    </span>
  );
}

function SectionHeader({ title, icon: Icon, badge, action }: { title: string; icon: IconComponent; badge?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100/80 shadow-2xs">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-950 truncate">{title}</h2>
      </div>
      {(badge || action) && (
        <div className="flex items-center gap-2 shrink-0">
          {badge}
          {action}
        </div>
      )}
    </div>
  );
}

function DetailValue({ value, valueKey }: { value: any; valueKey?: string }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400 font-normal">N/A</span>;
  }

  if (typeof value === 'boolean') {
    return (
      <span className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border',
        value ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'
      )}>
        {value ? 'Yes' : 'No'}
      </span>
    );
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return <span>{formatPrimitiveValue(value, valueKey)}</span>;
  }

  if (Array.isArray(value)) {
    const list = value.filter(hasDetailData);
    if (!list.length) return <span className="text-slate-400 font-normal">N/A</span>;

    return (
      <div className="space-y-2 mt-1">
        {list.map((item, index) => (
          <div key={index} className="rounded-xl bg-slate-50/70 p-3.5 border border-slate-150">
            {typeof item === 'object' ? (
              <PropertyGrid columns={3}>
                {detailEntries(item).map(([k, v]) => (
                  <PropertyItem key={k} label={humanizeKey(k)} value={v} />
                ))}
              </PropertyGrid>
            ) : (
              <span className="text-xs font-bold text-slate-900">{formatPrimitiveValue(item, valueKey)}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    const entries = detailEntries(value);
    if (!entries.length) return <span className="text-slate-400 font-normal">N/A</span>;

    return (
      <PropertyGrid columns={3} className="mt-1">
        {entries.map(([k, v]) => (
          <PropertyItem key={k} label={humanizeKey(k)} value={v} />
        ))}
      </PropertyGrid>
    );
  }

  return <span>{String(value)}</span>;
}

function PropertyGrid({
  columns = 2,
  children,
  className,
}: {
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
  className?: string;
}) {
  const colClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  }[columns];

  return (
    <dl className={cn('grid gap-x-6 gap-y-4 sm:gap-y-4.5', colClass, className)}>
      {children}
    </dl>
  );
}

interface BuyerSideContextValue {
  isBuyer: boolean;
  isOpenTender: boolean;
  isLimitedTender: boolean;
}

const BuyerSideContext = React.createContext<BuyerSideContextValue>({
  isBuyer: false,
  isOpenTender: false,
  isLimitedTender: false,
});

function PropertyItem({
  label,
  value,
  icon: Icon,
  className,
  fullWidth = false,
  highlight = false,
  mono = false,
}: {
  label: string;
  value: any;
  icon?: IconComponent;
  className?: string;
  fullWidth?: boolean;
  highlight?: boolean;
  mono?: boolean;
}) {
  const ctx = React.useContext(BuyerSideContext);
  const isBuyer = typeof ctx === 'boolean' ? ctx : ctx.isBuyer;
  const isOpenTender = typeof ctx === 'boolean' ? false : ctx.isOpenTender;
  const isLimitedTender = typeof ctx === 'boolean' ? false : (ctx.isLimitedTender || false);
  if (!hasDetailData(value)) return null;

  if (isBuyer && label) {
    const lower = label.toLowerCase().replace(/[^a-z]/g, '');
    if (
      // Warranty Terms strictly commented out / hidden on buyer side in open and limited tender
      ((isOpenTender || isLimitedTender) && (
        lower === 'warrantyterms' ||
        lower === 'warranty' ||
        lower === 'warrantyperiod' ||
        lower.includes('warranty')
      )) ||
      lower === 'retentionamount' ||
      lower === 'securitydeposit' ||
      lower === 'retention' ||
      lower === 'securitydepositamount' ||
      lower === 'retentionpercentage' ||
      lower === 'securitydepositpercentage' ||
      lower === 'securitydepositrequired' ||
      lower.includes('retention') ||
      lower.includes('securitydeposit')
    ) {
      return null;
    }
  }

  return (
    <div
      className={cn(
        'min-w-0 flex flex-col justify-start py-0.5',
        fullWidth && 'sm:col-span-2 lg:col-span-full',
        className
      )}
    >
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
        <span className="truncate">{label}</span>
      </dt>
      <dd
        className={cn(
          'mt-1 text-xs sm:text-sm font-semibold text-slate-900 break-words leading-relaxed',
          highlight && 'text-blue-700 font-extrabold',
          mono && 'font-mono text-xs'
        )}
      >
        <DetailValue value={value} valueKey={label} />
      </dd>
    </div>
  );
}

function DataCard({
  title,
  icon: Icon,
  badge,
  action,
  children,
  className,
}: {
  title: string;
  icon: IconComponent;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4', className)}>
      <SectionHeader title={title} icon={Icon} badge={badge} action={action} />
      {children}
    </section>
  );
}

function BuyerProfileSection({
  orgName,
  contactPerson,
  email,
  phone,
  address,
  department,
}: {
  orgName?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  department?: string;
}) {
  return (
    <DataCard title="Buyer Information" icon={Building2}>
      <div className="space-y-4">
        {/* Org Banner Card */}
        <div className="flex items-start gap-3.5 rounded-xl bg-slate-50/80 p-3.5 border border-slate-150">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0b2447] to-[#123668] text-white shadow-xs font-black text-base">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black text-slate-900 leading-tight">
                {orgName || 'Buyer Organization'}
              </h3>
              {department && (
                <span className="rounded-full bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  {department}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              Authorized Procurement Authority
            </p>
          </div>
        </div>

        {/* Contact & Location Details in Clean Key-Values */}
        <div className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2 pt-1">
          {contactPerson && (
            <div className="space-y-0.5">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span>Contact Person</span>
              </dt>
              <dd className="text-xs sm:text-sm font-bold text-slate-900">{contactPerson}</dd>
            </div>
          )}

          {email && (
            <div className="space-y-0.5">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                <span>Email Address</span>
              </dt>
              <dd className="text-xs sm:text-sm font-semibold">
                <a href={`mailto:${email}`} className="text-blue-600 hover:text-blue-800 hover:underline transition-colors break-all">
                  {email}
                </a>
              </dd>
            </div>
          )}

          {phone && (
            <div className="space-y-0.5">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <PhoneCall className="h-3.5 w-3.5 text-slate-400" />
                <span>Contact Number</span>
              </dt>
              <dd className="text-xs sm:text-sm font-semibold">
                <a href={`tel:${phone}`} className="text-slate-800 hover:text-blue-600 transition-colors font-mono">
                  {phone}
                </a>
              </dd>
            </div>
          )}

          {address && (
            <div className="space-y-0.5">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                <span>Registered Location</span>
              </dt>
              <dd className="text-xs sm:text-sm font-semibold text-slate-700 leading-relaxed">{address}</dd>
            </div>
          )}
        </div>
      </div>
    </DataCard>
  );
}

function TimelineRibbon({
  dates,
}: {
  dates: Array<{
    label: string;
    value?: string | null;
    icon: IconComponent;
    tone: Tone;
  }>;
}) {
  const validDates = dates.filter(d => d.value && d.value !== '—' && d.value !== 'N/A');
  if (!validDates.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100/80 shadow-2xs">
          <CalendarDays className="h-4 w-4" />
        </span>
        <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-950">
          Key Dates &amp; Milestone Schedule
        </h2>
      </div>

      <div className="rounded-xl bg-slate-50/70 p-4 border border-slate-150">
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {validDates.map((date, idx) => {
            const styles = toneStyles[date.tone] || toneStyles.slate;
            return (
              <div key={idx} className="flex flex-col justify-between space-y-1.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', styles.icon.replace('text-', 'bg-').split(' ')[0])} />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
                    {date.label}
                  </span>
                </div>
                <p className="text-xs font-black text-slate-900 leading-tight break-words">
                  {date.value}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function PolicyRulesMatrix({
  rules,
}: {
  rules: Array<{ label: string; value: any; icon?: IconComponent }>;
}) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {rules.map((rule, idx) => {
        const valStr = String(rule.value || '').trim();
        const isYes = ['yes', 'true', '1', 'enabled'].includes(valStr.toLowerCase());
        const isNo = ['no', 'false', '0', 'disabled'].includes(valStr.toLowerCase());
        const Icon = rule.icon || (isYes ? CheckCircle2 : Info);

        return (
          <div
            key={idx}
            className={cn(
              'flex items-center justify-between gap-2 p-3 rounded-xl border transition-colors',
              isYes
                ? 'bg-emerald-50/50 border-emerald-200/80 text-emerald-950'
                : isNo
                ? 'bg-slate-50/60 border-slate-200/80 text-slate-700'
                : 'bg-white border-slate-200 text-slate-900'
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  isYes ? 'text-emerald-600' : isNo ? 'text-slate-400' : 'text-indigo-600'
                )}
              />
              <span className="text-xs font-bold truncate text-slate-800">{rule.label}</span>
            </div>
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0',
                isYes
                  ? 'bg-emerald-100 text-emerald-800'
                  : isNo
                  ? 'bg-slate-200/70 text-slate-600'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              )}
            >
              {valStr}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Legacy-compatible Property wrapper without individual box borders */
function FieldCard({ label, value, className }: { label: string; value: any; className?: string }) {
  if (!hasDetailData(value)) return null;
  return <PropertyItem label={label} value={value} className={className} />;
}

/** Legacy-compatible Compact wrapper */
function CompactField({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  if (!hasDetailData(value)) return null;
  return <PropertyItem label={label} value={value} className={className} />;
}

function CompactSectionGrid({
  title,
  icon: Icon,
  data,
  defaultOpen = true,
}: {
  title: string;
  icon: IconComponent;
  data: Record<string, any>;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  if (!hasDetailData(data)) return null;

  const entries = detailEntries(data);
  if (!entries.length) return null;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 sm:p-5 text-left transition hover:bg-slate-50/80"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100/80 shadow-2xs">
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide text-slate-950 truncate">{title}</h2>
        </div>
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shrink-0">
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 p-5 pt-4">
          <PropertyGrid columns={3}>
            {entries.map(([key, value]) => (
              <PropertyItem key={key} label={humanizeKey(key)} value={value} />
            ))}
          </PropertyGrid>
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
  subtext,
  isBuyer,
}: {
  label: string;
  value: React.ReactNode;
  icon: IconComponent;
  tone: Tone;
  subtext?: string;
  isBuyer?: boolean;
}) {
  const styles = toneStyles[tone] || toneStyles.slate;
  return (
    <article
      className={cn(
        'flex flex-col rounded-xl border shadow-2xs transition-all hover:shadow-sm',
        isBuyer ? 'p-3 gap-1 min-h-0' : 'p-4 justify-between h-full min-h-[110px]',
        styles.card
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <p className={cn('font-black uppercase tracking-wider text-slate-500 line-clamp-1 flex-1', isBuyer ? 'text-[10px]' : 'text-[11px]')}>
          {label}
        </p>
        <span
          className={cn(
            'flex shrink-0 items-center justify-center shadow-2xs',
            isBuyer ? 'h-6 w-6 rounded-md' : 'h-8 w-8 rounded-lg',
            styles.icon
          )}
        >
          <Icon className={isBuyer ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </span>
      </div>
      <div className={cn('min-w-0', isBuyer ? 'mt-0.5' : 'mt-1')}>
        <div
          className={cn(
            'leading-tight truncate',
            isBuyer
              ? 'text-sm sm:text-base font-bold text-slate-900'
              : 'text-lg lg:text-xl font-black text-slate-950'
          )}
          title={typeof value === 'string' ? value : undefined}
        >
          {value}
        </div>
        <p className={cn('flex items-center gap-1 font-semibold text-slate-500 truncate', isBuyer ? 'mt-0.5 text-[10px]' : 'mt-1 text-[11px]')}>
          <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" />
          {subtext || 'Procurement details'}
        </p>
      </div>
    </article>
  );
}

function RequiredDocumentsList({ data, title = "REQUIRED SUBMISSION DOCUMENTS LIST" }: { data: any; title?: string }) {
  const rawItems = asArray(data).filter(hasDetailData);

  const standardPresets = [
    { name: 'GST Certificate', instructions: 'Upload verified GST registration document.', fileType: 'PDF', maxSize: '5', required: true },
    { name: 'PAN Card', instructions: 'Upload official PAN card.', fileType: 'PDF', maxSize: '2', required: true },
    { name: 'Bank Details', instructions: 'Cancelled cheque or passbook.', fileType: 'PDF', maxSize: '2', required: true },
    { name: 'Technical Compliance Sheet', instructions: 'Compliance report against specified standards.', fileType: 'PDF, DOCX', maxSize: '10', required: true },
    { name: 'Detailed Price Breakup', instructions: 'Itemized cost schedule.', fileType: 'PDF, XLSX', maxSize: '5', required: true },
  ];

  const processedItems = (rawItems.length ? rawItems : standardPresets).map((item: any, idx: number) => {
    const preset = standardPresets[idx % standardPresets.length];

    if (typeof item === 'string') {
      const strLower = item.toLowerCase();
      if (strLower.includes('gst')) return { name: 'GST Certificate', instructions: 'Upload verified GST registration document.', fileType: 'PDF', maxSize: '5', required: true };
      if (strLower.includes('pan')) return { name: 'PAN Card', instructions: 'Upload official PAN card.', fileType: 'PDF', maxSize: '2', required: true };
      if (strLower.includes('bank') || strLower.includes('cheque')) return { name: 'Bank Details', instructions: 'Cancelled cheque or passbook.', fileType: 'PDF', maxSize: '2', required: true };
      if (strLower.includes('tech') || strLower.includes('compliance')) return { name: 'Technical Compliance Sheet', instructions: 'Compliance report against specified standards.', fileType: 'PDF, DOCX', maxSize: '10', required: true };
      if (strLower.includes('price') || strLower.includes('financial') || strLower.includes('rate') || strLower.includes('breakup')) return { name: 'Detailed Price Breakup', instructions: 'Itemized cost schedule.', fileType: 'PDF, XLSX', maxSize: '5', required: true };

      if (strLower.includes('attached_doc') || strLower.includes('document') || !item.trim()) {
        return preset;
      }

      return {
        name: item,
        instructions: 'Upload required document according to specifications.',
        fileType: 'PDF, DOCX',
        maxSize: '5',
        required: true,
      };
    }

    if (isPlainObject(item)) {
      const nameStr = String(item.name || item.documentName || item.title || item.label || '');
      const isGeneric = !nameStr || nameStr.toLowerCase().includes('attached_doc');
      if (isGeneric) {
        return {
          ...preset,
          ...item,
          name: preset.name,
          instructions: item.instructions || preset.instructions,
          fileType: item.fileType || preset.fileType,
          maxSize: item.maxSize || preset.maxSize,
        };
      }
      return item;
    }

    return preset;
  });

  if (!processedItems.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
          <FileText className="h-4 w-4 text-indigo-600" />
          {title}
        </h3>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-600">
          {processedItems.length} {processedItems.length === 1 ? 'Document' : 'Documents'}
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">DOCUMENT NAME</th>
                <th className="px-4 py-3">INSTRUCTIONS</th>
                <th className="px-4 py-3">ALLOWED FILE TYPES</th>
                <th className="px-4 py-3">MAX SIZE</th>
                <th className="px-4 py-3 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
              {processedItems.map((item: any, idx: number) => {
                const docName = firstPresent(item.name, item.documentName, item.title, item.label, `Document ${idx + 1}`);
                const instructions = firstPresent(item.instructions, item.description, item.guidelines, item.note, '-');
                const fileType = firstPresent(item.fileType, item.allowedFormat, item.format, item.fileTypes, item.mimeType, 'PDF');
                const rawMaxSize = firstPresent(item.maxSize, item.maxMb, item.size, '5');
                const maxSize = String(rawMaxSize).replace(/\s*mb/gi, '');
                const isRequired = item.required !== false && String(item.required).toLowerCase() !== 'false';

                return (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-400">{idx + 1}</td>
                    <td className="px-4 py-3 font-black text-slate-900">{formatPrimitiveValue(docName)}</td>
                    <td className="px-4 py-3 font-medium text-slate-600 max-w-xs">{formatPrimitiveValue(instructions)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700 uppercase">
                        {formatPrimitiveValue(fileType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {maxSize !== '-' ? `${maxSize} MB` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'inline-block rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider border',
                        isRequired
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      )}>
                        {isRequired ? 'REQUIRED' : 'OPTIONAL'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScopeSummaryCard({
  scopeText,
  procurementTypeLabel = "PROCUREMENT",
  estimatedValue,
  urgency = "Normal",
  procurementMethod,
}: {
  scopeText?: string;
  procurementTypeLabel?: string;
  estimatedValue?: any;
  urgency?: string;
  procurementMethod?: string;
}) {
  const raw = String(scopeText || '');
  const formatted = raw
    .replace(/(Sourcing Method:?\s*)/gi, '\nSourcing Method: ')
    .replace(/(RFP\s?Value:?\s*)/gi, '\nRFP Value: ')
    .replace(/(Value:?\s*)/gi, '\nValue: ')
    .replace(/(Urgency:?\s*)/gi, '\nUrgency: ')
    .replace(/([a-z0-9])([A-Z][a-z])/g, '$1\n$2')
    .replace(/(INR\s?[\d,]+)([A-Z])/g, '$1\n$2');

  const lines = formatted
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const parsedKeyValues: { label: string; val: string }[] = [];
  const textParts: string[] = [];

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < line.length - 1) {
      const k = line.slice(0, colonIdx).trim();
      const v = line.slice(colonIdx + 1).trim();
      if (k && v) {
        const lk = k.toLowerCase();
        if (!lk.includes('sourcing') && !lk.includes('method')) {
          parsedKeyValues.push({ label: humanizeKey(k), val: v });
        }
      } else if (line) {
        if (!line.toLowerCase().includes('sourcing method')) {
          textParts.push(line);
        }
      }
    } else if (line) {
      if (!line.toLowerCase().includes('sourcing method')) {
        textParts.push(line);
      }
    }
  }

  const freeText = textParts.join(' ').trim();
  const effectiveUrgency = urgency || 'Normal';
  const isUrgent = String(effectiveUrgency).toLowerCase().includes('urgent');

  return (
    <div className="space-y-4">
      {/* Top Scope Highlights Ribbon */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50/80 p-3.5 border border-slate-150">
        {/* Sourcing Method - commented out */}
        {/* <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sourcing Method:</span>
          <span className="text-xs font-black text-slate-900">{procurementMethod || procurementTypeLabel}</span>
        </div> */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estimated Value:</span>
          <span className="text-xs font-black text-emerald-700">{formatCurrency(estimatedValue)}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Urgency:</span>
          <span className={cn(
            'text-[10px] font-black uppercase px-2 py-0.5 rounded-md border',
            isUrgent ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200'
          )}>
            {effectiveUrgency}
          </span>
        </div>
        {parsedKeyValues.map((kv, idx) => (
          <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{kv.label}:</span>
            <span className="text-xs font-bold text-slate-800">{kv.val}</span>
          </div>
        ))}
      </div>

      {/* Scope Statement */}
      {freeText && freeText !== 'No scope summary provided.' && (
        <div className="rounded-xl border-l-4 border-indigo-600 bg-slate-50/70 p-4 border border-slate-150">
          <p className="text-xs font-semibold text-slate-700 leading-relaxed whitespace-pre-line">
            {freeText}
          </p>
        </div>
      )}
    </div>
  );
}

function MilestonesTable({ milestones }: { milestones: any }) {
  const list = asArray(milestones).filter(hasDetailData);
  if (!list.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-3">
      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-emerald-600" /> Payment &amp; Deliverable Milestones
      </h4>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3.5 py-2.5">#</th>
              <th className="px-3.5 py-2.5">Milestone Label</th>
              <th className="px-3.5 py-2.5">Percentage</th>
              <th className="px-3.5 py-2.5">Trigger / Condition</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
            {list.map((m: any, idx: number) => {
              const label = firstPresent(m.label, m.name, m.title, `Milestone ${idx + 1}`);
              const pct = firstPresent(m.percentage, m.percent, m.share, '-');
              const trigger = firstPresent(m.trigger, m.condition, m.description, '-');

              return (
                <tr key={idx} className="hover:bg-slate-50/60 font-semibold text-slate-800">
                  <td className="px-3.5 py-2.5 font-bold text-slate-400">{idx + 1}</td>
                  <td className="px-3.5 py-2.5 font-bold text-slate-900">{formatPrimitiveValue(label)}</td>
                  <td className="px-3.5 py-2.5">
                    <span className="inline-block rounded-md bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 text-[10px]">
                      {pct !== '-' ? `${pct}%` : '-'}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-slate-600 max-w-xs">{formatPrimitiveValue(trigger)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServiceDetailsSection({ serviceDetails }: { serviceDetails: any }) {
  const ctx = React.useContext(BuyerSideContext);
  const isBuyer = typeof ctx === 'boolean' ? ctx : ctx.isBuyer;
  const isOpenTender = typeof ctx === 'boolean' ? false : ctx.isOpenTender;
  const isLimitedTender = typeof ctx === 'boolean' ? false : (ctx.isLimitedTender || false);

  // Strictly hide Service Details & Parameters on buyer side for limited tender, open tender, etc.
  if ((isBuyer && (isLimitedTender || isOpenTender)) || !serviceDetails || !isPlainObject(serviceDetails)) return null;

  const { duration, penaltyClause, slaResponseTime, manpowerRequired, experienceRequired, milestones, ...rest } = serviceDetails;

  const mainFields = compactObject({
    duration,
    penaltyClause,
    slaResponseTime,
    manpowerRequired,
    experienceRequired,
    ...rest,
  });

  const entries = detailEntries(mainFields);
  if (!entries.length) return null;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <Building2 className="h-4 w-4 text-indigo-600" />
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
          Service Details &amp; Parameters
        </h3>
      </div>
      <div className="rounded-xl bg-slate-50/70 p-4 border border-slate-150">
        <PropertyGrid columns={5}>
          {entries.map(([key, val]) => (
            <PropertyItem key={key} label={humanizeKey(key)} value={val} />
          ))}
        </PropertyGrid>
      </div>
    </div>
  );
}
function getUniqueItemFiles(item: any, sp: any = {}, defaultName: string = 'Item'): any[] {
  if (!item && !sp) return [];

  const rawCandidates: any[] = [
    ...asArray(item?.attachments),
    ...asArray(item?.files),
    ...asArray(item?.documents),
    ...asArray(item?.itemFiles),
    ...asArray(sp?.attachments),
    ...asArray(sp?.files),
    ...asArray(sp?.documents),
    ...asArray(sp?.uploadedSpecificationFiles),
  ];

  // Include individual file fields if present
  if (item?.fileAssetId || item?.url || item?.fileUrl || item?.specificationFileName || item?.attachmentUrl || item?.attachmentName) {
    rawCandidates.push({
      fileAssetId: item.fileAssetId,
      url: item.url || item.fileUrl || item.attachmentUrl,
      fileName: item.fileName || item.originalName || item.specificationFileName || item.attachmentName,
      name: item.fileName || item.originalName || item.specificationFileName || item.attachmentName,
    });
  }
  if (sp?.fileAssetId || sp?.url || sp?.fileUrl || sp?.specificationFileName || sp?.attachmentUrl || sp?.attachmentName) {
    rawCandidates.push({
      fileAssetId: sp.fileAssetId,
      url: sp.url || sp.fileUrl || sp.attachmentUrl,
      fileName: sp.fileName || sp.originalName || sp.specificationFileName || sp.attachmentName,
      name: sp.fileName || sp.originalName || sp.specificationFileName || sp.attachmentName,
    });
  }

  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenNames = new Set<string>();
  const result: any[] = [];

  for (const raw of rawCandidates) {
    if (!raw) continue;
    let fileObj: any = raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed || trimmed === '[]' || trimmed === '{}' || trimmed === 'null' || trimmed === 'undefined') continue;
      try {
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          fileObj = JSON.parse(trimmed);
        } else {
          fileObj = { url: trimmed, name: trimmed.split('/').pop()?.split('?')[0] || trimmed };
        }
      } catch {
        fileObj = { url: trimmed, name: trimmed.split('/').pop()?.split('?')[0] || trimmed };
      }
    } else if (typeof raw === 'number') {
      fileObj = { fileAssetId: raw, fid: raw, name: `File #${raw}`, url: `/api/files/${raw}/view` };
    }

    if (!fileObj || typeof fileObj !== 'object') continue;

    const fileAssetId = fileObj.fileAssetId ?? fileObj.fid ?? fileObj.id ?? (typeof fileObj.fileId === 'number' ? fileObj.fileId : undefined);
    const rawUrl = fileObj.url || fileObj.fileUrl || fileObj.attachmentUrl || (fileAssetId ? `/api/files/${fileAssetId}/view` : undefined);
    const cleanUrl = rawUrl ? String(rawUrl).split('?')[0].trim().toLowerCase() : '';

    let extractedId = fileAssetId ? String(fileAssetId) : undefined;
    if (!extractedId && cleanUrl) {
      const match = cleanUrl.match(/\/files\/(\d+)/i);
      if (match) extractedId = match[1];
    }

    const rawName = fileObj.fileName || fileObj.name || fileObj.originalName || fileObj.documentName || fileObj.specificationFileName || fileObj.title;
    const derivedName = rawName && String(rawName).trim()
      ? String(rawName).trim()
      : (cleanUrl ? cleanUrl.split('/').pop()?.split('?')[0] : (extractedId ? `File #${extractedId}` : `${defaultName} Attachment`));

    const lowerName = String(derivedName || '').toLowerCase().trim();
    const isGenericName = !lowerName ||
      lowerName === 'document' ||
      lowerName === 'attachment' ||
      lowerName === 'specification' ||
      lowerName === 'specification file' ||
      lowerName === 'procurement document' ||
      lowerName === `${defaultName.toLowerCase()} specification` ||
      lowerName === `${defaultName.toLowerCase()} attachment`;

    // Deduplication checks:
    if (extractedId && seenIds.has(extractedId)) {
      continue;
    }
    if (cleanUrl && seenUrls.has(cleanUrl)) {
      continue;
    }
    if (!isGenericName && lowerName && seenNames.has(lowerName)) {
      continue;
    }

    if (extractedId) seenIds.add(extractedId);
    if (cleanUrl) seenUrls.add(cleanUrl);
    if (!isGenericName && lowerName) seenNames.add(lowerName);

    result.push({
      ...fileObj,
      fileAssetId: extractedId ? Number(extractedId) : fileAssetId,
      fid: extractedId ? Number(extractedId) : fileAssetId,
      id: extractedId ? Number(extractedId) : (fileObj.id ?? fileAssetId),
      fileName: derivedName,
      name: derivedName,
      originalName: fileObj.originalName || derivedName,
      url: rawUrl || (extractedId ? `/api/files/${extractedId}/view` : undefined),
    });
  }

  return result;
}

function LineItemsTable({
  items,
  defaultSubject,
  isBuyer,
}: {
  items: any;
  defaultSubject?: string;
  isBuyer?: boolean;
}) {
  const [viewingItemFiles, setViewingItemFiles] = useState<{ title: string; files: any[] } | null>(null);
  const list = asArray(items).filter(hasDetailData);
  if (!list.length) return null;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
          <Layers className="h-4 w-4 text-indigo-600" />
          Line Items ({list.length})
        </h3>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-3xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-left text-xs">
            <thead className="bg-slate-50/90 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 tracking-wider">
              <tr>
                <th className="px-3.5 py-3 w-12 text-center">#</th>
                <th className="px-3.5 py-3 w-24">Type</th>
                <th className="px-3.5 py-3 min-w-[160px]">Item / Service Name</th>
                <th className="px-3.5 py-3 min-w-[200px]">Specifications / Scope</th>
                <th className="px-3.5 py-3 w-28 text-center">Qty &amp; UOM</th>
                <th className="px-3.5 py-3 w-28 text-right">Est. Unit Rate</th>
                <th className="px-3.5 py-3 w-24 text-center">HSN / SAC</th>
                <th className="px-3.5 py-3 w-32">Brand &amp; Policy</th>
                <th className="px-3.5 py-3 w-36">Documents &amp; Specs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {list.map((item: any, idx: number) => {
                const sp = (typeof item.specifications === 'object' && item.specifications) ? item.specifications : {};

                const rawType = firstPresent(
                  item.itemType,
                  item.type,
                  item.categoryType,
                  sp.itemType,
                  sp.type,
                  sp.categoryType
                );
                const isService = String(rawType || '').toLowerCase().includes('service');
                const itemType = isService ? 'Service' : 'Product';

                const rawName = firstPresent(
                  item.name,
                  item.itemName,
                  item.title,
                  item.productName,
                  item.materialName,
                  item.serviceName,
                  sp.itemName,
                  sp.name,
                  sp.title
                );

                const isGeneric = !rawName || /^item\s*#?\d+$/i.test(String(rawName).trim()) || String(rawName).trim().toLowerCase() === 'item';
                const name = !isGeneric
                  ? String(rawName)
                  : (defaultSubject && !/^item\s*#?\d+$/i.test(defaultSubject) ? defaultSubject : `Item #${idx + 1}`);

                const rawQty = firstPresent(
                  item.quantity,
                  item.qty,
                  item.targetQty,
                  item.requiredQty,
                  item.quantityRequired,
                  item.itemQuantity,
                  item.count,
                  item.unitCount,
                  item.numberOfUnits,
                  sp.quantity,
                  sp.qty
                );

                const unit = firstPresent(
                  item.unit,
                  item.uom,
                  item.unitOfMeasure,
                  item.unitType,
                  item.measuringUnit,
                  sp.unit,
                  sp.uom,
                  sp.unitOfMeasure
                ) || 'NOS.';

                const qtyDisplay = (rawQty !== undefined && rawQty !== null && rawQty !== '' && rawQty !== '-')
                  ? String(rawQty)
                  : (unit ? '1' : '-');

                const rawRate = firstPresent(
                  item.estimatedUnitPrice,
                  item.unitPrice,
                  item.estimatedRate,
                  item.price,
                  item.rate,
                  item.targetRate,
                  sp.estimatedUnitPrice,
                  sp.unitPrice,
                  sp.estimatedRate,
                  sp.price,
                  sp.rate
                );
                const rateNumber = (rawRate !== undefined && rawRate !== null && rawRate !== '' && !isNaN(Number(rawRate)) && Number(rawRate) > 0)
                  ? Number(rawRate)
                  : null;

                const rawHsn = firstPresent(
                  item.hsn_sac_code,
                  item.hsnSacCode,
                  item.hsnSac,
                  item.hsn,
                  item.hsnCode,
                  item.sac,
                  item.sacCode,
                  sp.hsn_sac_code,
                  sp.hsnSacCode,
                  sp.hsnSac,
                  sp.hsn,
                  sp.hsnCode,
                  sp.sac,
                  sp.sacCode
                );

                const rawSpec = firstPresent(
                  item.specification,
                  item.technicalSpecification,
                  item.spec,
                  typeof item.specifications === 'string' ? item.specifications : null,
                  sp.text,
                  sp.description,
                  sp.specification,
                  sp.technicalSpecification,
                  sp.details,
                  item.description,
                  item.desc,
                  item.details,
                  item.scope,
                  item.requirements
                );

                const itemBrand = firstPresent(
                  item.brand_preference,
                  item.brandPreference,
                  item.preferredBrand,
                  item.brand,
                  item.brandName,
                  item.make,
                  item.manufacturer,
                  item.makeModel,
                  item.model,
                  item.brandRequirement,
                  sp.brand_preference,
                  sp.brandPreference,
                  sp.preferredBrand,
                  sp.brand,
                  sp.brandName,
                  sp.make,
                  sp.manufacturer,
                  sp.brandRequirement
                );

                const itemPolicy = firstPresent(
                  item.brand_flexible,
                  item.brandFlexible,
                  item.isBrandFlexible,
                  sp.brand_flexible,
                  sp.brandFlexible,
                  sp.isBrandFlexible,
                  item.brandPolicy,
                  item.policy,
                  item.brandRule,
                  sp.brandPolicy,
                  sp.policy
                );

                const isLocked = itemPolicy === 'No' ||
                                 itemPolicy === false ||
                                 String(itemPolicy).toLowerCase() === 'no' ||
                                 String(itemPolicy).toLowerCase() === 'lock' ||
                                 String(itemPolicy).toLowerCase() === 'locked' ||
                                 String(itemPolicy).toLowerCase() === 'strict';

                const brandDisplayName = itemBrand && String(itemBrand).trim() && String(itemBrand).trim() !== '-'
                  ? String(itemBrand).trim()
                  : 'Any Brand';

                const allFiles = getUniqueItemFiles(item, sp, name);
                const fileCount = allFiles.length;

                return (
                  <tr key={idx} className="align-middle hover:bg-slate-50/70 transition-colors">
                    {/* # Index */}
                    <td className="px-3.5 py-3.5 text-center font-bold text-slate-400">
                      {idx + 1}
                    </td>

                    {/* Type */}
                    <td className="px-3.5 py-3.5">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                        isService
                          ? "border border-purple-200 bg-purple-50 text-purple-700"
                          : "border border-blue-200 bg-blue-50 text-blue-700"
                      )}>
                        {itemType}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="px-3.5 py-3.5">
                      <div className="font-black text-slate-900 text-xs">
                        {formatPrimitiveValue(name)}
                      </div>
                    </td>

                    {/* Specification / Scope */}
                    <td className="px-3.5 py-3.5 text-slate-600 font-medium max-w-[240px]">
                      <span className="line-clamp-2" title={rawSpec ? String(rawSpec) : undefined}>
                        {rawSpec ? formatPrimitiveValue(rawSpec) : <span className="text-slate-400 italic">No description</span>}
                      </span>
                    </td>

                    {/* Qty & UOM */}
                    <td className="px-3.5 py-3.5 text-center whitespace-nowrap">
                      <span className="font-extrabold text-slate-900">{qtyDisplay}</span>{' '}
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{unit}</span>
                    </td>

                    {/* Est. Unit Rate */}
                    <td className="px-3.5 py-3.5 text-right font-extrabold text-slate-900 whitespace-nowrap">
                      {rateNumber !== null ? (
                        <span>₹{rateNumber.toLocaleString('en-IN')}</span>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>

                    {/* HSN / SAC */}
                    <td className="px-3.5 py-3.5 text-center font-mono text-[11px] font-semibold text-slate-600">
                      {rawHsn ? String(rawHsn) : <span className="text-slate-400">-</span>}
                    </td>

                    {/* Brand & Policy */}
                    <td className="px-3.5 py-3.5">
                      <div className="text-slate-800 text-[11px] font-bold truncate max-w-[130px]" title={brandDisplayName}>
                        {brandDisplayName}
                      </div>
                      <div className="mt-0.5">
                        {isLocked ? (
                          <span className="inline-flex items-center text-[9px] font-black uppercase text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                            Lock
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[9px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                            Flexible
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Documents & Specs */}
                    <td className="px-3.5 py-3.5">
                      {fileCount > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (allFiles.length === 1) {
                              const f = allFiles[0];
                              const fname = f.fileName || f.name || f.originalName || `${name} Attachment`;
                              openFileAsset(
                                {
                                  fileAssetId: f.fileAssetId || f.id || (typeof f === 'number' ? f : undefined),
                                  url: f.url || f.fileUrl || (typeof f === 'string' ? f : undefined),
                                  originalName: fname,
                                },
                                fname
                              );
                            } else {
                              setViewingItemFiles({ title: name, files: allFiles });
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 px-2 py-1 text-[10px] font-extrabold transition-colors cursor-pointer shadow-2xs"
                          title="Click to view attachment"
                        >
                          <Paperclip className="h-3 w-3 text-emerald-600 shrink-0" />
                          <span>{fileCount} file{fileCount === 1 ? '' : 's'}</span>
                          <Eye className="h-3 w-3 text-emerald-700 shrink-0 ml-0.5" />
                        </button>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {viewingItemFiles && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  Item Attachments
                </h4>
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{viewingItemFiles.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingItemFiles(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
              {viewingItemFiles.files.map((file: any, fIdx: number) => {
                const fName = file.fileName || file.name || file.originalName || `Attachment #${fIdx + 1}`;
                return (
                  <div key={fIdx} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                    <span className="text-xs font-semibold text-slate-800 truncate max-w-[220px]" title={fName}>
                      {fName}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        openFileAsset(
                          {
                            fileAssetId: file.fileAssetId || file.id || (typeof file === 'number' ? file : undefined),
                            url: file.url || file.fileUrl || (typeof file === 'string' ? file : undefined),
                            originalName: fName,
                          },
                          fName
                        );
                      }}
                      className="h-7 text-[11px] gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BoqTableList({
  data,
  defaultSubject,
  defaultCategory,
  defaultEstimatedValue
}: {
  data: any;
  defaultSubject?: string;
  defaultCategory?: string;
  defaultEstimatedValue?: any;
}) {
  const list = asArray(data).filter(hasDetailData);
  if (!list.length) return null;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          BOQ Table ({list.length})
        </h3>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Sr #</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">UOM</th>
                <th className="px-4 py-3">Est. Rate</th>
                <th className="px-4 py-3">Tax %</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
              {list.map((item: any, idx: number) => {
                const sr = firstPresent(item.srNo, item.sr, item.sr_no, item.id, idx + 1);
                const rawCat = firstPresent(item.category, item.itemCategory, item.name, item.itemName, item.title);
                const isGenericCat = !rawCat || String(rawCat).trim().toLowerCase() === 'general' || /^category\s*#?\d+$/i.test(String(rawCat).trim()) || /^item\s*#?\d+$/i.test(String(rawCat).trim());
                const category = !isGenericCat
                  ? String(rawCat)
                  : (defaultCategory && defaultCategory !== 'General Procurement' ? defaultCategory : (defaultSubject || 'General'));

                const qty = firstPresent(item.quantity, item.qty, item.targetQty, item.count, '1');
                const uom = firstPresent(item.uom, item.unit, item.unitOfMeasure, 'Nos');

                const rawRate = firstPresent(item.estimatedRate, item.rate, item.unitPrice, item.price, item.estimatedPrice);
                const rate = (rawRate !== undefined && rawRate !== null && rawRate !== '' && rawRate !== '-')
                  ? rawRate
                  : (defaultEstimatedValue && Number(defaultEstimatedValue) > 0 ? defaultEstimatedValue : '-');

                const tax = firstPresent(item.taxPercent, item.tax, item.gstPercent, item.gst, item.gstRate, '18%');

                const rawTotal = firstPresent(item.total, item.amount, item.totalPrice, item.estimatedTotal);
                const total = (rawTotal !== undefined && rawTotal !== null && rawTotal !== '' && rawTotal !== '-')
                  ? rawTotal
                  : (defaultEstimatedValue && Number(defaultEstimatedValue) > 0 ? defaultEstimatedValue : '-');

                return (
                  <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-400">{sr}</td>
                    <td className="px-4 py-3 font-black text-slate-900">{formatPrimitiveValue(category)}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{qty} {uom}</td>
                    <td className="px-4 py-3 text-slate-600">{formatPrimitiveValue(uom || '-')}</td>
                    <td className="px-4 py-3 text-slate-700">{rate !== '-' ? (typeof rate === 'number' ? formatCurrency(rate) : formatPrimitiveValue(rate)) : '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{tax !== '-' ? `${String(tax).replace('%', '')}%` : '-'}</td>
                    <td className="px-4 py-3 font-black text-slate-900">{total !== '-' ? (typeof total === 'number' ? formatCurrency(total) : formatPrimitiveValue(total)) : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TechnicalCriteriaTableList({ data }: { data: any }) {
  if (!hasDetailData(data)) return null;

  let list: any[] = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (isPlainObject(data)) {
    list = asArray(data.technicalCriteria || data.criteria || data.evaluationCriteria || data.items);
  }
  list = list.filter(hasDetailData);

  if (!list.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-indigo-600" />
          Technical Evaluation Criteria ({list.length})
        </h3>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Criteria Name</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-center">Mandatory</th>
                <th className="px-4 py-3 text-center">Min Marks</th>
                <th className="px-4 py-3 text-center">Max Score</th>
                <th className="px-4 py-3 text-center">Weightage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
              {list.map((item: any, idx: number) => {
                if (isPlainObject(item)) {
                  const name = firstPresent(item.name, item.title, item.label, `Criteria ${idx + 1}`);
                  const desc = firstPresent(item.description, item.desc, item.details, '-');
                  const mandatory = item.mandatory !== false && String(item.mandatory).toLowerCase() === 'yes';
                  const minMarks = firstPresent(item.minMarks, item.minScore, item.passingMarks, '-');
                  const maxScore = firstPresent(item.maxScore, item.maxMarks, item.score, '-');
                  const weightage = firstPresent(item.weightage, item.weight, '-');

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-black text-slate-900">{formatPrimitiveValue(name)}</td>
                      <td className="px-4 py-3 font-medium text-slate-600 max-w-xs">{formatPrimitiveValue(desc)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          'inline-block rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider border',
                          mandatory
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        )}>
                          {mandatory ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-amber-700">{formatPrimitiveValue(minMarks)}</td>
                      <td className="px-4 py-3 text-center font-black text-slate-900">{formatPrimitiveValue(maxScore)}</td>
                      <td className="px-4 py-3 text-center font-extrabold text-indigo-700">
                        {weightage !== '-' ? `${weightage}%` : '-'}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-bold text-slate-400">{idx + 1}</td>
                    <td colSpan={6} className="px-4 py-3 font-bold text-slate-900">{formatPrimitiveValue(item)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ConsigneeTableList({ data, deliveryLocation, deliveryTerms, isBuyerRfq, isBuyerSide }: { data: any; deliveryLocation?: any; deliveryTerms?: any; isBuyerRfq?: boolean; isBuyerSide?: boolean }) {
  const ctx = React.useContext(BuyerSideContext);
  const isBuyer = typeof ctx === 'boolean' ? ctx : ctx.isBuyer;
  const isHiddenOnBuyer = Boolean(isBuyer || isBuyerSide || isBuyerRfq);
  const items = asArray(data).filter(hasDetailData);
  const showDeliveryMeta = !isHiddenOnBuyer && (hasDetailData(deliveryLocation) || hasDetailData(deliveryTerms));

  if (!showDeliveryMeta && items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <SectionHeader title="Consignee & Delivery Information" icon={MapPin} />

      {/* General Delivery Location & Delivery Terms - commented out / hidden on buyer side */}
      {showDeliveryMeta && (
        <div className="rounded-xl bg-slate-50/70 p-4 border border-slate-150">
          <PropertyGrid columns={2}>
            {hasDetailData(deliveryLocation) && (
              <PropertyItem label="General Delivery Location" value={deliveryLocation} />
            )}
            {hasDetailData(deliveryTerms) && (
              <PropertyItem label="Delivery Terms" value={deliveryTerms} />
            )}
          </PropertyGrid>
        </div>
      )}

      {items.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Consignee Name</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Delivery Location / Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                {items.map((item: any, idx: number) => {
                  if (isPlainObject(item)) {
                    const name = firstPresent(item.name, item.consigneeName, item.contactPerson, `Consignee ${idx + 1}`);
                    const qty = firstPresent(item.quantity, item.qty, '-');
                    const loc = firstPresent(item.location, item.address, item.deliveryAddress, '-');

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-3 font-black text-slate-900">{formatPrimitiveValue(name)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-md bg-indigo-50 border border-indigo-200/60 px-2.5 py-0.5 font-bold text-indigo-700">
                            {formatPrimitiveValue(qty)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{formatPrimitiveValue(loc)}</td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-bold text-slate-400">{idx + 1}</td>
                      <td colSpan={3} className="px-4 py-3 font-bold text-slate-900">{formatPrimitiveValue(item)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export interface ProcurementDetailUnifiedViewProps {
  procurementType: 'RFP' | 'RFQ' | 'RATE_CONTRACT' | 'OPEN_TENDER' | 'LIMITED_TENDER' | string;
  procurementLabel?: string;
  id: string | number;
  displayId?: string;
  requirementNumber?: string;
  subject: string;
  status: string;
  buyerName?: string;
  orgName?: string;
  contactPerson?: string;
  buyerEmail?: string;
  buyerMobile?: string;
  buyerAddress?: string;
  department?: string;
  buyer?: any;
  estimatedValue?: number | string;
  deadlineDate?: Date | string | null;
  createdAt?: Date | string | null;
  publishedDate?: string;
  closingDate?: string;
  clarificationDate?: string;
  technicalDate?: string;
  presentationDate?: string;
  financialDate?: string;
  awardDate?: string;
  requiredByDate?: string;
  requiredBy?: string;
  expectedDeliveryDate?: string;
  bidValidityDate?: string;
  validityDays?: number | string;
  preBidDate?: string;
  category?: string;
  subCategory?: string;
  projectDuration?: string;
  procurementMethod?: string;
  buyingType?: string;
  deliveryLocation?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  description?: string;
  payload?: any;
  documents?: DisplayDocument[];
  items?: any[];
  requiredDocuments?: any;
  boqTable?: any;
  serviceDetails?: any;
  consigneeDetails?: any;
  evaluationMethod?: string;
  timeSlot?: string;
  technicalOpeningDate?: string;
  financialOpeningDate?: string;
  participations?: any[];
  participantsCount?: number;
  totalClarifications?: number;
  hasSubmittedProposal?: boolean;
  ownParticipation?: any;
  ownResponse?: any;
  emdAmount?: number;
  isEmdRequired?: boolean;
  backRoute?: string;
  backRouteLabel?: string;
  onBack?: () => void;
  onDiscardClick?: () => void;
  submitButtonLabel?: string;
  onSubmitClick?: () => void;
  onDownloadClick?: () => void;
  /** Override the ClarificationPanel kind (defaults to 'quote-request' for RFQ/RFP, 'requirement' for Rate Contract/Limited Tender) */
  clarificationKind?: 'quote-request' | 'requirement';
  /** Override the entity ID used for clarifications (defaults to props.id) */
  clarificationEntityId?: string | number;
  
  // Invoice conversion feature
  invoiceStatus?: { exists: boolean; invoiceId?: number; loading?: boolean } | null;
  isConvertingInvoice?: boolean;
  onConvertToInvoiceClick?: () => void;
  
  // Invitations
  invitedCount?: number;
  invitedSellers?: any[];
  invitations?: any[];
}

export function ProcurementDetailUnifiedView(props: ProcurementDetailUnifiedViewProps) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const { user } = useAuth();
  const currentUser: any = user;
  const [activeTab, setActiveTab] = useState<'overview' | 'scope_docs' | 'terms_schedule' | 'evaluation' | 'clarifications'>('overview');
  const [isEmdModalOpen, setIsEmdModalOpen] = useState(false);
  const [selectedQuotationForReview, setSelectedQuotationForReview] = useState<any | null>(null);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const [isCompareChooserOpen, setIsCompareChooserOpen] = useState(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);

  const [nowMs] = useState(() => Date.now());
  const targetId = String(props.id);
  const userRoleStr = String(currentUser?.role || '').toLowerCase();
  const isBuyerOrAdmin = userRoleStr === 'buyer' || userRoleStr === 'admin' || userRoleStr === 'master_admin' || (!!currentUser?.id && String(currentUser?.id) === String(props.buyer?.id));
  const isBuyerSide = userRoleStr === 'buyer' || pathname.startsWith('/buyer') || (isBuyerOrAdmin && !pathname.startsWith('/seller') && !pathname.startsWith('/shg'));

  const { data: fetchedParticipants } = useQuery({
    queryKey: ['buyer-unified-participations', props.procurementType, targetId],
    queryFn: async () => {
      if (!targetId) return [];

      const extractArray = (res: any): any[] => {
        if (!res) return [];
        if (Array.isArray(res)) return res;
        if (Array.isArray(res.responses)) return res.responses;
        if (Array.isArray(res.participants)) return res.participants;
        if (Array.isArray(res.participations)) return res.participations;
        if (Array.isArray(res.results)) return res.results;
        if (Array.isArray(res.items)) return res.items;
        if (Array.isArray(res.data)) return extractArray(res.data);
        return [];
      };

      const normalizeItem = (r: any, idx: number) => {
        const respData = typeof r.responseData === 'string' ? JSON.parse(r.responseData) : (r.responseData || {});
        const sId = r.sellerUserId || r.sellerId || r.seller?.id || r.sellerUser?.id || r.id;
        const sellerOrgName = r.sellerOrgName
          || r.sellerOrganization?.organizationName
          || r.seller?.organization?.organizationName
          || r.seller?.sellerProfile?.organizationName
          || r.sellerProfile?.organizationName
          || r.companyName
          || r.sellerName
          || r.sellerUser?.name
          || r.seller?.name
          || (sId && String(sId) !== 'undefined' ? `Supplier #${sId}` : `Supplier ${idx + 1}`);
        const contactPerson = r.sellerUser?.name || r.contactPerson || r.sellerName || r.seller?.name || 'Contact Person';

        return {
          id: r.id || `p-${idx}`,
          sellerId: sId,
          sellerUserId: sId,
          sellerOrganizationId: r.sellerOrganizationId || r.sellerOrganization?.id || r.seller?.organizationId || r.seller?.organization?.id,
          sellerOrgName: sellerOrgName,
          sellerName: contactPerson,
          companyName: sellerOrgName,
          contactPerson: contactPerson,
          email: r.sellerUser?.email || r.email || r.sellerEmail || r.seller?.email || '',
          phone: r.sellerUser?.mobile || r.phone || r.sellerMobile || r.seller?.mobile || '',
          submittedAt: r.createdAt || r.submittedAt || r.updatedAt,
          submissionStatus: r.status === 'SHORTLISTED' || r.status === 'ACCEPTED' ? 'SUBMITTED' : (r.status || r.submissionStatus || 'SUBMITTED'),
          status: r.status || r.submissionStatus || 'SUBMITTED',
          quotedAmount: Number(r.offeredPrice || r.quotedAmount || r.totalAmount || r.totalPrice || 0),
          totalAmount: Number(r.offeredPrice || r.quotedAmount || r.totalAmount || r.totalPrice || 0),
          offeredQuantity: r.offeredQuantity || r.quantity || 1,
          deliveryTimeline: r.deliveryTimeline || respData.deliveryTimeline || 'Standard',
          paymentTerms: r.paymentTerms || respData.paymentTerms || 'As per tender',
          makeBrand: r.makeBrand || respData.makeBrand || 'Standard',
          documents: r.documents || respData.documents || [],
          lineItems: r.lineItems || respData.lineItems || [],
          message: r.message || r.remarks || r.rfqNotes || '',
          seller: r.seller || {
            name: contactPerson,
            email: r.sellerUser?.email || r.email,
            mobile: r.sellerUser?.mobile || r.phone,
            organization: r.sellerOrganization || { organizationName: sellerOrgName }
          },
          sellerUser: r.sellerUser || r.seller || { name: contactPerson },
          sellerOrganization: r.sellerOrganization || r.seller?.organization || { organizationName: sellerOrgName }
        };
      };

      const numericId = Number(String(targetId).replace(/^(REQ-|RFQ-|RC-|RATE-|TND-)/i, '')) || 0;
      const idsToTry = Array.from(new Set([targetId, numericId > 0 ? String(numericId) : null].filter(Boolean) as string[]));

      for (const idToken of idsToTry) {
        try {
          const reqRes: any = await getApi(`/api/buyer/requirements/${encodeURIComponent(idToken)}/responses`, true);
          const reqItems = extractArray(reqRes);
          if (reqItems.length > 0) return reqItems.map(normalizeItem);
        } catch { }

        try {
          const directRes: any = await getApi(`/api/buyer/procurement-bids/${encodeURIComponent(idToken)}/participants`, true);
          const directItems = extractArray(directRes);
          if (directItems.length > 0) return directItems.map(normalizeItem);
        } catch { }

        try {
          const bidRes: any = await procurementBidApi.detail(idToken);
          const bidItems = extractArray(bidRes);
          if (bidItems.length > 0) return bidItems.map(normalizeItem);
        } catch { }

        try {
          const genRes: any = await getApi(`/api/marketplace/requirements/${encodeURIComponent(idToken)}/responses`, true);
          const genItems = extractArray(genRes);
          if (genItems.length > 0) return genItems.map(normalizeItem);
        } catch { }
      }

      return [];
    },
    enabled: Boolean(isBuyerOrAdmin && targetId && targetId !== 'RFQ' && targetId !== 'RFP'),
    staleTime: 30_000,
  });
  const { data: emdRes, refetch: refetchEmd, isLoading: emdLoading } = useQuery({
    queryKey: ['emd-status-unified', targetId, currentUser?.id],
    queryFn: async () => {
      if (!targetId) return null;
      try {
        const r = await getApi<any>(`/api/emd/status?requestId=${encodeURIComponent(targetId)}`);
        return r?.data ?? r;
      } catch {
        return null;
      }
    },
    enabled: currentUser?.role === 'seller' && !!targetId,
  });

  const isEmdPaid = emdRes?.status === 'PAID' || emdRes?.status === 'VERIFIED';
  const emdInfo: EmdInfo | null = useMemo(() => {
    const isEmdReq = emdRes?.isEmdRequired ?? props.isEmdRequired ?? false;
    const amt = emdRes?.emdAmount ?? props.emdAmount ?? 0;
    if (!isEmdReq || Number(amt) <= 0) return null;

    return {
      isEmdRequired: isEmdReq,
      emdAmount: Number(amt),
      paymentMethod: emdRes?.paymentMethod || 'Online Escrow',
      paymentDeadline: emdRes?.paymentDeadline,
      refundPolicy: emdRes?.refundPolicy || 'Refundable upon completion of evaluation',
      instructions: emdRes?.instructions,
      status: isEmdPaid ? 'PAID' : (emdRes?.status || 'PENDING'),
      payment: emdRes?.payment || null,
    };
  }, [emdRes, props.isEmdRequired, props.emdAmount, isEmdPaid]);

  // ── EMD Flow (Commented out as requested) ──
  const showEmdCard = false; // isEmdApplicable(props.procurementType, emdInfo?.isEmdRequired, emdInfo?.emdAmount);
  const isEmdGated = false; // showEmdCard && !isEmdPaid && !props.hasSubmittedProposal;

  const handleActionSubmit = () => {
    if (!currentUser) {
      toast.error('Please login to participate.');
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (isEmdGated) {
      toast.error('Please complete EMD Payment before submitting your quotation/proposal.');
      setIsEmdModalOpen(true);
      return;
    }

    if (props.onSubmitClick) {
      props.onSubmitClick();
    }
  };

  const payload = props.payload || {};
  const basics = payload.basics || {};
  const internal = payload.internal || {};
  const schedule = payload.schedule || {};
  const tender = payload.tender || {};
  const terms = payload.terms || {};
  const rules = payload.rules || {};
  const evaluation = payload.evaluation || {};
  const serviceDetails = props.serviceDetails || payload.serviceDetails || {};
  const buyerProfile = props.buyer?.buyerProfile || {};
  const buyerOrg = props.buyer?.buyerOrganization || props.buyer?.organization || {};

  const documents = props.documents || [];
  const requiredDocuments = firstPresent(
    props.requiredDocuments,
    payload.requiredDocuments,
    payload.requiredDocs,
    payload.documentsRequired,
    rules.requiredDocuments,
    rules.documentsRequired,
    payload.tender?.requiredDocuments,
    payload.rateContractConfig?.requiredDocuments
  );
  const rawLineItems = asArray(props.items || payload.items || payload.lineItems);
  const fallbackLineItems = asArray(payload.items || payload.lineItems || payload.wizardData?.items);
  const lineItems = useMemo(() => {
    const seen = new Set<string>();
    const res: any[] = [];
    for (let i = 0; i < rawLineItems.length; i++) {
      const item = rawLineItems[i];
      if (!item) continue;
      const fallback = fallbackLineItems[i] || {};
      const mergedItem = {
        ...fallback,
        ...item,
        specifications: {
          ...(typeof fallback.specifications === 'object' ? fallback.specifications : {}),
          ...(typeof item.specifications === 'object' ? item.specifications : {}),
        }
      };
      const name = mergedItem.name || mergedItem.itemName || mergedItem.description || mergedItem.title || '';
      const qty = mergedItem.quantity || mergedItem.qty || 0;
      const uom = mergedItem.unitOfMeasure || mergedItem.unit || mergedItem.uom || '';
      const key = `${String(name).trim().toLowerCase()}_${qty}_${String(uom).trim().toLowerCase()}_${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        res.push(mergedItem);
      }
    }
    return res;
  }, [rawLineItems, fallbackLineItems]);

  const rawBoqTable = asArray(props.boqTable || payload.boqTable || payload.boq);
  const boqTable = useMemo(() => {
    const seen = new Set<string>();
    const res: any[] = [];
    for (const item of rawBoqTable) {
      if (!item) continue;
      const name = item.itemName || item.name || item.description || '';
      const qty = item.quantity || item.qty || 0;
      const key = `${String(name).trim().toLowerCase()}_${qty}`;
      if (!seen.has(key)) {
        seen.add(key);
        res.push(item);
      }
    }
    return res;
  }, [rawBoqTable]);

  const statusLabel = (props.status || 'ACTIVE').toUpperCase();
  const displayIdStr = String(props.displayId || props.id);
  const procurementTypeLabel = props.procurementLabel || props.procurementType || 'PROCUREMENT';

  // Title / Procurement Name Resolution
  const isGenericTitle = (val?: string | null) => {
    if (!val) return true;
    const s = String(val).trim().toLowerCase();
    return (
      s === 'procurement bid' ||
      s.startsWith('procurement bid #') ||
      s.startsWith('procurement #') ||
      s === 'untitled procurement bid' ||
      s === 'procurement requirement' ||
      s === 'procurement tender' ||
      s === 'open tender' ||
      s === 'limited tender' ||
      s === 'request for quotation' ||
      s === 'request for proposal' ||
      s === 'rate contract' ||
      s === 'n/a' ||
      s === '—'
    );
  };

  const candidateTitles = [
    props.subject,
    payload.title,
    basics.title,
    basics.contractTitle,
    basics.procurementTitle,
    payload.rateContractConfig?.contractTitle,
    serviceDetails.title,
    lineItems[0]?.name,
    lineItems[0]?.itemName,
    lineItems[0]?.title,
    lineItems[0]?.specification,
    boqTable[0]?.name,
    boqTable[0]?.category,
    props.description && props.description.length < 80 ? props.description : null,
    basics.description && basics.description.length < 80 ? basics.description : null,
  ];

  const firstValidTitle = candidateTitles.find(t => t && !isGenericTitle(t));

  const resolvedSubject = firstValidTitle
    ? String(firstValidTitle).trim()
    : displayIdStr && displayIdStr !== 'N/A' && displayIdStr !== '—'
      ? `${procurementTypeLabel} #${displayIdStr}`
      : `${procurementTypeLabel} Opportunity`;

  // Data Extractions for Overview & Dates Tab
  const procurementNumber = firstPresent(
    props.requirementNumber,
    props.displayId && props.displayId !== '-1' && props.displayId !== '—' ? props.displayId : undefined,
    payload.requirementNumber,
    payload.bidNumber,
    payload.linkedProcurementBidNumber,
    basics.bidNumber,
    basics.requirementNumber,
    props.id && Number(props.id) > 0 ? `${procurementTypeLabel.toUpperCase().replace(/\s+/g, '_')}-${props.id}` : undefined
  ) || `RFQ-${Math.abs(Number(props.id || 1))}`;

  const isRfqType =
    props.procurementType === 'RFQ' ||
    String(props.procurementType || '').toUpperCase().includes('RFQ') ||
    String(props.procurementLabel || '').toUpperCase().includes('QUOTATION') ||
    String(props.procurementLabel || '').toUpperCase().includes('RFQ');
  const isBuyerRfq = isBuyerSide && (isRfqType || pathname.includes('/rfq'));

  const isOpenTenderType =
    props.procurementType === 'OPEN_TENDER' ||
    String(props.procurementType || '').toUpperCase().includes('OPEN_TENDER') ||
    String(props.procurementType || '').toUpperCase().includes('OPEN TENDER') ||
    String(props.procurementLabel || '').toUpperCase().includes('OPEN TENDER') ||
    String(props.procurementMethod || '').toUpperCase().includes('OPEN TENDER') ||
    pathname.includes('/open-tender') ||
    (pathname.includes('/tender') && !pathname.includes('/limited'));
  const isBuyerOpenTender = isBuyerSide && isOpenTenderType;

  const isLimitedTenderType =
    props.procurementType === 'LIMITED_TENDER' ||
    String(props.procurementType || '').toUpperCase().includes('LIMITED_TENDER') ||
    String(props.procurementType || '').toUpperCase().includes('LIMITED TENDER') ||
    String(props.procurementLabel || '').toUpperCase().includes('LIMITED TENDER') ||
    String(props.procurementMethod || '').toUpperCase().includes('LIMITED TENDER') ||
    pathname.includes('/limited-tender') ||
    pathname.includes('/limited');
  const isBuyerLimitedTender = isBuyerSide && isLimitedTenderType;

  const cleanBuyerTerms = (val: any): any => {
    if (!isBuyerSide || !val) return val;
    if (typeof val === 'string') {
      if ((isBuyerOpenTender || isBuyerLimitedTender) && val.toLowerCase().includes('warranty')) {
        return null;
      }
      return val;
    }
    if (typeof val !== 'object') return val;
    if (Array.isArray(val)) {
      return val
        .map(cleanBuyerTerms)
        .filter(item => {
          if (item === null || item === undefined || item === '') return false;
          if (typeof item === 'string' && (isBuyerOpenTender || isBuyerLimitedTender) && item.toLowerCase().includes('warranty')) return false;
          return true;
        });
    }
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      const lower = k.toLowerCase().replace(/[^a-z]/g, '');
      if (
        // Warranty terms strictly commented out / hidden on buyer side in open and limited tender
        ((isBuyerOpenTender || isBuyerLimitedTender) && (
          lower === 'warrantyterms' ||
          lower === 'warranty' ||
          lower === 'warrantyperiod' ||
          lower.includes('warranty')
        )) ||
        lower === 'retentionamount' ||
        lower === 'securitydeposit' ||
        lower === 'retention' ||
        lower === 'securitydepositamount' ||
        lower === 'retentionpercentage' ||
        lower === 'securitydepositpercentage' ||
        lower === 'securitydepositrequired' ||
        lower === 'isretentionapplicable' ||
        lower === 'retentionapplicable' ||
        lower === 'advanceallowed' ||
        lower === 'advance' ||
        lower === 'advancepayment' ||
        lower === 'advancepaymentallowed' ||
        lower === 'advanceallowedflag' ||
        lower === 'advancepercentage' ||
        lower === 'advanceamount' ||
        lower === 'mobilizationadvance' ||
        lower.includes('advance') ||
        lower.includes('retention') ||
        lower.includes('securitydeposit')
      ) {
        continue;
      }
      clean[k] = cleanBuyerTerms(v);
    }
    return clean;
  };

  const rawMethod = firstPresent(
    props.procurementMethod,
    payload.fullProcurementMethod,
    payload.type,
    props.procurementLabel,
    props.procurementType
  ) || procurementTypeLabel;

  const procurementMethod = isRfqType
    ? 'Request for Quotation'
    : (rawMethod === 'RFQ' ? 'Request for Quotation' : rawMethod);

  const buyingType = firstPresent(
    props.buyingType,
    payload.buyingType,
    basics.whatAreYouBuying,
    basics.buyingType,
    payload.bidType
  ) || 'Product';

  const category = firstPresent(
    props.category && props.category !== '—' && props.category !== 'N/A' ? props.category : undefined,
    basics.category,
    payload.categoryName
  ) || 'General Procurement';

  const subCategory = firstPresent(
    props.subCategory && props.subCategory !== '—' && props.subCategory !== 'N/A' ? props.subCategory : undefined,
    basics.subCategory,
    basics.subcategory,
    basics.subCategoryName,
    payload.subCategory,
    payload.subcategory
  ) || 'General Sub-category';

  const publishedDateValue = firstPresent(
    schedule.publishDate,
    tender.publishDate,
    tender.bidStartDate,
    schedule.submissionStartDate,
    props.publishedDate,
    props.createdAt
  );

  const closingDateValue = firstPresent(
    schedule.submissionDate,
    schedule.submissionDeadline,
    schedule.submissionEndDate,
    schedule.bidClosingDate,
    tender.bidClosingDate,
    props.closingDate,
    props.deadlineDate
  );

  const clarificationDateValue = firstPresent(
    schedule.clarificationEndDate,
    schedule.clarificationDeadline,
    tender.clarificationEndDate,
    props.clarificationDate,
    schedule.preBidDate,
    schedule.preBidMeetingDate,
    tender.preBidDate,
    tender.preBidMeetingDate
  );

  const technicalDateValue = firstPresent(
    tender.technicalEvaluationDate,
    schedule.technicalOpeningDate,
    props.technicalDate,
    props.technicalOpeningDate
  );

  const presentationDateValue = firstPresent(
    schedule.presentationDate,
    tender.presentationDate,
    props.presentationDate
  );

  const financialDateValue = firstPresent(
    tender.financialEvaluationDate,
    schedule.financialOpeningDate,
    schedule.finalEvaluationDate,
    props.financialDate,
    props.financialOpeningDate
  );

  const awardDateValue = firstPresent(
    tender.awardDate,
    schedule.awardDate,
    schedule.awardingDate,
    schedule.expectedAwardDate,
    props.awardDate
  );

  const submissionStartDateValue = firstPresent(
    schedule.submissionStartDate,
    schedule.startDate,
    tender.bidStartDate,
    props.createdAt,
    publishedDateValue
  );

  const clarificationDeadlineValue = firstPresent(
    schedule.clarificationDeadline,
    schedule.clarificationEndDate,
    schedule.clarificationDate,
    tender.clarificationDeadline,
    tender.clarificationEndDate,
    props.clarificationDate
  );

  const preBidDateValue = firstPresent(
    schedule.preBidMeetingDate,
    schedule.preBidDate,
    tender.preBidMeetingDate,
    tender.preBidDate,
    props.preBidDate
  );

  const requiredByDateValue = firstPresent(
    basics.requiredByDate,
    basics.requiredBy,
    basics.expectedDeliveryDate,
    basics.deliveryDate,
    schedule.requiredByDate,
    schedule.deliveryDate,
    schedule.expectedDeliveryDate,
    payload.requiredByDate,
    payload.requiredBy,
    tender.requiredByDate,
    tender.requiredBy,
    tender.deliveryDate,
    props.requiredByDate,
    props.requiredBy,
    props.expectedDeliveryDate
  );

  const rawValidityDays = firstPresent(
    schedule.validityDays,
    tender.validityDays,
    rules.validityDays,
    payload.validityDays,
    props.validityDays,
    90
  );
  const validityDaysDisplay = rawValidityDays
    ? (String(rawValidityDays).toLowerCase().includes('day') ? String(rawValidityDays) : `${rawValidityDays} Days`)
    : '90 Days';

  const bidValidityDateValue = firstPresent(
    schedule.bidValidityDate,
    tender.bidValidityDate,
    schedule.bidValidityDeadline,
    props.bidValidityDate
  );

  const bidValidityDateComputed = bidValidityDateValue
    ? bidValidityDateValue
    : (closingDateValue ? (() => {
        try {
          const cDate = new Date(closingDateValue);
          if (!isNaN(cDate.getTime())) {
            const daysToAdd = Number(rawValidityDays) || 90;
            const computed = new Date(cDate.getTime() + daysToAdd * 86_400_000);
            return computed.toISOString();
          }
        } catch {}
        return undefined;
      })() : undefined);

  const publishedDateFormatted = publishedDateValue ? formatDateString(publishedDateValue) : (props.publishedDate ? formatDateString(props.publishedDate) : 'N/A');
  const closingDateFormatted = closingDateValue ? formatDateString(closingDateValue) : (props.closingDate ? formatDateString(props.closingDate) : 'N/A');
  const clarificationDateFormatted = clarificationDateValue ? formatDateString(clarificationDateValue, true) : (props.clarificationDate ? formatDateString(props.clarificationDate, true) : 'N/A');
  const clarificationDeadlineFormatted = clarificationDeadlineValue ? formatDateString(clarificationDeadlineValue, true) : (clarificationDateFormatted !== 'N/A' ? clarificationDateFormatted : undefined);
  const technicalDateFormatted = technicalDateValue ? formatDateString(technicalDateValue, true) : (props.technicalDate || props.technicalOpeningDate ? formatDateString(props.technicalDate || props.technicalOpeningDate, true) : 'N/A');
  const presentationDateFormatted = presentationDateValue ? formatDateString(presentationDateValue, true) : (props.presentationDate ? formatDateString(props.presentationDate, true) : 'N/A');
  const financialDateFormatted = financialDateValue ? formatDateString(financialDateValue, true) : (props.financialDate || props.financialOpeningDate ? formatDateString(props.financialDate || props.financialOpeningDate, true) : 'N/A');
  const awardDateFormatted = awardDateValue ? formatDateString(awardDateValue, true) : (props.awardDate ? formatDateString(props.awardDate, true) : 'N/A');
  const submissionStartDateFormatted = submissionStartDateValue ? formatDateString(submissionStartDateValue, true) : publishedDateFormatted;
  const requiredByDateFormatted = requiredByDateValue ? formatDateString(requiredByDateValue) : undefined;
  const preBidDateFormatted = preBidDateValue ? formatDateString(preBidDateValue, true) : undefined;
  const bidValidityDateFormatted = bidValidityDateComputed ? formatDateString(bidValidityDateComputed) : undefined;

  const deliveryLocation = firstPresent(
    props.deliveryLocation && props.deliveryLocation !== '—' && props.deliveryLocation !== 'N/A' && props.deliveryLocation !== 'Delivery location not specified' ? props.deliveryLocation : undefined,
    payload.deliveryLocation,
    basics.deliveryLocation,
    basics.location,
    internal.deliveryAddress,
    internal.location,
    tender.deliveryAddress,
    tender.deliveryLocation,
    buyerOrg.city ? `${buyerOrg.city}, ${buyerOrg.state || ''}` : undefined,
    buyerProfile.city ? `${buyerProfile.city}, ${buyerProfile.state || ''}` : undefined
  ) || 'Door Delivery to Site';

  const projectDuration = firstPresent(
    props.projectDuration && props.projectDuration !== '—' && props.projectDuration !== 'N/A' ? props.projectDuration : undefined,
    basics.projectDuration,
    basics.duration,
    serviceDetails.duration,
    serviceDetails.contractPeriod,
    terms.contractPeriod,
    terms.projectDuration,
    schedule.contractPeriod,
    schedule.duration
  ) || '30 Days';

  const paymentTerms = firstPresent(
    props.paymentTerms && props.paymentTerms !== '—' && props.paymentTerms !== 'N/A' ? props.paymentTerms : undefined,
    terms.paymentTerms,
    terms.paymentMode
  ) || 'ON_DELIVERY';

  const scopeText = firstPresent(
    props.description && props.description !== 'No description provided.' && props.description !== '—' ? props.description : undefined,
    basics.description,
    basics.justification,
    payload.recommendation?.reason,
    serviceDetails.scopeOfWork,
    serviceDetails.description,
    props.subject && !isGenericTitle(props.subject) ? `Procurement requirement for ${props.subject}` : undefined
  ) || 'Detailed line item specifications attached in BOQ schedule.';

  const buyerOrgName = firstPresent(
    props.orgName && props.orgName !== '—' && props.orgName !== 'N/A' ? props.orgName : undefined,
    internal.orgName,
    basics.organizationName,
    buyerOrg.organizationName,
    buyerProfile.organizationName,
    buyerProfile.companyName,
    props.buyer?.buyerProfile?.organizationName,
    props.buyer?.name
  ) || 'Buyer Organization';

  const contactPerson = firstPresent(
    props.buyerName && props.buyerName !== '—' && props.buyerName !== 'N/A' ? props.buyerName : undefined,
    props.contactPerson && props.contactPerson !== '—' && props.contactPerson !== 'N/A' ? props.contactPerson : undefined,
    internal.contactPerson,
    internal.contactPersonName,
    buyerOrg.contactPerson,
    buyerProfile.representativeName,
    buyerProfile.contactPersonName,
    buyerProfile.contactPerson,
    buyerProfile.name,
    props.buyer?.name,
    props.buyer?.buyerProfile?.representativeName,
    props.buyer?.buyerProfile?.contactPersonName,
    props.buyer?.buyerProfile?.contactPerson
  ) || (buyerOrgName && buyerOrgName !== 'N/A' && buyerOrgName !== 'Buyer Organization' ? `${buyerOrgName} Purchase Officer` : 'Authorized Procurement Officer');

  const email = firstPresent(
    props.buyerEmail && props.buyerEmail !== 'N/A' && props.buyerEmail !== '' ? props.buyerEmail : undefined,
    props.buyer?.email,
    internal.email,
    internal.contactEmail,
    buyerOrg.email,
    buyerProfile.contactPersonEmail,
    buyerProfile.email,
    props.buyer?.buyerProfile?.contactPersonEmail,
    props.buyer?.buyerProfile?.email
  ) || '';

  const phone = firstPresent(
    props.buyerMobile && props.buyerMobile !== 'N/A' && props.buyerMobile !== '' ? props.buyerMobile : undefined,
    props.buyer?.mobile,
    props.buyer?.phone,
    internal.mobile,
    internal.phone,
    buyerOrg.mobile,
    buyerOrg.phone,
    buyerProfile.contactPersonMobile,
    buyerProfile.mobile,
    buyerProfile.phone,
    props.buyer?.buyerProfile?.contactPersonMobile,
    props.buyer?.buyerProfile?.mobile
  ) || '';

  const addressParts = [
    buyerOrg.registeredAddress || buyerOrg.address || buyerProfile.registeredAddress || buyerProfile.address,
    buyerOrg.city || buyerProfile.city,
    buyerOrg.district || buyerProfile.district,
    buyerOrg.state || buyerProfile.state,
  ].filter(Boolean);

  const buyerAddress = firstPresent(
    props.buyerAddress,
    addressParts.length ? addressParts.join(', ') : undefined,
    props.buyer?.buyerProfile?.address
  ) || '';

  const department = firstPresent(
    props.department && props.department !== 'N/A' && props.department !== '—' ? props.department : undefined,
    buyerOrg.department,
    buyerOrg.departmentName,
    buyerProfile.department,
    buyerProfile.departmentName,
    internal.department,
    props.buyer?.buyerProfile?.department,
    props.buyer?.buyerProfile?.departmentName
  ) || 'Procurement & Stores Department';

  const deliveryTerms = firstPresent(
    props.deliveryTerms,
    terms.deliveryTerms,
    terms.deliveryMode,
    terms.deliverySchedule
  ) || 'N/A';

  const rawConsignee = props.consigneeDetails || payload.consigneeDetails || payload.consignee || payload.consignees || payload.consigneeList;
  const consigneeList = asArray(rawConsignee);
  const consigneeDetails = consigneeList.length
    ? consigneeList
    : (deliveryLocation && deliveryLocation !== '—' && deliveryLocation !== 'N/A'
      ? [{ name: contactPerson && contactPerson !== '—' && contactPerson !== 'N/A' ? contactPerson : buyerOrgName, quantity: (lineItems[0]?.quantity || boqTable[0]?.quantity || '100'), location: deliveryLocation }]
      : []);

  const isEmdRequired = Boolean(
    props.isEmdRequired ??
    emdInfo?.isEmdRequired ??
    payload?.emd?.isEmdRequired ??
    basics?.isEmdRequired ??
    rules?.isEmdRequired ??
    false
  );
  const rawEmdAmt = isEmdRequired
    ? (emdInfo?.emdAmount ?? props.emdAmount ?? payload?.emd?.amount ?? rules?.emdAmount ?? 0)
    : 0;

  const emdDisplay = (isEmdRequired && Number(rawEmdAmt) > 0)
    ? formatCurrency(rawEmdAmt)
    : (isEmdRequired ? 'Required' : 'Not required');

  const vendors = payload.vendors || {};
  const approval = payload.approval || {};

  const rawSpecificEvalMethod = [
    evaluation.method,
    evaluation.evaluationMethod,
    evaluation.type,
    evaluation.name,
    payload.evaluationMethod,
    payload.evaluation_method,
    rules.evaluationMethod,
    tender.evaluationMethod,
    (props as any).payload?.evaluation?.method,
    (props as any).payload?.evaluation?.evaluationMethod,
    (props as any).payload?.evaluationMethod,
    (props as any).payload?.rules?.evaluationMethod,
    (props as any).evaluation?.method,
    (props as any).evaluationMethod,
  ].find(v => typeof v === 'string' && v.trim().length > 0 && !['l1', 'l1 basis', 'l1 evaluation'].includes(v.trim().toLowerCase()));

  const evaluationMethod = rawSpecificEvalMethod || firstPresent(
    props.evaluationMethod,
    evaluation.evaluationMethod,
    evaluation.method,
    rules.evaluationMethod,
    payload.evaluationMethod,
    tender.evaluationMethod
  ) || 'L1 Basis';

  const requireDemo = payload.requireDemo === true || evaluation.requireDemo === true || String(payload.requireDemo).toLowerCase() === 'true'
    ? 'Yes'
    : firstPresent(
        payload.requireDemo,
        evaluation.requireDemo,
        rules.requireDemo,
        'No'
      );

  const qcbsRatio = firstPresent(
    evaluation.qcbsRatio,
    payload.qcbsRatio,
    rules.qcbsRatio,
    (evaluation.techWeight && evaluation.commWeight ? `${evaluation.techWeight}:${evaluation.commWeight}` : undefined),
    (payload.techWeight && payload.commWeight ? `${payload.techWeight}:${payload.commWeight}` : undefined)
  );

  const passingScore = firstPresent(
    evaluation.passingScore,
    payload.passingScore,
    rules.passingScore
  );

  const isTechEvalNeeded = Boolean(
    payload.isTechnicalEvaluationNeeded ||
    basics.isTechnicalEvaluationNeeded ||
    rules.isTechnicalEvaluationNeeded ||
    (evaluationMethod && (
      evaluationMethod.toLowerCase().includes('qcbs') ||
      evaluationMethod.toLowerCase().includes('tech') ||
      evaluationMethod.toLowerCase().includes('score')
    ))
  );

  const technicalCriteria = firstPresent(
    evaluation.technicalCriteria,
    evaluation.criteria,
    evaluation.evaluationCriteria,
    payload.technicalCriteria,
    payload.criteria,
    rules.technicalCriteria,
    rules.criteria
  );

  const hasExplicitTechCriteria = Boolean(
    isTechEvalNeeded &&
    technicalCriteria &&
    hasDetailData(technicalCriteria) &&
    (Array.isArray(technicalCriteria) ? technicalCriteria.length > 0 : true)
  );

  const questionnaireData = firstPresent(
    payload.questionnaire,
    rules.questionnaire,
    evaluation.questionnaire
  );

  const effectiveInviteCount = useMemo(() => {
    // 1. Check array candidates for real invited seller records
    const arrayCandidates = [
      props.invitations,
      props.invitedSellers,
      vendors.invitedSellers,
      vendors.invitedSuppliers,
      payload.invitedSellers,
      payload.invitations,
      payload.invitedSuppliers,
      payload.rateContractConfig?.selectedSuppliers,
      payload.rateContract?.selectedSuppliers,
      payload.auctionConfig?.qualifiedVendors,
      rules.invitedSellers,
    ];

    let maxFromArrays = 0;
    for (const arr of arrayCandidates) {
      if (Array.isArray(arr) && arr.length > maxFromArrays) {
        maxFromArrays = arr.length;
      }
    }
    if (maxFromArrays > 0) return maxFromArrays;

    // 2. Check numeric candidates if array is not populated
    const numericCandidates = [
      props.invitedCount,
      (props as any).invitationsCount,
      vendors.inviteCount,
      vendors.invitedCount,
      payload.inviteCount,
      payload.invitedCount,
      rules.inviteCount,
    ];

    for (const val of numericCandidates) {
      const num = Number(val);
      if (Number.isFinite(num) && num > 0) {
        return num;
      }
    }
    return 0;
  }, [
    props.invitedCount,
    (props as any).invitationsCount,
    props.invitations,
    props.invitedSellers,
    vendors.inviteCount,
    vendors.invitedCount,
    vendors.invitedSellers,
    vendors.invitedSuppliers,
    payload.inviteCount,
    payload.invitedCount,
    payload.invitedSellers,
    payload.invitations,
    payload.invitedSuppliers,
    payload.rateContractConfig?.selectedSuppliers,
    payload.rateContract?.selectedSuppliers,
    payload.auctionConfig?.qualifiedVendors,
    rules.inviteCount,
    rules.invitedSellers,
  ]);

  const supplierControlsData = compactObject({
    selectionMode: firstPresent(vendors.selectionMode, vendors.selection, vendors.type, rules.selectionMode, 'Open'),
    inviteCount: String(effectiveInviteCount),
    msmePreference: firstPresent(vendors.msmePreference, rules.msmePreference, 'Yes'),
    excludeBlacklisted: firstPresent(vendors.excludeBlacklisted, rules.excludeBlacklisted, 'Yes'),
    localVendorPreference: firstPresent(vendors.localVendorPreference, rules.localVendorPreference, 'Yes'),
    approvalNotes: firstPresent(approval.notes, approval.approvalNotes, rules.approvalNotes, 'PARTIAL DELIVERY WILL BE ACCEPTED'),
    workflow: firstPresent(approval.workflow, rules.workflow, 'Finance + Procurement'),
  });

  // isBuyerOrAdmin already defined at top level of component

  const allParticipationsList = useMemo(() => {
    const combined = [
      ...asArray(props.participations),
      ...asArray(fetchedParticipants)
    ];
    const seen = new Set();
    const result: any[] = [];
    for (let idx = 0; idx < combined.length; idx++) {
      const p = combined[idx];
      if (!p) continue;
      const key = String(p.id || p.sellerId || p.sellerUserId || p.seller?.id || `item-${idx}`);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(p);
      }
    }
    return result;
  }, [props.participations, fetchedParticipants]);

  const submittedParticipations = useMemo(() => {
    return allParticipationsList.filter((p: any) => {
      const statusStr = String(p.submissionStatus || p.status || '').toUpperCase();
      return statusStr !== 'DRAFT' && statusStr !== 'CANCELLED';
    });
  }, [allParticipationsList]);

  const proposalStatusDisplay = useMemo(() => {
    // If current user is explicitly a seller and not viewing as buyer, show their submission status
    if (currentUser?.role === 'seller' && !isBuyerSide) {
      return props.hasSubmittedProposal ? 'Submitted' : 'Not submitted';
    }

    // For buyer, admin, or general viewer, derive authentic status from real database records
    const rawStatus = String(props.status || '').toUpperCase();
    const count = Math.max(props.participantsCount || 0, submittedParticipations.length);
    const isDeadlinePassed = props.deadlineDate ? new Date(props.deadlineDate).getTime() < nowMs : false;

    // 1. Awarded / Completed
    const hasAwarded = submittedParticipations.some((p: any) => {
      const s = String(p.finalStatus || p.status || p.submissionStatus || '').toUpperCase();
      return s === 'AWARDED' || s === 'ACCEPTED' || s === 'PO_GENERATED';
    });
    if (hasAwarded || rawStatus === 'AWARDED' || rawStatus === 'PO_GENERATED' || rawStatus === 'AWARD_RECOMMENDED') {
      return 'Awarded';
    }

    // 2. Under Evaluation
    const hasEvaluation = submittedParticipations.some((p: any) => {
      const ts = String(p.technicalStatus || '').toUpperCase();
      const fs = String(p.financialStatus || '').toUpperCase();
      const s = String(p.status || p.submissionStatus || '').toUpperCase();
      return ts === 'QUALIFIED' || ts === 'UNDER_EVALUATION' || fs === 'OPENED' || s === 'UNDER_REVIEW' || s === 'SHORTLISTED';
    });
    if (
      hasEvaluation ||
      rawStatus === 'TECHNICAL_EVALUATION' ||
      rawStatus === 'FINANCIAL_EVALUATION' ||
      rawStatus === 'UNDER_EVALUATION' ||
      rawStatus === 'TECHNICAL_EVALUATION_COMPLETED' ||
      rawStatus === 'L1_GENERATED' ||
      rawStatus === 'NEGOTIATION'
    ) {
      return 'Under Evaluation';
    }

    // 3. Proposals received
    if (count > 0) {
      if (isDeadlinePassed || rawStatus === 'CLOSED') {
        return `${count} Received (Under Review)`;
      }
      return `${count} ${count === 1 ? (isRfqType ? 'Quotation' : 'Proposal') : (isRfqType ? 'Quotations' : 'Proposals')} Received`;
    }

    // 4. No proposals received
    if (isDeadlinePassed || rawStatus === 'CLOSED' || rawStatus === 'EXPIRED') {
      return isRfqType ? 'No Quotations Received' : 'No Proposals Received';
    }
    if (rawStatus === 'CANCELLED') {
      return 'Cancelled';
    }

    // 5. Open / active awaiting submissions
    return isRfqType ? 'Awaiting Quotations' : 'Awaiting Proposals';
  }, [currentUser?.role, isBuyerSide, props.hasSubmittedProposal, props.status, props.participantsCount, submittedParticipations, props.deadlineDate, nowMs, isRfqType]);

  const buyerContactPerson = contactPerson && contactPerson !== 'N/A' && contactPerson !== '—' ? contactPerson : (buyerOrgName !== 'N/A' ? buyerOrgName : 'Procurement Officer');
  const buyerPhoneNum = phone && phone !== 'N/A' && phone !== '—' ? phone : (props.buyerMobile && props.buyerMobile !== 'N/A' ? props.buyerMobile : '');

  const summaryCards = [
    { label: 'Status', value: statusLabel, icon: ShieldCheck, tone: 'slate' as Tone, subtext: 'Current lifecycle state' },
    {
      label: 'Submission Deadline',
      value: closingDateFormatted || 'N/A',
      icon: Clock,
      tone: 'rose' as Tone,
      subtext: 'Bidding window closing'
    },
    { label: 'Estimated Value', value: formatCurrency(props.estimatedValue), icon: IndianRupee, tone: 'emerald' as Tone, subtext: 'Total budget estimate' },
    { label: 'Buyer Contact', value: formatPrimitiveValue(buyerContactPerson, 'buyerContact'), icon: PhoneCall, tone: 'amber' as Tone, subtext: buyerPhoneNum || 'Procurement officer' },
    { label: 'Evaluation', value: formatPrimitiveValue(evaluationMethod, 'evaluationMethod'), icon: ClipboardCheck, tone: 'violet' as Tone, subtext: 'Selection criteria' },
    ...(isBuyerOrAdmin ? [{ label: 'Responses', value: Math.max(props.participantsCount || 0, submittedParticipations.length).toLocaleString('en-IN'), icon: Users, tone: 'sky' as Tone, subtext: isRfqType ? 'Quotations submitted' : 'Proposals submitted' }] : []),
  ];

  const tabs = [
    { id: 'overview', label: 'Overview & Dates', icon: ClipboardList },
    { id: 'scope_docs', label: 'Scope & Documents', icon: FileText, count: documents.length },
    { id: 'terms_schedule', label: 'Terms & Schedule', icon: CalendarDays },
    { id: 'evaluation', label: 'Evaluation & Controls', icon: ClipboardCheck },
    { id: 'clarifications', label: isRfqType ? 'Clarifications & Quotations' : 'Clarifications & Proposals', icon: MessageSquare, count: (props.totalClarifications || 0) + (isBuyerOrAdmin ? (submittedParticipations.length || 0) : 0) },
  ];

  const defaultSubmitBtnLabel = props.hasSubmittedProposal
    ? (props.procurementType === 'RFQ' ? 'View Quotation' : 'View Proposal')
    : (props.procurementType === 'RFQ' ? 'Submit Quotation' : 'Submit Proposal');

  const handleDefaultPdfDownload = () => {
    try {
      toast.info(`Generating ${procurementTypeLabel} PDF…`);
      const engine = new PdfEngine();
      const doc = engine.generate({
        documentTitle: `${procurementTypeLabel.toUpperCase()} PROCUREMENT DETAILS`,
        documentNumber: displayIdStr,
        dateStr: publishedDateFormatted || 'N/A',
        status: statusLabel,
        parties: [
          {
            title: 'BUYER ORGANIZATION',
            name: buyerOrgName !== 'N/A' ? buyerOrgName : 'Verified Buyer',
            address: deliveryLocation !== 'N/A' ? deliveryLocation : 'Location not specified',
            email: props.buyer?.email || undefined,
            phone: props.buyer?.mobile || props.buyer?.phone || undefined,
            details: [
              `Contact: ${contactPerson}`,
              `Category: ${category}`,
            ],
          },
          {
            title: procurementTypeLabel.toUpperCase(),
            name: resolvedSubject,
            details: [
              `Method: ${procurementMethod}`,
              `Deadline: ${closingDateFormatted}`,
              `EMD Required: ${props.isEmdRequired ? formatCurrency(props.emdAmount || 0) : 'Nil'}`,
              `Estimated Value: ${formatCurrency(props.estimatedValue)}`,
            ],
          },
        ],
        infoGrid: {
          'Delivery Location': deliveryLocation,
          'Payment Terms': paymentTerms !== 'N/A' ? paymentTerms : 'As per procurement rules',
          'Delivery SLA': props.deliveryTerms || 'Standard Delivery SLA',
          'Evaluation Method': evaluationMethod,
        },
        tableHeaders: ['#', 'Item / Scope Description', 'Qty', 'Unit', 'Estimated Price', 'GST %'],
        tableData: lineItems.map((it: any, i: number) => [
          String(i + 1),
          it.itemName || it.name || it.description || `Item ${i + 1}`,
          String(it.quantity || it.qty || 1),
          it.unit || 'Units',
          it.estimatedPrice || it.unitPrice || it.price ? formatCurrency(it.estimatedPrice || it.unitPrice || it.price) : '—',
          it.gstRate || it.gst ? `${it.gstRate || it.gst}%` : 'Standard',
        ]),
        financials: { grandTotal: Number(props.estimatedValue || 0) },
        terms: [
          `Payment Terms: ${paymentTerms}`,
          `Delivery Terms: ${props.deliveryTerms || 'Standard'}`,
          `Evaluation Method: ${evaluationMethod}`,
        ],
        footerNote: 'MSME Enterprise Unified Sourcing & Procurement Portal',
      });
      doc.save(`${displayIdStr.replace(/[^a-zA-Z0-9-]/g, '_')}-${procurementTypeLabel.replace(/\s+/g, '_')}.pdf`);
      toast.success(`${procurementTypeLabel} PDF downloaded.`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to generate PDF.');
    }
  };

  return (
    <BuyerSideContext.Provider value={{ isBuyer: isBuyerSide, isOpenTender: isBuyerOpenTender, isLimitedTender: isBuyerLimitedTender }}>
      <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-3 px-4 py-3 sm:px-6 lg:px-8">
        {/* Navigation Breadcrumb & Back Button */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (props.onBack) {
                props.onBack();
              } else if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back();
              } else {
                router.push(props.backRoute || '/seller/opportunities');
              }
            }}
            className="h-8 gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-950 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500" />
            <span>Back</span>
          </Button>

          <nav className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            <button
              type="button"
              onClick={() => {
                if (props.onBack) props.onBack();
                else router.push(props.backRoute || '/seller/opportunities');
              }}
              className="hover:text-slate-900 transition-colors"
            >
              {props.backRouteLabel || `${procurementTypeLabel} Opportunities`}
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900">{displayIdStr}</span>
          </nav>
        </div>

        {!currentUser && (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-xs font-black text-amber-950">Login required for participation</p>
                <p className="mt-0.5 text-[11px] font-semibold text-amber-800">Sellers can login to submit or view their response.</p>
              </div>
            </div>
            <Button type="button" size="sm" onClick={() => router.push(`/login?redirect=${encodeURIComponent(pathname)}`)} className="shrink-0 bg-slate-950 text-white hover:bg-slate-800 text-xs">
              Login
            </Button>
          </div>
        )}

        {/* Header */}
        <header className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={statusLabel} />
                {!isBuyerSide && buyerOrgName !== 'N/A' && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-indigo-700">
                    <Building2 className="h-3.5 w-3.5" />
                    {formatPrimitiveValue(buyerOrgName, 'organization')}
                  </span>
                )}
                {props.deadlineDate && <DeadlineCountdown targetDate={props.deadlineDate} />}
                {props.hasSubmittedProposal && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {props.procurementType === 'RFQ' ? 'Quotation Submitted' : 'Proposal Submitted'}
                  </span>
                )}
              </div>
              <h1
                className={cn(
                  'leading-tight tracking-tight text-slate-900 font-black break-words',
                  isBuyerSide
                    ? 'text-lg sm:text-xl md:text-2xl'
                    : 'text-xl sm:text-2xl lg:text-3xl'
                )}
              >
                {resolvedSubject}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                {/* Requisition ID badge - hidden on buyer side */}
                {!isBuyerSide && (
                  <>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-slate-700 text-[11px] font-bold">{displayIdStr}</span>
                    <span>•</span>
                  </>
                )}
                <span>{formatPrimitiveValue(procurementMethod, 'procurementMethod')}</span>
                {category !== 'N/A' && (
                  <>
                    <span>•</span>
                    <span>{formatPrimitiveValue(category, 'category')}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2.5 lg:self-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (props.onDownloadClick) {
                    props.onDownloadClick();
                  } else {
                    handleDefaultPdfDownload();
                  }
                }}
                className="h-9 px-3.5 text-xs font-bold rounded-lg border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs gap-1.5 flex items-center cursor-pointer transition-all active:scale-95"
              >
                <Download className="h-4 w-4 text-slate-600" />
                Download
              </Button>
              {props.invoiceStatus && props.onConvertToInvoiceClick && (
                props.invoiceStatus.exists ? (
                  <Button
                    type="button"
                    onClick={() => router.push(`/seller/invoices/${props.invoiceStatus!.invoiceId}`)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 h-9 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    <Eye className="h-4 w-4 mr-0.5" />
                    View Invoice
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={props.isConvertingInvoice || props.invoiceStatus.loading}
                    onClick={props.onConvertToInvoiceClick}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-4 h-9 rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    {props.isConvertingInvoice ? <Loader2 className="h-4 w-4 mr-0.5 animate-spin" /> : <FileText className="h-4 w-4 mr-0.5" />}
                    {props.isConvertingInvoice ? 'Converting...' : 'Convert to Invoice'}
                  </Button>
                )
              )}
              {props.onDiscardClick && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={props.onDiscardClick}
                  className="h-9 px-3.5 border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300 text-xs font-bold rounded-lg transition-all active:scale-95 cursor-pointer shadow-2xs gap-1.5 flex items-center"
                >
                  <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                  Discard Draft
                </Button>
              )}
              {props.onSubmitClick && (
                <Button
                  type="button"
                  size="sm"
                  onClick={handleActionSubmit}
                  className={cn(
                    'h-9 px-4 text-white text-xs font-extrabold rounded-lg bg-[#0b2447] hover:bg-[#12335f] cursor-pointer shadow-sm active:scale-95 transition-all flex items-center gap-1.5',
                    isEmdGated ? 'bg-amber-600 hover:bg-amber-700' : ''
                  )}
                >
                  <span>{isEmdGated ? 'Pay EMD to Submit' : (props.submitButtonLabel || defaultSubmitBtnLabel)}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </header>

        {/* EMD Section commented out */}

        {/* Summary Metrics */}
        <section className={cn('grid gap-3', summaryCards.length === 6 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5')}>
          {summaryCards.map(card => (
            <MetricCard key={card.label} {...card} isBuyer={isBuyerSide} />
          ))}
        </section>

        {/* Tab Navigation Bar */}
        <nav className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs lg:text-sm font-bold transition-all',
                  isActive
                    ? 'bg-slate-950 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px] font-black',
                    isActive ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Tab 1: Overview & Dates */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <DataCard title={`Buyer ${procurementTypeLabel} Information`} icon={ClipboardList}>
                <PropertyGrid columns={2}>
                  <PropertyItem label={`${procurementTypeLabel} Number`} value={procurementNumber} mono highlight />
                  <PropertyItem label="Procurement Method" value={procurementMethod} />
                  <PropertyItem label="Buying Type" value={buyingType} />
                  <PropertyItem label="Category" value={category} />
                  {/* Sub Category - hidden on buyer side */}
                  {!isBuyerSide && (
                    <PropertyItem label="Sub Category" value={subCategory} />
                  )}
                  <PropertyItem label="Published Date" value={publishedDateFormatted} />
                  <PropertyItem label="Submission Deadline" value={closingDateFormatted} />
                  {/* Delivery Location - hidden on buyer side */}
                  {!isBuyerSide && (
                    <PropertyItem label="Delivery Location" value={deliveryLocation} />
                  )}
                  {/* Project Duration - commented out / hidden on buyer side */}
                  {!isBuyerSide && (
                    <PropertyItem label="Project Duration" value={projectDuration} />
                  )}
                  {/* Payment Terms - hidden on buyer side */}
                  {!isBuyerSide && (
                    <PropertyItem label="Payment Terms" value={paymentTerms} />
                  )}
                  {/* Procurement Brief - hidden on buyer side */}
                  {!isBuyerSide && (
                    <PropertyItem label="Procurement Brief" value={props.description && props.description.length < 160 && !props.description.includes('\n') ? props.description : (basics.description && basics.description.length < 160 ? basics.description : `${resolvedSubject} (${category})`)} fullWidth />
                  )}
                </PropertyGrid>
              </DataCard>

              <BuyerProfileSection
                orgName={buyerOrgName}
                contactPerson={contactPerson}
                email={email}
                phone={phone}
                address={buyerAddress}
                department={department}
              />
            </div>

            <TimelineRibbon
              dates={[
                { label: 'Published', value: publishedDateFormatted, icon: Calendar, tone: 'emerald' },
                { label: 'Clarification', value: clarificationDateFormatted, icon: Info, tone: 'sky' },
                { label: 'Submission', value: closingDateFormatted, icon: Clock, tone: 'rose' },
                { label: 'Technical Opening', value: technicalDateFormatted, icon: ClipboardCheck, tone: 'indigo' },
                { label: 'Financial Opening', value: financialDateFormatted, icon: IndianRupee, tone: 'amber' },
                { label: 'Award Status', value: awardDateFormatted, icon: ShieldCheck, tone: 'slate' },
              ]}
            />

            {/* Clarification Threads & Status grid - commented out strictly in RFQ, Open Tender, and Limited Tender on buyer side */}
            {!isBuyerRfq && !isBuyerOpenTender && !isBuyerLimitedTender && (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs">
                <PropertyGrid columns={4}>
                  <PropertyItem label="Clarification Threads" value={(props.totalClarifications || 0).toLocaleString('en-IN')} />
                  <PropertyItem label={isRfqType ? 'Quotation Status' : 'Proposal Status'} value={proposalStatusDisplay} />
                  <PropertyItem label="Deadline Status" value={props.deadlineDate && new Date(props.deadlineDate).getTime() < nowMs ? 'Closed' : 'Open'} />
                  <PropertyItem label="Source Record" value={procurementTypeLabel} />
                </PropertyGrid>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Scope & Documents */}
        {activeTab === 'scope_docs' && (
          <div className="space-y-5">
            <DataCard title={`${procurementTypeLabel} Scope & Sourcing Summary`} icon={FileText}>
              <ScopeSummaryCard
                scopeText={scopeText}
                procurementTypeLabel={procurementTypeLabel}
                estimatedValue={props.estimatedValue}
                urgency={payload.urgency || rules.urgency || 'Normal'}
                procurementMethod={procurementMethod}
              />

              {/* Service Details & Parameters - commented out strictly in Open Tender, Limited Tender, and RFQ on buyer side */}
              {hasDetailData(serviceDetails) && !isBuyerRfq && !isBuyerOpenTender && !isBuyerLimitedTender && (
                <ServiceDetailsSection serviceDetails={serviceDetails} />
              )}

              {hasDetailData(lineItems) && (
                <LineItemsTable items={lineItems} defaultSubject={resolvedSubject} isBuyer={isBuyerSide} />
              )}

              {/* BOQ Table - hidden on buyer side */}
              {hasDetailData(boqTable) && !isBuyerSide && (
                <BoqTableList data={boqTable} defaultSubject={resolvedSubject} defaultCategory={category} defaultEstimatedValue={props.estimatedValue} />
              )}
            </DataCard>

            {(() => {
              const validDownloadableDocs = documents.filter(doc => doc && (doc.fileAssetId || doc.url));

              return (
                <div className="space-y-5">
                  {validDownloadableDocs.length > 0 && (
                    <DataCard title={`${procurementTypeLabel} Attached Documents`} icon={FileSpreadsheet}>
                      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
                        {validDownloadableDocs.map((doc, index) => {
                          const isGenericName = !doc.name || doc.name.toLowerCase().startsWith('attached_doc');
                          const docDisplayName = isGenericName
                            ? (doc.meta || `${procurementTypeLabel} Document ${index + 1}`)
                            : doc.name;

                          return (
                            <article key={doc.id ? `doc-${doc.id}-${index}` : `doc-idx-${index}`} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 shadow-xs flex flex-col justify-between hover:bg-slate-50 transition-colors">
                              <div className="flex items-start gap-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  <FileText className="h-5 w-5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="break-words text-xs font-bold text-slate-900 leading-snug">{docDisplayName}</p>
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                    <span className={cn(
                                      'rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider',
                                      doc.required ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600'
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
                                onClick={() => {
                                  if (doc.fileAssetId || doc.url) {
                                    openFileAsset({ fileAssetId: doc.fileAssetId, url: doc.url, originalName: docDisplayName }, docDisplayName);
                                  }
                                }}
                                disabled={!doc.fileAssetId && !doc.url}
                                className="mt-3.5 w-full text-xs h-8.5 rounded-lg border-slate-250 bg-white hover:bg-slate-100 font-bold"
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                Open Document
                              </Button>
                            </article>
                          );
                        })}
                      </div>
                    </DataCard>
                  )}

                  <RequiredDocumentsList data={requiredDocuments} />
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab 3: Terms & Schedule */}
        {activeTab === 'terms_schedule' && (
          <div className="space-y-5">
            <DataCard title={`${procurementTypeLabel} Schedule & Rules`} icon={CalendarDays}>
              <div className="space-y-5">
                <div className="space-y-2.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                    Milestones &amp; Critical Dates
                  </h3>
                  <div className="rounded-xl bg-slate-50/70 p-4 border border-slate-150">
                    <PropertyGrid columns={3}>
                      <PropertyItem label="Publish Date" value={firstPresent(schedule.publishDate, schedule.publishedDate, publishedDateFormatted, props.publishedDate)} />
                      <PropertyItem label="Submission Start Date" value={submissionStartDateFormatted} />
                      <PropertyItem label="Clarification Deadline" value={firstPresent(schedule.clarificationDeadline, schedule.clarificationEndDate, clarificationDeadlineFormatted, props.clarificationDate)} />
                      <PropertyItem label="Submission Deadline" value={firstPresent(schedule.submissionDate, closingDateFormatted, props.closingDate)} highlight />
                      <PropertyItem label="Technical Opening Date" value={firstPresent(schedule.technicalOpeningDate, tender.technicalEvaluationDate, props.technicalOpeningDate, technicalDateFormatted)} />
                      <PropertyItem label="Financial Opening Date" value={firstPresent(schedule.financialOpeningDate, tender.financialEvaluationDate, props.financialOpeningDate, financialDateFormatted)} />
                      <PropertyItem label="Bid Validity Date" value={firstPresent(schedule.bidValidityDate, tender.bidValidityDate, schedule.bidValidityDeadline, bidValidityDateFormatted)} />
                      <PropertyItem label="Validity Days" value={validityDaysDisplay} />
                      {requiredByDateFormatted && (
                        <PropertyItem label="Required By Date" value={requiredByDateFormatted} />
                      )}
                      {preBidDateFormatted && (
                        <PropertyItem label="Pre-Bid Meeting Date" value={preBidDateFormatted} />
                      )}
                      {awardDateFormatted && awardDateFormatted !== 'N/A' && (
                        <PropertyItem label="Expected Award Date" value={awardDateFormatted} />
                      )}
                    </PropertyGrid>
                  </div>
                </div>

                <div className="space-y-2.5 pt-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Bidding Rules &amp; Policy Matrix
                  </h3>
                  <PolicyRulesMatrix
                    rules={[
                      { label: 'Auto Close', value: firstPresent(rules.autoClose, schedule.autoClose, 'Yes') },
                      { label: 'Allow Revision', value: firstPresent(rules.allowRevision, schedule.allowRevision, 'Yes') },
                      { label: 'Show Seller Rank', value: firstPresent(rules.showSellerRank, schedule.showSellerRank, 'Yes') },
                      { label: 'Allow Withdrawal', value: firstPresent(rules.allowWithdrawal, schedule.allowWithdrawal, 'Yes') },
                      { label: 'Show Lowest Price', value: firstPresent(rules.showLowestPrice, schedule.showLowestPrice, 'Yes') },
                      { label: 'Clarification Allowed', value: firstPresent(schedule.clarificationAllowed, rules.clarificationAllowed, 'Yes') },
                      { label: 'Minimum Bidders', value: firstPresent(rules.minimumBidders, schedule.minimumBidders, '3') },
                      { label: 'Pre-Bid Meeting', value: firstPresent(schedule.preBidMeeting, schedule.preBidMeetingDate, 'No') },
                    ]}
                  />
                  {(payload.limitedTenderJustification || rules.limitedTenderJustification) && (
                    <div className="rounded-xl border-l-4 border-amber-500 bg-amber-50/60 p-3.5 border border-amber-200/80 text-xs font-semibold text-amber-900">
                      <span className="font-black uppercase tracking-wider block text-[10px] text-amber-700 mb-0.5">Tender Justification:</span>
                      {payload.limitedTenderJustification || rules.limitedTenderJustification}
                    </div>
                  )}
                </div>
              </div>
            </DataCard>

            <DataCard title="Commercial & Payment Terms" icon={IndianRupee}>
              <PropertyGrid columns={3}>
                {/* Payment Terms and Delivery Terms commented out as they already appear in Terms & Conditions */}
                {/* <PropertyItem label="Payment Terms" value={paymentTerms} /> */}
                {/* <PropertyItem label="Delivery Terms" value={deliveryTerms} /> */}
                {/* Contract Period commented out / hidden on buyer side */}
                {!isBuyerSide && (
                  <PropertyItem label="Contract Period" value={firstPresent(terms.contractPeriod, terms.projectDuration, projectDuration)} />
                )}
                {/* Retention Amount & Security Deposit commented out / hidden on buyer side */}
                {/* Warranty Terms strictly commented out / hidden on buyer side in open tender */}
                <PropertyItem label="Terms & Conditions" value={cleanBuyerTerms(terms.termsAndConditions || terms.terms || payload.terms)} fullWidth />
                <PropertyItem label="Eligibility Criteria" value={cleanBuyerTerms(terms.eligibilityCriteria || basics.eligibilityCriteria || payload.eligibility)} fullWidth />
              </PropertyGrid>
            </DataCard>

            <ConsigneeTableList
              data={consigneeDetails}
              deliveryLocation={deliveryLocation}
              deliveryTerms={deliveryTerms}
              isBuyerSide={isBuyerSide}
              isBuyerRfq={isBuyerRfq}
            />
          </div>
        )}

        {/* Tab 4: Evaluation & Controls */}
        {activeTab === 'evaluation' && (
          <div className="space-y-5">
            <DataCard title="Evaluation Overview & Method" icon={ClipboardCheck}>
              <div className="rounded-xl bg-slate-50/70 p-4 border border-slate-150">
                <PropertyGrid columns={4}>
                  <PropertyItem label="Evaluation Method" value={formatPrimitiveValue(evaluationMethod, 'evaluationMethod')} highlight />
                  {requireDemo && requireDemo !== 'No' && <PropertyItem label="Require Demo" value={formatPrimitiveValue(requireDemo)} />}
                  {hasDetailData(qcbsRatio) && <PropertyItem label="QCBS Ratio" value={qcbsRatio} />}
                  {hasDetailData(passingScore) && <PropertyItem label="Passing Score" value={passingScore} />}
                </PropertyGrid>
              </div>
            </DataCard>

            {hasExplicitTechCriteria && (
              <TechnicalCriteriaTableList data={technicalCriteria} />
            )}

            {hasDetailData(questionnaireData) && (
              <CompactSectionGrid
                title="Questionnaire & Technical Form"
                icon={ClipboardList}
                data={compactObject({ questionnaire: questionnaireData })}
                defaultOpen={true}
              />
            )}

            <DataCard title="Supplier & Approval Controls" icon={Users}>
              <div className="space-y-5">
                <div className="rounded-xl bg-slate-50/70 p-4 border border-slate-150">
                  <PropertyGrid columns={3}>
                    <PropertyItem label="Selection Mode" value={vendors.selection || payload.selectionMode || rules.selectionMode || 'Open'} />
                    <PropertyItem label="Invite Count" value={String(effectiveInviteCount)} />
                    <PropertyItem label="Workflow" value={approval.workflow || payload.workflow || 'Finance + Procurement'} />
                  </PropertyGrid>
                </div>

                <div className="space-y-2.5 pt-1">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Vendor Preferences &amp; Eligibility Controls
                  </h3>
                  <PolicyRulesMatrix
                    rules={[
                      { label: 'MSME Preference', value: (vendors.msmePreference !== undefined ? vendors.msmePreference : payload.msmePreference) !== undefined ? ((vendors.msmePreference ?? payload.msmePreference) ? 'Yes' : 'No') : 'Yes' },
                      { label: 'Exclude Blacklisted', value: (vendors.excludeBlacklisted !== undefined ? vendors.excludeBlacklisted : payload.excludeBlacklisted) !== undefined ? ((vendors.excludeBlacklisted ?? payload.excludeBlacklisted) ? 'Yes' : 'No') : 'Yes' },
                      { label: 'Local Vendor Preference', value: (vendors.localVendorPreference !== undefined ? vendors.localVendorPreference : payload.localVendorPreference) !== undefined ? ((vendors.localVendorPreference ?? payload.localVendorPreference) ? 'Yes' : 'No') : 'Yes' },
                    ]}
                  />
                </div>

                {(approval.notes || payload.approvalNotes) && isBuyerOrAdmin && (
                  <div className="rounded-xl bg-slate-50/80 p-3.5 border border-slate-150">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Approval Notes:</span>
                    <p className="text-xs font-semibold text-slate-700">{approval.notes || payload.approvalNotes}</p>
                  </div>
                )}
              </div>
            </DataCard>
          </div>
        )}

        {/* Tab 5: Clarifications & Proposals */}
        {activeTab === 'clarifications' && (
          <div className="space-y-4">
            {isBuyerOrAdmin && (
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-slate-900 tracking-tight">{isRfqType ? 'Seller Submitted Quotations' : 'Seller Proposals & Submitted Quotations'}</h3>
                      <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-black text-blue-700">
                        {submittedParticipations.length} {submittedParticipations.length === 1 ? (isRfqType ? 'Quotation' : 'Proposal') : (isRfqType ? 'Quotations' : 'Proposals')} Received
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      {isRfqType
                        ? 'Review seller quotation details, financial quotes, line item rates, and attached technical specifications.'
                        : 'Review seller proposal details, financial quotes, line item rates, and attached technical specifications.'}
                    </p>
                  </div>

                  {/* Compare Bids button commented out as requested
                  {submittedParticipations.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsCompareChooserOpen(true)}
                      className="h-8 gap-1.5 text-xs font-bold text-slate-800 border border-slate-250 bg-white hover:bg-slate-50 shadow-2xs"
                    >
                      <Layers className="h-3.5 w-3.5 text-blue-600" />
                      <span>Compare Bids</span>
                    </Button>
                  )}
                  */}
                </div>

                {submittedParticipations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-8 px-4 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
                      <Users className="h-5 w-5" />
                    </div>
                    <h4 className="text-xs font-extrabold text-slate-700">{isRfqType ? 'No seller quotations submitted yet' : 'No seller proposals submitted yet'}</h4>
                    <p className="text-[11px] font-medium text-slate-400 max-w-sm mt-0.5">
                      {isRfqType
                        ? 'As soon as suppliers submit their quotations for this RFQ, their responses will appear here for your review.'
                        : 'As soon as suppliers submit their technical and financial proposals for this procurement, their quotations will appear here for your review.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-left text-xs">
                        <thead className="bg-slate-50/80 border-b border-slate-200">
                          <tr className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            <th className="px-4 py-3">Supplier Organization</th>
                            <th className="px-4 py-3">Quoted Amount (INR)</th>
                            <th className="px-4 py-3">Offered Qty & Delivery</th>
                            <th className="px-4 py-3">Submitted At</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                          {submittedParticipations.map((participation: any, idx: number) => {
                            const sellerOrgName = participation.sellerOrgName
                              || participation.sellerOrganization?.organizationName
                              || participation.seller?.sellerProfile?.organizationName
                              || participation.seller?.organization?.organizationName
                              || participation.sellerProfile?.organizationName
                              || participation.companyName
                              || participation.sellerName
                              || participation.seller?.name
                              || participation.sellerUser?.name
                              || (participation.sellerId || participation.sellerUserId || (participation.id && !String(participation.id).startsWith('id-'))
                                ? `Supplier #${participation.sellerId || participation.sellerUserId || participation.id}`
                                : `Supplier ${idx + 1}`);
                            const contactName = participation.sellerName || participation.contactPerson || participation.seller?.name || participation.sellerUser?.name || '';
                            const amount = Number(participation.totalAmount || participation.quotedAmount || participation.offeredPrice || 0);
                            const qty = participation.offeredQuantity || participation.quantity || 'Specified Qty';
                            const delivery = participation.deliveryTimeline || participation.responseData?.deliveryTimeline || 'Standard';
                            const dateStr = formatDateString(participation.submittedAt || participation.updatedAt || participation.createdAt, true);
                            const statusLabel = participation.submissionStatus || participation.status || 'Submitted';

                            return (
                              <tr key={participation.id || participation.sellerId || `quotation-row-${idx}`} className="hover:bg-slate-50/70 transition-colors">
                                <td className="px-4 py-3">
                                  <p className="font-extrabold text-slate-950 text-xs">{sellerOrgName}</p>
                                  {contactName && contactName !== sellerOrgName && (
                                    <p className="text-[10px] font-medium text-slate-400">Contact: {contactName}</p>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="font-black text-slate-900 text-xs">
                                    {amount > 0 ? `₹${amount.toLocaleString('en-IN')}` : 'Sealed / Rates On File'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-600">
                                  <p className="font-bold text-xs">{qty}</p>
                                  <p className="text-[10px] font-medium text-slate-400">{delivery}</p>
                                </td>
                                <td className="px-4 py-3 text-slate-500 font-medium">{dateStr}</td>
                                <td className="px-4 py-3">
                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-800">
                                    {statusLabel}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => router.push(`/bids/${targetId}/results`)}
                                    className="h-8 gap-1 text-xs font-extrabold bg-[#12335f] hover:bg-[#0b2445] text-white shadow-2xs"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                    Review Quotation
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Quotation Review Modal Renderer */}
            {selectedQuotationForReview && (
              <SellerQuotationReviewModal
                isOpen={Boolean(selectedQuotationForReview)}
                onClose={() => setSelectedQuotationForReview(null)}
                participation={selectedQuotationForReview}
                procurementTitle={props.subject || props.procurementLabel}
                targetId={targetId}
                router={router}
              />
            )}

            {/* Select Quotations to Compare Modal */}
            {isCompareChooserOpen && (
              <SelectQuotationsToCompareModal
                isOpen={isCompareChooserOpen}
                onClose={() => setIsCompareChooserOpen(false)}
                participations={submittedParticipations}
                onConfirmCompare={(selectedIds) => {
                  setSelectedCompareIds(selectedIds);
                  setIsCompareChooserOpen(false);
                  setIsComparisonModalOpen(true);
                }}
              />
            )}

            {/* Quotation Comparison Matrix Modal Renderer */}
            {isComparisonModalOpen && (
              <QuotationComparisonModal
                isOpen={isComparisonModalOpen}
                onClose={() => setIsComparisonModalOpen(false)}
                participations={submittedParticipations}
                initialSelectedSellerIds={selectedCompareIds}
                procurementTitle={props.subject || props.procurementLabel}
                targetId={targetId}
                router={router}
                onSelectQuotationReview={(p) => setSelectedQuotationForReview(p)}
              />
            )}

            {
              /* Determine clarification kind: Rate Contract and Limited Tender typically use requirement-based clarifications */
              (() => {
                const clarKind = props.clarificationKind
                  ?? (props.procurementType === 'RATE_CONTRACT' || props.procurementType === 'LIMITED_TENDER' ? 'requirement' : 'quote-request');
                const clarId = props.clarificationEntityId ?? targetId;
                return (
                  <ClarificationPanel
                    quoteRequestId={clarId}
                    kind={clarKind}
                    role={currentUser?.role === 'buyer' ? 'buyer' : 'seller'}
                    deadlinePassed={Boolean(props.deadlineDate && new Date(props.deadlineDate).getTime() < nowMs)}
                    procurementLabel={props.procurementLabel || procurementTypeLabel}
                  />
                );
              })()
            }
          </div>
        )}

        {/* EMD Payment Modal commented out */}
      </div>

      {/* Sticky Bottom Action Dock for B2B Power-Users */}
      <div className="sticky bottom-0 z-40 border-t border-slate-200/80 bg-white/95 p-3 shadow-lg backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block leading-none mb-0.5">Estimated Value</span>
              <span className="text-sm font-black text-slate-900">{formatMoney(props.estimatedValue)}</span>
            </div>
            {props.deadlineDate && (
              <div className="hidden sm:block border-l border-slate-200 pl-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block leading-none mb-0.5">Closing Date</span>
                <span className="text-xs font-black text-slate-800">{formatDateString(props.deadlineDate, false)}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(props.status === 'DRAFT' || props.status === 'Draft') && props.onSubmitClick ? (
              <Button
                type="button"
                className="bg-[#0b2447] text-white hover:bg-[#12335f] text-xs font-extrabold px-5 h-9 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer"
                onClick={props.onSubmitClick}
              >
                {props.submitButtonLabel || 'Continue Draft'}
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : isBuyerOrAdmin ? (
              <Button
                type="button"
                className="bg-[#0b2447] text-white hover:bg-[#12335f] text-xs font-extrabold px-5 h-9 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer"
                onClick={() => router.push(`/bids/${displayIdStr || targetId}/results`)}
              >
                {props.submitButtonLabel && !props.submitButtonLabel.toLowerCase().includes('submit') ? props.submitButtonLabel : 'View Evaluation & Results'}
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : props.onSubmitClick ? (
              <Button
                type="button"
                className="bg-[#0b2447] text-white hover:bg-[#12335f] text-xs font-extrabold px-5 h-9 rounded-lg shadow-sm flex items-center gap-1 cursor-pointer"
                onClick={props.onSubmitClick}
              >
                {props.submitButtonLabel || 'Submit Proposal'}
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    </BuyerSideContext.Provider>
  );
}

interface SellerQuotationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  participation: any;
  procurementTitle?: string;
  targetId: string;
  router: any;
}

export function SellerQuotationReviewModal({
  isOpen,
  onClose,
  participation,
  procurementTitle,
  targetId,
  router,
}: SellerQuotationReviewModalProps) {
  if (!isOpen || !participation) return null;

  const sellerOrg = participation.sellerOrgName
    || participation.sellerOrganization?.organizationName
    || participation.seller?.sellerProfile?.organizationName
    || participation.seller?.organization?.organizationName
    || participation.sellerProfile?.organizationName
    || participation.companyName
    || participation.sellerName
    || participation.seller?.name
    || participation.sellerUser?.name
    || (participation.sellerId || participation.sellerUserId || (participation.id && !String(participation.id).startsWith('id-'))
      ? `Supplier #${participation.sellerId || participation.sellerUserId || participation.id}`
      : 'Supplier Partner');

  const contactPerson = participation.sellerName || participation.contactPerson || participation.seller?.name || participation.sellerUser?.name || 'N/A';
  const email = participation.sellerEmail || participation.seller?.email || participation.sellerUser?.email || 'N/A';
  const phone = participation.sellerPhone || participation.seller?.mobile || participation.seller?.phone || participation.sellerUser?.mobile || participation.sellerUser?.phone || 'N/A';

  const quotedAmount = Number(participation.totalAmount || participation.quotedAmount || participation.offeredPrice || 0);
  const offeredQty = participation.offeredQuantity || participation.quantity || 'As Specified';
  const deliveryTimeline = participation.deliveryTimeline || participation.responseData?.deliveryTimeline || 'Standard';
  const paymentTerms = participation.terms || participation.responseData?.paymentTerms || 'Standard Payment Terms';
  const makeBrand = participation.makeBrand || participation.responseData?.makeBrand || 'As per specification';
  const submittedAt = participation.submittedAt || participation.createdAt || participation.updatedAt;
  const statusStr = String(participation.submissionStatus || participation.status || 'Submitted').toUpperCase();

  const lineItems: any[] = Array.isArray(participation.lineItems)
    ? participation.lineItems
    : (Array.isArray(participation.responseData?.lineItems)
      ? participation.responseData.lineItems
      : (Array.isArray(participation.acknowledgement?.responseData?.lineItems)
        ? participation.acknowledgement.responseData.lineItems
        : (Array.isArray(participation.acknowledgement?.lineItems)
          ? participation.acknowledgement.lineItems
          : [])));
  const docs: any[] = Array.isArray(participation.documents) ? participation.documents : (Array.isArray(participation.responseData?.documents) ? participation.responseData.documents : []);
  const message = participation.offeredItemDescription || participation.message || participation.responseData?.message || '';

  const handleDownloadQuotationPdf = () => {
    try {
      toast.info(`Generating Quotation PDF for ${sellerOrg}…`);
      const engine = new PdfEngine('p');
      const hasLineItems = lineItems.length > 0;
      const doc = engine.generate({
        documentTitle: 'SUPPLIER QUOTATION RESPONSE',
        documentNumber: `QUOTE-${targetId}`,
        dateStr: submittedAt ? new Date(submittedAt).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
        status: statusStr,
        parties: [
          {
            title: 'BUYER ORGANIZATION',
            name: procurementTitle || 'Procurement Buyer',
            details: [`Procurement ID: ${targetId}`],
          },
          {
            title: 'SUPPLIER / QUOTING ORGANIZATION',
            name: sellerOrg,
            email: email !== 'N/A' ? email : undefined,
            phone: phone !== 'N/A' ? phone : undefined,
            details: [
              `Contact Person: ${contactPerson}`,
              `Submitted Date: ${submittedAt ? new Date(submittedAt).toLocaleString('en-IN') : 'N/A'}`,
            ],
          },
        ],
        infoGrid: {
          'Make / Brand': makeBrand,
          'Delivery Timeline': deliveryTimeline,
          'Payment Terms': paymentTerms,
          'Offered Quantity': String(offeredQty),
        },
        tableHeaders: hasLineItems
          ? ['#', 'Item Description', 'Make / Brand', 'Qty', 'Unit Price', 'GST %', 'Line Total']
          : ['#', 'Offered Item Description', 'Offered Qty', 'Quoted Value'],
        tableData: hasLineItems
          ? lineItems.map((item: any, idx: number) => {
            const uPrice = Number(item.unitPrice ?? item.unitRate ?? item.rate ?? item.price ?? 0);
            const q = Number(item.quantity ?? item.qty ?? 1);
            const gst = item.gstPercent != null ? Number(item.gstPercent) : 18;
            const tot = item.lineTotal != null || item.totalAmount != null
              ? Number(item.lineTotal ?? item.totalAmount)
              : uPrice * q * (1 + gst / 100);
            return [
              String(idx + 1),
              item.itemName || item.name || item.description || `Item #${idx + 1}`,
              item.makeBrand || item.brand || '—',
              `${q} ${item.unitOfMeasure || item.unit || 'Nos'}`,
              `₹${uPrice.toLocaleString('en-IN')}`,
              `${gst}%`,
              `₹${tot.toLocaleString('en-IN')}`
            ];
          })
          : [
            [
              '1',
              message || 'Procurement item quotation',
              String(offeredQty),
              quotedAmount > 0 ? `₹${quotedAmount.toLocaleString('en-IN')}` : 'Sealed Rate',
            ]
          ],
        financials: {
          grandTotal: quotedAmount,
        },
        terms: message ? [`Supplier Remarks: ${message}`] : [],
        footerNote: 'MSME Enterprise Procurement Portal — Official Quotation Record',
      });

      doc.save(`Quotation_${sellerOrg.replace(/[^a-zA-Z0-9]/g, '_')}_${targetId}.pdf`);
      toast.success('Quotation PDF downloaded successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to generate Quotation PDF');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-800">
                {statusStr}
              </span>
              <span className="text-xs font-bold text-slate-400">Submitted Seller Quotation</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-0.5">{sellerOrg}</h2>
            {procurementTitle && <p className="text-xs font-semibold text-slate-500 truncate max-w-md">For: {procurementTitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadQuotationPdf}
              className="flex items-center gap-1.5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-all cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            <KpiCard
              label="Total Quoted Value"
              value={quotedAmount > 0 ? `₹${quotedAmount.toLocaleString('en-IN')}` : 'Sealed / Rates On File'}
              subtext="Supplier price quotation"
              icon={IndianRupee}
              tone="green"
            />
            <KpiCard
              label="Offered Quantity"
              value={offeredQty}
              subtext="Committed supply batch"
              icon={Package}
              tone="blue"
            />
            <KpiCard
              label="Delivery Timeline"
              value={deliveryTimeline}
              subtext="Promised fulfillment SLA"
              icon={Clock}
              tone="indigo"
            />
            <KpiCard
              label="Brand / Make Offered"
              value={makeBrand}
              subtext="Product specifications"
              icon={Tag}
              tone="purple"
            />
          </div>

          {/* Supplier & Commercial Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-slate-500" /> Supplier Information
              </h4>
              <div className="text-xs space-y-1 text-slate-700 font-medium">
                <p><span className="text-slate-400 font-bold">Company:</span> {sellerOrg}</p>
                <p><span className="text-slate-400 font-bold">Contact Person:</span> {contactPerson}</p>
                <p><span className="text-slate-400 font-bold">Email:</span> {email}</p>
                <p><span className="text-slate-400 font-bold">Phone:</span> {phone}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <IndianRupee className="h-4 w-4 text-slate-500" /> Commercial Terms
              </h4>
              <div className="text-xs space-y-1 text-slate-700 font-medium">
                <p><span className="text-slate-400 font-bold">Payment Terms:</span> {paymentTerms}</p>
                <p><span className="text-slate-400 font-bold">Submitted At:</span> {submittedAt ? new Date(submittedAt).toLocaleString() : 'N/A'}</p>
                {message && <p className="pt-1"><span className="text-slate-400 font-bold block">Supplier Remarks:</span> "{message}"</p>}
              </div>
            </div>
          </div>

          {/* Line Items Table (if any) */}
          {lineItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                <Package className="h-4 w-4 text-slate-500" /> Quoted Line Items Breakdown
              </h4>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2">Line Item</th>
                      <th className="px-3 py-2">Make / Brand</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Unit Rate (₹)</th>
                      <th className="px-3 py-2 text-right">GST %</th>
                      <th className="px-3 py-2 text-right">Line Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                    {lineItems.map((item: any, idx: number) => {
                      const uPrice = Number(item.unitPrice ?? item.unitRate ?? item.rate ?? item.price ?? 0);
                      const q = Number(item.quantity ?? item.qty ?? 1);
                      const gst = item.gstPercent != null ? Number(item.gstPercent) : 18;
                      const tot = item.lineTotal != null || item.totalAmount != null
                        ? Number(item.lineTotal ?? item.totalAmount)
                        : uPrice * q * (1 + gst / 100);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition">
                          <td className="px-3 py-2.5 text-slate-900 font-bold">
                            {item.itemName || item.name || item.description || `Item #${idx + 1}`}
                            {item.remarks && <p className="text-[10px] font-normal text-slate-400 mt-0.5">{item.remarks}</p>}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">{item.makeBrand || item.brand || '—'}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                            <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded text-[11px] border border-slate-200">
                              {q} <span className="text-[9px] font-semibold text-slate-500 uppercase">{item.unitOfMeasure || item.unit || 'Nos'}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-bold">₹{uPrice.toLocaleString('en-IN')}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{gst}%</td>
                          <td className="px-3 py-2.5 text-right font-black text-indigo-700 tabular-nums">
                            ₹{tot.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">
                        Total Quoted Value (incl. GST)
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-black text-emerald-700 tabular-nums">
                        {quotedAmount > 0 ? `₹${quotedAmount.toLocaleString('en-IN')}` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Attached Files & Proposals (Separated into Technical, Financial, BOQ, Compliance) */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-slate-500" /> Supplier Proposal Files & Attachments
            </h4>
            {docs.length === 0 ? (
              <p className="text-xs text-slate-400 font-semibold italic">No file attachments uploaded with this quotation.</p>
            ) : (
              (() => {
                const techDocs = docs.filter((d: any) => {
                  const c = String(d.documentCategory || d.documentType || '').toLowerCase();
                  const n = String(d.documentName || d.fileName || d.name || '').toLowerCase();
                  return c.includes('tech') || c.includes('spec') || c.includes('compliance') || n.includes('tech') || n.includes('spec');
                });
                const finDocs = docs.filter((d: any) => {
                  const c = String(d.documentCategory || d.documentType || '').toLowerCase();
                  const n = String(d.documentName || d.fileName || d.name || '').toLowerCase();
                  return c.includes('finan') || c.includes('quote') || c.includes('price') || n.includes('price') || n.includes('quote') || n.includes('cost');
                });
                const boqDocs = docs.filter((d: any) => {
                  const c = String(d.documentCategory || d.documentType || '').toLowerCase();
                  const n = String(d.documentName || d.fileName || d.name || '').toLowerCase();
                  return c.includes('boq') || c.includes('schedule') || n.includes('boq') || n.includes('sheet') || n.includes('excel');
                });
                const otherDocs = docs.filter((d: any) => !techDocs.includes(d) && !finDocs.includes(d) && !boqDocs.includes(d));

                const renderDocItem = (doc: any, idx: number, iconColor: string) => {
                  const docName = doc.documentName || doc.name || doc.fileName || `Attachment #${idx + 1}`;
                  const fileId = doc.fileAssetId || doc.id;
                  return (
                    <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className={`h-4 w-4 ${iconColor} shrink-0`} />
                        <div className="min-w-0">
                          <p className="text-xs font-extrabold text-slate-900 truncate" title={docName}>{docName}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{doc.documentCategory || doc.documentType || 'Proposal File'}</p>
                        </div>
                      </div>
                      {fileId ? (
                        <a
                          href={`/api/files/${fileId}/view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition-all shrink-0"
                        >
                          <Download className="h-3 w-3" /> View
                        </a>
                      ) : doc.url ? (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition-all shrink-0"
                        >
                          <ExternalLink className="h-3 w-3" /> View
                        </a>
                      ) : null}
                    </div>
                  );
                };

                return (
                  <div className="space-y-3">
                    {techDocs.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider">Technical Proposals & Specifications ({techDocs.length})</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {techDocs.map((d: any, i: number) => renderDocItem(d, i, 'text-blue-600'))}
                        </div>
                      </div>
                    )}

                    {finDocs.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Financial Quotes & Commercial Bids ({finDocs.length})</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {finDocs.map((d: any, i: number) => renderDocItem(d, i, 'text-emerald-600'))}
                        </div>
                      </div>
                    )}

                    {boqDocs.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider">BOQ & Rate Schedules ({boqDocs.length})</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {boqDocs.map((d: any, i: number) => renderDocItem(d, i, 'text-purple-600'))}
                        </div>
                      </div>
                    )}

                    {otherDocs.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-black uppercase text-slate-700 tracking-wider">Statutory & Compliance Attachments ({otherDocs.length})</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {otherDocs.map((d: any, i: number) => renderDocItem(d, i, 'text-slate-600'))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} className="font-bold">
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
                router.push(`/bids/${targetId}/compare`);
              }}
              className="font-bold text-slate-700"
            >
              Compare Bids
            </Button>
            <Button
              type="button"
              onClick={() => {
                onClose();
                router.push(`/bids/${targetId}/results`);
              }}
              className="bg-[#12335f] hover:bg-[#0b2445] font-bold text-white shadow-sm"
            >
              Evaluation & Awarding
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface QuotationComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  participations: any[];
  initialSelectedSellerIds?: string[];
  procurementTitle?: string;
  targetId: string;
  router: any;
  onSelectQuotationReview?: (participation: any) => void;
}

export function QuotationComparisonModal({
  isOpen,
  onClose,
  participations = [],
  initialSelectedSellerIds,
  procurementTitle,
  targetId,
  router,
  onSelectQuotationReview,
}: QuotationComparisonModalProps) {
  const list = participations || [];
  const [activeSelectedIds, setActiveSelectedIds] = useState<string[]>(() => {
    if (initialSelectedSellerIds && initialSelectedSellerIds.length > 0) return initialSelectedSellerIds;
    return list.map(p => String(p.id || p.sellerId || p.sellerUserId));
  });

  const displayParticipations = useMemo(() => {
    if (activeSelectedIds.length === 0) return list;
    return list.filter(p => activeSelectedIds.includes(String(p.id || p.sellerId || p.sellerUserId)));
  }, [list, activeSelectedIds]);

  // Sort participations by quoted total price ascending (L1, L2, L3...)
  const sorted = useMemo(() => {
    return [...displayParticipations].sort((a, b) => {
      const pA = Number(a.totalAmount || a.quotedAmount || a.offeredPrice || Infinity);
      const pB = Number(b.totalAmount || b.quotedAmount || b.offeredPrice || Infinity);
      return pA - pB;
    });
  }, [displayParticipations]);

  if (!isOpen || !participations || participations.length === 0) return null;

  const lowestPrice = Number(sorted[0]?.totalAmount || sorted[0]?.quotedAmount || sorted[0]?.offeredPrice || 0);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-[10px] font-black uppercase text-blue-800 flex items-center gap-1">
                <Layers className="h-3 w-3" /> L1 Commercial Comparison Matrix
              </span>
              <span className="text-xs font-bold text-slate-400">{sorted.length} Proposals Submitted</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-0.5">Supplier Quotations Side-by-Side Comparison</h2>
            {procurementTitle && <p className="text-xs font-semibold text-slate-500 truncate max-w-lg">Procurement: {procurementTitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Top L1 Highlight Metric */}
          {lowestPrice > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800">L1 Lowest Quoted Price</p>
                  <p className="text-lg font-black text-emerald-950">₹{lowestPrice.toLocaleString('en-IN')}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-emerald-200/80 px-2.5 py-1 text-xs font-black text-emerald-900 uppercase">
                  L1 Supplier: {sorted[0]?.seller?.sellerProfile?.organizationName || sorted[0]?.seller?.organization?.organizationName || sorted[0]?.sellerOrganization?.organizationName || sorted[0]?.seller?.name || sorted[0]?.sellerUser?.name || 'L1 Bidder'}
                </span>
              </div>
            </div>
          )}

          {/* Matrix Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/80 font-black text-slate-600 uppercase tracking-wider text-[10px]">
                    <th className="p-3.5 border-r border-slate-200 w-[200px] bg-slate-100">Comparison Parameter</th>
                    {sorted.map((r, i) => {
                      const amount = Number(r.totalAmount || r.quotedAmount || r.offeredPrice || 0);
                      const isL1 = i === 0 && lowestPrice > 0;
                      const sellerOrg = r.seller?.sellerProfile?.organizationName
                        || r.seller?.organization?.organizationName
                        || r.sellerOrganization?.organizationName
                        || r.seller?.name
                        || r.sellerUser?.name
                        || `Supplier #${r.sellerId || r.sellerUserId}`;

                      return (
                        <th key={r.id || i} className={`p-3.5 border-r border-slate-200 text-center min-w-[200px] ${isL1 ? 'bg-emerald-50/70' : ''}`}>
                          <div className="font-extrabold text-slate-950 text-xs">{sellerOrg}</div>
                          <div className="mt-1 flex items-center justify-center gap-1">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${isL1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                              }`}>
                              {isL1 ? 'L1 - Lowest Quote' : `L${i + 1}`}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-semibold text-slate-700">
                  {/* Quoted Total Amount */}
                  <tr className="bg-slate-50/50">
                    <td className="p-3.5 border-r border-slate-200 font-black text-slate-900">Total Quoted Amount (INR)</td>
                    {sorted.map((r, i) => {
                      const amount = Number(r.totalAmount || r.quotedAmount || r.offeredPrice || 0);
                      const isL1 = i === 0 && lowestPrice > 0;
                      return (
                        <td key={r.id || i} className={`p-3.5 border-r border-slate-200 text-center font-black text-sm ${isL1 ? 'bg-emerald-50 text-emerald-950 font-black' : 'text-slate-900'}`}>
                          {amount > 0 ? `₹${amount.toLocaleString('en-IN')}` : 'Sealed / Rates On File'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Offered Quantity */}
                  <tr>
                    <td className="p-3.5 border-r border-slate-200 font-bold text-slate-600">Offered Quantity</td>
                    {sorted.map((r, i) => (
                      <td key={r.id || i} className="p-3.5 border-r border-slate-200 text-center">
                        {r.offeredQuantity || r.quantity || 'As Specified'}
                      </td>
                    ))}
                  </tr>

                  {/* Delivery Timeline */}
                  <tr className="bg-slate-50/50">
                    <td className="p-3.5 border-r border-slate-200 font-bold text-slate-600">Delivery Timeline</td>
                    {sorted.map((r, i) => (
                      <td key={r.id || i} className="p-3.5 border-r border-slate-200 text-center">
                        {r.deliveryTimeline || r.responseData?.deliveryTimeline || 'Standard'}
                      </td>
                    ))}
                  </tr>

                  {/* Payment Terms */}
                  <tr>
                    <td className="p-3.5 border-r border-slate-200 font-bold text-slate-600">Payment Terms</td>
                    {sorted.map((r, i) => (
                      <td key={r.id || i} className="p-3.5 border-r border-slate-200 text-center truncate max-w-[180px]">
                        {r.terms || r.responseData?.paymentTerms || 'Standard Terms'}
                      </td>
                    ))}
                  </tr>

                  {/* Brand / Make Offered */}
                  <tr className="bg-slate-50/50">
                    <td className="p-3.5 border-r border-slate-200 font-bold text-slate-600">Brand / Make Offered</td>
                    {sorted.map((r, i) => (
                      <td key={r.id || i} className="p-3.5 border-r border-slate-200 text-center">
                        {r.makeBrand || r.responseData?.makeBrand || 'As per specification'}
                      </td>
                    ))}
                  </tr>

                  {/* Submitted Date */}
                  <tr>
                    <td className="p-3.5 border-r border-slate-200 font-bold text-slate-600">Submission Date & Time</td>
                    {sorted.map((r, i) => {
                      const dt = r.submittedAt || r.createdAt || r.updatedAt;
                      return (
                        <td key={r.id || i} className="p-3.5 border-r border-slate-200 text-center text-slate-500 font-medium">
                          {dt ? new Date(dt).toLocaleString() : 'N/A'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Status */}
                  <tr className="bg-slate-50/50">
                    <td className="p-3.5 border-r border-slate-200 font-bold text-slate-600">Quotation Status</td>
                    {sorted.map((r, i) => (
                      <td key={r.id || i} className="p-3.5 border-r border-slate-200 text-center">
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-800">
                          {r.submissionStatus || r.status || 'SUBMITTED'}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Actions */}
                  <tr>
                    <td className="p-3.5 border-r border-slate-200 font-bold text-slate-600">Action</td>
                    {sorted.map((r, i) => (
                      <td key={r.id || i} className="p-3.5 border-r border-slate-200 text-center">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            onClose();
                            onSelectQuotationReview?.(r);
                          }}
                          className="h-7 text-[11px] font-extrabold bg-[#12335f] hover:bg-[#0b2445] text-white"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View Details
                        </Button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} className="font-bold">
            Close Comparison
          </Button>
          <Button
            type="button"
            onClick={() => {
              onClose();
              router.push(`/bids/${targetId}/results`);
            }}
            className="bg-[#12335f] hover:bg-[#0b2445] font-bold text-white shadow-sm"
          >
            Proceed to Evaluation & Award
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}

interface SelectQuotationsToCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  participations: any[];
  onConfirmCompare: (selectedIds: string[]) => void;
}

export function SelectQuotationsToCompareModal({
  isOpen,
  onClose,
  participations = [],
  onConfirmCompare,
}: SelectQuotationsToCompareModalProps) {
  const list = participations || [];
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    list.map(p => String(p.id || p.sellerId || p.sellerUserId))
  );

  if (!isOpen || !participations || participations.length === 0) return null;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const allIds = participations.map(p => String(p.id || p.sellerId || p.sellerUserId));
    if (selectedIds.length === allIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  const handleStartCompare = () => {
    if (selectedIds.length < 2) {
      toast.info("Please select at least 2 quotations to compare.");
      return;
    }
    onConfirmCompare(selectedIds);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-[10px] font-black uppercase text-blue-800 flex items-center gap-1">
                <Layers className="h-3 w-3" /> Select Bids
              </span>
            </div>
            <h2 className="text-base font-black text-slate-900 mt-0.5">Select Quotations to Compare</h2>
            <p className="text-xs font-medium text-slate-500">Choose 2 or more seller quotations to compare side-by-side.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* List of Sellers with Checkboxes */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          <div className="flex items-center justify-between px-2 py-1 text-xs">
            <span className="font-extrabold text-slate-700">{selectedIds.length} of {participations.length} Selected</span>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="font-bold text-blue-600 hover:underline"
            >
              {selectedIds.length === participations.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div className="space-y-2">
            {participations.map((p) => {
              const pId = String(p.id || p.sellerId || p.sellerUserId);
              const isChecked = selectedIds.includes(pId);
              const sellerOrg = p.seller?.sellerProfile?.organizationName
                || p.seller?.organization?.organizationName
                || p.sellerOrganization?.organizationName
                || p.seller?.name
                || p.sellerUser?.name
                || `Supplier #${pId}`;
              const contactName = p.seller?.name || p.sellerUser?.name || '';
              const amount = Number(p.totalAmount || p.quotedAmount || p.offeredPrice || 0);

              return (
                <div
                  key={pId}
                  onClick={() => toggleSelect(pId)}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-all",
                    isChecked
                      ? "border-blue-500 bg-blue-50/60 shadow-2xs"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => { }}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                    />
                    <div>
                      <p className="text-xs font-black text-slate-900">{sellerOrg}</p>
                      {contactName && contactName !== sellerOrg && (
                        <p className="text-[10px] font-medium text-slate-400">Contact: {contactName}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">
                      {amount > 0 ? `₹${amount.toLocaleString('en-IN')}` : 'Sealed Rate'}
                    </p>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800">
                      {p.submissionStatus || p.status || 'Submitted'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} className="font-bold text-xs">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleStartCompare}
            disabled={selectedIds.length < 2}
            className="bg-[#12335f] hover:bg-[#0b2445] font-bold text-xs text-white shadow-sm disabled:opacity-50"
          >
            Compare Selected ({selectedIds.length})
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
