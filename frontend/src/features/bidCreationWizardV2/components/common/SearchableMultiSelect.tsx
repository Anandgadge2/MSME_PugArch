import React from 'react';
import { X } from 'lucide-react';
import SearchableSelect, { type SelectOption } from './SearchableSelect';

export default function SearchableMultiSelect({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string[];
  options: readonly SelectOption[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}) {
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className="space-y-2">
      <SearchableSelect
        value=""
        options={options}
        placeholder={placeholder || 'Add option'}
        onChange={next => {
          const text = typeof next === 'object' ? next.otherValue || next.dropdownValue : next;
          if (text && !selected.includes(text)) onChange([...selected, text]);
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
    </div>
  );
}
