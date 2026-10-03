'use client';

import React from 'react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Gavel,
  Info,
  Layers,
  Loader2,
  Package,
  Plus,
  Search,
  Trash2,
  Users,
  AlertTriangle,
  Upload,
  UserCheck,
  Clock,
  ExternalLink,
  Award,
  Globe,
  Pencil,
  Paperclip,
  Eye,
  X,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Button } from '../../../components/ui/button';
import { ProcurementGlossaryTooltip } from '../../../components/common/ProcurementGlossaryTooltip';

// Helper to format currency
const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

// ─────────────────────────────────────────────────────────────────────────────
// 1. ProcurementStepper
// ─────────────────────────────────────────────────────────────────────────────
export interface StepperStep {
  id: string;
  label: string;
  description?: string;
  icon?: any;
}

interface ProcurementStepperProps {
  steps: StepperStep[];
  currentStep: number;
  completedSteps: string[];
  maxVisitedStep?: number;
  onStepClick?: (idx: number) => void;
  disabledFutureSteps?: boolean;
}

export function ProcurementStepper({
  steps,
  currentStep,
  completedSteps,
  maxVisitedStep,
  onStepClick,
  disabledFutureSteps = false
}: ProcurementStepperProps) {
  const highestVisited = typeof maxVisitedStep === 'number' ? Math.max(maxVisitedStep, currentStep) : currentStep;

  return (
    <nav className="space-y-1.5 rounded-[22px] bg-white/95 backdrop-blur-sm p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
      {steps.map((step, idx) => {
        const isActive = idx === currentStep;
        const isCompleted = completedSteps.includes(step.id);
        const isVisited = idx <= highestVisited;
        const isDisabled = disabledFutureSteps && !isCompleted && !isVisited && idx > highestVisited + 1;
        const Icon = step.icon || ClipboardList;

        return (
          <button
            key={step.id}
            type="button"
            disabled={isDisabled}
            onClick={() => onStepClick && !isDisabled && onStepClick(idx)}
            className={cn(
              "group w-full flex items-start gap-3 rounded-2xl p-2.5 text-left transition-all duration-200 ease-out",
              isActive ? "bg-gradient-to-r from-[#12335f]/15 via-[#12335f]/10 to-[#12335f]/5 ring-1 ring-[#12335f]/25 shadow-sm translate-x-1" : "hover:bg-slate-100/80 hover:translate-x-1.5",
              isDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
            )}
          >
            <span className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all duration-200",
              isActive ? "bg-[#12335f] border-[#12335f] text-white shadow-sm shadow-[#12335f]/30 scale-105" :
              isCompleted ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm shadow-emerald-500/10 group-hover:scale-105" :
              "bg-white border-slate-200 text-slate-400 group-hover:border-slate-300 group-hover:text-slate-600"
            )}>
              {isCompleted && !isActive ? <Check className="h-3.5 w-3.5" /> : idx + 1}
            </span>
            <div className="min-w-0">
              <p className={cn("text-xs font-black tracking-tight truncate leading-tight transition-colors duration-200", isActive ? "text-[#12335f]" : "text-slate-700 group-hover:text-slate-900")}>
                {step.label}
              </p>
              {step.description && (
                <p className="text-[9px] text-slate-400 truncate mt-0.5 font-semibold leading-none">{step.description}</p>
              )}
            </div>
          </button>
        );
      })}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ProcurementMethodCard
// ─────────────────────────────────────────────────────────────────────────────
interface ProcurementMethodCardProps {
  title: string;
  subtitle: string;
  icon: any;
  complexity: 'Low' | 'Medium' | 'High';
  estimatedTime: string;
  isSelected?: boolean;
  isDisabled?: boolean;
  isRecommended?: boolean;
  termKey?: string;
  onSelect: () => void;
  fitCriteria?: string[];
}

