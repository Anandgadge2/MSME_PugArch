import React from 'react';

export default function DeclarationCheckbox({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-700">
      <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-[#12335f]" />
      <span>{children}</span>
    </label>
  );
}
