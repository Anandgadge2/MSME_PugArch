import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { BidType, PacketType, WizardFormData } from '../types/steps';
import { bidWizardApi } from '../api';
import { defaultStep4ForBidType, emptyWizardFormData, mergeStepData } from '../utils/helpers';
import { useStepValidation } from './useStepValidation';
import { useDraftPersistence } from './useDraftPersistence';

export const useBidWizard = () => {
  const [draftId, setDraftId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<WizardFormData>(() => emptyWizardFormData());
  const [validationErrors, setValidationErrors] = useState<Record<number, Record<string, string[]>>>({});
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bidType = (formData.step1.bidType || null) as BidType | null;
  const packetType = (formData.step1.packetType || 'SINGLE_PACKET') as PacketType;
  const validateStep = useStepValidation(formData, bidType, packetType, setValidationErrors);
  const persistence = useDraftPersistence({ draftId, currentStep, formData, validationErrors, completedSteps, enabled: Boolean(draftId) });

  const updateField = useCallback((step: number, field: string, value: any) => {
    setFormData(prev => {
      const next = mergeStepData(prev, step, { [field]: value });
      if (step === 1 && field === 'bidType') {
        next.step4 = defaultStep4ForBidType(String(value));
      }
      return next;
    });
  }, []);

  const updateStepData = useCallback((step: number, data: Record<string, any>) => {
    setFormData(prev => mergeStepData(prev, step, data));
  }, []);

  const ensureDraft = useCallback(async () => {
    const selectedBidType = formData.step1.bidType as BidType | undefined;
    if (draftId || !selectedBidType) return draftId;
    const draft = await bidWizardApi.createDraft(selectedBidType, formData);
    setDraftId(draft.id);
    persistence.setLastSavedAt(draft.lastSavedAt);
    return draft.id;
  }, [draftId, formData, persistence]);

  const goToStep = useCallback(async (step: number) => {
    if (step > currentStep) {
      const ok = await validateStep(currentStep, true);
      if (!ok) return;
      setCompletedSteps(prev => Array.from(new Set([...prev, currentStep])));
      if (currentStep === 1) await ensureDraft();
    }
    setCurrentStep(Math.min(9, Math.max(1, step)));
  }, [currentStep, ensureDraft, validateStep]);

  const saveDraft = useCallback(async () => {
    const hadDraft = Boolean(draftId);
    const id = await ensureDraft();
    if (!id) {
      toast.error('Select bid type before saving draft');
      return;
    }
    if (hadDraft) {
      await persistence.saveDraft();
    } else {
      const draft = await bidWizardApi.updateDraft(id, {
        currentStep,
        formData,
        validationState: validationErrors,
        completedSteps,
      });
      persistence.setLastSavedAt(draft.lastSavedAt);
    }
    toast.success('Draft saved');
  }, [completedSteps, currentStep, draftId, ensureDraft, formData, persistence, validationErrors]);

  const submitBid = useCallback(async (submitForApproval = true) => {
    const id = await ensureDraft();
    if (!id) return;
    setIsSubmitting(true);
    try {
      const invalidSteps: number[] = [];
      for (let step = 1; step <= 9; step += 1) {
        const ok = await validateStep(step, true);
        if (!ok) invalidSteps.push(step);
      }
      if (invalidSteps.length) {
        setCurrentStep(invalidSteps[0]);
        toast.error(`Please fix validation errors in step ${invalidSteps[0]}`);
        return;
      }
      const result = await bidWizardApi.submit(id, submitForApproval);
      toast.success(`Bid submitted: ${result.procurementBid?.bidNumber || result.procurementBid?.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Unable to submit bid');
    } finally {
      setIsSubmitting(false);
    }
  }, [ensureDraft, validateStep]);

  const loadDraft = useCallback(async (id: number) => {
    const draft = await bidWizardApi.getDraft(id);
    setDraftId(draft.id);
    setCurrentStep(draft.currentStep || 1);
    setFormData({ ...emptyWizardFormData(), ...(draft.formData || {}) });
    setCompletedSteps(draft.completedSteps || []);
    setValidationErrors(draft.validationState || {});
    persistence.setLastSavedAt(draft.lastSavedAt);
  }, [persistence]);

  const resetWizard = useCallback(() => {
    setDraftId(null);
    setCurrentStep(1);
    setFormData(emptyWizardFormData());
    setValidationErrors({});
    setCompletedSteps([]);
  }, []);

  return useMemo(() => ({
    draftId,
    currentStep,
    bidType,
    packetType,
    formData,
    validationErrors,
    completedSteps,
    saveStatus: persistence.saveStatus,
    lastSavedAt: persistence.lastSavedAt,
    isSubmitting,
    setStep: goToStep,
    updateField,
    updateStepData,
    validateCurrentStep: () => validateStep(currentStep, true),
    saveDraft,
    submitBid,
    loadDraft,
    resetWizard,
  }), [bidType, completedSteps, currentStep, draftId, formData, goToStep, isSubmitting, loadDraft, packetType, persistence.lastSavedAt, persistence.saveStatus, resetWizard, saveDraft, submitBid, updateField, updateStepData, validateStep, validationErrors]);
};
