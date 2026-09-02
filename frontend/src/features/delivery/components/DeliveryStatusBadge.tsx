import { cn } from '../../../lib/utils';
import { isLiveStatus, labelFor, toneClassFor, toneDotFor } from '../status';

interface DeliveryStatusBadgeProps {
  status?: string;
  dark?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

export function DeliveryStatusBadge({
  status,
  dark = false,
  size = 'md',
  showDot = true,
  className
}: DeliveryStatusBadgeProps) {
  const isLive = isLiveStatus(status);
  const baseClass = dark
    ? 'border-white/20 bg-white/10 text-white backdrop-blur-xs ring-1 ring-white/20 shadow-xs'
    : toneClassFor(status);
  const dotColor = toneDotFor(status);

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[9px] gap-1.5',
    md: 'px-2.5 py-1 text-[10px] gap-1.5',
    lg: 'px-3.5 py-1.5 text-xs gap-2'
  };

  return (
    <span
      role="status"
      aria-label={`Status: ${labelFor(status)}`}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-black uppercase tracking-wider transition-all duration-200 select-none',
        sizeStyles[size],
        baseClass,
        className
      )}
    >
      {showDot && (
        <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
          {isLive && (
            <span
              className={cn(
                'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
                dotColor
              )}
            />
          )}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', dotColor)} />
        </span>
      )}
      <span>{labelFor(status)}</span>
    </span>
  );
}

