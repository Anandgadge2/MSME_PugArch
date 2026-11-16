import { positiveNumber, requiredText } from '../shared/validation';

export interface ProductValidationInput {
  name?: string;
  categoryId?: string | number | null;
  description?: string;
  unitOfMeasure?: string;
  itemCondition?: string;
  hsnCode?: string;
  price?: unknown;
  splitTaxRate?: string;
  igstTaxRate?: string;
  imagesCount?: number;
  isShg?: boolean;
}

export interface ServiceValidationInput {
  name?: string;
  categoryId?: string | number | null;
  description?: string;
  serviceArea?: string;
  duration?: string;
  slaResponseTime?: string;
  scopeOfWork?: string;
  pricingModel?: string;
  basePrice?: unknown;
  splitTaxRate?: string;
  igstTaxRate?: string;
  imagesCount?: number;
  isShg?: boolean;
}

export const validateProduct = (input: ProductValidationInput) => {
  const isPriceProvided = input.price !== undefined && input.price !== null && input.price !== '';
  const isPriceValid = Boolean(isPriceProvided && positiveNumber(input.price));
  const isTaxProvided = (input.splitTaxRate !== undefined && input.splitTaxRate !== '') || (input.igstTaxRate !== undefined && input.igstTaxRate !== '');
  const isTaxValid = Boolean(isTaxProvided);
  const isHsnValid = Boolean(requiredText(input.hsnCode));

  return {
    name: requiredText(input.name),
    category: Boolean(input.categoryId),
    description: requiredText(input.description),
    unitOfMeasure: requiredText(input.unitOfMeasure),
    itemCondition: requiredText(input.itemCondition),
    hsnCode: isHsnValid,
    price: isPriceValid,
    tax: isTaxValid,
    images: (input.imagesCount || 0) >= 1,
    isValid:
      requiredText(input.name) &&
      Boolean(input.categoryId) &&
      requiredText(input.description) &&
      requiredText(input.unitOfMeasure) &&
      requiredText(input.itemCondition) &&
      isHsnValid &&
      isPriceValid &&
      isTaxValid &&
      (input.imagesCount || 0) >= 1
  };
};

export const validateService = (input: ServiceValidationInput) => {
  const isPriceProvided = input.basePrice !== undefined && input.basePrice !== null && input.basePrice !== '';
  const isPriceValid = Boolean(isPriceProvided && positiveNumber(input.basePrice));
  const isTaxProvided = (input.splitTaxRate !== undefined && input.splitTaxRate !== '') || (input.igstTaxRate !== undefined && input.igstTaxRate !== '');
  const isTaxValid = Boolean(isTaxProvided);

  return {
    name: requiredText(input.name),
    category: Boolean(input.categoryId),
    description: requiredText(input.description),
    serviceArea: requiredText(input.serviceArea),
    duration: requiredText(input.duration),
    slaResponseTime: requiredText(input.slaResponseTime),
    scopeOfWork: requiredText(input.scopeOfWork),
    pricingModel: requiredText(input.pricingModel),
    price: isPriceValid,
    tax: isTaxValid,
    images: (input.imagesCount || 0) >= 1,
    isValid:
      requiredText(input.name) &&
      Boolean(input.categoryId) &&
      requiredText(input.description) &&
      requiredText(input.serviceArea) &&
      requiredText(input.duration) &&
      requiredText(input.slaResponseTime) &&
      requiredText(input.scopeOfWork) &&
      requiredText(input.pricingModel) &&
      isPriceValid &&
      isTaxValid &&
      (input.imagesCount || 0) >= 1
  };
};

export const validateCatalogueItem = (payload: { name?: string; price?: unknown; basePrice?: unknown }) => ({
  name: requiredText(payload.name),
  price: payload.price === undefined || positiveNumber(payload.price),
  basePrice: payload.basePrice === undefined || positiveNumber(payload.basePrice)
});

