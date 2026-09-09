/**
 * Standardized Unique Alphanumeric Reference ID Helper for Backend
 * Enforces the Method-First Scheme across services and routes:
 * Format: ${METHOD_PREFIX}-${YEAR}-${SEQUENCE}
 * (e.g. RFP-2026-39620, RFQ-2026-78901, TND-2026-47138, LTND-2026-10492, RC-2026-68496, DP-2026-71536, RA-2026-55102).
 */

export function deriveMethodPrefix(method?: string | null, rawRef?: string | null, fallback = 'REQ'): string {
  if (method) {
    const m = String(method).toUpperCase().replace(/[\s-]+/g, '_');
    if (m.includes('LIMITED_TENDER') || m === 'LTND' || m.includes('LIMITED_RFQ')) return 'LTND';
    if (m.includes('TENDER') || m === 'OT' || m === 'OPEN_TENDER') return 'TND';
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
    if (trimmed.startsWith('TND-') || trimmed.startsWith('OT-')) return 'TND';
    if (trimmed.startsWith('RFQ-')) return 'RFQ';
    if (trimmed.startsWith('RFP-')) return 'RFP';
    if (trimmed.startsWith('RC-')) return 'RC';
    if (trimmed.startsWith('DP-') || trimmed.startsWith('PRQ-') || trimmed.startsWith('PR-')) return 'DP';
    if (trimmed.startsWith('RA-')) return 'RA';
  }

  const fb = (fallback || 'REQ').toUpperCase();
  if (fb === 'PRQ' || fb === 'PR') return 'DP';
  return fb;
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

    // Pattern 1: Already has year and sequence: PREFIX-YYYY-XXXXX (e.g. RFP-2026-00054, REQ-2026-39620)
    const matchFull = trimmed.match(/^[A-Z]{2,5}-(\d{4})-(\d+)$/i);
    if (matchFull) {
      extractedYear = matchFull[1];
      extractedSeq = matchFull[2].padStart(5, '0');
    } else {
      // Pattern 2: PREFIX-XXXXX (e.g. REQ-39620, PRQ-71536, DP-97090, RFP-54)
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
  return formatRefId('REQ', id, rawNum, method);
}
