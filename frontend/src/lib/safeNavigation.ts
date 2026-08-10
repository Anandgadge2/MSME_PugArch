/**
 * Accept only same-origin application paths. This blocks protocol-relative,
 * backslash, control-character, and absolute-URL redirect payloads.
 */
export const safeInternalPath = (value: string | null | undefined, fallback = '/dashboard') => {
  if (!value) return fallback;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }

  if (
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(decoded)
  ) {
    return fallback;
  }

  return decoded;
};
