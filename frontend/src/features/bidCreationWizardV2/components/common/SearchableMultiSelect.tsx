import React from 'react';
import { X } from 'lucide-react';
import SearchableSelect, { type SelectOption } from './SearchableSelect';

export default function SearchableMultiSelect({
  value,
  options,
  onChange,
  placeholder,
  error,
}: {
  value: string[];
  options: readonly SelectOption[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  error?: string[];
}) {
  const selected = Array.isArray(value) ? value : [];
  const hasError = Boolean(error?.length);

  const otherIndex = selected.findIndex(item => item === 'Other' || item.startsWith('Other:'));
  const isOtherSelected = otherIndex !== -1;
  const otherValue = isOtherSelected
    ? (selected[otherIndex].startsWith('Other:')
        ? selected[otherIndex].substring(6).trim()
        : '')
    : '';

  const handleOtherTextChange = (text: string) => {
    const nextSelected = [...selected];
    if (otherIndex !== -1) {
      nextSelected[otherIndex] = text ? `Other: ${text}` : 'Other';
      onChange(nextSelected);
    }
  };

  return (
    <div className="space-y-2" data-field-error={hasError ? 'true' : undefined}>
      <SearchableSelect
        value=""
        options={options}
        placeholder={placeholder || 'Add option'}
        error={error}
        onChange={next => {
          const text = typeof next === 'object' ? next.otherValue || next.dropdownValue : next;
          if (text && !selected.includes(text) && !selected.some(item => item.startsWith('Other:') && text === 'Other')) {
            onChange([...selected, text]);
          }
        }}
      />
      <div className="flex flex-wrap gap-2">
        {selected.map(item => (
          <span key={item} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700">
            {item}
            <button type="button" onClick={() => onChange(selected.filter(entry => entry !== item))} className="text-slate-400 hover:text-red-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      {isOtherSelected && (
        <div className="rounded-lg border border-slate-150 bg-slate-50/50 p-2.5 space-y-1.5 animate-in slide-in-from-top-1 duration-150">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">
            Please specify *
          </span>
          <input
            type="text"
            required
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-[#12335f] outline-none transition focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15"
            placeholder="Type custom option here..."
            value={otherValue}
            onChange={e => handleOtherTextChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
