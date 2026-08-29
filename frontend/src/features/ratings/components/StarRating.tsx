import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface StarRatingProps {
    value: number;
    onChange?: (value: number) => void;
    size?: 'sm' | 'md' | 'lg';
    readOnly?: boolean;
    className?: string;
    showLabel?: boolean;
}

const sizeClass = {
    sm: 'h-3.5 w-3.5',
    md: 'h-4 w-4',
    lg: 'h-6 w-6'
} as const;

const RATING_LABELS: Record<number, string> = {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent'
};

export function StarRating({ value, onChange, size = 'md', readOnly, className, showLabel = false }: StarRatingProps) {
    const [hover, setHover] = useState<number | null>(null);
    const display = hover ?? Math.round(value);

    const handleClick = (star: number) => {
        if (readOnly) return;
        setHover(null);
        onChange?.(star);
    };

    return (
        <div className="flex items-center gap-2.5">
            <div
                className={cn('inline-flex items-center gap-1', className)}
                onMouseLeave={() => setHover(null)}
                role={readOnly ? undefined : 'radiogroup'}
                aria-label="Star rating"
            >
                {[1, 2, 3, 4, 5].map(star => (
                    <button
                        key={star}
                        type="button"
                        disabled={readOnly}
                        onMouseEnter={() => !readOnly && setHover(star)}
                        onClick={() => handleClick(star)}
                        aria-label={`${star} star${star > 1 ? 's' : ''}`}
                        aria-pressed={display === star}
                        className={cn(
                            'rounded-md p-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-[#0f766e]/40',
                            !readOnly && 'cursor-pointer hover:scale-125 active:scale-90',
                            readOnly && 'cursor-default'
                        )}
                    >
                        <Star
                            className={cn(
                                sizeClass[size],
                                'pointer-events-none transition-all duration-150',
                                star <= display
                                    ? 'fill-amber-400 text-amber-400 drop-shadow-xs'
                                    : 'fill-transparent text-slate-300'
                            )}
                        />
                    </button>
                ))}
            </div>
            {showLabel && (
                <span className="text-xs font-black text-slate-700 transition-all">
                    {display > 0 ? `${display} / 5 · ${RATING_LABELS[display] || ''}` : 'Select rating'}
                </span>
            )}
        </div>
    );
}
