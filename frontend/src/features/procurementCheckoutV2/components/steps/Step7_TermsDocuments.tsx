'use client';

import { Input } from '../../../../components/ui/input';

export default function Step7_TermsDocuments({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-black text-slate-950">Step 7 — Terms & Documents</h2>
      {['deliveryTerms', 'paymentTerms', 'warrantyTerms', 'inspectionTerms', 'delayPenaltyDetails', 'additionalTerms'].map(field => (
        <div key={field} className="space-y-1">
          <label className="text-xs font-bold">{field.replace(/([A-Z])/g, ' $1')}</label>
          <textarea
            rows={2}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            value={String(data[field] || '')}
            onChange={e => onChange(field, e.target.value)}
          />
        </div>
      ))}
      <div className="space-y-1">
        <label className="text-xs font-bold">Liquidated Damages / Delay Penalty Applicable</label>
        <Input value={String(data.delayPenaltyApplicable || 'No')} onChange={e => onChange('delayPenaltyApplicable', e.target.value)} />
      </div>
      <p className="text-xs text-slate-500">Upload approval, L1 comparison, PAC, and technical documents via your organisation document store and reference file numbers in remarks.</p>
    </div>
  );
}
