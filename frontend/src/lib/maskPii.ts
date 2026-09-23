/**
 * PII Masking utility for DPDP and security compliance.
 * Mirrors backend maskSensitive utilities to prevent exposure of sensitive
 * identifiers in frontend views, PDFs, and client exports.
 */

export const maskAadhaar = (v?: string | null): string => {
  if (!v) return '';
  const clean = String(v).replace(/\s+/g, '');
  if (clean.length >= 8) {
    return `XXXX XXXX ${clean.slice(-4)}`;
  }
  return clean;
};

export const maskPAN = (v?: string | null): string => {
  if (!v) return '';
  const clean = String(v).trim().toUpperCase();
  if (clean.length >= 10) {
    return `${clean.slice(0, 2)}*****${clean.slice(-2)}`;
  }
  return clean;
};

export const maskBankAccount = (v?: string | null): string => {
  if (!v) return '';
  const clean = String(v).trim();
  if (clean.length > 4) {
    return `${'X'.repeat(clean.length - 4)}${clean.slice(-4)}`;
  }
  return clean;
};

export const maskGSTIN = (v?: string | null): string => {
  if (!v) return '';
  const clean = String(v).trim().toUpperCase();
  if (clean.length >= 15) {
    return `${clean.slice(0, 2)}***********${clean.slice(-2)}`;
  }
  return clean;
};

export const maskMobile = (v?: string | null): string => {
  if (!v) return '';
  const clean = String(v).trim();
  if (clean.length >= 10) {
    return `${clean.slice(0, 2)}******${clean.slice(-2)}`;
  }
  return clean;
};

export const maskEmail = (v?: string | null): string => {
  if (!v) return '';
  const clean = String(v).trim();
  const parts = clean.split('@');
  if (parts.length === 2 && parts[0].length > 2) {
    return `${parts[0][0]}***${parts[0].slice(-1)}@${parts[1]}`;
  }
  return clean;
};
