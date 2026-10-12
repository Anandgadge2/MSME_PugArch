/**
 * Business Type normalization and canonical dictionary for MSME Portal.
 * Handles bidirectional mapping between:
 * - Registration values ('Company (Pvt Ltd / Ltd)', 'Proprietorship', etc.)
 * - Prisma enums ('PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'GOVERNMENT', 'PSU', etc.)
 * - Human-readable display labels
 */

export interface BusinessTypeOption {
  value: string;
  label: string;
}

export const CANONICAL_BUYER_BUSINESS_TYPES: BusinessTypeOption[] = [
  { value: 'Company (Pvt Ltd / Ltd)', label: 'Private Limited Company (Pvt Ltd / Ltd)' },
  { value: 'Public Limited Company', label: 'Public Limited Company' },
  { value: 'Government Department / Ministry', label: 'Government Department / Ministry' },
  { value: 'Public Sector Undertaking (PSU)', label: 'Public Sector Undertaking (PSU)' },
  { value: 'Partnership Firm', label: 'Partnership Firm' },
  { value: 'Proprietorship', label: 'Proprietorship' },
  { value: 'LLP', label: 'Limited Liability Partnership (LLP)' },
  { value: 'Startup', label: 'Startup' },
  { value: 'MSME', label: 'MSME' },
  { value: 'herSHG', label: 'SHG / Women Self-Help Group' }
];

export const PRIMARY_USER_TYPES: string[] = [
  'Government Department / Ministry',
  'Public Sector Undertaking (PSU)',
  'Proprietorship',
  'Partnership Firm',
  'Company (Pvt Ltd / Ltd)',
  'Public Limited Company',
  'LLP',
  'MSME',
  'Startup',
  'herSHG'
];

/**
 * Normalizes any business type string (Prisma enum, UI variant, or legacy code)
 * into a canonical registration/onboarding string.
 */
export const normalizeBusinessType = (raw: unknown): string => {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const clean = trimmed.toUpperCase().replace(/[\s\-_/()]/g, '');

  // Private Limited / Company
  if (
    clean.includes('PVTLTD') ||
    clean.includes('PRIVATELIMITED') ||
    clean === 'COMPANY' ||
    clean === 'COMPANYPVTLTDLTD' ||
    clean === 'PVT'
  ) {
    return 'Company (Pvt Ltd / Ltd)';
  }

  // Public Limited
  if (clean.includes('PUBLICLIMITED') || clean === 'PUBLICLTD') {
    return 'Public Limited Company';
  }

  // Government
  if (
    clean.includes('GOV') ||
    clean.includes('MINISTRY') ||
    clean === 'GOVERNMENTBUYER' ||
    clean === 'CENTRALGOVERNMENT' ||
    clean === 'STATEGOVERNMENT'
  ) {
    return 'Government Department / Ministry';
  }

  // PSU
  if (
    clean.includes('PSU') ||
    clean.includes('PUBLICSECTOR') ||
    clean === 'CPSE' ||
    clean === 'SPSE'
  ) {
    return 'Public Sector Undertaking (PSU)';
  }

  // Partnership
  if (clean.includes('PARTNER')) {
    return 'Partnership Firm';
  }

  // Proprietorship
  if (clean.includes('PROPRIET')) {
    return 'Proprietorship';
  }

  // LLP
  if (clean === 'LLP' || clean.includes('LIMITEDLIABILITYPARTNERSHIP')) {
    return 'LLP';
  }

  // Startup
  if (clean.includes('STARTUP')) {
    return 'Startup';
  }

  // MSME
  if (clean.includes('MSME')) {
    return 'MSME';
  }

  // SHG
  if (clean.includes('SHG')) {
    return 'herSHG';
  }

  return trimmed;
};

/**
 * Checks whether the given business type is recognized as a primary user type.
 */
export const isPrimaryUserType = (businessType: unknown): boolean => {
  const normalized = normalizeBusinessType(businessType);
  return PRIMARY_USER_TYPES.includes(normalized);
};

/**
 * Converts any business type string into a human-friendly display label.
 */
export const getBusinessTypeLabel = (raw: unknown): string => {
  const normalized = normalizeBusinessType(raw);
  const match = CANONICAL_BUYER_BUSINESS_TYPES.find(opt => opt.value === normalized);
  if (match) return match.label;
  if (normalized) return normalized;
  return 'Not specified';
};