export function ProcurementMethodCard({
  title,
  subtitle,
  icon: Icon,
  complexity,
  estimatedTime,
  isSelected = false,
  isDisabled = false,
  isRecommended = false,
  termKey,
  onSelect,
  fitCriteria = []
}: ProcurementMethodCardProps) {
  return (
    <div
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-disabled={isDisabled}
      aria-pressed={isSelected}
      onClick={isDisabled ? undefined : onSelect}
      onKeyDown={(e) => {
        if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "flex h-full w-full flex-col justify-between rounded-[22px] border-0 bg-white/95 p-4 text-left shadow-3xs ring-1 ring-slate-200/70 transition select-none",
        isSelected ? "ring-2 ring-[#12335f]/35 shadow-[0_14px_34px_rgba(18,51,95,0.12)]" : "hover:ring-[#12335f]/25 hover:shadow-sm",
        isDisabled ? "opacity-50 cursor-not-allowed bg-slate-50" : "cursor-pointer"
      )}
    >
      <div className="w-full">
        <div className="flex items-start justify-between gap-2">
          <span className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
            isSelected ? "bg-[#12335f] text-white border-[#12335f]" : "bg-slate-50 border-slate-200 text-slate-500"
          )}>
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div className="flex items-center gap-1.5">
            {termKey && (
              <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <ProcurementGlossaryTooltip term={termKey} />
              </span>
            )}
            {isRecommended && (
              <span className="bg-amber-100 text-amber-800 font-extrabold uppercase text-[8px] px-2 py-0.5 rounded leading-none border border-amber-200 animate-pulse">
                Recommended
              </span>
            )}
          </div>
        </div>

        <div className="mt-3">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide leading-tight truncate">{title}</h3>
          <p className="text-[10px] text-slate-500 leading-normal mt-1 min-h-[30px] line-clamp-2 font-medium">{subtitle}</p>
        </div>

        {fitCriteria.length > 0 && (
          <ul className="mt-3 space-y-1 text-[9px] font-semibold text-slate-400 border-t border-slate-100 pt-2">
            {fitCriteria.slice(0, 2).map((fit, i) => (
              <li key={i} className="flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span className="truncate">{fit}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="w-full flex items-center justify-between mt-4 pt-2 border-t border-slate-100 text-[9px] font-bold text-slate-450">
        <span>Complexity: <strong className="text-slate-800">{complexity}</strong></span>
        <span>Est. Time: <strong className="text-slate-800">{estimatedTime}</strong></span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ProcurementStatusBadge
// ─────────────────────────────────────────────────────────────────────────────
interface ProcurementStatusBadgeProps {
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'OPEN' | 'CLOSED' | 'AWARDED' | 'REJECTED' | 'CANCELLED' | string;
}

export function ProcurementStatusBadge({ status }: ProcurementStatusBadgeProps) {
  const norm = String(status || '').toUpperCase().trim();
  let style = 'bg-slate-50 text-slate-700 border-slate-200';

  if (norm === 'DRAFT') {
    style = 'bg-slate-100 text-slate-700 border-slate-300';
  } else if (norm === 'PENDING_APPROVAL') {
    style = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (norm === 'APPROVED') {
    style = 'bg-emerald-50 text-emerald-800 border-emerald-250';
  } else if (norm === 'PUBLISHED' || norm === 'OPEN') {
    style = 'bg-blue-50 text-blue-800 border-blue-200';
  } else if (norm === 'AWARDED') {
    style = 'bg-emerald-100 text-emerald-900 border-emerald-300';
  } else if (norm === 'CLOSED') {
    style = 'bg-slate-100 text-slate-800 border-slate-300';
  } else if (norm === 'REJECTED' || norm === 'CANCELLED') {
    style = 'bg-rose-50 text-rose-800 border-rose-200';
  }

  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-black uppercase tracking-wider leading-none", style)}>
      {norm.replace(/_/g, ' ')}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. OrganizationBadge — Shows entity classification for trust/context
// ─────────────────────────────────────────────────────────────────────────────
interface OrganizationBadgeProps {
  organizationType?: string;
  className?: string;
}

export function OrganizationBadge({ organizationType, className }: OrganizationBadgeProps) {
  const clean = String(organizationType || '').toUpperCase();
  const isPsu = clean.includes('PSU') || clean.includes('PUBLIC SECTOR');
  const isGov = clean.includes('GOV') || clean.includes('MINISTRY') || clean.includes('DEPARTMENT');

  let label = 'Private Enterprise';
  let badgeStyle = "bg-indigo-50 text-indigo-850 border-indigo-250";
  if (isPsu) {
    label = 'PSU Buyer';
    badgeStyle = "bg-sky-50 text-sky-850 border-sky-300";
  } else if (isGov) {
    label = 'Government Buyer';
    badgeStyle = "bg-amber-50 text-amber-850 border-amber-300";
  }

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded border text-[8.5px] font-black uppercase tracking-wider leading-none",
      badgeStyle,
      className
    )}>
      {label}
    </span>
  );
}

// Backward compatibility alias for legacy imports
export function BuyerTypeBadge({ buyerType, className }: { buyerType: string; className?: string }) {
  return <OrganizationBadge organizationType={buyerType} className={className} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MethodBadge
// ─────────────────────────────────────────────────────────────────────────────
interface MethodBadgeProps {
  method: string;
  className?: string;
}

export function MethodBadge({ method, className }: MethodBadgeProps) {
  const raw = String(method || '').trim();
  const upper = raw.toUpperCase();

  const hasRA = upper.includes('+ RA') || upper.includes('+RA') || upper.includes('REVERSE_AUCTION') || upper.includes('REVERSE AUCTION') || upper.includes('WITH_RA');

  let base = raw.replace(/_/g, ' ');
  if (hasRA && !upper.includes('+ RA') && !upper.includes('+RA')) {
    if (upper.startsWith('RFQ')) base = 'RFQ';
    else if (upper.startsWith('RFP')) base = 'RFP';
    else if (upper.includes('LIMITED')) base = 'Limited Tender';
    else if (upper.includes('OPEN') || upper.includes('TENDER')) base = 'Open Tender';
    else if (upper.includes('RATE')) base = 'Rate Contract';
    else if (upper === 'REVERSE_AUCTION' || upper === 'REVERSE AUCTION') base = 'Reverse Auction';
    else base = 'Procurement';
  }

  const parts = base.split(/\s*\+\s*/);
  const baseName = parts[0] || 'Procurement';
  const containsPlusRa = (parts.length > 1 || hasRA) && baseName !== 'Reverse Auction';

  return (
    <div className={cn("inline-flex items-center gap-1 shrink-0", className)}>
      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-slate-700">
        {baseName}
      </span>
      {containsPlusRa && (
        <span className="inline-flex items-center gap-0.5 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-rose-700 shadow-2xs">
          <Gavel className="h-2.5 w-2.5 text-rose-600" aria-hidden="true" />
          + RA
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. SectionCard
// ─────────────────────────────────────────────────────────────────────────────
interface SectionCardProps {
  title: string;
  description?: string;
  icon?: any;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  rightAction,
  className
}: SectionCardProps) {
  return (
    <div className={cn("group w-full min-w-0 max-w-full space-y-2.5 sm:space-y-4 rounded-[20px] sm:rounded-[24px] border-0 bg-white/95 backdrop-blur-sm p-3 sm:p-6 shadow-[0_12px_36px_rgba(15,23,42,0.06)] hover:shadow-[0_20px_45px_rgba(15,23,42,0.09)] ring-1 ring-slate-200/80 transition-all duration-300 ease-out", className)}>
      <div className="flex items-start justify-between gap-2.5 sm:gap-3 min-w-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {Icon && (
            <span className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#12335f]/10 to-[#12335f]/5 text-[#12335f] ring-1 ring-[#12335f]/15 group-hover:scale-110 group-hover:bg-[#12335f] group-hover:text-white transition-all duration-300 shadow-sm">
              <Icon className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            </span>
          )}
          <div className="min-w-0">
            <h3 className="text-[11px] sm:text-[13px] font-black text-slate-900 uppercase tracking-wide leading-none truncate">{title}</h3>
            {description && (
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-semibold mt-1 leading-normal truncate">{description}</p>
            )}
          </div>
        </div>
        {rightAction && <div className="shrink-0">{rightAction}</div>}
      </div>
      <div className="w-full min-w-0">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. StickyActionBar
// ─────────────────────────────────────────────────────────────────────────────
interface StickyActionBarProps {
  onBack?: () => void;
  onSaveDraft?: () => void;
  onContinue?: () => void;
  onSubmit?: () => void;
  backText?: string;
  continueText?: string;
  saveText?: string;
  submitText?: string;
  isSaving?: boolean;
  isSubmitting?: boolean;
  disableContinue?: boolean;
  disableSubmit?: boolean;
  showSubmit?: boolean;
}

export function StickyActionBar({
  onBack,
  onSaveDraft,
  onContinue,
  onSubmit,
  backText = 'Back',
  continueText = 'Save & Continue',
  saveText = 'Save Draft',
  submitText = 'Submit & Publish',
  isSaving = false,
  isSubmitting = false,
  disableContinue = false,
  disableSubmit = false,
  showSubmit = false
}: StickyActionBarProps) {
  return (
    <div className="sticky bottom-2 sm:bottom-4 z-20 flex flex-wrap items-center justify-between gap-1.5 sm:gap-3 rounded-[18px] sm:rounded-[22px] border border-slate-200/80 bg-white/95 p-1.5 px-2.5 sm:p-4 shadow-lg sm:shadow-[0_20px_50px_-12px_rgba(15,23,42,0.18)] backdrop-blur-md transition-all duration-300">
      <Button
        variant="outline"
        onClick={onBack}
        className="h-[38px] sm:h-10 px-3 sm:px-5 text-[11px] sm:text-sm text-slate-700 font-bold hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300 hover:-translate-x-0.5 active:translate-x-0 transition-all duration-200 rounded-xl"
        type="button"
      >
        {backText}
      </Button>

      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
        {onSaveDraft && (
          <Button
            variant="outline"
            onClick={onSaveDraft}
            disabled={isSaving}
            className="h-[38px] sm:h-10 px-3 sm:px-4 text-[11px] sm:text-sm text-slate-700 font-bold hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 rounded-xl"
            type="button"
          >
            {isSaving ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1.5" /> : null}
            {saveText}
          </Button>
        )}

        {showSubmit && onSubmit ? (
          <Button
            onClick={onSubmit}
            disabled={isSubmitting || disableSubmit}
            className="h-[38px] sm:h-10 text-[11px] sm:text-sm bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 hover:from-emerald-700 hover:to-teal-900 text-white font-black shadow-md shadow-emerald-700/25 hover:shadow-lg hover:shadow-emerald-700/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 px-4 sm:px-6 rounded-xl flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            type="button"
          >
            {isSubmitting ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1.5" /> : null}
            <span>{submitText}</span>
          </Button>
        ) : (
          onContinue && (
            <Button
              onClick={onContinue}
              disabled={disableContinue || isSaving}
              className="group h-8 sm:h-10 text-xs sm:text-sm bg-gradient-to-r from-[#12335f] via-[#1a447e] to-[#0f294a] hover:from-[#0e294d] hover:to-[#163c70] text-white font-black shadow-md shadow-[#12335f]/25 hover:shadow-lg hover:shadow-[#12335f]/35 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 px-4 sm:px-6 rounded-xl flex items-center gap-1.5"
              type="button"
            >
              <span>{continueText}</span>
              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Button>
          )
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. EmptyState
// ─────────────────────────────────────────────────────────────────────────────
interface EmptyStateProps {
  title: string;
  description: string;
  icon?: any;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon: Icon = FolderOpenEmptyIcon,
  actionText,
  onAction,
  className
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50", className)}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 border border-slate-200 mb-3.5">
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">{title}</h3>
      <p className="text-[10px] text-slate-500 font-semibold max-w-sm mt-1 leading-normal">{description}</p>
      {actionText && onAction && (
        <Button
          size="sm"
          onClick={onAction}
          className="mt-4 bg-[#12335f] text-white text-[10px] uppercase font-black"
        >
          {actionText}
        </Button>
      )}
    </div>
  );
}

function FolderOpenEmptyIcon(props: any) {
  return <ClipboardList {...props} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. BOQTable
// ─────────────────────────────────────────────────────────────────────────────
export interface BOQRowAttachment {
  id: string;
  name?: string;
  fileAssetId: number;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  uploadedAt?: string;
  url?: string;
}

export interface BOQRow {
  srNo: number;
  description: string;
  category: string;
  quantity: number;
  uom: string;
  estimatedRate: number;
  taxPercent: number;
  hsnSacCode?: string;
  fileAssetId?: number | null;
  fileName?: string | null;
  fileSize?: number | null;
  attachments?: BOQRowAttachment[];
  total: number;
  remarks: string;
}

const DEFAULT_BOQ_CATEGORIES = [
  'General',
  'Civil Works',
  'Electrical Works',
  'Mechanical Works',
  'IT Hardware & Networking',
  'Software & IT Services',
  'Consulting & Manpower',
  'Raw Materials',
  'Office Supplies & Equipment',
  'Facility Management',
  'Logistics & Transportation',
  'Industrial Machinery & Spares',
  'Chemicals & Minerals',
  'Safety & PPE',
];

const DEFAULT_BOQ_UOMS = [
  { value: 'NOS', label: 'NOS - Numbers' },
  { value: 'SET', label: 'SET - Sets' },
  { value: 'EA', label: 'EA - Each' },
  { value: 'KG', label: 'KG - Kilograms' },
  { value: 'MT', label: 'MT - Metric Tonnes' },
  { value: 'METER', label: 'METER - Meters' },
  { value: 'SQ FT', label: 'SQ FT - Square Feet' },
  { value: 'CU.MTRS', label: 'CU.MTRS - Cubic Meters' },
  { value: 'LTR', label: 'LTR - Litres' },
  { value: 'PKT', label: 'PKT - Packets' },
  { value: 'BOX', label: 'BOX - Boxes' },
  { value: 'PACK', label: 'PACK - Packs' },
  { value: 'RL', label: 'RL - Rolls' },
  { value: 'LOT', label: 'LOT - Lots' },
  { value: 'LS', label: 'LS - Lump Sum' },
  { value: 'HOUR', label: 'HOUR - Hours' },
  { value: 'DAY', label: 'DAY - Days' },
  { value: 'MONTH', label: 'MONTH - Months' },
];

const DEFAULT_BOQ_TAX_SLABS = [
  { value: 0, label: '0%' },
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18%' },
  { value: 28, label: '28%' },
];

interface BOQTableProps {
  rows: BOQRow[];
  onChange: (idx: number, key: keyof BOQRow, val: any) => void;
  onAddRow: () => void;
  onDuplicateRow: (idx: number) => void;
  onDeleteRow: (idx: number) => void;
  estimatedTotal: number;
  categories?: Array<{ id: number; name: string } | string>;
  loadingCategories?: boolean;
  uomOptions?: Array<{ value: string; label: string } | string>;
  taxRateOptions?: Array<{ value: number; label: string } | number>;
  onAttachDocument?: (idx: number, row: BOQRow) => void;
  onUploadRowDocument?: (idx: number, file: File) => Promise<void>;
  onRemoveRowDocument?: (idx: number, attachmentId?: string) => void;
  onPreviewDocument?: (attachment: { fileAssetId?: number; url?: string; fileName?: string; name?: string }) => void;
  onSyncEstimatedTotal?: (newTotal: number) => void;
}

export function BOQTable({
  rows,
  onChange,
  onAddRow,
  onDuplicateRow,
  onDeleteRow,
  estimatedTotal,
  categories = [],
  loadingCategories = false,
  uomOptions,
  taxRateOptions,
  onAttachDocument,
  onUploadRowDocument: _onUploadRowDocument,
  onRemoveRowDocument: _onRemoveRowDocument,
  onPreviewDocument,
  onSyncEstimatedTotal,
}: BOQTableProps) {
  const tableInput = 'h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-1 focus:ring-[#12335f]/15 transition-all';

  // Resolved dynamic categories
  const resolvedCategoryNames = React.useMemo(() => {
    const fromProps = categories.map(c => (typeof c === 'string' ? c : c.name)).filter(Boolean);
    const combined = Array.from(new Set([...fromProps, ...DEFAULT_BOQ_CATEGORIES]));
    return combined;
  }, [categories]);

  // Resolved dynamic UOMs
  const resolvedUoms = React.useMemo(() => {
    if (uomOptions && uomOptions.length > 0) {
      return uomOptions.map(u => {
        if (typeof u === 'string') return { value: u, label: u };
        return u;
      });
    }
    return DEFAULT_BOQ_UOMS;
  }, [uomOptions]);

  // Resolved dynamic Tax slabs
  const resolvedTaxSlabs = React.useMemo(() => {
    if (taxRateOptions && taxRateOptions.length > 0) {
      return taxRateOptions.map(t => {
        if (typeof t === 'number') return { value: t, label: `${t}%` };
        return t;
      });
    }
    return DEFAULT_BOQ_TAX_SLABS;
  }, [taxRateOptions]);

  return (
    <div className="space-y-3">
      <div className="w-full min-w-0 overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-3xs">
        <table data-ux-wrapped="true" className="w-full min-w-[1100px] border-collapse text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2.5 text-center w-12">Sr</th>
              <th className="px-3 py-2.5 min-w-[180px]">Item Description</th>
              <th className="px-3 py-2.5 w-36">Category</th>
              <th className="px-3 py-2.5 w-28">UOM</th>
              <th className="px-3 py-2.5 w-20 text-center">Qty</th>
              <th className="px-3 py-2.5 w-28 text-right">Est. Rate (₹)</th>
              <th className="px-3 py-2.5 w-20 text-center">Tax %</th>
              <th className="px-3 py-2.5 w-28 text-center">HSN/SAC</th>
              <th className="px-3 py-2.5 w-36 text-center">Docs (Opt.)</th>
              <th className="px-3 py-2.5 w-28 text-right">Total (Gross)</th>
              <th className="px-3 py-2.5 w-20 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold">
            {rows.map((row, idx) => {
              const rowCat = row.category || '';
              const isCustomCat = rowCat && !resolvedCategoryNames.some(c => c.toLowerCase() === rowCat.toLowerCase());
              
              const rowUom = row.uom || 'Nos';
              const isCustomUom = rowUom && !resolvedUoms.some(u => u.value.toLowerCase() === rowUom.toLowerCase());

              const attachmentsList = row.attachments || [];
              const hasDocs = attachmentsList.length > 0 || Boolean(row.fileName);
              const docCount = attachmentsList.length || (row.fileName ? 1 : 0);
              const firstAtt = attachmentsList[0];
              const docName = firstAtt?.fileName || row.fileName || 'Attachment';

              return (
                <tr key={idx} className="align-middle hover:bg-slate-50/60 transition-colors">
                  <td className="px-3 py-2 text-center text-slate-400 font-bold">{row.srNo}</td>
                  
                  {/* Item Description */}
                  <td className="px-3 py-2">
                    <input
                      value={row.description}
                      onChange={e => onChange(idx, 'description', e.target.value)}
                      className={tableInput}
                      placeholder="Describe item specifications"
                      aria-label={`Item description for row ${row.srNo}`}
                    />
                  </td>

                  {/* Category Dropdown (Database + Standard + Custom) */}
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      <select
                        value={resolvedCategoryNames.some(c => c.toLowerCase() === rowCat.toLowerCase()) ? rowCat : (rowCat ? 'Other' : '')}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'Other') {
                            onChange(idx, 'category', 'Other');
                          } else {
                            onChange(idx, 'category', val);
                          }
                        }}
                        className={cn(tableInput, 'cursor-pointer')}
                        aria-label={`Category for row ${row.srNo}`}
                      >
                        <option value="">{loadingCategories ? 'Loading...' : '-- Category --'}</option>
                        {resolvedCategoryNames.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="Other">Other / Custom...</option>
                      </select>
                      {(rowCat === 'Other' || isCustomCat) && (
                        <input
                          type="text"
                          value={rowCat === 'Other' ? '' : rowCat}
                          onChange={e => onChange(idx, 'category', e.target.value || 'Other')}
                          placeholder="Type category..."
                          className="h-7 w-full rounded border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-800 outline-none focus:border-[#12335f] focus:ring-1 focus:ring-[#12335f]/15"
                          aria-label={`Custom category for row ${row.srNo}`}
                        />
                      )}
                    </div>
                  </td>

                  {/* UOM Dropdown (Database + Standard + Custom) */}
                  <td className="px-3 py-2">
                    <div className="space-y-1">
                      <select
                        value={resolvedUoms.some(u => u.value.toLowerCase() === rowUom.toLowerCase()) ? (resolvedUoms.find(u => u.value.toLowerCase() === rowUom.toLowerCase())?.value) : (rowUom ? 'Other' : 'NOS')}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === 'Other') {
                            onChange(idx, 'uom', 'Other');
                          } else {
                            onChange(idx, 'uom', val);
                          }
                        }}
                        className={cn(tableInput, 'cursor-pointer uppercase')}
                        aria-label={`Unit of measure for row ${row.srNo}`}
                      >
                        {resolvedUoms.map(u => (
                          <option key={u.value} value={u.value}>{u.label || u.value}</option>
                        ))}
                        <option value="Other">Other / Custom...</option>
                      </select>
                      {(rowUom === 'Other' || isCustomUom) && (
                        <input
                          type="text"
                          value={rowUom === 'Other' ? '' : rowUom}
                          onChange={e => onChange(idx, 'uom', e.target.value || 'Other')}
                          placeholder="Type unit..."
                          className="h-7 w-full rounded border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-800 outline-none focus:border-[#12335f] focus:ring-1 focus:ring-[#12335f]/15 uppercase"
                          aria-label={`Custom UOM for row ${row.srNo}`}
                        />
                      )}
                    </div>
                  </td>

                  {/* Quantity */}
                  <td className="px-3 py-2 text-center">
                    <input
                      type="number"
                      min="1"
                      value={row.quantity || ''}
                      onChange={e => onChange(idx, 'quantity', Number(e.target.value || 0))}
                      className={cn(tableInput, 'text-center')}
                      aria-label={`Quantity for row ${row.srNo}`}
                    />
                  </td>

                  {/* Estimated Rate */}
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      value={row.estimatedRate || ''}
                      onChange={e => onChange(idx, 'estimatedRate', Number(e.target.value || 0))}
                      className={cn(tableInput, 'text-right font-medium')}
                      placeholder="0"
                      aria-label={`Estimated rate for row ${row.srNo}`}
                    />
                  </td>

                  {/* Tax % Dropdown */}
                  <td className="px-3 py-2">
                    <select
                      value={row.taxPercent ?? 18}
                      onChange={e => onChange(idx, 'taxPercent', Number(e.target.value || 0))}
                      className={cn(tableInput, 'cursor-pointer text-center')}
                      aria-label={`GST Slab for row ${row.srNo}`}
                    >
                      {resolvedTaxSlabs.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </td>

                  {/* HSN/SAC Code (Optional) */}
                  <td className="px-3 py-2 text-center">
                    <input
                      type="text"
                      value={row.hsnSacCode || ''}
                      onChange={e => onChange(idx, 'hsnSacCode', e.target.value)}
                      className={cn(tableInput, 'text-center font-mono text-[11px]')}
                      placeholder="HSN/SAC"
                      maxLength={15}
                      aria-label={`HSN or SAC code for row ${row.srNo}`}
                    />
                  </td>

                  {/* Attach Docs (Optional) */}
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1.5 min-w-[110px]">
                      {hasDocs ? (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onAttachDocument?.(idx, row)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/90 hover:bg-emerald-100 hover:border-emerald-300 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 transition-all cursor-pointer shadow-3xs whitespace-nowrap shrink-0"
                            title="Click to view and manage uploaded documents"
                            aria-label={`View ${docCount} documents for row ${row.srNo}`}
                          >
                            <Paperclip className="h-3 w-3 text-emerald-600 shrink-0" aria-hidden="true" />
                            <span>
                              {docCount} file{docCount === 1 ? '' : 's'}
                            </span>
                          </button>
                          {onPreviewDocument && (firstAtt || row.fileAssetId) && (
                            <button
                              type="button"
                              onClick={() => onPreviewDocument(firstAtt || { fileAssetId: row.fileAssetId || undefined, fileName: row.fileName || 'Document' })}
                              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
                              title="Preview primary document"
                              aria-label={`Preview document for row ${row.srNo}`}
                            >
                              <Eye className="h-3 w-3" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onAttachDocument?.(idx, row)}
                            className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer shrink-0"
                            title="Add more documents"
                            aria-label={`Add more documents for row ${row.srNo}`}
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAttachDocument?.(idx, row)}
                          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white hover:border-[#0b2447] hover:bg-slate-50 px-2.5 py-1 text-[10.5px] font-semibold text-slate-700 transition-all cursor-pointer whitespace-nowrap shrink-0 shadow-3xs"
                          title="Attach specification, drawing or dossier"
                          aria-label={`Attach specification or drawing for row ${row.srNo}`}
                        >
                          <Paperclip className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                          <span>Attach</span>
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Row Total */}
                  <td className="px-3 py-2 text-right font-black text-slate-900 whitespace-nowrap">
                    {formatCurrency(row.total)}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      title="Duplicate line"
                      onClick={() => onDuplicateRow(idx)}
                      className="p-1.5 text-slate-400 hover:text-[#12335f] hover:bg-slate-100 rounded transition-colors"
                      aria-label={`Duplicate row ${row.srNo}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete line"
                      onClick={() => onDeleteRow(idx)}
                      disabled={rows.length === 1}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded disabled:opacity-30 transition-colors"
                      aria-label={`Delete row ${row.srNo}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center pt-0.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAddRow}
          className="h-8.5 px-3.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border-slate-200 shadow-3xs cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add BOQ Row
        </Button>
      </div>

      {(() => {
        const totalQty = rows.reduce((acc, r) => acc + Number(r.quantity || 0), 0);
        const baseTotal = rows.reduce((acc, r) => acc + (Number(r.quantity || 0) * Number(r.estimatedRate || 0)), 0);
        const taxTotal = rows.reduce((acc, r) => acc + (Number(r.quantity || 0) * Number(r.estimatedRate || 0) * (Number(r.taxPercent ?? 18) / 100)), 0);
        const grossTotal = baseTotal + taxTotal;
        const qtyOk = totalQty > 0;
        const isSynced = estimatedTotal > 0 ? Math.round(grossTotal) === estimatedTotal : true;

        return (
          <div className="space-y-3">
            {/* 4 Summary Metric Cards matching Image 1 */}
            <div className="grid gap-2.5 sm:gap-3 grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-xs font-bold text-slate-700 shadow-3xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Total Items & Qty</span>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <span className="text-sm font-black text-slate-900">{rows.length} Lines</span>
                  <span className="text-xs font-bold text-slate-500">{totalQty.toLocaleString('en-IN')} Units</span>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-xs font-bold text-slate-700 shadow-3xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Base Value (Excl. GST)</span>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <span className="text-sm font-black text-slate-800">
                    {baseTotal > 0
                      ? formatCurrency(baseTotal)
                      : <span className="text-slate-400 font-bold text-xs">To be Quoted</span>}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">Pre-tax</span>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-xs font-bold text-slate-700 shadow-3xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Applicable GST (Taxes)</span>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <span className="text-sm font-black text-[#0b2447]">
                    {taxTotal > 0
                      ? `+${formatCurrency(taxTotal)}`
                      : '+18% GST'}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">Taxes</span>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/90 to-white p-3.5 text-xs font-bold shadow-3xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#0b2447]">Total Est. Value (Gross)</span>
                <div className="mt-1 flex items-baseline justify-between gap-1">
                  <span className="text-base font-black text-[#0b2447]">
                    {grossTotal > 0
                      ? formatCurrency(grossTotal)
                      : <span className="text-blue-900/80 font-black text-xs">Disclosed in Bid</span>}
                  </span>
                  <span className="text-[9.5px] font-black text-blue-700 bg-blue-100/70 px-1.5 py-0.5 rounded uppercase">Incl. GST</span>
                </div>
              </div>
            </div>

            {/* Reconciliation / info banner */}
            {rows.length > 0 && (
              grossTotal === 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold">
                    <Info className="h-4 w-4 text-[#0b2447] shrink-0" />
                    <span>
                      <strong>Competitive Price Discovery:</strong> Line item rate is ₹0. Bidders will quote unit rates during bidding.
                    </span>
                  </div>
                </div>
              ) : estimatedTotal > 0 && !isSynced ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs">
                  <div className="flex items-center gap-2 text-amber-900 font-semibold">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      Step 2 initial budget is <strong>{formatCurrency(estimatedTotal)}</strong>, but BOQ Schedule total (incl. GST) is <strong>{formatCurrency(grossTotal)}</strong>.
                    </span>
                  </div>
                  {onSyncEstimatedTotal && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onSyncEstimatedTotal(Math.round(grossTotal))}
                      className="h-7.5 px-3 text-xs font-black bg-[#0b2447] text-white hover:bg-[#12335f] shrink-0 whitespace-nowrap shadow-3xs cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> Sync Tender Budget with BOQ
                    </Button>
                  )}
                </div>
              ) : estimatedTotal > 0 && isSynced && grossTotal > 0 ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[11px] font-semibold text-emerald-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Tender estimated budget is fully synchronized with schedule line items (Base + GST).</span>
                  </div>
                  <span className="text-[9.5px] font-black uppercase text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                    Synchronized
                  </span>
                </div>
              ) : null
            )}

            {/* Zero-quantity warning banner matching Image 1 */}
            {!qtyOk && (
              <p className="text-[11px] font-bold text-rose-600">
                Add at least one line with a quantity greater than 0. Submission is blocked until total quantity is above 0.
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. SupplierSelector
// ─────────────────────────────────────────────────────────────────────────────
export interface Supplier {
  id: number;
  organizationName: string;
  msmeCategory?: string;
  officeCity?: string;
  rating?: string | number;
  pastOrdersCount?: number;
  onTimeDeliveryRate?: number;
  gstVerified?: boolean;
  categories?: string[];
  isUdyamVerified?: boolean;
}

interface SupplierSelectorProps {
  suppliers: Supplier[];
  invitedIds: number[];
  onToggleInvite: (id: number, name: string) => void;
  isLoading?: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  msmeOnly?: boolean;
  onMsmeOnlyChange?: (val: boolean) => void;
}

export function SupplierSelector({
  suppliers,
  invitedIds,
  onToggleInvite,
  isLoading = false,
  searchQuery,
  onSearchChange,
  msmeOnly = false,
  onMsmeOnlyChange
}: SupplierSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="h-9 w-full border border-slate-200 rounded-lg pl-9 pr-3 font-semibold focus:outline-none focus:ring-1 focus:ring-[#12335f]"
            placeholder="Search verified suppliers database..."
          />
        </div>
        {onMsmeOnlyChange && (
          <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={msmeOnly}
              onChange={e => onMsmeOnlyChange(e.target.checked)}
              className="h-4 w-4 rounded accent-[#12335f]"
            />
            <span>Filter MSME / Udyam verified only</span>
          </label>
        )}
      </div>

      <div className="w-full min-w-0 overflow-x-auto border border-slate-200 rounded-lg max-h-[320px] overflow-y-auto">
        {isLoading ? (
          <div className="p-10 flex items-center justify-center text-slate-450 text-xs font-semibold">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Searching supplier repository...
          </div>
        ) : suppliers.length === 0 ? (
          <div className="p-10 text-center text-slate-450 text-xs font-semibold">No category matched suppliers found.</div>
        ) : (
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-3 py-2 w-14 text-center">Select</th>
                <th className="px-3 py-2">Supplier Name</th>
                <th className="px-3 py-2">Categories / Trade</th>
                <th className="px-3 py-2">Location</th>
                <th className="px-3 py-2 text-center">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-750">
              {suppliers.map(seller => {
                const isSelected = invitedIds.includes(seller.id);
                return (
                  <tr key={seller.id} className="align-middle hover:bg-slate-50/50">
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleInvite(seller.id, seller.organizationName)}
                        className="h-4 w-4 rounded accent-[#12335f] cursor-pointer"
                        aria-label={`Select ${seller.organizationName}`}
                      />
                    </td>
                    <td className="px-3 py-2 font-extrabold text-slate-900">{seller.organizationName}</td>
                    <td className="px-3 py-2">
                      {seller.categories && seller.categories.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {seller.categories.slice(0, 2).map((cat, idx) => (
                            <span key={idx} className="bg-blue-50 text-[#12335f] text-[9px] font-bold px-1.5 py-0.5 rounded border border-blue-100">
                              {cat}
                            </span>
                          ))}
                          {seller.categories.length > 2 && (
                            <span className="text-[9px] text-slate-400 font-bold">+{seller.categories.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Verified Seller</span>
                      )}
                    </td>
                    <td className="px-3 py-2 truncate max-w-[150px]">{seller.officeCity || 'N/A'}</td>
                    <td className="px-3 py-2 text-center">
                      {seller.isUdyamVerified ? (
                        <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black px-1.5 py-0.5 rounded border border-emerald-200">
                          MSME
                        </span>
                      ) : (
                        <span className="bg-slate-50 text-slate-500 text-[9px] font-bold px-1.5 py-0.5 rounded">
                          General
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="text-[10px] text-slate-450 font-bold pl-0.5">
        Selected: <span className="text-slate-900 font-black">{invitedIds.length} suppliers</span> to invite.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. DocumentRequirementBuilder
// ─────────────────────────────────────────────────────────────────────────────
export interface SourcingDoc {
  id: string;
  name: string;
  required: boolean;
  instructions?: string;
  fileAssetId?: number | null;
  fileName?: string;
}

interface DocumentRequirementBuilderProps {
  documents: SourcingDoc[];
  onToggleRequired: (id: string) => void;
  onRemove: (id: string) => void;
  onAddCustomDoc: (name: string, required: boolean, instructions?: string) => void;
  onUpdateInstructions?: (id: string, instructions: string) => void;
  onUploadFile?: (id: string, file: File) => Promise<void>;
  onRemoveFile?: (id: string) => void;
  isEmergencyPriority?: boolean;
}

const STANDARD_DOC_PRESETS = [
  {
    name: 'GST Registration Certificate',
    required: true,
    instructions: 'Upload active GSTIN registration certificate showing registered business address.'
  },
  {
    name: 'Permanent Account Number (PAN)',
    required: true,
    instructions: 'Upload copy of PAN card matching the business / legal entity name.'
  },
  {
    name: 'Udyam MSME Registration Certificate',
    required: false,
    instructions: 'Upload valid Udyam certificate for claiming MSME purchase preference & EMD exemption.'
  },
  {
    name: 'OEM Authorization / MAF Form',
    required: true,
    instructions: 'Manufacturer Authorization Form (MAF) from OEM certifying authorization to bid and supply warranty.'
  },
  {
    name: '3 Yrs Audited Financials & CA Certificate',
    required: true,
    instructions: 'Audited Balance Sheet, Profit & Loss statements, and CA net-worth certificate for the last 3 financial years.'
  },
  {
    name: 'Past Work Order & Completion Certificate',
    required: true,
    instructions: 'Copies of successfully completed past purchase orders / contracts for similar goods or services.'
  },
  {
    name: 'Non-Blacklisting Undertaking Affidavit',
    required: true,
    instructions: 'Self-declaration affidavit on company letterhead confirming entity is not debarred or blacklisted by any Government or PSU.'
  },
  {
    name: 'ISO 9001:2015 Quality Certificate',
    required: false,
    instructions: 'Valid ISO 9001:2015 quality management system certification copy.'
  }
];

export function DocumentRequirementBuilder({
  documents,
  onToggleRequired,
  onRemove,
  onAddCustomDoc,
  onUpdateInstructions,
  onUploadFile,
  onRemoveFile,
  isEmergencyPriority
}: DocumentRequirementBuilderProps) {
  const [docName, setDocName] = React.useState('');
  const [docInstructions, setDocInstructions] = React.useState('');
  const [docReq, setDocReq] = React.useState(true);
  const [uploadingIds, setUploadingIds] = React.useState<Record<string, boolean>>({});

  const hasEmergencyDoc = documents.some(
    doc => doc.name.toLowerCase().includes('emergency') || doc.name.toLowerCase().includes('justification')
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) return;
    onAddCustomDoc(docName.trim(), docReq, docInstructions.trim() || undefined);
    setDocName('');
    setDocInstructions('');
  };

  return (
    <div className="space-y-4">
      {isEmergencyPriority && (
        hasEmergencyDoc ? (
          <div role="status" aria-live="polite" className="p-3.5 sm:p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" aria-hidden="true" />
            <div className="text-xs">
              <span className="font-bold text-emerald-950">Emergency Procurement Compliance Satisfied:</span>
              <span className="text-emerald-800 ml-1">An emergency approval or justification document is included in your document checklist.</span>
            </div>
          </div>
        ) : (
          <div role="status" aria-live="polite" className="p-3.5 sm:p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h4 className="text-xs font-bold text-amber-950">Emergency Procurement Priority Selected</h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  Because this procurement is marked as <strong>Emergency</strong> priority, an <strong>Emergency Approval Note</strong> or <strong>Justification Letter</strong> is recommended in the checklist.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onAddCustomDoc('Emergency Approval Note', true, 'Upload official emergency procurement approval note.')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 cursor-pointer"
            >
              + Add Emergency Approval Doc
            </button>
          </div>
        )
      )}

      {/* Quick Add Standard Compliance Presets */}
      <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 sm:p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider">
              Quick Presets: Standard Compliance Documents
            </span>
            <span className="text-[10px] font-semibold text-slate-500">1-click attach</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            * denotes mandatory compliance
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {STANDARD_DOC_PRESETS.map(preset => {
            const alreadyAdded = documents.some(
              d => d.name.trim().toLowerCase() === preset.name.trim().toLowerCase()
            );
            return (
              <button
                key={preset.name}
                type="button"
                disabled={alreadyAdded}
                onClick={() => onAddCustomDoc(preset.name, preset.required, preset.instructions)}
                title={alreadyAdded ? 'Already included in checklist' : preset.instructions}
                className={cn(
                  "text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all flex items-center gap-1.5",
                  alreadyAdded
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 opacity-80 cursor-default"
                    : "border-slate-200 bg-white hover:border-[#0b2447] hover:bg-[#0b2447] hover:text-white text-slate-700 shadow-xs cursor-pointer active:scale-95"
                )}
              >
                <span>{alreadyAdded ? '✓' : '+'}</span>
                <span>{preset.name}</span>
                {preset.required && !alreadyAdded && (
                  <span className="text-[10px] text-rose-500 font-black">*</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row md:items-end justify-between gap-3 border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50/50">
        <label className="w-full md:w-5/12 block space-y-1">
          <span className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Document Name</span>
          <input
            value={docName}
            onChange={e => setDocName(e.target.value)}
            className="h-8 sm:h-9 w-full min-w-0 border border-slate-200 rounded-lg px-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#12335f] bg-white"
            placeholder="ISO/BIS standard, balance sheet..."
            aria-label="Custom document name"
          />
        </label>
        <label className="w-full md:w-5/12 block space-y-1">
          <span className="text-[9px] font-black uppercase text-slate-450 tracking-wider">Custom Instruction / Guidelines</span>
          <input
            value={docInstructions}
            onChange={e => setDocInstructions(e.target.value)}
            className="h-8 sm:h-9 w-full min-w-0 border border-slate-200 rounded-lg px-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#12335f] bg-white"
            placeholder="e.g. Upload certified copy for current FY..."
            aria-label="Custom document instruction"
          />
        </label>
        <div className="w-full md:w-auto flex items-center justify-between md:justify-start gap-3 sm:gap-4 text-[10px] sm:text-xs font-semibold shrink-0">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={docReq}
              onChange={e => setDocReq(e.target.checked)}
              className="h-4 w-4 rounded accent-[#12335f]"
              aria-label="Is mandatory document"
            />
            <span className="text-slate-700">Mandatory?</span>
          </label>
          <Button
            type="submit"
            disabled={!docName.trim()}
            className="flex-1 md:flex-none h-8 sm:h-9 bg-[#12335f] text-white hover:bg-[#0b2445] text-xs font-bold px-4"
          >
            Add Document
          </Button>
        </div>
      </form>

      <div className="hidden sm:block border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2.5 w-1/4">Document Name</th>
              <th className="px-3 py-2.5 w-28">Requirement</th>
              <th className="px-3 py-2.5">Instructions</th>
              {/* <th className="px-3 py-2 w-48">Buyer Reference / Template</th> */}
              <th className="px-3 py-2.5 w-16 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
            {documents.map(doc => (
              <tr key={doc.id} className="align-middle hover:bg-slate-50/50">
                <td className="px-3 py-2.5 font-extrabold text-slate-900">{doc.name}</td>
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => onToggleRequired(doc.id)}
                    className={cn(
                      "text-[9px] font-black uppercase px-2 py-0.5 rounded border transition-all cursor-pointer",
                      doc.required ? "bg-rose-55 bg-rose-50 text-rose-800 border-rose-200" : "bg-slate-50 text-slate-500 border-slate-200"
                    )}
                    aria-label={`Toggle requirement for ${doc.name}, currently ${doc.required ? 'Mandatory' : 'Optional'}`}
                  >
                    {doc.required ? 'Mandatory' : 'Optional'}
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <div className="relative flex items-center group">
                    <input
                      type="text"
                      value={doc.instructions ?? ''}
                      onChange={(e) => onUpdateInstructions?.(doc.id, e.target.value)}
                      placeholder="Enter instructions for supplier..."
                      className="h-8 w-full border border-slate-200 hover:border-slate-300 focus:border-[#12335f] bg-white rounded-lg px-2.5 pr-7 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#12335f] transition-all"
                      title="Edit instructions"
                      aria-label={`Instructions for ${doc.name}`}
                    />
                    <Pencil className="h-3 w-3 text-slate-400 absolute right-2.5 pointer-events-none group-focus-within:text-[#12335f] transition-colors" aria-hidden="true" />
                  </div>
                </td>
                {/* Buyer Reference / Template Upload option commented out as requested */}
                {/*
                <td className="px-3 py-3">
                  {doc.fileAssetId ? (
                    <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded text-[11px] max-w-[180px]">
                      <span className="truncate font-bold" title={doc.fileName || 'Attached document'}>
                        {doc.fileName || 'Attached document'}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveFile && onRemoveFile(doc.id)}
                        className="text-rose-500 hover:text-rose-700 font-bold ml-auto flex-shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div>
                      {uploadingIds[doc.id] ? (
                        <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Uploading...</span>
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type="file"
                            id={`file-upload-${doc.id}`}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file && onUploadFile) {
                                setUploadingIds(prev => ({ ...prev, [doc.id]: true }));
                                try {
                                  await onUploadFile(doc.id, file);
                                } finally {
                                  setUploadingIds(prev => ({ ...prev, [doc.id]: false }));
                                }
                              }
                            }}
                            className="hidden"
                          />
                          <label
                            htmlFor={`file-upload-${doc.id}`}
                            className="cursor-pointer inline-flex items-center gap-1 bg-[#12335f]/10 hover:bg-[#12335f]/20 text-[#12335f] text-[10px] font-black uppercase px-2 py-1 rounded transition-all"
                          >
                            <Upload className="h-3 w-3" />
                            <span>Upload</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </td>
                */}
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove(doc.id)}
                    className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 sm:hidden">
        {documents.map(doc => (
          <div key={doc.id} className="border border-slate-200 rounded-xl p-3 bg-white space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-slate-900 text-xs truncate" title={doc.name}>{doc.name}</h4>
                <div className="mt-2">
                  <label htmlFor={`mobile-doc-inst-${doc.id}`} className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Instructions / Guidelines
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id={`mobile-doc-inst-${doc.id}`}
                      type="text"
                      value={doc.instructions ?? ''}
                      onChange={(e) => onUpdateInstructions?.(doc.id, e.target.value)}
                      placeholder="Add instructions for supplier..."
                      className="h-8 w-full border border-slate-200 bg-slate-50 focus:bg-white rounded-lg px-2.5 pr-7 text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#12335f] transition-all"
                      aria-label={`Instructions for ${doc.name}`}
                    />
                    <Pencil className="h-3 w-3 text-slate-400 absolute right-2.5 pointer-events-none" aria-hidden="true" />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(doc.id)}
                className="p-1 text-rose-500 hover:bg-rose-50 rounded flex-shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            
            <div className="flex flex-wrap items-center justify-between border-t border-slate-100 pt-2 gap-2">
              <button
                type="button"
                onClick={() => onToggleRequired(doc.id)}
                className={cn(
                  "text-[9px] font-black uppercase px-2 py-1 rounded border transition-all flex-shrink-0",
                  doc.required ? "bg-rose-50 text-rose-800 border-rose-200" : "bg-slate-50 text-slate-500 border-slate-200"
                )}
              >
                {doc.required ? 'Mandatory' : 'Optional'}
              </button>

              <div className="min-w-0">
                {doc.fileAssetId ? (
                  <div className="flex items-center justify-end gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded text-[10px]">
                    <span className="truncate font-bold max-w-[120px]" title={doc.fileName || 'Attached document'}>
                      {doc.fileName || 'Attached document'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveFile && onRemoveFile(doc.id)}
                      className="text-rose-500 hover:text-rose-700 font-bold ml-1 flex-shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div>
                    {uploadingIds[doc.id] ? (
                      <div className="flex items-center justify-end gap-1.5 text-slate-500 text-[10px] font-bold">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </div>
                    ) : (
                      <div className="relative flex justify-end">
                        <input
                          type="file"
                          id={`mobile-file-upload-${doc.id}`}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file && onUploadFile) {
                              setUploadingIds(prev => ({ ...prev, [doc.id]: true }));
                              try {
                                await onUploadFile(doc.id, file);
                              } finally {
                                setUploadingIds(prev => ({ ...prev, [doc.id]: false }));
                              }
                            }
                          }}
                          className="hidden"
                        />
                        <label
                          htmlFor={`mobile-file-upload-${doc.id}`}
                          className="cursor-pointer inline-flex items-center gap-1 bg-[#12335f]/10 hover:bg-[#12335f]/20 text-[#12335f] text-[9px] font-black uppercase px-2 py-1 rounded transition-all"
                        >
                          <Upload className="h-3 w-3" />
                          <span>Upload</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. EvaluationCriteriaBuilder
// ─────────────────────────────────────────────────────────────────────────────
export interface EvalCriteria {
  id: string;
  name: string;
  description: string;
  maxScore: number;
  weightage: number;
  mandatory: boolean;
  minMarks: number;
}

interface EvaluationCriteriaBuilderProps {
  criteria: EvalCriteria[];
  onChange: (id: string, key: keyof EvalCriteria, val: any) => void;
  onAddRow: () => void;
  onDeleteRow: (id: string) => void;
}

export function EvaluationCriteriaBuilder({
  criteria,
  onChange,
  onAddRow,
  onDeleteRow,
}: EvaluationCriteriaBuilderProps) {
  const tableInput = 'h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold outline-none focus:border-[#12335f] focus:ring-1 focus:ring-[#12335f]/15';
  const totalWeightage = criteria.reduce((sum, c) => sum + Number(c.weightage || 0), 0);

  return (
    <div className="space-y-3">

      <div className="w-full min-w-0 overflow-x-auto border border-slate-200 rounded-lg">
        <div className="overflow-x-auto w-full rounded-xl border border-slate-200 bg-white mb-6 shadow-sm">
<table data-ux-wrapped="true" className="w-full min-w-[700px] border-collapse text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2.5">Criteria Name</th>
              <th className="px-3 py-2.5">Description</th>
              <th className="px-3 py-2.5 w-24">Max Score</th>
              <th className="px-3 py-2.5 w-24">Weight %</th>
              <th className="px-3 py-2.5 w-20 text-center">Mandatory</th>
              <th className="px-3 py-2.5 w-24">Min Marks</th>
              <th className="px-3 py-2.5 w-20 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
            {criteria.map(c => (
              <tr key={c.id} className="align-middle hover:bg-slate-50/50">
                <td className="px-3 py-1.5">
                  <input
                    value={c.name}
                    onChange={e => onChange(c.id, 'name', e.target.value)}
                    className={tableInput}
                    placeholder="e.g. Turnovers, Experience"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    value={c.description}
                    onChange={e => onChange(c.id, 'description', e.target.value)}
                    className={tableInput}
                    placeholder="Brief evaluation description"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    value={c.maxScore || ''}
                    onChange={e => onChange(c.id, 'maxScore', Number(e.target.value || 0))}
                    className={tableInput}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    value={c.weightage || ''}
                    onChange={e => onChange(c.id, 'weightage', Number(e.target.value || 0))}
                    className={tableInput}
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={c.mandatory}
                    onChange={e => onChange(c.id, 'mandatory', e.target.checked)}
                    className="h-4 w-4 rounded accent-[#12335f] cursor-pointer"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    value={c.minMarks || ''}
                    onChange={e => onChange(c.id, 'minMarks', Number(e.target.value || 0))}
                    className={tableInput}
                  />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => onDeleteRow(c.id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
</div>
      </div>

      <div className="flex justify-between items-center font-bold text-xs px-0.5">
        <Button type="button" size="sm" variant="outline" onClick={onAddRow} className="h-8 text-slate-700">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Criteria Row
        </Button>
        <span className="text-[#12335f] font-extrabold">
          Total Weightage Sum: {totalWeightage}%
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 13. ApprovalTimeline
// ─────────────────────────────────────────────────────────────────────────────
interface ApprovalTimelineProps {
  stages: string[];
  currentIdx?: number;
}

export function ApprovalTimeline({ stages, currentIdx = 0 }: ApprovalTimelineProps) {
  return (
    <div className="w-full min-w-0 flex flex-col sm:flex-row sm:items-center gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl overflow-x-auto">
      {stages.map((stage, idx) => {
        const isPassed = idx < currentIdx;
        const isCurrent = idx === currentIdx;

        return (
          <React.Fragment key={idx}>
            <div className="flex items-center gap-2">
              <span className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black border transition-all",
                isPassed ? "bg-emerald-55 border-emerald-500 bg-emerald-500 text-white" :
                isCurrent ? "bg-[#12335f] border-[#12335f] text-white ring-4 ring-[#12335f]/15" :
                "bg-white border-slate-200 text-slate-450"
              )}>
                {isPassed ? <Check className="h-3 w-3" /> : idx + 1}
              </span>
              <span className={cn(
                "text-[10px] font-black uppercase tracking-wider whitespace-nowrap",
                isCurrent ? "text-[#12335f]" : "text-slate-500"
              )}>
                {stage}
              </span>
            </div>
            {idx < stages.length - 1 && (
              <ChevronRight className="h-4 w-4 text-slate-300 hidden sm:block shrink-0" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 14. ProcurementSummaryPanel
// ─────────────────────────────────────────────────────────────────────────────
interface ProcurementSummaryPanelProps {
  title: string;
  buyerType?: string;
  method: string;
  estimatedValue: number;
  priority: string;
  requiredBy?: string;
  location?: string;
  itemsCount: number;
  suppliersCount: number;
  docsCount: number;
}

function formatDateTimeDisplay(val?: string) {
  if (!val) return 'N/A';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const isDateOnlyStr = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim());
    if (isDateOnlyStr) return `${day} ${month} ${year}`;
    const hoursNum = d.getHours();
    const minutesStr = String(d.getMinutes()).padStart(2, '0');
    const ampm = hoursNum >= 12 ? 'PM' : 'AM';
    let h12 = hoursNum % 12;
    if (h12 === 0) h12 = 12;
    const hoursFormatted = String(h12).padStart(2, '0');
    return `${day} ${month} ${year}, ${hoursFormatted}:${minutesStr} ${ampm}`;
  } catch {
    return val;
  }
}

export function ProcurementSummaryPanel({
  title,
  buyerType: _buyerType,
  method,
  estimatedValue,
  priority,
  requiredBy,
  location,
  itemsCount,
  suppliersCount,
  docsCount
}: ProcurementSummaryPanelProps) {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 font-bold text-xs">
      <SummaryItem label="Sourcing Title" value={title} className="sm:col-span-2 xl:col-span-2" />
      <SummaryItem label="Sourcing Method" value={method ? method.replace(/_/g, ' ') : 'N/A'} />
      <SummaryItem label="Estimated Budget" value={formatCurrency(estimatedValue)} />
      <SummaryItem label="Priority Level" value={priority || 'Normal'} />
      <SummaryItem label="Required By Date & Time" value={formatDateTimeDisplay(requiredBy)} />
      <SummaryItem label="Line Items" value={`${itemsCount} line items scheduled`} />
      <SummaryItem label="Delivery Location" value={location || 'N/A'} className="sm:col-span-2 xl:col-span-2" />
      <SummaryItem label="Invited Bidders" value={`${suppliersCount} suppliers invited`} />
      <SummaryItem label="Required Checklists" value={`${docsCount} documents required`} />
    </div>
  );
}

function SummaryItem({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("border border-slate-200 rounded-lg p-3 bg-slate-50/50 flex flex-col justify-between min-h-[64px]", className)}>
      <p className="text-[8.5px] font-black uppercase text-slate-400 tracking-wider leading-none">{label}</p>
      <p className="mt-1.5 text-slate-900 font-extrabold tracking-tight break-words text-xs leading-snug" title={value}>
        {value || 'N/A'}
      </p>
    </div>
  );
}

