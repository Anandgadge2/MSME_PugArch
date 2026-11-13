export const formatGstVerificationError = (error: any) => {
  const code = String(error?.code || error?.errorCode || '').toUpperCase();
  const message = String(error?.message || '');
  const instruction = String(error?.instruction || '');
  const combined = [message, instruction].filter(Boolean).join(' ');

  if (code === 'GST_ALREADY_REGISTERED' || /already registered/i.test(combined)) {
    return 'This GSTIN is already registered with another account.';
  }
  if (code === 'INVALID_GSTIN_CHECKSUM' || /checksum/i.test(combined)) {
    return 'Invalid GSTIN checksum. Please re-check the last character from your GST certificate.';
  }
  if (code === 'INVALID_GSTIN' || /invalid gstin|invalid gst number/i.test(combined)) {
    return 'Please enter a valid 15-character GSTIN.';
  }
  if (
    code === 'GST_PROVIDER_ERROR' ||
    code === 'GST_PROVIDER_UNREACHABLE' ||
    code === 'GST_NOT_CONFIGURED' ||
    code === 'GST_CONTACT_NOT_CONFIGURED' ||
    /api setu returned status|provider is unreachable|service is not configured/i.test(combined)
  ) {
    return 'GST verification provider is not responding right now. You can try again after a few minutes.';
  }

  return combined || 'Could not verify GSTIN. Please re-check the number or try again later.';
};

export const isGstProviderUnavailable = (error: any) => {
  const code = String(error?.code || error?.errorCode || '').toUpperCase();
  const message = String(error?.message || '');
  const instruction = String(error?.instruction || '');
  const combined = [message, instruction].filter(Boolean).join(' ');

  return (
    code === 'GST_PROVIDER_ERROR' ||
    code === 'GST_PROVIDER_UNREACHABLE' ||
    code === 'GST_NOT_CONFIGURED' ||
    code === 'GST_CONTACT_NOT_CONFIGURED' ||
    /api setu returned status|provider is unreachable|service is not configured/i.test(combined)
  );
};

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const GSTIN_CHECKSUM_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const hasValidGstinChecksum = (value: unknown): boolean => {
  const gstin = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!GSTIN_REGEX.test(gstin)) return false;

  let factor = 2;
  let sum = 0;
  for (let index = 13; index >= 0; index -= 1) {
    const codePoint = GSTIN_CHECKSUM_CHARS.indexOf(gstin[index]);
    const product = codePoint * factor;
    sum += Math.floor(product / 36) + (product % 36);
    factor = factor === 2 ? 1 : 2;
  }

  const checksumIndex = (36 - (sum % 36)) % 36;
  return GSTIN_CHECKSUM_CHARS[checksumIndex] === gstin[14];
};

export const getExpectedGstinChecksum = (value: unknown): string => {
  const gstin = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (gstin.length < 14) return '';

  let factor = 2;
  let sum = 0;
  for (let index = 13; index >= 0; index -= 1) {
    const codePoint = GSTIN_CHECKSUM_CHARS.indexOf(gstin[index]);
    if (codePoint === -1) return '';
    const product = codePoint * factor;
    sum += Math.floor(product / 36) + (product % 36);
    factor = factor === 2 ? 1 : 2;
  }

  const checksumIndex = (36 - (sum % 36)) % 36;
  return GSTIN_CHECKSUM_CHARS[checksumIndex] || '';
};
