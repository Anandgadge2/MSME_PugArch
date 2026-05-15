export const normalizeSpaces = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

export const stripControlCharacters = (value: string) => value.replace(/[\u0000-\u001F\u007F]/g, '');
