'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface MarketplaceQuantityControlProps {
    quantity: number;
    itemName?: string;
    onChange: (quantity: number) => void;
    min?: number;
    max?: number;
    disabled?: boolean;
    className?: string;
    size?: 'sm' | 'md';
}

export function MarketplaceQuantityControl({
    quantity,
    itemName = 'item',
    onChange,
    min = 0,
    max = 1_000_000,
    disabled = false,
    className = '',
    size = 'sm',
}: MarketplaceQuantityControlProps) {
    const [inputValue, setInputValue] = useState<string>(String(quantity > 0 ? quantity : 1));
    const [isFocused, setIsFocused] = useState(false);

    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastCommittedRef = useRef<number>(quantity);
    const currentPropQtyRef = useRef<number>(quantity);
    const pendingQtyRef = useRef<number | null>(null);

    // Keep prop ref updated and sync to input when not actively typing/focused
    useEffect(() => {
        currentPropQtyRef.current = quantity;
        if (!isFocused) {
            setInputValue(String(quantity > 0 ? quantity : 1));
            lastCommittedRef.current = quantity;
            pendingQtyRef.current = null;
        }
    }, [quantity, isFocused]);

    // Commit quantity change to parent
    const commitQuantity = useCallback((targetQty: number) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }

        const clamped = Math.max(min, Math.min(max, targetQty));
        pendingQtyRef.current = null;

        if (clamped > 0) {
            setInputValue(String(clamped));
        }

        if (clamped !== lastCommittedRef.current) {
            lastCommittedRef.current = clamped;
            onChange(clamped);
        }
    }, [min, max, onChange]);

    // Debounced commit helper
    const scheduleCommit = useCallback((targetQty: number, delayMs = 350) => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        pendingQtyRef.current = targetQty;
        debounceTimerRef.current = setTimeout(() => {
            commitQuantity(targetQty);
        }, delayMs);
    }, [commitQuantity]);

    // Ensure pending changes flush if unmounting
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            if (pendingQtyRef.current !== null && pendingQtyRef.current !== lastCommittedRef.current) {
                onChange(pendingQtyRef.current);
            }
        };
    }, [onChange]);

    // Direct input typing handler
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        const raw = e.target.value;
        const cleaned = raw.replace(/\D/g, '');

        if (cleaned === '') {
            setInputValue('');
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            pendingQtyRef.current = null;
            return;
        }

        let parsed = parseInt(cleaned, 10);
        if (parsed > max) {
            parsed = max;
        }

        setInputValue(String(parsed));
        scheduleCommit(parsed, 400);
    };

    // Commit on blur
    const handleBlur = () => {
        setIsFocused(false);
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }

        if (inputValue === '' || inputValue === '0') {
            if (inputValue === '0' && min === 0) {
                commitQuantity(0);
            } else {
                const fallback = currentPropQtyRef.current > 0 ? currentPropQtyRef.current : 1;
                setInputValue(String(fallback));
                commitQuantity(fallback);
            }
        } else {
            const parsed = parseInt(inputValue, 10);
            if (Number.isFinite(parsed) && parsed >= min) {
                commitQuantity(parsed);
            } else {
                const fallback = currentPropQtyRef.current > 0 ? currentPropQtyRef.current : 1;
                setInputValue(String(fallback));
                commitQuantity(fallback);
            }
        }
    };

    // Keyboard navigation (Enter to commit, Escape to cancel, Arrows to increment/decrement)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            const fallback = currentPropQtyRef.current > 0 ? currentPropQtyRef.current : 1;
            setInputValue(String(fallback));
            pendingQtyRef.current = null;
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
            e.currentTarget.blur();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            handleIncrement();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleDecrement();
        }
    };

    // Increment (+)
    const handleIncrement = () => {
        if (disabled) return;
        const current = parseInt(inputValue, 10) || currentPropQtyRef.current || 1;
        const next = Math.min(max, current + 1);
        setInputValue(String(next));
        scheduleCommit(next, 300);
    };

    // Decrement (−)
    const handleDecrement = () => {
        if (disabled) return;
        const current = parseInt(inputValue, 10) || currentPropQtyRef.current || 1;
        const next = current - 1;

        if (next <= 0) {
            // Drop to 0 immediately commits removal
            pendingQtyRef.current = null;
            commitQuantity(0);
        } else {
            setInputValue(String(next));
            scheduleCommit(next, 300);
        }
    };

    const isSmall = size === 'sm';

    return (
        <div
            className={cn(
                'flex-1 inline-flex items-center justify-between rounded-xl border border-[#0b2447]/30 bg-white text-[#0b2447] shadow-sm px-1 transition-all focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600',
                isSmall ? 'h-7 sm:h-8' : 'h-8 sm:h-9',
                disabled && 'opacity-50 cursor-not-allowed',
                className
            )}
            role="group"
            aria-label={`Quantity adjustment for ${itemName}`}
        >
            <button
                type="button"
                aria-label={`Decrease quantity of ${itemName}`}
                title="Decrease quantity"
                disabled={disabled}
                onClick={handleDecrement}
                className={cn(
                    'rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0',
                    isSmall ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-6 w-6 sm:h-7 sm:w-7'
                )}
            >
                <Minus className="h-3 w-3" aria-hidden="true" />
            </button>

            <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                aria-label={`Quantity of ${itemName}`}
                title="Click to enter custom quantity"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={(e) => {
                    setIsFocused(true);
                    e.currentTarget.select();
                }}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                className={cn(
                    'w-full min-w-0 max-w-[44px] sm:max-w-[56px] text-center font-black text-[#0b2447] bg-transparent border-0 p-0 focus:outline-none tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                    isSmall ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-sm'
                )}
            />

            <button
                type="button"
                aria-label={`Increase quantity of ${itemName}`}
                title="Increase quantity"
                disabled={disabled || (parseInt(inputValue, 10) >= max)}
                onClick={handleIncrement}
                className={cn(
                    'rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0',
                    isSmall ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-6 w-6 sm:h-7 sm:w-7'
                )}
            >
                <Plus className="h-3 w-3" aria-hidden="true" />
            </button>
        </div>
    );
}
