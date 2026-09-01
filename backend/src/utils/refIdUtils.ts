/**
 * Standardized Unique Alphanumeric Reference ID Helper for Backend
 * Ensures all entity reference numbers follow consistent, unique alphanumeric formats across services and routes.
 * (e.g. REQ-2026-00007, RFQ-2026-00006, TND-2026-00007, RC-2026-00006).
 */

export function formatRefId(
  prefix: string,
  id?: number | string | null,
  rawRef?: string | null,
  method?: string | null
): string {
  let p = (prefix || 'REQ').toUpperCase();

  if (method) {
    const m = String(method).toUpperCase().replace(/\s+/g, '_');
    if (m.includes('TENDER')) p = 'TND';
    else if (m === 'RFQ' || m.includes('QUOTE')) p = 'RFQ';
    else if (m === 'RFP' || m.includes('PROPOSAL')) p = 'RFP';
    else if (m === 'RATE_CONTRACT' || m === 'RC') p = 'RC';
    else if (m === 'DIRECT_PURCHASE' || m === 'DP') p = 'DP';
    else if (m === 'REVERSE_AUCTION' || m === 'RA') p = 'RA';
  } else if (rawRef && typeof rawRef === 'string') {
    const trimmed = rawRef.trim().toUpperCase();
    if (trimmed.startsWith('RFQ-')) p = 'RFQ';
    else if (trimmed.startsWith('TND-') || trimmed.startsWith('OT-')) p = 'TND';
    else if (trimmed.startsWith('RFP-')) p = 'RFP';
    else if (trimmed.startsWith('RC-')) p = 'RC';
    else if (trimmed.startsWith('DP-')) p = 'DP';
    else if (trimmed.startsWith('RA-')) p = 'RA';
  }

  const cleanId = id != null && !isNaN(Number(id)) ? Math.abs(Number(id)) : null;

  if (rawRef && typeof rawRef === 'string') {
    const trimmed = rawRef.trim();

    if (/^[A-Z]{2,4}-20\d{2}-\d{5}$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }

    // If rawRef is in 5-digit format like REQ-86638 or RC-86638, preserve it
    if (/^[A-Z]{2,4}-\d{5}$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }

    // If rawRef is in long timestamp format like RC-1786170101620, normalize it to 5 digits (RC-01620)
    if (/^[A-Z]{2,4}-\d{10,}$/i.test(trimmed)) {
      const match = trimmed.match(/^([A-Z]{2,4})-(\d+)$/i);
      if (match) {
        return `${match[1].toUpperCase()}-${match[2].slice(-5)}`;
      }
    }
  }

  if (cleanId !== null && cleanId > 0) {
    return `${p}-${String(cleanId).padStart(5, '0')}`;
  }

  return `${p}-00001`;
}

export function formatRequirementNumber(
  id?: number | string | null,
  rawNum?: string | null,
  method?: string | null
): string {
  return formatRefId('REQ', id, rawNum, method);
}
