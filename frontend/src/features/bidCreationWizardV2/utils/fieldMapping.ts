import type { WizardFormData } from '../types/steps';

export const resolveOtherValues = (value: any): any => {
  if (Array.isArray(value)) return value.map(resolveOtherValues);
  if (value && typeof value === 'object') {
    if (value.dropdownValue === 'Other') return String(value.otherValue || '').trim();
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, resolveOtherValues(nested)]));
  }
  return value;
};

export const formDataToApiPayload = (formData: WizardFormData) => resolveOtherValues(formData);
