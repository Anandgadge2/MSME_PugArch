/**
 * Dispatch & Logistics Field Validation Utilities
 * Enforces Indian statutory rules for Vehicle Registration, E-Way Bill numbers, and Driver Phone numbers.
 */

export interface ValidationResult {
  isValid: boolean;
  formatted?: string;
  error?: string;
}

/**
 * Validates Indian Vehicle Registration Number formats:
 * 1. Standard State format: e.g., MH 04 AB 1234, DL 01 C 9999, KA 05 M 5555
 * 2. Bharat BH Series format: e.g., 22 BH 1234 AB
 * 3. Defense / Army format: e.g., 22 D 123456 A
 * 4. Temporary Registration format: e.g., MH 04 TEMP 1234, KA 01 TR 9999
 */
export const validateIndianVehicleNumber = (val: string): ValidationResult => {
  if (!val || !val.trim()) {
    return { isValid: true, formatted: '' };
  }

  const cleaned = val.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!cleaned) {
    return { isValid: true, formatted: '' };
  }

  // 1. Standard Indian format (State Code + RTO Code + Series + Number)
  const standardPattern = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
  // 2. Bharat BH Series (YY BH NNNN XX)
  const bhPattern = /^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$/;
  // 3. Defense (YY D NNNNNN X)
  const defensePattern = /^[0-9]{2}D[0-9]{6}[A-Z]$/;
  // 4. Temporary (State + RTO + TEMP/TR + NNNN)
  const tempPattern = /^[A-Z]{2}[0-9]{1,2}(TEMP|TR)[0-9]{4}$/;

  const isValid =
    standardPattern.test(cleaned) ||
    bhPattern.test(cleaned) ||
    defensePattern.test(cleaned) ||
    tempPattern.test(cleaned);

  if (!isValid) {
    return {
      isValid: false,
      formatted: cleaned,
      error: 'Invalid Indian vehicle registration format (e.g., MH 04 AB 1234 or 22 BH 1234 AB)'
    };
  }

  // Format cleanly with standardized spaces
  let formatted = cleaned;
  if (standardPattern.test(cleaned)) {
    const state = cleaned.slice(0, 2);
    const num = cleaned.slice(-4);
    const mid = cleaned.slice(2, cleaned.length - 4);
    const rtoMatch = mid.match(/^([0-9]{1,2})([A-Z]{1,3})$/);
    if (rtoMatch) {
      const rto = rtoMatch[1].padStart(2, '0');
      const series = rtoMatch[2];
      formatted = `${state} ${rto} ${series} ${num}`;
    } else {
      formatted = `${state} ${mid} ${num}`;
    }
  } else if (bhPattern.test(cleaned)) {
    const yr = cleaned.slice(0, 2);
    const num = cleaned.slice(4, 8);
    const letters = cleaned.slice(8);
    formatted = `${yr} BH ${num} ${letters}`;
  } else if (tempPattern.test(cleaned)) {
    const state = cleaned.slice(0, 2);
    const num = cleaned.slice(-4);
    const mid = cleaned.slice(2, cleaned.length - 4);
    formatted = `${state} ${mid} ${num}`;
  }

  return { isValid: true, formatted };
};

/**
 * Validates Driver Phone Number (Strictly 10 numeric digits for Indian mobile numbers)
 */
export const validateDriverPhone = (val: string): ValidationResult => {
  if (!val || !val.trim()) {
    return { isValid: true, formatted: '' };
  }

  const cleaned = val.replace(/\D/g, '');

  if (!cleaned) {
    return { isValid: true, formatted: '' };
  }

  if (cleaned.length !== 10) {
    return {
      isValid: false,
      formatted: cleaned,
      error: 'Driver phone / contact must be exactly 10 numeric digits'
    };
  }

  return { isValid: true, formatted: cleaned };
};

/**
 * Validates E-Way Bill Number (Rule 138 - Strictly 12 numeric digits)
 */
export const validateEwayBillNumber = (val: string, isRequired: boolean = false): ValidationResult => {
  const cleaned = (val || '').replace(/\D/g, '');

  if (!cleaned) {
    if (isRequired) {
      return {
        isValid: false,
        formatted: '',
        error: 'E-Way Bill Number (12 numeric digits) is required for consignments ≥ ₹50,000'
      };
    }
    return { isValid: true, formatted: '' };
  }

  if (cleaned.length !== 12) {
    return {
      isValid: false,
      formatted: cleaned,
      error: 'E-Way Bill Number must be exactly 12 numeric digits'
    };
  }

  return { isValid: true, formatted: cleaned };
};
