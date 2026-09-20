/**
 * Standardized Unique Alphanumeric Reference ID Helper for Backend
 * Enforces the Method-First Scheme across services and routes:
 * Format: ${METHOD_PREFIX}-${YEAR}-${SEQUENCE}
 * Strictly supported canonical prefixes: RFQ, RFP, TND, LTND, RC, DP, RA.
 * (e.g. RFP-2026-39620, RFQ-2026-78901, TND-2026-47138, LTND-2026-10492, RC-2026-68496, DP-2026-71536, RA-2026-55102).
 */

export const CANONICAL_METHOD_PREFIXES = ['RFQ', 'RFP', 'TND', 'LTND', 'RC', 'DP', 'RA'] as const;
export type CanonicalMethodPrefix = typeof CANONICAL_METHOD_PREFIXES[number];

/**
 * Returns strictly canonical prefix variations for a given raw token.
 * E.g., for "TND-2026-39952" -> ["TND-2026-39952", "RFQ-2026-39952", "RFP-2026-39952", ...]
 * Never includes legacy/disallowed prefixes like REQ, BID, OT, PRQ, PR, PB, TENDER.
 */
export function getCanonicalLookupVariants(rawToken: string): string[] {
  const token = String(rawToken || '').trim();
  if (!token) return [];

  const variants = new Set<string>([token]);
  const prefixMatch = token.match(/^([A-Z]{2,6})-(.+)$/i);
  if (prefixMatch) {
    const strippedSuffix = prefixMatch[2];
    for (const pfx of CANONICAL_METHOD_PREFIXES) {
      variants.add(`${pfx}-${strippedSuffix}`);
    }
  }
  return Array.from(variants);
}

export function deriveMethodPrefix(method?: string | null, rawRef?: string | null, fallback = 'RFQ'): string {
  if (method) {
    const m = String(method).toUpperCase().replace(/[\s-]+/g, '_');
    if (m.includes('LIMITED_TENDER') || m === 'LTND' || m.includes('LIMITED_RFQ')) return 'LTND';
    if (m.includes('TENDER') || m === 'TND') return 'TND';
    if (m.includes('RFQ') || m.includes('QUOTE') || m.includes('QUOTATION')) return 'RFQ';
    if (m.includes('RFP') || m.includes('PROPOSAL')) return 'RFP';
    if (m.includes('RATE_CONTRACT') || m === 'RC') return 'RC';
    if (
      m.includes('DIRECT_PURCHASE') ||
      m.includes('DIRECT') ||
      m === 'DP' ||
      m.includes('CART') ||
      m.includes('CHECKOUT') ||
      m.includes('CATALOG') ||
      m.includes('PAC') ||
      m.includes('L1')
    ) return 'DP';
    if (m.includes('AUCTION') || m === 'RA') return 'RA';
  }

  if (rawRef && typeof rawRef === 'string') {
    const trimmed = rawRef.trim().toUpperCase();
    if (trimmed.startsWith('LTND-')) return 'LTND';
    if (trimmed.startsWith('TND-')) return 'TND';
    if (trimmed.startsWith('RFQ-')) return 'RFQ';
    if (trimmed.startsWith('RFP-')) return 'RFP';
    if (trimmed.startsWith('RC-')) return 'RC';
    if (trimmed.startsWith('DP-')) return 'DP';
    if (trimmed.startsWith('RA-')) return 'RA';
  }

  const fb = (fallback || 'RFQ').toUpperCase();
  if (CANONICAL_METHOD_PREFIXES.includes(fb as any)) return fb;
  return 'RFQ';
}

export function formatRefId(
  prefix: string,
  id?: number | string | null,
  rawRef?: string | null,
  method?: string | null,
  year?: number | string | null
): string {
  const p = deriveMethodPrefix(method, rawRef, prefix);
  const defaultYear = year ? String(year) : '2026';

  let extractedSeq: string | null = null;
  let extractedYear: string | null = null;

  if (rawRef && typeof rawRef === 'string') {
    const trimmed = rawRef.trim();

    // Pattern 1: Already has year and sequence: PREFIX-YYYY-XXXXX (e.g. RFP-2026-00054, RFQ-2026-39620)
    const matchFull = trimmed.match(/^[A-Z]{2,5}-(\d{4})-(\d+)$/i);
    if (matchFull) {
      extractedYear = matchFull[1];
      extractedSeq = matchFull[2].padStart(5, '0');
    } else {
      // Pattern 2: PREFIX-XXXXX (e.g. DP-97090, RFP-54)
      const matchShort = trimmed.match(/^[A-Z]{2,5}-(\d+)$/i);
      if (matchShort) {
        const rawDigits = matchShort[1];
        // If timestamp format like RC-1786170101620, take last 5 digits
        extractedSeq = rawDigits.length > 5 ? rawDigits.slice(-5) : rawDigits.padStart(5, '0');
      }
    }
  }

  // If no sequence extracted from rawRef, use numeric id
  if (!extractedSeq && id != null && !isNaN(Number(id))) {
    const cleanId = Math.abs(Number(id));
    if (cleanId > 0) {
      extractedSeq = String(cleanId).padStart(5, '0');
    }
  }

  const finalSeq = extractedSeq || '00001';
  const finalYear = extractedYear || defaultYear;

  return `${p}-${finalYear}-${finalSeq}`;
}

export const formatRequirementNumber = (
  id?: number | string | null,
  rawRef?: string | null,
  method?: string | null,
  year?: number | string | null
): string => {
  return formatRefId('RFQ', id, rawRef, method, year);
};

export const CANONICAL_REF_REGEX = /^[A-Z]{2,5}-\d{4}-\d{5}$/;

/**
 * Validates whether a given token matches the strict canonical pattern:
 * [METHOD]-[YEAR]-[5-DIGIT-SEQUENCE] (e.g. RFQ-2026-00049, TND-2026-00084)
 */
export function isValidCanonicalRef(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  return CANONICAL_REF_REGEX.test(token.trim());
}

/**
 * Parses and normalizes a token to canonical format if possible,
 * or returns null if it cannot be parsed.
 */
export function normalizeToCanonicalRef(token: string, defaultMethod = 'RFQ'): string | null {
  if (!token || typeof token !== 'string') return null;
  const trimmed = token.trim().toUpperCase();
  if (CANONICAL_REF_REGEX.test(trimmed)) return trimmed;

  const match = trimmed.match(/^([A-Z]{2,5})-(\d{4})-(\d+)$/);
  if (match) {
    const pfx = deriveMethodPrefix(match[1], null, defaultMethod);
    const year = match[2];
    const seq = match[3].padStart(5, '0');
    return `${pfx}-${year}-${seq}`;
  }

  const matchShort = trimmed.match(/^([A-Z]{2,5})-(\d+)$/);
  if (matchShort) {
    const pfx = deriveMethodPrefix(matchShort[1], null, defaultMethod);
    const year = new Date().getFullYear();
    const seq = matchShort[2].padStart(5, '0');
    return `${pfx}-${year}-${seq}`;
  }

  return null;
}


