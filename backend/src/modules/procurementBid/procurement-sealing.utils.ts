/**
 * Procurement Document Sealing and Commercial Redaction Utilities
 * Provides consolidated, authoritative logic for classifying financial/commercial
 * documents and enforcing strict sealed-bidding statutory rules.
 */

export const FINANCIAL_OPEN_STATUSES = [
  'FINANCIAL_EVALUATION',
  'L1_GENERATED',
  'AWARD_RECOMMENDED',
  'AWARD_OFFERED',
  'AWARDED',
  'PO_GENERATED',
  'COMPLETED'
];

/**
 * Determines whether a document is financial, commercial, or price-bearing.
 * Inspects both explicit category metadata and common filename patterns.
 */
export function isFinancialOrCommercialDocument(doc: any): boolean {
  if (!doc) return false;

  const cat = String(
    doc.documentCategory || doc.category || doc.type || doc.kind || ''
  ).toUpperCase();

  const nm = String(
    doc.documentName || doc.fileName || doc.name || doc.title || ''
  ).toLowerCase();

  // Category based classification
  if (
    cat.includes('FINAN') ||
    cat.includes('PRICE') ||
    cat.includes('COMMERCIAL') ||
    cat.includes('COST') ||
    cat.includes('RATE_SCHEDULE') ||
    cat.includes('FEE')
  ) {
    return true;
  }

  // Filename based heuristic classification
  if (
    nm.includes('price') ||
    nm.includes('breakup') ||
    nm.includes('commercial') ||
    nm.includes('financial') ||
    nm.includes('cost schedule') ||
    nm.includes('rate schedule') ||
    nm.includes('price breakup') ||
    nm.includes('boq rate') ||
    nm.includes('pricing') ||
    nm.includes('quotation sheet') ||
    nm.includes('cost_summary') ||
    nm.includes('commercial_bid')
  ) {
    return true;
  }

  return false;
}

/**
 * Filter documents according to financial visibility permissions.
 * If canSeeFinancial is false, all commercial/financial documents are strictly removed.
 */
export function filterSealedDocuments(
  documents: any[],
  canSeeFinancial: boolean
): any[] {
  if (!Array.isArray(documents)) return [];
  if (canSeeFinancial) return documents;

  return documents.filter((doc) => !isFinancialOrCommercialDocument(doc));
}

/**
 * Checks if the bid status permits unsealing of financial packets.
 */
export function isFinancialStatusOpen(bidStatus?: string | null): boolean {
  if (!bidStatus) return false;
  return FINANCIAL_OPEN_STATUSES.includes(String(bidStatus).toUpperCase());
}
