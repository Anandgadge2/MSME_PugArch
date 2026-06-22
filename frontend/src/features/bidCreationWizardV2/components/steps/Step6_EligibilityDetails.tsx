import React from 'react';
import FormField from '../common/FormField';
import SearchableMultiSelect from '../common/SearchableMultiSelect';
import SearchableSelect from '../common/SearchableSelect';
import ConditionalSection from '../common/ConditionalSection';
import TechnicalPacketSection from '../common/TechnicalPacketSection';
import { DOCUMENT_OPTIONS, EVALUATION_METHOD_OPTIONS } from '../../utils/constants';
import type { StepComponentProps } from '../../types/steps';

const inputClass = 'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#12335f] focus:ring-2 focus:ring-[#12335f]/15';

export default function Step6_EligibilityDetails({ data, packetType, errors, updateField }: StepComponentProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Evaluation Method" required error={errors.evaluationMethod}><SearchableSelect value={data.evaluationMethod} options={EVALUATION_METHOD_OPTIONS} onChange={value => updateField('evaluationMethod', value)} allowOther /></FormField>
        <FormField label="Bidder Documents" required error={errors.bidderDocuments}><SearchableMultiSelect value={data.bidderDocuments || []} options={DOCUMENT_OPTIONS} onChange={value => updateField('bidderDocuments', value)} /></FormField>
        {['minimumExperienceRequired', 'minimumTurnoverRequired', 'similarWorkExperienceRequired', 'msePreference', 'makeInIndiaPreference', 'emdRequired', 'pbgRequired', 'blacklistingDeclarationRequired', 'conflictOfInterestDeclarationRequired'].map(field => (
          <label key={field} className="flex min-h-12 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={Boolean(data[field])} onChange={event => updateField(field, event.target.checked)} className="h-4 w-4 accent-[#12335f]" />
            {field}
          </label>
        ))}
        {data.minimumExperienceRequired && <FormField label="Minimum Experience"><input value={data.minimumExperience || ''} onChange={event => updateField('minimumExperience', event.target.value)} className={inputClass} /></FormField>}
        {data.minimumTurnoverRequired && <FormField label="Minimum Turnover"><input type="number" value={data.minimumTurnover || ''} onChange={event => updateField('minimumTurnover', event.target.value)} className={inputClass} /></FormField>}
        {data.emdRequired && <FormField label="EMD Amount" required error={errors.emdAmount}><input type="number" value={data.emdAmount || ''} onChange={event => updateField('emdAmount', event.target.value)} className={inputClass} /></FormField>}
        {data.pbgRequired && <FormField label="PBG Percentage" required error={errors.pbgPercentage}><input type="number" value={data.pbgPercentage || ''} onChange={event => updateField('pbgPercentage', event.target.value)} className={inputClass} /></FormField>}
      </div>
      <ConditionalSection showWhen={packetType === 'TWO_PACKET'}>
        <h3 className="mb-4 text-sm font-black text-slate-900">Technical Packet</h3>
        <TechnicalPacketSection value={data.technicalPacket} onChange={value => updateField('technicalPacket', value)} />
        {errors.technicalPacket && <p className="mt-2 text-xs font-bold text-red-600">{errors.technicalPacket[0]}</p>}
      </ConditionalSection>
    </div>
  );
}
