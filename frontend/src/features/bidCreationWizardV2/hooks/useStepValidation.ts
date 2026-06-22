import { useCallback } from 'react';
import type { BidType, PacketType, WizardFormData } from '../types/steps';
import { validateStepClient } from '../utils/validation';
import { bidWizardApi } from '../api';

export const useStepValidation = (
  formData: WizardFormData,
  bidType: BidType | null,
  packetType: PacketType,
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<number, Record<string, string[]>>>>
) => {
  return useCallback(async (step: number, useServer = false) => {
    const clientResult = validateStepClient(step, formData, bidType, packetType);
    if (!clientResult.valid || !useServer) {
      setValidationErrors(prev => ({ ...prev, [step]: clientResult.errors }));
      return clientResult.valid;
    }
    try {
      const serverResult = await bidWizardApi.validateStep(step, formData, bidType, packetType);
      setValidationErrors(prev => ({ ...prev, [step]: serverResult.errors || {} }));
      return serverResult.valid;
    } catch (error: any) {
      const details = error?.details && typeof error.details === 'object' ? error.details : { form: [error.message || 'Validation failed'] };
      setValidationErrors(prev => ({ ...prev, [step]: details }));
      return false;
    }
  }, [bidType, formData, packetType, setValidationErrors]);
};
