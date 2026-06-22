import React from 'react';
import FormField from './FormField';
import SearchableMultiSelect from './SearchableMultiSelect';
import DocumentUploadSection from './DocumentUploadSection';
import { DOCUMENT_OPTIONS, EVALUATION_METHOD_OPTIONS } from '../../utils/constants';

const inputClass = 'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15';

export default function TechnicalPacketSection({ value, onChange }: { value?: Record<string, any>; onChange: (value: Record<string, any>) => void }) {
  const data = value || {};
  const set = (field: string, next: any) => onChange({ ...data, [field]: next });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormField label="Technical Eligibility Criteria" required>
        <SearchableMultiSelect value={data.technicalEligibilityCriteria || []} options={DOCUMENT_OPTIONS} onChange={value => set('technicalEligibilityCriteria', value)} />
      </FormField>
      <FormField label="Technical Evaluation Method" required>
        <select value={data.technicalEvaluationMethod || ''} onChange={event => set('technicalEvaluationMethod', event.target.value)} className={inputClass}>
          <option value="">Select method</option>
          {EVALUATION_METHOD_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </FormField>
      <FormField label="Minimum Experience"><input value={data.minimumExperience || ''} onChange={event => set('minimumExperience', event.target.value)} className={inputClass} /></FormField>
      <FormField label="Minimum Turnover"><input type="number" value={data.minimumTurnover || ''} onChange={event => set('minimumTurnover', event.target.value)} className={inputClass} /></FormField>
      <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={Boolean(data.technicalProposalRequired)} onChange={event => set('technicalProposalRequired', event.target.checked)} /> Technical proposal required</label>
      <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={Boolean(data.complianceSheet)} onChange={event => set('complianceSheet', event.target.checked)} /> Compliance sheet required</label>
      <div className="md:col-span-2">
        <DocumentUploadSection label="Technical Packet Documents" mandatory value={data.technicalDocumentUploads} onChange={value => set('technicalDocumentUploads', value)} />
      </div>
    </div>
  );
}
