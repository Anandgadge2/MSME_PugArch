import { Badge } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import { labelFor, toneClassFor } from '../status';

export function DeliveryStatusBadge({ status, dark = false, className }: { status?: string; dark?: boolean; className?: string }) {
  const baseClass = dark ? 'border-white/30 bg-white/10 text-white' : toneClassFor(status);
  return (
    <Badge
      className={cn(
        'shrink-0 rounded-lg px-3 py-1 text-[10px] font-black uppercase tracking-wide',
        baseClass,
        className
      )}
    >
      {labelFor(status)}
    </Badge>
  );
}
