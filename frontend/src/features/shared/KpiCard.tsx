import React, { memo } from 'react';
import { cn } from '../../lib/utils';

export type KpiCardTone =
  | 'blue'
  | 'green'
  | 'emerald'
  | 'amber'
  | 'orange'
  | 'red'
  | 'rose'
  | 'purple'
  | 'indigo'
  | 'slate'
  | 'cyan'
  | 'teal'
  | 'sky'
  | 'neutral'
  | 'positive'
  | 'warning'
  | 'negative'
  | 'info';

export interface KpiCardProps {
  label: string;
  value: React.ReactNode | number | string;
  subtext?: React.ReactNode | string;
  hint?: React.ReactNode | string;
  helper?: React.ReactNode | string;
  change?: React.ReactNode | string;
  description?: React.ReactNode | string;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  tone?: KpiCardTone | string;
  color?: string;
  loading?: boolean;
  active?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
  ariaLabel?: string;
  badge?: React.ReactNode | string;
  badgeColor?: string;
  trend?: string;
}

const TONES: Record<string, { bg: string; iconBg: string; text: string; shadow: string }> = {
  blue: {
    bg: 'from-sky-100/80 via-indigo-50/50 to-transparent border-sky-200/60',
    iconBg: 'bg-gradient-to-br from-[#12335f] to-indigo-700 text-white shadow-indigo-500/25',
    text: 'text-[#12335f]',
    shadow: 'hover:shadow-indigo-500/10'
  },
  sky: {
    bg: 'from-sky-100/80 via-blue-50/50 to-transparent border-sky-200/60',
    iconBg: 'bg-gradient-to-br from-sky-600 to-blue-700 text-white shadow-sky-500/25',
    text: 'text-sky-700',
    shadow: 'hover:shadow-sky-500/10'
  },
  green: {
    bg: 'from-emerald-100/80 via-teal-50/50 to-transparent border-emerald-200/60',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-emerald-500/25',
    text: 'text-emerald-700',
    shadow: 'hover:shadow-emerald-500/10'
  },
  emerald: {
    bg: 'from-emerald-100/80 via-teal-50/50 to-transparent border-emerald-200/60',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-emerald-500/25',
    text: 'text-emerald-700',
    shadow: 'hover:shadow-emerald-500/10'
  },
  positive: {
    bg: 'from-emerald-100/80 via-teal-50/50 to-transparent border-emerald-200/60',
    iconBg: 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-emerald-500/25',
    text: 'text-emerald-700',
    shadow: 'hover:shadow-emerald-500/10'
  },
  amber: {
    bg: 'from-amber-100/80 via-orange-50/50 to-transparent border-amber-200/60',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-500/25',
    text: 'text-amber-700',
    shadow: 'hover:shadow-amber-500/10'
  },
  orange: {
    bg: 'from-orange-100/80 via-amber-50/50 to-transparent border-orange-200/60',
    iconBg: 'bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-orange-500/25',
    text: 'text-orange-700',
    shadow: 'hover:shadow-orange-500/10'
  },
  warning: {
    bg: 'from-amber-100/80 via-orange-50/50 to-transparent border-amber-200/60',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-500/25',
    text: 'text-amber-700',
    shadow: 'hover:shadow-amber-500/10'
  },
  red: {
    bg: 'from-rose-100/80 via-red-50/50 to-transparent border-rose-200/60',
    iconBg: 'bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-rose-500/25',
    text: 'text-rose-700',
    shadow: 'hover:shadow-rose-500/10'
  },
  negative: {
    bg: 'from-rose-100/80 via-red-50/50 to-transparent border-rose-200/60',
    iconBg: 'bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-rose-500/25',
    text: 'text-rose-700',
    shadow: 'hover:shadow-rose-500/10'
  },
  rose: {
    bg: 'from-rose-100/80 via-red-50/50 to-transparent border-rose-200/60',
    iconBg: 'bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-rose-500/25',
    text: 'text-rose-700',
    shadow: 'hover:shadow-rose-500/10'
  },
  purple: {
    bg: 'from-purple-100/80 via-violet-50/50 to-transparent border-purple-200/60',
    iconBg: 'bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-purple-500/25',
    text: 'text-purple-700',
    shadow: 'hover:shadow-purple-500/10'
  },
  indigo: {
    bg: 'from-indigo-100/80 via-blue-50/50 to-transparent border-indigo-200/60',
    iconBg: 'bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-indigo-500/25',
    text: 'text-indigo-700',
    shadow: 'hover:shadow-indigo-500/10'
  },
  slate: {
    bg: 'from-slate-100/80 via-slate-50/50 to-transparent border-slate-200/80',
    iconBg: 'bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-slate-500/25',
    text: 'text-slate-700',
    shadow: 'hover:shadow-slate-500/10'
  },
  neutral: {
    bg: 'from-slate-100/80 via-slate-50/50 to-transparent border-slate-200/80',
    iconBg: 'bg-gradient-to-br from-[#12335f] to-slate-800 text-white shadow-slate-500/25',
    text: 'text-[#12335f]',
    shadow: 'hover:shadow-slate-500/10'
  },
  cyan: {
    bg: 'from-cyan-100/80 via-sky-50/50 to-transparent border-cyan-200/60',
    iconBg: 'bg-gradient-to-br from-cyan-600 to-sky-700 text-white shadow-cyan-500/25',
    text: 'text-cyan-700',
    shadow: 'hover:shadow-cyan-500/10'
  },
  teal: {
    bg: 'from-teal-100/80 via-emerald-50/50 to-transparent border-teal-200/60',
    iconBg: 'bg-gradient-to-br from-teal-600 to-emerald-700 text-white shadow-teal-500/25',
    text: 'text-teal-700',
    shadow: 'hover:shadow-teal-500/10'
  },
  info: {
    bg: 'from-sky-100/80 via-indigo-50/50 to-transparent border-sky-200/60',
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
  change,
  description,
  icon: Icon,
  tone,
  color,
  loading = false,
  active,
  isActive,
  onClick,
  className,
  ariaLabel,
  badge,
  badgeColor
}: KpiCardProps) {
  // Normalize tone key
  let toneKey = String(tone || color || 'blue').toLowerCase().trim();
  if (toneKey.includes('emerald') || toneKey.includes('green')) toneKey = 'green';
  else if (toneKey.includes('amber') || toneKey.includes('orange') || toneKey.includes('yellow')) toneKey = 'amber';
  else if (toneKey.includes('red') || toneKey.includes('rose')) toneKey = 'red';
  else if (toneKey.includes('purple') || toneKey.includes('violet')) toneKey = 'purple';
  else if (toneKey.includes('indigo')) toneKey = 'indigo';
  else if (toneKey.includes('cyan')) toneKey = 'cyan';
  else if (toneKey.includes('teal')) toneKey = 'teal';
  else if (toneKey.includes('sky')) toneKey = 'sky';
  else if (toneKey.includes('slate') || toneKey.includes('gray')) toneKey = 'slate';

  const currentTone = TONES[toneKey] || TONES.blue;
  const isCardActive = active ?? isActive ?? false;
  const interactive = typeof onClick === 'function';
  const displaySubtext = subtext || hint || helper || change || description;

  const formattedValue = React.useMemo(() => {
    if (typeof value === 'number') {
      return value.toLocaleString('en-IN');
    }
    return value ?? '0';
  }, [value]);

  const Element: any = interactive ? 'button' : 'div';

  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) return Icon;
    if (typeof Icon === 'function' || typeof Icon === 'object') {
      const IconComponent = Icon as React.ComponentType<{ className?: string }>;
      return <IconComponent className="h-4 w-4" />;
    }
    return null;
  };

  return (
    <Element
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={interactive ? Boolean(isCardActive) : undefined}
      aria-label={interactive ? ariaLabel || `Filter by ${label}` : undefined}
      className={cn(
        'group relative w-full text-left rounded-xl border bg-gradient-to-br px-3.5 py-3 shadow-2xs backdrop-blur-sm transition-all duration-200',
        interactive && 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#12335f]/30',
        isCardActive
          ? 'border-[#12335f] shadow-sm ring-2 ring-[#12335f]/15 bg-white'
          : 'hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm',
        currentTone.bg,
        currentTone.shadow,
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Label row */}
          <div className="flex items-center gap-1.5">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-tight truncate">
              {label}
            </p>
            {badge && (
              <span className={cn('shrink-0 text-[8px] sm:text-[9px] font-black uppercase px-1.5 py-0.5 rounded', badgeColor || 'bg-blue-100 text-blue-800')}>
                {badge}
              </span>
            )}
          </div>

          {/* Value */}
          <div className="mt-1">
            {loading ? (
              <div className="h-5 sm:h-6 w-14 sm:w-20 bg-slate-200/80 rounded animate-pulse my-0.5" />
            ) : (
              <div className="truncate text-base sm:text-lg lg:text-xl font-black tracking-tight leading-snug text-slate-900 tabular-nums">
                {formattedValue}
              </div>
            )}
          </div>
        </div>

        {Icon && (
          <div
            className={cn(
              'flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-lg shadow-2xs transition-transform duration-200 group-hover:scale-105',
              currentTone.iconBg
            )}
          >
            {renderIcon()}
          </div>
        )}
      </div>

      {displaySubtext && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-slate-200/60 pt-1.5">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-medium text-slate-500 truncate">
              {displaySubtext}
            </div>
          </div>
        </div>
      )}
    </Element>
  );
}

export const KpiCard = memo(KpiCardBase);
export default KpiCard;
