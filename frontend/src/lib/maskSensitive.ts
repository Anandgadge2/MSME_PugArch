export const maskSensitive = (value: string | number | null | undefined, visibleSuffix = 4) => {
  const text = String(value ?? '');
  if (!text) return '';
  if (text.length <= visibleSuffix) return '*'.repeat(text.length);
  return `${'*'.repeat(text.length - visibleSuffix)}${text.slice(-visibleSuffix)}`;
};
