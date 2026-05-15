export const bankVerificationService = {
  normalizeIfsc(ifsc: string) {
    return ifsc.trim().toUpperCase();
  }
};
