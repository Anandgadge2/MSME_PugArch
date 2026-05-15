-- Phase 1 security foundation: add masked/hash aliases and OTP audit records.
-- Raw sensitive columns are retained temporarily for backward compatibility and
-- must not be written or returned by application code.

ALTER TABLE "BuyerProfile" ADD COLUMN IF NOT EXISTS "aadhaarHash" TEXT;
ALTER TABLE "SellerProfile" ADD COLUMN IF NOT EXISTS "aadhaarHash" TEXT;
ALTER TABLE "SellerBankAccount" ADD COLUMN IF NOT EXISTS "accountNumberHash" TEXT;

ALTER TABLE "SellerBankAccount" ALTER COLUMN "accountNumber" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "BuyerProfile_aadhaarHash_key" ON "BuyerProfile"("aadhaarHash");
CREATE UNIQUE INDEX IF NOT EXISTS "SellerProfile_aadhaarHash_key" ON "SellerProfile"("aadhaarHash");
CREATE UNIQUE INDEX IF NOT EXISTS "SellerBankAccount_accountNumberHash_key" ON "SellerBankAccount"("accountNumberHash");

CREATE INDEX IF NOT EXISTS "BuyerProfile_aadhaarHash_idx" ON "BuyerProfile"("aadhaarHash");
CREATE INDEX IF NOT EXISTS "SellerProfile_aadhaarHash_idx" ON "SellerProfile"("aadhaarHash");

CREATE TABLE IF NOT EXISTS "OtpVerification" (
  "id" SERIAL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "identifierHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "OtpVerification_identifierHash_purpose_idx" ON "OtpVerification"("identifierHash", "purpose");
CREATE INDEX IF NOT EXISTS "OtpVerification_expiresAt_idx" ON "OtpVerification"("expiresAt");
