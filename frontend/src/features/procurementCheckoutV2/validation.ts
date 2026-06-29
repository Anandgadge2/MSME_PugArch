import type { CheckoutFormData } from './types';

export const validateStep = (step: number, form: CheckoutFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (step === 2) {
    if (!form.buyerDetails.organizationName) errors.organizationName = 'Required';
    if (!form.buyerDetails.buyerOfficerName) errors.buyerOfficerName = 'Required';
    if (!form.buyerDetails.email) errors.email = 'Required';
  }

  if (step === 3) {
    if (!form.consigneeDetails.consigneeName) errors.consigneeName = 'Required';
    if (!form.deliveryDetails.deliveryAddress) errors.deliveryAddress = 'Required';
    if (!form.deliveryDetails.pinCode) errors.pinCode = 'Required';
  }

  if (step === 4) {
    if (!form.selectedMethod) errors.selectedMethod = 'Select a procurement method';
  }

  if (step === 5) {
    if (form.budgetSanction.budgetAvailabilityConfirmed !== 'Yes') {
      errors.budgetAvailabilityConfirmed = 'Budget must be confirmed';
    }
    if (!form.budgetSanction.sanctionAmount) {
      errors.sanctionAmount = 'Required';
    } else {
      const sanctionAmt = Number(form.budgetSanction.sanctionAmount);
      if (!isNaN(sanctionAmt) && sanctionAmt < 0) {
        errors.sanctionAmount = 'Amount cannot be negative';
      }
    }
    if (!form.priceReasonability.estimatedPrice) {
      errors.estimatedPrice = 'Required';
    } else {
      const estPrice = Number(form.priceReasonability.estimatedPrice);
      if (!isNaN(estPrice) && estPrice < 0) {
        errors.estimatedPrice = 'Price cannot be negative';
      }
    }

    ['lastPurchasePrice', 'marketComparisonPrice', 'portalL1Price'].forEach(field => {
      const val = form.priceReasonability[field];
      if (val) {
        const num = Number(val);
        if (!isNaN(num) && num < 0) {
          errors[field] = 'Price cannot be negative';
        }
      }
    });
  }

  if (step === 6) {
    if (!form.paymentAuthority.payingAuthorityName) errors.payingAuthorityName = 'Required';
    if (!form.paymentAuthority.paymentMode) errors.paymentMode = 'Required';
  }

  if (step === 8) {
    const d = form.declarations;
    if (!d.specsConfirmed) errors.specsConfirmed = 'Required';
    if (!d.priceReasonabilityConfirmed) errors.priceReasonabilityConfirmed = 'Required';
    if (!d.budgetConfirmed) errors.budgetConfirmed = 'Required';
    if (!d.noDemandSplitConfirmed) errors.noDemandSplitConfirmed = 'Required';
    if (!d.termsAccepted) errors.termsAccepted = 'Required';
  }

  return errors;
};
