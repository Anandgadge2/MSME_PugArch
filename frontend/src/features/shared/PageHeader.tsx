/**
 * PageHeader — standardized page header used across all feature pages.
 *
 * Renders:
 *   - Tricolor accent strip on top (saffron / white / green)
 *   - Page title (large, bold, near-black)
 *   - Description (single-line wrap, slate)
 *   - Optional action slot (right-aligned buttons)
 *
 * Usage:
 *   <PageHeader
 *     title="My Cart"
 *     description="Review items and submit for approval."
 *     actions={<Button>...</Button>}
 *   />
 */
import React from 'react';

interface Props {
    title: string;
    description?: string;
    actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: Props) {
    return (
        <div>
            <div className="page-header">
                <div className="min-w-0">
                    <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-black tracking-tight text-slate-950 text-wrap-anywhere">{title}</h1>
                    {description && (
                        <p className="mt-1 max-w-3xl text-[10px] sm:text-xs lg:text-sm font-semibold text-slate-500 text-wrap-anywhere">{description}</p>
                    )}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-0">{actions}</div>}
            </div>
        </div>
    );
}
