import { useCallback, useEffect, useRef, useState } from 'react';
import type { SaveStatus, WizardFormData } from '../types/steps';
import { bidWizardApi } from '../api';

const DEBOUNCE_MS = 1000;

export const useDraftPersistence = ({
  draftId,
  currentStep,
  formData,
  validationErrors,
  completedSteps,
  enabled,
}: {
  draftId: number | null;
  currentStep: number;
  formData: WizardFormData;
  validationErrors: Record<number, Record<string, string[]>>;
  completedSteps: number[];
  enabled: boolean;
}) => {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = true;
  }, [formData, currentStep]);

  const saveDraft = useCallback(async () => {
    if (!draftId) return;
    setSaveStatus('saving');
    try {
      const draft = await bidWizardApi.updateDraft(draftId, {
        currentStep,
        formData,
        validationState: validationErrors,
        completedSteps,
      });
      setLastSavedAt(draft.lastSavedAt);
      setSaveStatus('saved');
      dirtyRef.current = false;
    } catch {
      setSaveStatus('failed');
    }
  }, [completedSteps, currentStep, draftId, formData, validationErrors]);

  useEffect(() => {
    if (!enabled || !draftId || !dirtyRef.current) return;
    const timer = window.setTimeout(() => {
      saveDraft();
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draftId, enabled, formData, currentStep, saveDraft]);

  return { saveStatus, lastSavedAt, saveDraft, setLastSavedAt };
};
