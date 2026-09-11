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
