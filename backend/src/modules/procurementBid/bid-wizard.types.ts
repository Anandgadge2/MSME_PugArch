export type BidType =
  | 'PRODUCT_BID'
  | 'SERVICE_BID'
  | 'CUSTOM_BID'
  | 'BOQ_BID'
  | 'BID_WITH_RA'
  | 'REVERSE_AUCTION'
  | 'PAC_BID';

export type PacketType = 'SINGLE_PACKET' | 'TWO_PACKET';

export type BidWizardFormData = Record<string, any> & {
  step1?: Record<string, any>;
  step2?: Record<string, any>;
  step3?: Record<string, any>;
  step4?: Record<string, any>;
  step5?: Record<string, any>;
  step6?: Record<string, any>;
  step7?: Record<string, any>;
  step8?: Record<string, any>;
  step9?: Record<string, any>;
};

export type StepValidationResult = {
  valid: boolean;
  errors: Record<string, string[]>;
};
