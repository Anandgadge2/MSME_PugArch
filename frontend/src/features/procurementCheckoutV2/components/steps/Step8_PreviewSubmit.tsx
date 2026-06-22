'use client';

import { PROCUREMENT_METHOD_LABELS } from '../../constants';
import type { CartDto } from '../../../cart/api';
import type { CartEvaluation, CheckoutFormData } from '../../types';
import { formatCurrency } from '../../../shared/format';

const DECLARATIONS = [
  ['specsConfirmed', 'I confirm the selected product/service meets required specifications.'],
  ['priceReasonabilityConfirmed', 'I confirm price reasonability.'],
  ['budgetConfirmed', 'I confirm budget availability.'],
  ['authorityConfirmed', 'I confirm competent authority approval.'],
  ['noDemandSplitConfirmed', 'I confirm this purchase is not split to avoid Bid/RA or higher approval.'],
  ['termsAccepted', 'I agree to portal procurement terms.'],
] as const;

export default function Step8_PreviewSubmit({
  cart,
  form,
  evaluation,
  onDeclarationChange,
  errors,
}: {
  cart?: CartDto;
  form: CheckoutFormData;
  evaluation: CartEvaluation | null;
  onDeclarationChange: (field: string, value: boolean) => void;
  errors: Record<string, string>;
}) {
  const total = cart?.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0) ?? 0;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-black text-slate-950">Step 8 — Preview & Submit</h2>
      <div className="grid gap-3 text-xs md:grid-cols-2">
        <PreviewBlock title="Cart Summary" lines={[`${cart?.items.length || 0} items`, `Total ${formatCurrency(total)}`]} />
        <PreviewBlock title="Procurement Method" lines={[PROCUREMENT_METHOD_LABELS[form.selectedMethod] || form.selectedMethod || '—']} />
        <PreviewBlock title="Buyer" lines={[String(form.buyerDetails.organizationName || '—'), String(form.buyerDetails.buyerOfficerName || '')]} />
        <PreviewBlock title="Delivery" lines={[String(form.deliveryDetails.deliveryAddress || '—'), String(form.deliveryDetails.deliveryPeriod || '')]} />
      </div>
      {evaluation?.warnings?.map(w => (
        <p key={w} className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{w}</p>
      ))}
      <div className="space-y-2 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-black">Declarations</h3>
        {DECLARATIONS.map(([key, label]) => (
          <label key={key} className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={Boolean(form.declarations[key as keyof typeof form.declarations])}
              onChange={e => onDeclarationChange(key, e.target.checked)}
            />
            <span>{label}</span>
          </label>
        ))}
        {Object.entries(errors).map(([k, v]) => (
          <p key={k} className="text-[10px] text-red-600">{v}</p>
        ))}
      </div>
    </div>
  );
}

function PreviewBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="font-black text-slate-800">{title}</p>
      {lines.map(l => <p key={l} className="text-slate-600">{l}</p>)}
    </div>
  );
}
