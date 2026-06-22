import React from 'react';
import PreviewSection from '../common/PreviewSection';
import DeclarationCheckbox from '../common/DeclarationCheckbox';
import type { StepComponentProps } from '../../types/steps';
import { STEP_TITLES } from '../../utils/constants';

export default function Step9_PreviewPublish({ data, allData, errors, updateField, goToStep }: StepComponentProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {STEP_TITLES.slice(0, 8).map((title, index) => (
          <PreviewSection key={title} title={`${index + 1}. ${title}`} data={allData[`step${index + 1}` as keyof typeof allData]} onEdit={() => goToStep?.(index + 1)} />
        ))}
      </div>
      <DeclarationCheckbox checked={Boolean(data.buyerDeclarationAccepted)} onChange={checked => updateField('buyerDeclarationAccepted', checked)}>
        Buyer confirms bid details, specifications, eligibility, delivery details, documents and terms are correct.
      </DeclarationCheckbox>
      {errors.buyerDeclarationAccepted && <p className="text-xs font-bold text-red-600">{errors.buyerDeclarationAccepted[0]}</p>}
      <DeclarationCheckbox checked={Boolean(data.restrictiveConditionsDeclarationAccepted)} onChange={checked => updateField('restrictiveConditionsDeclarationAccepted', checked)}>
        Buyer confirms the bid does not contain restrictive, biased or unnecessary conditions and follows applicable procurement rules.
      </DeclarationCheckbox>
      {errors.restrictiveConditionsDeclarationAccepted && <p className="text-xs font-bold text-red-600">{errors.restrictiveConditionsDeclarationAccepted[0]}</p>}
    </div>
  );
}
