import type { WizardFormData } from '../types/steps';

export const emptyWizardFormData = (): WizardFormData => ({
  step1: {
    packetType: 'SINGLE_PACKET',
    isReverseAuctionRequired: false,
    isPacRequired: false,
    bidCreationMode: 'FRESH_BID',
  },
  step2: {
    state: 'Maharashtra',
  },
  step3: {
    priority: 'Normal',
    publishingDate: new Date().toISOString().slice(0, 16),
    budgetConfirmed: false,
    preBidMeetingRequired: false,
  },
  step4: {},
  step5: {
    consigneeType: 'SINGLE',
    installationSiteSame: true,
    delayPenaltyApplicable: false,
  },
  step6: {
    technicalQualificationRequired: true,
    minimumExperienceRequired: false,
    minimumTurnoverRequired: false,
    similarWorkExperienceRequired: false,
    bidderDocuments: [],
    msePreference: false,
    makeInIndiaPreference: false,
    emdRequired: false,
    pbgRequired: false,
    blacklistingDeclarationRequired: true,
    conflictOfInterestDeclarationRequired: true,
  },
  step7: {
    documentUploads: [],
    technicalSpecificationDocumentIds: [],
    budgetSanctionDocumentIds: [],
    administrativeApprovalDocumentIds: [],
    advancePaymentAllowed: false,
    partPaymentAllowed: false,
    invoiceRequired: true,
    gstInvoiceRequired: true,
    ewayBillRequired: false,
  },
  step8: {
    corrigendumAllowed: true,
    cancellationAllowedBeforeClosing: true,
    clarificationWindowRequired: true,
    sellerQueryAllowed: true,
    documentResubmissionAllowed: false,
    splittingQuantityAllowed: false,
    multipleAwardAllowed: false,
    rateContractRequired: false,
  },
  step9: {
    buyerDeclarationAccepted: false,
    restrictiveConditionsDeclarationAccepted: false,
  },
});

export const formatMoney = (value: unknown) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

export const mergeStepData = (formData: WizardFormData, step: number, data: Record<string, any>): WizardFormData => ({
  ...formData,
  [`step${step}`]: {
    ...(formData[`step${step}` as keyof WizardFormData] || {}),
    ...data,
  },
});

export const defaultStep4ForBidType = (bidType?: string): Record<string, any> => {
  if (bidType === 'SERVICE_BID') {
    return {
      manpowerRequired: false,
      slaRequired: false,
      statutoryComplianceRequired: false,
    };
  }
  if (bidType === 'CUSTOM_BID') {
    return {
      milestonesRequired: false,
      technicalProposalRequired: false,
    };
  }
  if (bidType === 'BOQ_BID') {
    return {
      boqEntryMode: 'MANUAL',
      boqDocumentUploads: [],
      lineItems: [],
      gstApplicable: true,
    };
  }
  if (bidType === 'PAC_BID') {
    return {
      alternativeProductAnalysisDone: false,
      pacCertificateUploads: [],
      competentAuthorityApprovalUploads: [],
      priceReasonabilityDocumentUploads: [],
    };
  }
  if (bidType === 'REVERSE_AUCTION') {
    return {
      autoExtensionRequired: false,
    };
  }
  return {
    warrantyRequired: false,
    installationRequired: false,
    testingCommissioningRequired: false,
    ...(bidType === 'BID_WITH_RA' ? { autoExtensionRequired: false } : {}),
  };
};
