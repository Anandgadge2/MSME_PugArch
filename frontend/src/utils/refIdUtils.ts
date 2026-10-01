/**
 * Standardized Unique Alphanumeric Reference ID Formatter
 * Enforces the Method-First Scheme across the portal:
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
  // 1. If rawRef already has an authentic canonical prefix, it takes absolute precedence
  if (rawRef && typeof rawRef === 'string') {
    const trimmed = rawRef.trim().toUpperCase();
    if (trimmed.startsWith('LTND-') || trimmed.startsWith('LIM-')) return 'LTND';
    if (trimmed.startsWith('TND-')) return 'TND';
    if (trimmed.startsWith('RFQ-')) return 'RFQ';
    if (trimmed.startsWith('RFP-')) return 'RFP';
    if (trimmed.startsWith('RC-')) return 'RC';
    if (trimmed.startsWith('DP-') || trimmed.startsWith('DIR-')) return 'DP';
    if (trimmed.startsWith('RA-')) return 'RA';
  }

  // 2. Otherwise derive from method token
  if (method) {
    const m = String(method).toUpperCase().replace(/[\s-]+/g, '_');
    if (m.includes('LIMITED_TENDER') || m === 'LTND' || m.includes('LIMITED_RFQ')) return 'LTND';
    if (m.includes('RATE_CONTRACT') || m === 'RC' || m.includes('RATE')) return 'RC';
    if (m.includes('TENDER') || m === 'TND') return 'TND';
    if (m.includes('RFQ') || m.includes('QUOTE') || m.includes('QUOTATION')) return 'RFQ';
    if (m.includes('RFP') || m.includes('PROPOSAL')) return 'RFP';
    if (
      m.includes('DIRECT_PURCHASE') ||
      m.includes('DIRECT') ||
      m === 'DP' ||
      m.includes('CART') ||
      m.includes('CHECKOUT') ||
      m.includes('CATALOG') ||
      m.includes('L1')
    ) return 'DP';
    if (m.includes('AUCTION') || m === 'RA') return 'RA';
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
  if (rawRef && typeof rawRef === 'string') {
    const trimmed = rawRef.trim().toUpperCase();
    // If rawRef is already in full canonical format, return it untouched
    if (/^(RFQ|RFP|TND|LTND|RC|DP|RA)-\d{4}-\d{5}$/i.test(trimmed)) {
      return trimmed;
    }
  }

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

export function formatRequirementNumber(
  id?: number | string | null,
  rawNum?: string | null,
  method?: string | null
): string {
  const pfx = method ? deriveMethodPrefix(method, rawNum, 'RFQ') : 'RFQ';
  return formatRefId(pfx, id, rawNum, method);
}

/**
 * Strips accidental redundant prefixes like BID- or REQ- when followed by a canonical prefix.
 * e.g., "BID-RC-2026-95656" -> "RC-2026-95656"
 *       "BID-TND-2026-86615" -> "TND-2026-86615"
 *       "REQ-RFQ-2026-47428" -> "RFQ-2026-47428"
 */
export function cleanCanonicalRefId(rawToken?: string | null): string {
  if (!rawToken || typeof rawToken !== 'string') return '';
  const trimmed = rawToken.trim();
  // Strip redundant leading BID- or REQ- or ORD- if immediately followed by a canonical prefix
  const cleaned = trimmed.replace(/^(?:BID|REQ|ORD|PRQ)-(?=(?:RC|TND|LTND|RFQ|RFP|RA|DP)-\d{4}-\d+)/i, '')
    .replace(/^(?:BID|REQ|ORD|PRQ)-(?=(?:RC|TND|LTND|RFQ|RFP|RA|DP)-)/i, '');
  return cleaned;
}

/**
 * Extracts a concise, human-friendly geographical summary (City/District, State)
 * to prevent massive legal industrial plant addresses from ballooning dashboard cards.
 */
export function formatLocationSummary(
  location?: string | null,
  district?: string | null,
  state?: string | null,
  city?: string | null
): string {
  const cleanCityOrDistrict = (city || district || '').trim();
  const cleanState = (state || '').trim();

  if (cleanCityOrDistrict && cleanState && cleanCityOrDistrict.toLowerCase() !== cleanState.toLowerCase()) {
    return `${cleanCityOrDistrict}, ${cleanState}`;
  }
  if (cleanCityOrDistrict) return cleanCityOrDistrict;
  if (cleanState) return cleanState;

  if (!location || typeof location !== 'string') return 'All India';

  const raw = location.trim();
  if (raw.length === 0) return 'All India';

  // If the string is already short and clean, use it
  if (raw.length <= 32 && !raw.includes('PLOT') && !raw.includes('KHATA')) {
    return raw;
  }

  // Common pattern in Indian addresses: "..., [City/District], [State] - [Pincode]"
  const pinMatch = raw.match(/,\s*([A-Za-z\s]+),\s*([A-Za-z\s]+)(?:\s*-\s*\d{6})?$/i);
  if (pinMatch) {
    const c = pinMatch[1].trim();
    const s = pinMatch[2].trim();
    if (c.length > 2 && s.length > 2 && !c.toUpperCase().includes('PLOT') && !c.toUpperCase().includes('KHATA')) {
      return `${c}, ${s}`;
    }
  }

  // Alternative pattern: comma-separated segments. Take the last 2 non-empty segments
  const parts = raw.split(',').map(p => p.trim().replace(/-\s*\d{6}$/, '').trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last1 = parts[parts.length - 1];
    const last2 = parts[parts.length - 2];
    if (last1.length <= 25 && last2.length <= 25 && !last2.toUpperCase().includes('ROAD') && !last2.toUpperCase().includes('PLOT') && !last2.toUpperCase().includes('KHATA')) {
      return `${last2}, ${last1}`;
    }
    if (last1.length <= 32 && !last1.toUpperCase().includes('PLOT') && !last1.toUpperCase().includes('KHATA')) {
      return last1;
    }
  }

  // Fallback: truncate cleanly
  return raw.length > 32 ? `${raw.slice(0, 29)}...` : raw;
}


