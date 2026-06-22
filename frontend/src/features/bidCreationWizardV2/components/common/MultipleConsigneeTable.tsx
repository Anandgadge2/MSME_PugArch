import React from 'react';

export default function MultipleConsigneeTable({ value, onChange }: { value?: any[]; onChange: (value: any[]) => void }) {
  const rows = Array.isArray(value) ? value : [];
  return (
    <div className="space-y-3">
      <button type="button" onClick={() => onChange([...rows, { name: '', address: '', quantity: '' }])} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700">Add Consignee</button>
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-5">
          {['name', 'designation', 'mobile', 'address', 'quantity'].map(field => (
            <input
              key={field}
              value={row[field] || ''}
              onChange={event => {
                const next = rows.slice();
                next[index] = { ...next[index], [field]: event.target.value };
                onChange(next);
              }}
              placeholder={field}
              className="h-10 rounded-md border border-slate-200 px-2 text-xs font-semibold"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
