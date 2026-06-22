import React from 'react';

export default function PreviewSection({ title, data, onEdit }: { title: string; data: Record<string, any>; onEdit: () => void }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        <button type="button" onClick={onEdit} className="text-xs font-black text-[#12335f] hover:underline">Edit</button>
      </div>
      <dl className="grid gap-2 md:grid-cols-2">
        {Object.entries(data || {}).slice(0, 12).map(([key, value]) => (
          <div key={key} className="rounded-md bg-slate-50 px-3 py-2">
            <dt className="text-[10px] font-black uppercase text-slate-400">{key}</dt>
            <dd className="mt-1 break-words text-xs font-bold text-slate-700">{typeof value === 'object' ? JSON.stringify(value) : String(value || '-')}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
