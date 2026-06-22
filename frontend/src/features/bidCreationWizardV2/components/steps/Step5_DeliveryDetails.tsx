import React from 'react';
import FormField from '../common/FormField';
import SearchableSelect from '../common/SearchableSelect';
import ConsigneeForm from '../common/ConsigneeForm';
import MultipleConsigneeTable from '../common/MultipleConsigneeTable';
import ConsigneeExcelUpload from '../common/ConsigneeExcelUpload';
import type { StepComponentProps } from '../../types/steps';

const inputClass = 'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15';

export default function Step5_DeliveryDetails({ data, errors, updateField }: StepComponentProps) {
  return (
    <div className="space-y-5">
      <FormField label="Consignee Type" required error={errors.consigneeType}>
        <SearchableSelect value={data.consigneeType} options={[{ value: 'SINGLE', label: 'Single Consignee' }, { value: 'MULTIPLE', label: 'Multiple Consignees' }]} onChange={value => updateField('consigneeType', value)} allowOther={false} />
      </FormField>
      <ConsigneeForm data={data} updateField={updateField} errors={errors} />
      {data.consigneeType === 'MULTIPLE' && <><MultipleConsigneeTable value={data.multipleConsignees} onChange={value => updateField('multipleConsignees', value)} /><ConsigneeExcelUpload /></>}
      {errors.multipleConsignees && <p className="text-xs font-bold text-red-600">{errors.multipleConsignees[0]}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex min-h-12 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">
          <input type="checkbox" checked={Boolean(data.installationSiteSame)} onChange={event => updateField('installationSiteSame', event.target.checked)} className="h-4 w-4 accent-[#12335f]" />
          Installation site same as delivery address
        </label>
        <label className="flex min-h-12 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">
          <input type="checkbox" checked={Boolean(data.delayPenaltyApplicable)} onChange={event => updateField('delayPenaltyApplicable', event.target.checked)} className="h-4 w-4 accent-[#12335f]" />
          LD / delay penalty applicable
        </label>
        {!data.installationSiteSame && <FormField label="Installation Address"><input value={data.installationAddress || ''} onChange={event => updateField('installationAddress', event.target.value)} className={inputClass} /></FormField>}
        <FormField label="Inspection Officer"><input value={data.inspectionOfficer || ''} onChange={event => updateField('inspectionOfficer', event.target.value)} className={inputClass} /></FormField>
        {data.delayPenaltyApplicable && <FormField label="Penalty Details" className="md:col-span-2"><textarea value={data.penaltyDetails || ''} onChange={event => updateField('penaltyDetails', event.target.value)} rows={3} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15" /></FormField>}
      </div>
      <FormField label="Acceptance Criteria" required error={errors.acceptanceCriteria}>
        <textarea value={data.acceptanceCriteria || ''} onChange={event => updateField('acceptanceCriteria', event.target.value)} rows={4} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15" />
      </FormField>
    </div>
  );
}
