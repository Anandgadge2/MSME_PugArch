/**
 * Date and Timezone utility functions for MSME Portal (India).
 * Ensures all local dates/times submitted without explicit timezone offset
 * are correctly interpreted in Indian Standard Time (IST, UTC+05:30).
 */

export function parseDateIST(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return Number.isFinite(val.getTime()) ? val : null;
  if (typeof val !== 'string') {
    const d = new Date(val as any);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const s = val.trim();
  if (!s) return null;

  // If already contains timezone offset (Z, +HH:MM, or -HH:MM), parse directly
  if (/Z|[+-]\d{2}(:?\d{2})?$/i.test(s)) {
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  // Pure calendar date: YYYY-MM-DD -> Start of day in IST (00:00:00+05:30)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00+05:30`);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  // Datetime without timezone: YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss(.sss)
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(s)) {
    const normalized = s.includes(' ') ? s.replace(' ', 'T') : s;
    const parts = normalized.split('T');
    const timeParts = parts[1].split(':');
    const sec = timeParts[2] ? (timeParts[2].includes('.') ? timeParts[2] : `${timeParts[2]}.000`) : '00.000';
    const isoWithIST = `${parts[0]}T${timeParts[0].padStart(2, '0')}:${timeParts[1].padStart(2, '0')}:${sec}+05:30`;
    const d = new Date(isoWithIST);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  const fallback = new Date(s);
  return Number.isFinite(fallback.getTime()) ? fallback : null;
}
