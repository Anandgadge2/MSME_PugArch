export const normalizeSpaces = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

export const stripControlCharacters = (value: string, preserveNewlines = true) => {
  if (!value || typeof value !== 'string') return '';
  // Strip null bytes, bidirectional overrides, and non-printable control characters
  const pattern = preserveNewlines
    ? /[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200D\uFEFF]/g
    : /[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g;
  return value.replace(pattern, '');
};

export const escapeHtml = (str: string): string => {
  if (!str || typeof str !== 'string') return '';
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  return str.replace(/[&<>"'`]/g, match => htmlEscapes[match] || match);
};

export const sanitizeUrlProtocol = (urlStr: string): string => {
  if (!urlStr || typeof urlStr !== 'string') return '';
  const trimmed = urlStr.trim();
  // Disallow javascript:, data:text/html, vbscript:
  if (/^(javascript|data\s*:\s*text\/html|vbscript):/i.test(trimmed)) {
    return 'about:blank';
  }
  return trimmed;
};

