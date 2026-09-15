import { Star } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { RatingSummary } from '../types';

/**
 * Horizontal bar chart of how many 5-star, 4-star, ..., 1-star ratings the
 * subject has received. Rendered on the seller profile and the ratings page.
 */
export interface RatingDistributionProps {
    summary: RatingSummary | undefined;
    className?: string;
    onSelectStar?: (star: number) => void;
    selectedStar?: number | null;
}

export function RatingDistribution({ summary, className, onSelectStar, selectedStar }: RatingDistributionProps) {
    if (!summary || summary.count === 0) {
        return (
            <div className={cn('rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center', className)}>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">No ratings yet</p>
            </div>
        );
    }

    const max = Math.max(...summary.distribution.map(b => b.count), 1);

    return (
        <div className={cn('space-y-2', className)}>
            {[5, 4, 3, 2, 1].map(star => {
                const bucket = summary.distribution.find(b => b.star === star);
                const count = bucket?.count ?? 0;
                const pct = (count / max) * 100;
                const isSelected = selectedStar === star;
                const isClickable = Boolean(onSelectStar);

                const Element = isClickable ? 'button' : 'div';

                return (
                    <Element
                        key={star}
                        type={isClickable ? 'button' : undefined}
                        onClick={isClickable ? () => onSelectStar?.(star) : undefined}
                        aria-pressed={isClickable ? isSelected : undefined}
                        aria-label={isClickable ? `Filter by ${star} star ratings (${count} available)` : undefined}
                        className={cn(
                            'group flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left transition-colors',
                            isClickable && 'cursor-pointer hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#12335f]/20',
                            isSelected && 'bg-amber-50/80 ring-1 ring-amber-300'
                        )}
                    >
                        <div className="flex w-12 shrink-0 items-center gap-1 text-[10px] font-black uppercase text-slate-600 group-hover:text-slate-900">
                            <span>{star}</span>
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                        </div>
                        <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                                className={cn(
                                    'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                                    isSelected
                                        ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                                        : 'bg-gradient-to-r from-amber-400 to-amber-500 group-hover:from-amber-500 group-hover:to-amber-600'
                                )}
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <div className="w-12 shrink-0 text-right text-[11px] font-bold text-slate-600 group-hover:text-slate-900">
                            {count}
                        </div>
                    </Element>
                );
            })}
        </div>
    );
}
