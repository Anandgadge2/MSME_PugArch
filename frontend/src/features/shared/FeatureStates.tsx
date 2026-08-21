import { AlertTriangle, Inbox, type LucideIcon } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { TruckLoader } from '../../components/ui/TruckLoader';

export function LoadingState({ label = 'Loading records...', sublabel }: { label?: string; sublabel?: string }) {
  return (
    <div className="flex min-h-[360px] w-full flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white/95 p-8 shadow-xs backdrop-blur-sm">
      <TruckLoader label={label} sublabel={sublabel || 'Please wait while we prepare your data...'} />
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  /** Optional CTA button. */
  action?: { label: string; onClick: () => void };
}

export function EmptyState({
  title = 'No records found',
  description = 'Try changing filters or create a new record.',
  icon: Icon = Inbox,
  action
}: EmptyStateProps) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="mt-3 text-sm font-black text-slate-900 text-wrap-anywhere">{title}</h3>
      <p className="mt-1 max-w-md text-xs font-semibold text-slate-500 text-wrap-anywhere">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-4 bg-[#12335f] text-white hover:bg-[#0e2a4f]">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8 text-center">
      <AlertTriangle className="h-8 w-8 text-red-500" />
      <h3 className="mt-3 text-sm font-black text-red-900">Unable to load data</h3>
      <p className="mt-1 max-w-md text-xs font-semibold text-red-700">{message}</p>
      {onRetry && <Button onClick={onRetry} className="mt-4 h-9 rounded-md bg-red-700 px-4 text-xs font-black text-white">Retry</Button>}
    </div>
  );
}

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
        <div>
          <p className="mt-1 text-xs font-semibold text-red-700">{message}</p>
        </div>
      </div>
      {onRetry && <Button onClick={onRetry} className="h-9 shrink-0 rounded-md bg-red-700 px-4 text-xs font-black text-white">Retry</Button>}
    </div>
  );
}
