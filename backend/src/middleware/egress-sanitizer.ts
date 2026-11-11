import { maskPAN, maskGST, maskBankAccount, maskAadhaar } from '../utils/maskSensitive.js';
import { isEncrypted, decryptField } from '../utils/crypto.js';
import type { Request, Response, NextFunction } from 'express';

const FORBIDDEN_CREDENTIAL_KEYS = new Set([
  'password', 'passwordHash', 'tempPassword', 'temporaryPassword', 'rawPassword', 'currentPassword'
]);

const WORKFLOW_STATUSES = new Set([
  'approved', 'rejected', 'pending', 'submitted', 'verified', 'incomplete', 'under_review', 'active', 'inactive', 'suspended', 'cancelled'
]);

export interface EgressSanitizerOptions {
  isScrutinyAdmin?: boolean;
  isSelfProfile?: boolean;
}

export function sanitizeEgressPayload(val: any, depth = 0, options: EgressSanitizerOptions = {}): any {
  if (!val || depth > 8 || typeof val !== 'object') return val;
  if (val instanceof Date || Buffer.isBuffer(val)) return val;
  if (val.constructor && (val.constructor.name === 'Decimal' || val._isDecimal === true || typeof val.toFixed === 'function')) {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(item => sanitizeEgressPayload(item, depth + 1, options));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(val)) {
    // 1. Purge credentials completely - NEVER EXPOSE CREDENTIALS UNDER ANY CIRCUMSTANCES
    if (FORBIDDEN_CREDENTIAL_KEYS.has(key)) {
      continue;
    }

    let effectiveVal = value;
    if (typeof effectiveVal === 'string' && isEncrypted(effectiveVal)) {
      try {
        effectiveVal = decryptField(effectiveVal);
      } catch {
        // preserve encrypted text if key missing or invalid
      }
    }

    // 2. Aadhaar statutory masking - NEVER EXPOSE FULL AADHAAR TO ANYONE (UIDAI MANDATE)
    if (/^aadhaar(Number)?$/i.test(key)) {
      result[key] = effectiveVal ? maskAadhaar(effectiveVal) : effectiveVal;
      continue;
    }

    // For authorized admin / master_admin officers performing KYC scrutiny:
    // Retain cleartext PAN, GSTIN, Bank Accounts, Mobile, and Identity names to allow cross-verification against uploaded proofs
    if (options.isScrutinyAdmin || options.isSelfProfile) {
      if (/^(pan|panNumber|gst|gstin|gstNumber|nameAsInPan|panName|dateAsInPan)$/i.test(key) ||
          /(^|_)(phone|mobile|officialPhone|contactPhone)$/i.test(key) ||
          (key !== 'bankAccounts' && /accountNumber|bankAccount|bankAccountNo/i.test(key))) {
        result[key] = effectiveVal;
        continue;
      }
    }

    // 3. Bank Account numbers
    if (key !== 'bankAccounts' && /accountNumber|bankAccount|bankAccountNo/i.test(key)) {
      result[key] = effectiveVal ? maskBankAccount(effectiveVal) : effectiveVal;
      continue;
    }

    // 4. PAN numbers (preserve workflow status flags)
    if (/^(pan|panNumber)$/i.test(key)) {
      if (typeof effectiveVal === 'string' && WORKFLOW_STATUSES.has(effectiveVal.trim().toLowerCase())) {
        result[key] = effectiveVal;
      } else {
        result[key] = effectiveVal ? maskPAN(effectiveVal) : effectiveVal;
      }
      continue;
    }

    // 5. GSTIN (preserve workflow status flags)
    if (/^(gst|gstin|gstNumber)$/i.test(key)) {
      if (typeof effectiveVal === 'string' && WORKFLOW_STATUSES.has(effectiveVal.trim().toLowerCase())) {
        result[key] = effectiveVal;
      } else {
        result[key] = effectiveVal ? maskGST(effectiveVal) : effectiveVal;
      }
      continue;
    }

    // Recurse for nested objects
    result[key] = sanitizeEgressPayload(effectiveVal, depth + 1, options);
  }
  return result;
}

/**
 * Global Outbound HTTP Egress Sanitizer Middleware.
 * Enforces defense-in-depth across all Express JSON responses per STQC GIGW 3.0 & UIDAI regulations.
 * Selectively permits authorized KYC scrutiny officers (admin / master_admin) to inspect unmasked
 * business PAN, GSTIN, and Bank Account records to verify applicant authenticity against physical documents.
 */
export const globalEgressSanitizer = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    if (body && typeof body === 'object') {
      try {
        const user = (req as any).user;
        const role = user?.role;
        const isAdmin = role === 'admin' || role === 'master_admin';
        const rawPath = req.originalUrl || (req.baseUrl ? `${req.baseUrl}${req.path}` : req.path) || '';
        const path = rawPath.toLowerCase();
        const isSelfProfile = path.includes('/auth/me') || path.includes('/onboarding/me');
        const isScrutinyRoute = Boolean(res.locals && res.locals.isScrutinyAdmin) || (isAdmin && (
          path.includes('/admin/onboarding') ||
          path.includes('/master-admin/onboarding') ||
          path.includes('/admin/users') ||
          path.includes('/admin/organizations') ||
          path.includes('/master-admin/users') ||
          path.includes('/master-admin/organizations')
        ));

        const sanitized = sanitizeEgressPayload(body, 0, { isScrutinyAdmin: isScrutinyRoute, isSelfProfile });
        return originalJson(sanitized);
      } catch {
        return originalJson(body);
      }
    }
    return originalJson(body);
  };
  next();
};
