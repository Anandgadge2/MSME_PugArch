import React from 'react';
import { cn } from '../../../../lib/utils';

export default function FormField({
  label,
  required,
  error,
  help,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string[];
  help?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-[11px] font-black uppercase text-slate-500">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
      {help && <span className="block text-xs font-semibold text-slate-500">{help}</span>}
      {error?.length ? <span className="block text-xs font-bold text-red-600">{error[0]}</span> : null}
    </label>
  );
}
