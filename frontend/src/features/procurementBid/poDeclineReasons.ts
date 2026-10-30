export interface PoDeclineReasonOption {
  code: string;
  label: string;
  shortLabel?: string;
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
    shortLabel: 'Buyer Terms Discrepancy',
    category: 'EXCUSED',
    isExcused: true,
    requiresEvidence: false,
    description: 'Purchase Order specifies items, commercial terms, or clauses not present in the published tender.'
  },
  {
    code: 'DELIVERY_TIMELINE_UNFEASIBLE',
    label: 'Delivery timeline is significantly shorter than quoted in bid',
    shortLabel: 'Delivery Timeline Unfeasible',
    category: 'EXCUSED',
    isExcused: true,
    requiresEvidence: false,
    description: 'Buyer shortened the lead time or expected delivery date beyond the agreed bid schedule.'
  },
  {
    code: 'FORCE_MAJEURE',
    label: 'Force Majeure (Natural disaster, statutory ban, emergency)',
    shortLabel: 'Force Majeure',
    category: 'EXCUSED',
    isExcused: true,
    requiresEvidence: true,
    description: 'Unforeseen acts of God, governmental decree, pandemic, or civil disruption preventing fulfillment.'
  },
  {
    code: 'SPECIFICATION_AMBIGUITY',
    label: 'Technical specification ambiguity / unresolvable clarification',
    shortLabel: 'Specification Ambiguity',
    category: 'EXCUSED',
    isExcused: true,
    requiresEvidence: false,
    description: 'Drawing or technical parameters in PO contradict standard industry standards.'
  },

  // Commercial / Operational Reasons (Recorded under Vendor Discipline)
  {
    code: 'CAPACITY_CONSTRAINTS',
    label: 'Unforeseen production capacity constraint / factory breakdown',
    shortLabel: 'Capacity Constraints',
    category: 'UNEXCUSED',
    isExcused: false,
    requiresEvidence: false,
    description: 'Manufacturing lines are operating at 100% capacity and cannot take on new production volume.'
  },
  {
    code: 'RAW_MATERIAL_SHORTAGE',
    label: 'Raw material or component supply chain disruption',
    shortLabel: 'Raw Material Shortage',
    category: 'UNEXCUSED',
    isExcused: false,
    requiresEvidence: false,
    description: 'Key inputs or semiconductor components are unavailable in open market.'
  },
  {
    code: 'PRICING_CALCULATION_ERROR',
    label: 'Pricing or quotation estimation error during bidding',
    shortLabel: 'Pricing Calculation Error',
    category: 'UNEXCUSED',
    isExcused: false,
    requiresEvidence: false,
    description: 'Mistake in BOQ cost calculations making fulfillment commercially unviable.'
  },
  {
    code: 'OTHER_OPERATIONAL',
    label: 'Other operational constraint (Requires detailed justification)',
    shortLabel: 'Other Operational Constraint',
    category: 'UNEXCUSED',
    isExcused: false,
    requiresEvidence: false,
    description: 'Other verified logistical or internal constraint.'
  }
];

export const getPoDeclineReasonByCode = (code?: string): PoDeclineReasonOption | undefined => {
  if (!code) return undefined;
  const clean = String(code).trim().replace(/[\[\]]/g, '').toUpperCase();
  return PO_DECLINE_REASONS.find((r) => r.code === clean);
};

export interface ParsedDeclineReason {
  code?: string;
  label: string;
  shortLabel: string;
  remarks?: string;
  isExcused?: boolean;
  category?: 'EXCUSED' | 'UNEXCUSED';
  description?: string;
  raw: string;
}

export function parseDeclineReason(rawReason?: string | null): ParsedDeclineReason {
  if (!rawReason || !String(rawReason).trim()) {
    return {
      label: 'Offer declined by supplier',
      shortLabel: 'Offer Declined',
      raw: '',
    };
  }

  // Strip wrapping quotes and whitespace e.g. ' " [BUYER_TERMS_DISCREPANCY] ..." '
  let trimmed = String(rawReason).trim();
  while (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  // Handle patterns:
  // 1. [BUYER_TERMS_DISCREPANCY] Optional remarks
  // 2. BUYER_TERMS_DISCREPANCY: Optional remarks
  // 3. BUYER_TERMS_DISCREPANCY - Optional remarks
  const bracketMatch = trimmed.match(/^\[\s*([A-Za-z0-9_]+)\s*\](?:\s*[:-]?\s*(.*))?$/s);
  const colonMatch = !bracketMatch ? trimmed.match(/^([A-Za-z0-9_]{3,})\s*:\s*(.*)$/s) : null;
  const match = bracketMatch || colonMatch;

  let code: string | undefined;
  let remarks: string | undefined;

  if (match) {
    code = match[1].trim().toUpperCase();
    remarks = match[2]?.trim() || undefined;
  } else {
    // Check if the entire string matches a known code
    const directMatched = getPoDeclineReasonByCode(trimmed);
    if (directMatched) {
      code = directMatched.code;
      remarks = undefined;
    } else {
      // Check if string begins with a known code followed by a space
      const spaceIdx = trimmed.indexOf(' ');
      if (spaceIdx > 0) {
        const potentialCode = trimmed.substring(0, spaceIdx);
        if (getPoDeclineReasonByCode(potentialCode)) {
          code = potentialCode.replace(/[\[\]]/g, '').toUpperCase();
          remarks = trimmed.substring(spaceIdx + 1).trim() || undefined;
        }
      }
    }
  }

  // Clean remarks of wrapping quotes
  if (remarks) {
    while (
      (remarks.startsWith('"') && remarks.endsWith('"')) ||
      (remarks.startsWith("'") && remarks.endsWith("'"))
    ) {
      remarks = remarks.slice(1, -1).trim();
    }
    if (!remarks) remarks = undefined;
  }

  if (code) {
    const matched = getPoDeclineReasonByCode(code);
    const friendlyName = code
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    return {
      code,
      label: matched?.label || friendlyName,
      shortLabel: matched?.shortLabel || friendlyName,
      remarks,
      isExcused: matched?.isExcused,
      category: matched?.category,
      description: matched?.description,
      raw: trimmed,
    };
  }

  return {
    label: trimmed,
    shortLabel: 'Offer Declined',
    remarks: trimmed,
    raw: trimmed,
  };
}
