export const panVerificationService = {
  normalize(pan: string) {
    return pan.trim().toUpperCase();
  }
};
