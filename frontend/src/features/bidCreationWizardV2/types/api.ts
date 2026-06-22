import type { BidType, PacketType, WizardFormData } from './steps';

export type BidWizardDraft = {
  id: number;
  buyerId: number;
  bidType: BidType;
  currentStep: number;
  completedSteps: number[];
  formData: WizardFormData;
  validationState?: Record<string, any>;
  lastSavedAt: string;
  draftStatus: 'DRAFT' | 'SUBMITTED' | 'PUBLISHED' | 'CANCELLED';
};

export type StepValidationResponse = {
  valid: boolean;
  errors: Record<string, string[]>;
};

export type PreviewResponse = {
  draftId: number;
  bidType: BidType;
  bidTypeLabel: string;
  packetType: PacketType;
  currentStep: number;
  completedSteps: number[];
  lastSavedAt: string;
  valid: boolean;
  validationErrors: Record<string, Record<string, string[]>>;
  steps: WizardFormData;
};
