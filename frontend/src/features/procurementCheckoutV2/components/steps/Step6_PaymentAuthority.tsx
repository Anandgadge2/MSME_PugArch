'use client';

import { Input } from '../../../../components/ui/input';
import { SearchableSelect } from '../common/SearchableSelect';
import { PAYMENT_MODE_OPTIONS } from '../../constants';

export default function Step6_PaymentAuthority({
  data,
  onChange,
  errors,
}: {
  data: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-black text-slate-950">Step 6 — Payment Authority</h2>
      <p className="text-xs text-slate-500">Government procurement payment is status-tracking only unless online gateway is enabled by admin.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {['payingAuthorityName', 'payingAuthorityDesignation', 'ddoPaoAccountsOfficer', 'paymentTimeline', 'paymentRemarks'].map(field => (
          <div key={field} className="space-y-1">
            <label className="text-xs font-bold">{field.replace(/([A-Z])/g, ' $1')}</label>
            <Input value={String(data[field] || '')} onChange={e => onChange(field, e.target.value)} className={errors[field] ? 'border-red-400' : ''} />
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-xs font-bold">Payment Mode</label>
          <SearchableSelect
            options={PAYMENT_MODE_OPTIONS.map(o => ({ value: o, label: o }))}
            value={String(data.paymentMode || 'PFMS')}
            onChange={v => onChange('paymentMode', v)}
            allowOther
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold">Invoice in name of</label>
          <SearchableSelect
            options={[{ value: 'Buyer', label: 'Buyer' }, { value: 'Consignee', label: 'Consignee' }]}
            value={String(data.invoiceInNameOf || 'Buyer')}
            onChange={v => onChange('invoiceInNameOf', v)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold">TDS applicable</label>
          <SearchableSelect options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]} value={String(data.tdsApplicable || 'No')} onChange={v => onChange('tdsApplicable', v)} />
        </div>
      </div>
    </div>
  );
}
