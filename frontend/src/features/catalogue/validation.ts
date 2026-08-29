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
}

export const validateProduct = (input: ProductValidationInput) => {
  const isPriceValid = input.price !== undefined && input.price !== null && input.price !== '' && positiveNumber(input.price);
  const isTaxValid = (input.splitTaxRate !== undefined && input.splitTaxRate !== '') || (input.igstTaxRate !== undefined && input.igstTaxRate !== '');
  return {
    name: requiredText(input.name),
    category: Boolean(input.categoryId),
    description: requiredText(input.description),
    unitOfMeasure: requiredText(input.unitOfMeasure),
    itemCondition: requiredText(input.itemCondition),
    hsnCode: requiredText(input.hsnCode),
    price: isPriceValid,
    tax: isTaxValid,
    images: (input.imagesCount || 0) >= 1,
    isValid:
      requiredText(input.name) &&
      Boolean(input.categoryId) &&
      requiredText(input.description) &&
      requiredText(input.unitOfMeasure) &&
      requiredText(input.itemCondition) &&
      requiredText(input.hsnCode) &&
      isPriceValid &&
      isTaxValid &&
      (input.imagesCount || 0) >= 1
  };
};

export const validateService = (input: ServiceValidationInput) => {
  const isPriceValid = input.basePrice !== undefined && input.basePrice !== null && input.basePrice !== '' && positiveNumber(input.basePrice);
  const isTaxValid = (input.splitTaxRate !== undefined && input.splitTaxRate !== '') || (input.igstTaxRate !== undefined && input.igstTaxRate !== '');
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

