import type { BidType } from '../types/steps';

export const STEP_CONFIG_BY_BID_TYPE: Record<BidType, string[]> = {
  PRODUCT_BID: ['Product fields', 'Warranty', 'Inspection'],
  SERVICE_BID: ['Service scope', 'SLA', 'Statutory compliance'],
  CUSTOM_BID: ['Custom scope', 'Deliverables', 'Evaluation'],
  BOQ_BID: ['BOQ upload or entry', 'BOQ line items'],
  BID_WITH_RA: ['Product fields', 'Reverse auction setup'],
  REVERSE_AUCTION: ['Reverse auction setup'],
  PAC_BID: ['PAC justification', 'Approvals', 'Price reasonability'],
};
