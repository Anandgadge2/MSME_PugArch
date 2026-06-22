'use client';

import { Input } from '../../../../components/ui/input';

const FIELDS = [
  ['organizationName', 'Buyer Department / Organization'],
  ['buyerOfficerName', 'Buyer Officer Name'],
  ['designation', 'Designation'],
  ['email', 'Email'],
  ['mobile', 'Mobile'],
  ['officeAddress', 'Office Address'],
  ['financialYear', 'Financial Year'],
  ['departmentFileNumber', 'Department File Number'],
  ['budgetHead', 'Budget Head / Scheme'],
  ['competentAuthorityName', 'Competent Authority Name'],
  ['competentAuthorityDesignation', 'Competent Authority Designation'],
] as const;

export default function Step2_BuyerDetails({
  data,
  onChange,
  errors,
}: {
  data: Record<string, unknown>;
  onChange: (field: string, value: string) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-black text-slate-950">Step 2 — Buyer Details</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {FIELDS.map(([key, label]) => (
          <div key={key} className="space-y-1">
            <label className="text-xs font-bold">{label}</label>
            <Input
              value={String(data[key] || '')}
              onChange={e => onChange(key, e.target.value)}
              className={errors[key] ? 'border-red-400' : ''}
            />
            {errors[key] && <p className="text-[10px] text-red-600">{errors[key]}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
