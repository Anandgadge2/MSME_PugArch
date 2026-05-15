export const validators = {
  pan(value: string) {
    return /^[A-Z]{5}\d{4}[A-Z]$/.test(value.trim().toUpperCase());
  },
  gstin(value: string) {
    return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value.trim().toUpperCase());
  },
  indianMobile(value: string) {
    return /^[6-9]\d{9}$/.test(value.trim());
  }
};
