export type BidType =
  | 'PRODUCT_BID'
  | 'SERVICE_BID'
  | 'CUSTOM_BID'
  | 'BOQ_BID'
  | 'BID_WITH_RA'
  | 'REVERSE_AUCTION'
  | 'PAC_BID';

export type PacketType = 'SINGLE_PACKET' | 'TWO_PACKET';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

export type WizardStepKey = 'step1' | 'step2' | 'step3' | 'step4' | 'step5' | 'step6' | 'step7' | 'step8' | 'step9';

export type OtherValue = {
  dropdownValue: string;
  otherValue: string;
};

export type WizardFormData = Record<WizardStepKey, Record<string, any>>;

export type BidWizardState = {
  draftId: number | null;
  currentStep: number;
  bidType: BidType | null;
  packetType: PacketType;
  formData: WizardFormData;
  validationErrors: Record<number, Record<string, string[]>>;
  completedSteps: number[];
  saveStatus: SaveStatus;
  lastSavedAt: string | null;
  isSubmitting: boolean;
};

export type StepComponentProps = {
  data: Record<string, any>;
  allData: WizardFormData;
  bidType: BidType | null;
  packetType: PacketType;
  errors: Record<string, string[]>;
  updateField: (field: string, value: any) => void;
  updateStepData: (data: Record<string, any>) => void;
  goToStep?: (step: number) => void;
};
