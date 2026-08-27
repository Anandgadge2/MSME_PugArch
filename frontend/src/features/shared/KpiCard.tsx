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
  const displaySubtext = subtext || hint || helper || change || description || `${label} status`;

  const formattedValue = React.useMemo(() => {
    if (loading) return '...';
    if (typeof value === 'number') {
      return value.toLocaleString('en-IN');
    }
    return value ?? '0';
  }, [value, loading]);

  const Element: any = interactive ? 'button' : 'div';

  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) return Icon;
    if (typeof Icon === 'function' || typeof Icon === 'object') {
      const IconComponent = Icon as React.ComponentType<{ className?: string }>;
      return <IconComponent className="h-3.5 w-3.5 sm:h-5 sm:w-5" />;
    }
    return null;
  };

  // Extract plain string for tooltips (handles ReactNode values gracefully)
  const labelTooltip = label;
  const valueTooltip: string | undefined = React.useMemo(() => {
    if (typeof formattedValue === 'string') return formattedValue;
    if (typeof formattedValue === 'number') return String(formattedValue);
    // For ReactNode values (e.g. Submission Deadline with countdown), use title attr fallback
    return undefined;
  }, [formattedValue]);

  return (
    <Element
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      aria-pressed={interactive ? Boolean(isCardActive) : undefined}
      aria-label={interactive ? ariaLabel || `Filter by ${label}` : undefined}
      className={cn(
        'group relative w-full text-left rounded-xl sm:rounded-2xl border bg-gradient-to-br px-3 py-2.5 sm:px-4 sm:py-3 shadow-sm backdrop-blur-sm transition-all duration-300 hover:z-[100]',
        interactive && 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#12335f]/30',
        isCardActive
          ? 'border-[#12335f] shadow-md ring-2 ring-[#12335f]/20 bg-white'
          : 'hover:-translate-y-0.5 hover:border-[#12335f]/40 hover:shadow-md',
        currentTone.bg,
        currentTone.shadow,
        className
      )}
    >
      <div className="flex items-start justify-between gap-1.5 sm:gap-2.5">
        <div className="min-w-0 flex-1">
          {/* Label row */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Label with CSS tooltip */}
            <div className="group/kpi-label relative min-w-0 flex-1">
              <p className="text-[8.5px] sm:text-[10px] lg:text-[11px] font-black uppercase tracking-wider text-slate-500 leading-tight truncate">
                {label}
              </p>
              {/* Tooltip — only visible on hover, positioned below, no layout shift */}
              <span
                className="pointer-events-none absolute top-full left-0 z-50 mt-1 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/kpi-label:opacity-100"
                aria-hidden="true"
              >
                {labelTooltip}
              </span>
            </div>
            {badge && (
              <span className={cn('shrink-0 text-[7.5px] sm:text-[8px] lg:text-[10px] font-black uppercase px-1 sm:px-1.5 py-0.5 rounded', badgeColor || 'bg-blue-100 text-blue-800')}>
                {badge}
              </span>
            )}
          </div>

          {/* Value with CSS tooltip */}
          <div className="group/kpi-value relative mt-0.5">
            <div
              className={cn(
                'truncate text-base sm:text-2xl font-black tracking-tight leading-none',
                loading ? 'text-slate-300 animate-pulse' : 'text-slate-900'
              )}
            >
              {formattedValue}
            </div>
            {/* Tooltip for value */}
            {valueTooltip && (
              <span
                className="pointer-events-none absolute top-full left-0 z-50 mt-1 max-w-[240px] whitespace-normal rounded-md bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/kpi-value:opacity-100"
                aria-hidden="true"
              >
                {valueTooltip}
              </span>
            )}
          </div>
        </div>

        {Icon && (
          <div
            className={cn(
              'flex h-7 w-7 sm:h-9 sm:w-9 lg:h-10 lg:w-10 shrink-0 items-center justify-center rounded-lg sm:rounded-xl shadow-xs sm:shadow-md transition-transform duration-300 group-hover:scale-105',
              currentTone.iconBg
            )}
          >
            {renderIcon()}
          </div>
        )}
      </div>

      <div className="mt-1.5 sm:mt-3 flex items-center gap-1 sm:gap-1.5 border-t border-slate-100/90 pt-1.5 sm:pt-2.5">
        <span className="h-1 w-1 sm:h-1.5 sm:w-1.5 shrink-0 rounded-full bg-slate-400 animate-pulse" />
        <div className="group/kpi-sub relative min-w-0 flex-1">
          <div className="text-[9px] sm:text-[11px] lg:text-xs font-semibold text-slate-500 truncate">
            {displaySubtext}
          </div>
          {typeof displaySubtext === 'string' && (
            <span
              className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/kpi-sub:opacity-100"
              aria-hidden="true"
            >
              {displaySubtext}
            </span>
          )}
        </div>
      </div>
    </Element>
  );
}

export const KpiCard = memo(KpiCardBase);
export default KpiCard;
