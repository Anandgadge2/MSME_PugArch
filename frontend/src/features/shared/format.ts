/**
 * Shared formatting helpers used across feature pages.
 *
 * `formatDate` shows just the date, `formatDateTime` shows date + time so
 * audit logs and admin queues display when something happened down to the
 * minute. Both are tolerant of nulls/undefined so callers don't have to
 * defensively check.
 */

const safeDate = (value: unknown): Date | null => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(d.getTime()) ? d : null;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

export const formatDate = (value: unknown): string => {
  const d = safeDate(value);
  if (!d) return '—';
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
};

export const formatTime = (value: unknown): string => {
  const d = safeDate(value);
  if (!d) return '—';
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

export const formatDateTime = (value: unknown): string => {
  const d = safeDate(value);
  if (!d) return '—';
  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${day} ${month} ${year}, ${h}:${m} ${ampm}`;
};

/**
 * Checks whether a given date value has an explicit, non-midnight time component.
 * Returns false for pure calendar dates (YYYY-MM-DD) or UTC midnight zero timestamps.
 */
export const hasExplicitTime = (value: unknown): boolean => {
  if (!value) return false;
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    if (/T00:00:00(\.000)?(Z|[+-]00:00)?$/i.test(s)) return false;
    return s.includes('T') || s.includes(':');
  }
  if (value instanceof Date) {
    return !(
      value.getUTCHours() === 0 &&
      value.getUTCMinutes() === 0 &&
      value.getUTCSeconds() === 0 &&
      value.getUTCMilliseconds() === 0
    );
  }
  return false;
};

/**
 * Formats a date intelligently:
 * - If explicit time exists or forceTime is true: returns `${day} ${month} ${year}, ${h}:${m} ${ampm}`
 * - If pure calendar date: returns `${day} ${month} ${year}` (zero phantom 12:00 AM)
 */
export const formatDisplayDate = (
  value: unknown,
  options?: { forceTime?: boolean }
): string => {
  if (!value) return '—';
  if (options?.forceTime || hasExplicitTime(value)) {
    return formatDateTime(value);
  }
  return formatDate(value);
};

/** Distance from now in friendly form, supports both past and future dates. */
export const formatRelative = (value: unknown): string => {
  const d = safeDate(value);
  if (!d) return '—';
  const diffMs = Date.now() - d.getTime();
  const isFuture = diffMs < 0;
  const sec = Math.abs(Math.round(diffMs / 1000));
  
  if (sec < 60) return isFuture ? 'soon' : 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return isFuture ? `in ${min} min${min === 1 ? '' : 's'}` : `${min} min${min === 1 ? '' : 's'} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return isFuture ? `in ${hr} hr${hr === 1 ? '' : 's'}` : `${hr} hr${hr === 1 ? '' : 's'} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return isFuture ? `${day} day${day === 1 ? '' : 's'} left` : `${day} day${day === 1 ? '' : 's'} ago`;
  return formatDate(d);
};

export const formatCurrency = (value: unknown, currency = 'INR'): string => {
  const num = typeof value === 'string' ? Number(value) : (value as number);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(num);
};

export const formatNumber = (value: unknown): string => {
  const num = typeof value === 'string' ? Number(value) : (value as number);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat('en-IN').format(num);
};

export const maskEmail = (email?: string | null): string => {
  if (!email) return '—';
  const [local = '', domain = ''] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
};

/**
 * Intelligently cleans and extracts concise City, State from full consignee addresses
 * e.g. "Office Delivery Address: Plot No. 888, Satyajyoti Nagar, Panchpada, Town Unit-9, Jharsuguda, Odisha - 768204. Contact: Snehal Kolhe (8835155245)"
 * -> "Jharsuguda, Odisha"
 */
export const formatCleanLocation = (raw?: string | null): string => {
  if (!raw) return '';
  let str = String(raw).trim();
  if (!str || str === '—') return '';

  // Strip prefixes like "Office Delivery Address:", "Delivery Location:", etc.
  str = str.replace(/^(?:Office\s+(?:Delivery\s+)?Address|Delivery\s+Location|Delivery\s+Address|Consignee\s+Location|Address)\s*:\s*/i, '');
  // Strip contact suffixes like "Contact: Snehal Kolhe (8835155245)" or ". Contact: ..."
  str = str.replace(/(?:\.?\s*(?:Contact|Phone|Tel|Mobile)\s*:\s*.*)$/i, '');

  str = str.trim();
  if (!str) return '';

  // If already concise (e.g. "All India", "Pune", "Delhi")
  if (str.length <= 25 && !str.includes(',')) {
    return str;
  }

  // Split by comma
  const segments = str.split(',').map(s => s.trim()).filter(Boolean);

  if (segments.length === 0) return str;
  if (segments.length === 1) {
    // Strip pincode e.g. "Jharsuguda - 768204" -> "Jharsuguda"
    return segments[0].replace(/\s*-\s*\d{6}$/, '').replace(/\s+\d{6}$/, '').trim();
  }

  // Last segment often contains State + Pincode (e.g. "Odisha - 768204" or "Maharashtra")
  const lastSeg = segments[segments.length - 1];
  const secondLastSeg = segments[segments.length - 2];

  // Clean pincode from state
  const cleanState = lastSeg.replace(/\s*-\s*\d{6}$/, '').replace(/\s+\d{6}$/, '').trim();
  // Clean town/city from second to last (strip any plot/unit prefix if mixed)
  const cleanCity = secondLastSeg.replace(/^(?:Town|Unit|Sector|Ward|Phase)\s*[-#0-9]*\s*/i, '').trim() || secondLastSeg;

  // If the last segment looks like a valid state or region, return "City, State"
  if (cleanCity && cleanState && cleanCity.toLowerCase() !== cleanState.toLowerCase()) {
    // Check if cleanCity is not just a building number
    if (!/^(?:Plot|Flat|Shop|Door|Survey|House|Office)\b/i.test(cleanCity)) {
      return `${cleanCity}, ${cleanState}`;
    }
  }

  // Fallback: take last 2 cleaned segments
  const fallback = segments.slice(-2).join(', ').replace(/\s*-\s*\d{6}$/, '').replace(/\s+\d{6}$/, '').trim();
  return fallback.length > 35 ? fallback.slice(0, 32) + '...' : fallback;
};
