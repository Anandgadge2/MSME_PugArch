export interface PoDeclineReasonOption {
  code: string;
  label: string;
  category: 'EXCUSED' | 'UNEXCUSED';
  isExcused: boolean;
  requiresEvidence: boolean;
  description: string;
}

export const PO_DECLINE_REASONS: PoDeclineReasonOption[] = [
  // Contractual / Excused Reasons (Zero Vendor Penalty)
  {
    code: 'BUYER_TERMS_DISCREPANCY',
    label: 'PO terms or specifications mismatch original RFQ / Tender',
    category: 'EXCUSED',
    isExcused: true,
    requiresEvidence: false,
    description: 'Purchase Order specifies items, commercial terms, or clauses not present in the published tender.'
  },
  {
    code: 'DELIVERY_TIMELINE_UNFEASIBLE',
    label: 'Delivery timeline is significantly shorter than quoted in bid',
    category: 'EXCUSED',
    isExcused: true,
    requiresEvidence: false,
    description: 'Buyer shortened the lead time or expected delivery date beyond the agreed bid schedule.'
  },
  {
    code: 'FORCE_MAJEURE',
    label: 'Force Majeure (Natural disaster, statutory ban, emergency)',
    category: 'EXCUSED',
    isExcused: true,
    requiresEvidence: true,
    description: 'Unforeseen acts of God, governmental decree, pandemic, or civil disruption preventing fulfillment.'
  },
  {
    code: 'SPECIFICATION_AMBIGUITY',
    label: 'Technical specification ambiguity / unresolvable clarification',
    category: 'EXCUSED',
    isExcused: true,
    requiresEvidence: false,
    description: 'Drawing or technical parameters in PO contradict standard industry standards.'
  },

  // Commercial / Operational Reasons (Recorded under Vendor Discipline)
  {
    code: 'CAPACITY_CONSTRAINTS',
    label: 'Unforeseen production capacity constraint / factory breakdown',
    category: 'UNEXCUSED',
    isExcused: false,
    requiresEvidence: false,
    description: 'Manufacturing lines are operating at 100% capacity and cannot take on new production volume.'
  },
  {
    code: 'RAW_MATERIAL_SHORTAGE',
    label: 'Raw material or component supply chain disruption',
    category: 'UNEXCUSED',
    isExcused: false,
    requiresEvidence: false,
    description: 'Key inputs or semiconductor components are unavailable in open market.'
  },
  {
    code: 'PRICING_CALCULATION_ERROR',
    label: 'Pricing or quotation estimation error during bidding',
    category: 'UNEXCUSED',
    isExcused: false,
    requiresEvidence: false,
    description: 'Mistake in BOQ cost calculations making fulfillment commercially unviable.'
  },
  {
    code: 'OTHER_OPERATIONAL',
    label: 'Other operational constraint (Requires detailed justification)',
    category: 'UNEXCUSED',
    isExcused: false,
    requiresEvidence: false,
    description: 'Other verified logistical or internal constraint.'
  }
];

export const getPoDeclineReasonByCode = (code?: string): PoDeclineReasonOption | undefined => {
  if (!code) return undefined;
  return PO_DECLINE_REASONS.find((r) => r.code === code);
};
