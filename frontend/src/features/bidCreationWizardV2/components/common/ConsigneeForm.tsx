import React from 'react';
import FormField from './FormField';

const inputClass = 'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15';

export default function ConsigneeForm({ data, updateField, errors }: { data: Record<string, any>; updateField: (field: string, value: any) => void; errors: Record<string, string[]> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[
        ['consigneeName', 'Consignee Name'],
        ['consigneeDesignation', 'Consignee Designation'],
        ['consigneeMobile', 'Consignee Mobile'],
        ['deliveryDistrict', 'Delivery District'],
        ['pincode', 'PIN Code'],
        ['deliveryPeriod', 'Delivery Period'],
      ].map(([field, label]) => (
        <FormField key={field} label={label} required error={errors[field]}>
          <input value={data[field] || ''} onChange={event => updateField(field, event.target.value)} className={inputClass} />
        </FormField>
      ))}
      <FormField label="Delivery Address" required error={errors.deliveryAddress} className="md:col-span-2">
        <textarea value={data.deliveryAddress || ''} onChange={event => updateField('deliveryAddress', event.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15" />
      </FormField>
    </div>
  );
}
