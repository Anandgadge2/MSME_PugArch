import React from 'react';

export default function OtherTextInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <input
      value={value}
      onChange={event => onChange(event.target.value)}
      className="h-11 w-full rounded-lg border border-amber-200 bg-amber-50/40 px-3 text-sm font-semibold text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15"
      placeholder="Please specify"
    />
  );
}
