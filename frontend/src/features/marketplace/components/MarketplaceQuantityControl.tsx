'use client';

import React, { useState } from 'react';
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
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState<string>('');

    const displayValue = isEditing ? editValue : String(quantity > 0 ? quantity : 1);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        setIsEditing(true);
        setEditValue(String(quantity > 0 ? quantity : 1));
        e.currentTarget.select();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return;
        const cleaned = e.target.value.replace(/\D/g, '');
        setEditValue(cleaned);
    };

    const commitEdit = () => {
        setIsEditing(false);
        if (editValue === '') {
            return;
        }

        const parsed = parseInt(editValue, 10);
        if (!Number.isFinite(parsed)) return;

        const clamped = Math.max(min, Math.min(max, parsed));
        if (clamped !== quantity) {
            onChange(clamped);
        }
    };

    const handleBlur = () => {
        commitEdit();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setIsEditing(false);
            e.currentTarget.blur();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            handleIncrement();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleDecrement();
        }
    };

    const handleIncrement = () => {
        if (disabled) return;
        const current = isEditing ? (parseInt(editValue, 10) || quantity || 1) : (quantity || 1);
        const next = Math.min(max, current + 1);
        if (isEditing) {
            setEditValue(String(next));
        }
        if (next !== quantity) {
            onChange(next);
        }
    };

    const handleDecrement = () => {
        if (disabled) return;
        const current = isEditing ? (parseInt(editValue, 10) || quantity || 1) : (quantity || 1);
        const next = current - 1;
        if (next < min) return;
        if (isEditing) {
            setEditValue(String(next));
        }
        if (next !== quantity) {
            onChange(next);
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
                value={displayValue}
                onChange={handleInputChange}
                onFocus={handleFocus}
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
                disabled={disabled || (quantity >= max)}
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
