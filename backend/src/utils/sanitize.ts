export const normalizeSpaces = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

export const stripControlCharacters = (value: string, preserveNewlines = true) =>
  preserveNewlines
    ? value.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
    : value.replace(/[\u0000-\u001F\u007F]/g, '');

