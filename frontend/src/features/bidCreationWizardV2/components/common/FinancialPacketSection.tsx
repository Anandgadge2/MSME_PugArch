import React from 'react';
import FormField from './FormField';
import { EVALUATION_METHOD_OPTIONS, PAYMENT_TERMS_OPTIONS } from '../../utils/constants';
import DocumentUploadSection from './DocumentUploadSection';

const inputClass = 'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15';

export default function FinancialPacketSection({ value, onChange }: { value?: Record<string, any>; onChange: (value: Record<string, any>) => void }) {
  const data = value || {};
  const set = (field: string, next: any) => onChange({ ...data, [field]: next });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField label="Financial Quote Format" required>
        <select value={data.financialQuoteFormat || ''} onChange={event => set('financialQuoteFormat', event.target.value)} className={inputClass}>
          <option value="">Select format</option>
          {['ITEM_WISE', 'TOTAL_BOQ', 'PERCENTAGE', 'LOT_WISE'].map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </FormField>
      <FormField label="Payment Terms" required>
        <select value={data.paymentTerms || ''} onChange={event => set('paymentTerms', event.target.value)} className={inputClass}>
          <option value="">Select terms</option>
          {PAYMENT_TERMS_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </FormField>
      <FormField label="GST Rate"><input type="number" value={data.taxGstDetails?.gstRate || ''} onChange={event => set('taxGstDetails', { ...(data.taxGstDetails || {}), gstIncluded: true, gstRate: Number(event.target.value) })} className={inputClass} /></FormField>
      <FormField label="Price Validity Days"><input type="number" value={data.priceValidityDays || ''} onChange={event => set('priceValidityDays', event.target.value)} className={inputClass} /></FormField>
      <FormField label="Financial Opening Rules"><input value={data.financialOpeningRules || ''} onChange={event => set('financialOpeningRules', event.target.value)} className={inputClass} /></FormField>
      <FormField label="Financial Evaluation Method" required>
        <select value={data.financialEvaluationMethod || ''} onChange={event => set('financialEvaluationMethod', event.target.value)} className={inputClass}>
          <option value="">Select method</option>
          {EVALUATION_METHOD_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </FormField>
      <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
        <DocumentUploadSection label="Financial Packet Documents" mandatory value={data.financialDocumentUploads} onChange={value => set('financialDocumentUploads', value)} />
        <DocumentUploadSection label="BOQ Price Schedule" value={data.boqPriceSchedule} onChange={value => set('boqPriceSchedule', value)} />
      </div>
    </div>
  );
}
