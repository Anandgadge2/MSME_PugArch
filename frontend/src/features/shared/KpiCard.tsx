import React, { memo } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { cn } from '../../lib/utils';

export type KpiCardTone =
  | 'blue'
  | 'green'
  | 'amber'
  | 'red'
  | 'purple'
  | 'indigo'
  | 'slate'
  | 'cyan'
  | 'teal'
  | 'rose'
  | 'neutral'
  | 'positive'
  | 'warning'
  | 'negative'
  | 'info';

export interface KpiCardProps {
  label: string;
  value: React.ReactNode | number | string;
  subtext?: string;
  hint?: string;
  helper?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: KpiCardTone | string;
  color?: string;
  loading?: boolean;
  active?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
}

const TONES: Record<string, { bg: string; iconBg: string; text: string; shadow: string }> = {
  blue: {
    bg: 'from-sky-500/5 via-indigo-500/5 to-transparent border-sky-200/60',
    iconBg: 'bg-gradient-to-br from-[#12335f] to-indigo-700 text-white shadow-indigo-500/25',
    text: 'text-[#12335f]',
    shadow: 'hover:shadow-indigo-500/10'
  },
  green: {
    bg: 'from-emerald-500/5 via-teal-500/5 to-transparent border-emerald-200/60',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-emerald-500/25',
    text: 'text-emerald-700',
    shadow: 'hover:shadow-emerald-500/10'
  },
  positive: {
    bg: 'from-emerald-500/5 via-teal-500/5 to-transparent border-emerald-200/60',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-emerald-500/25',
    text: 'text-emerald-700',
    shadow: 'hover:shadow-emerald-500/10'
  },
  amber: {
    bg: 'from-amber-500/5 via-orange-500/5 to-transparent border-amber-200/60',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-500/25',
    text: 'text-amber-700',
    shadow: 'hover:shadow-amber-500/10'
  },
  warning: {
    bg: 'from-amber-500/5 via-orange-500/5 to-transparent border-amber-200/60',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-500/25',
    text: 'text-amber-700',
    shadow: 'hover:shadow-amber-500/10'
  },
  red: {
    bg: 'from-rose-500/5 via-red-500/5 to-transparent border-rose-200/60',
    iconBg: 'bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-rose-500/25',
    text: 'text-rose-700',
    shadow: 'hover:shadow-rose-500/10'
  },
  negative: {
    bg: 'from-rose-500/5 via-red-500/5 to-transparent border-rose-200/60',
    iconBg: 'bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-rose-500/25',
    text: 'text-rose-700',
    shadow: 'hover:shadow-rose-500/10'
  },
  rose: {
    bg: 'from-rose-500/5 via-red-500/5 to-transparent border-rose-200/60',
    iconBg: 'bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-rose-500/25',
    text: 'text-rose-700',
    shadow: 'hover:shadow-rose-500/10'
  },
  purple: {
    bg: 'from-purple-500/5 via-violet-500/5 to-transparent border-purple-200/60',
    iconBg: 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-purple-500/25',
    text: 'text-purple-700',
    shadow: 'hover:shadow-purple-500/10'
  },
  indigo: {
    bg: 'from-indigo-500/5 via-blue-500/5 to-transparent border-indigo-200/60',
    iconBg: 'bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-indigo-500/25',
    text: 'text-indigo-700',
    shadow: 'hover:shadow-indigo-500/10'
  },
  slate: {
    bg: 'from-slate-500/5 via-slate-400/5 to-transparent border-slate-200/80',
    iconBg: 'bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-slate-500/25',
    text: 'text-slate-700',
    shadow: 'hover:shadow-slate-500/10'
  },
  neutral: {
    bg: 'from-slate-500/5 via-slate-400/5 to-transparent border-slate-200/80',
    iconBg: 'bg-gradient-to-br from-[#12335f] to-slate-800 text-white shadow-slate-500/25',
    text: 'text-[#12335f]',
    shadow: 'hover:shadow-slate-500/10'
  },
  cyan: {
    bg: 'from-cyan-500/5 via-sky-500/5 to-transparent border-cyan-200/60',
    iconBg: 'bg-gradient-to-br from-cyan-600 to-sky-700 text-white shadow-cyan-500/25',
    text: 'text-cyan-700',
    shadow: 'hover:shadow-cyan-500/10'
  },
  teal: {
    bg: 'from-teal-500/5 via-emerald-500/5 to-transparent border-teal-200/60',
    iconBg: 'bg-gradient-to-br from-teal-600 to-emerald-700 text-white shadow-teal-500/25',
    text: 'text-teal-700',
    shadow: 'hover:shadow-teal-500/10'
  },
  info: {
    bg: 'from-sky-500/5 via-indigo-500/5 to-transparent border-sky-200/60',
    iconBg: 'bg-gradient-to-br from-sky-600 to-indigo-700 text-white shadow-sky-500/25',
    text: 'text-sky-700',
    shadow: 'hover:shadow-sky-500/10'
  }
};

function KpiCardBase({
  label,
  value,
  subtext,
  hint,
  helper,
  icon: Icon,
  tone,
  color,
  loading = false,
  active,
  isActive,
  onClick,
  className,
  ariaLabel
}: KpiCardProps) {
  const resolvedToneKey = String(tone || color || 'blue').toLowerCase();
  const currentTone = TONES[resolvedToneKey] || TONES.blue;
  const isCardActive = active ?? isActive ?? false;
  const interactive = typeof onClick === 'function';
  const displaySubtext = subtext || hint || helper;

  const formattedValue = React.useMemo(() => {
    if (loading) return '...';
    if (typeof value === 'number') {
      return value.toLocaleString('en-IN');
    }
    return value ?? '0';
  }, [value, loading]);

  const Element: any = interactive ? 'button' : 'div';

  return (
    <Element
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={interactive ? Boolean(isCardActive) : undefined}
      aria-label={interactive ? ariaLabel || `Filter by ${label}` : undefined}
      className={cn(
        'group relative w-full text-left overflow-hidden rounded-2xl border bg-gradient-to-br p-3 sm:p-4.5 shadow-sm backdrop-blur-sm transition-all duration-300',
        interactive && 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#12335f]/30',
        isCardActive
          ? 'border-[#12335f] shadow-md ring-2 ring-[#12335f]/20 bg-white'
          : 'hover:-translate-y-1 hover:border-[#12335f]/40 hover:shadow-lg',
        currentTone.bg,
        currentTone.shadow,
        className
      )}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] min-[400px]:text-[10px] font-black uppercase tracking-wider text-slate-500 truncate">{label}</p>
          <p className={cn('mt-1 text-xl min-[400px]:text-2xl sm:text-3xl font-black tracking-tight truncate', loading ? 'text-slate-300 animate-pulse' : 'text-slate-900')}>
            {formattedValue}
          </p>
        </div>
        {Icon && (
          <div
            className={cn(
              'flex h-8 w-8 min-[400px]:h-9 min-[400px]:w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3',
              currentTone.iconBg
            )}
          >
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        )}
      </div>
      {displaySubtext && (
        <div className="mt-2.5 sm:mt-3 flex items-center gap-1 sm:gap-1.5 border-t border-slate-100/90 pt-2 sm:pt-2.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400 animate-pulse" />
          <p className="text-[10px] min-[400px]:text-[11px] font-medium text-slate-500 truncate">{displaySubtext}</p>
        </div>
      )}
    </Element>
  );
}

export const KpiCard = memo(KpiCardBase);
export default KpiCard;
