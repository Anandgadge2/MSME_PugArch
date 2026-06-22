import React from 'react';
import type { StepComponentProps } from '../../types/steps';

const labels: Record<string, string> = {
  corrigendumAllowed: 'Corrigendum Allowed?',
  cancellationAllowedBeforeClosing: 'Bid Cancellation Allowed Before Closing?',
  clarificationWindowRequired: 'Clarification Window Required?',
  sellerQueryAllowed: 'Seller Query Allowed?',
  documentResubmissionAllowed: 'Document Resubmission Allowed?',
  splittingQuantityAllowed: 'Splitting Quantity Allowed?',
  multipleAwardAllowed: 'Multiple Award Allowed?',
  rateContractRequired: 'Rate Contract Required?',
};

export default function Step8_SpecialConditions({ data, updateField }: StepComponentProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Object.entries(labels).map(([field, label]) => (
        <label key={field} className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-700">
          <span>{label}</span>
          <input type="checkbox" checked={Boolean(data[field])} onChange={event => updateField(field, event.target.checked)} className="h-4 w-4 accent-[#12335f]" />
        </label>
      ))}
    </div>
  );
}
