-- AlterTable BuyerProfile: drop aadhaarNumber, add mobileFingerprint
ALTER TABLE "BuyerProfile" DROP COLUMN IF EXISTS "aadhaarNumber";
ALTER TABLE "BuyerProfile" ADD COLUMN IF NOT EXISTS "mobileFingerprint" TEXT;
CREATE INDEX IF NOT EXISTS "BuyerProfile_mobileFingerprint_idx" ON "BuyerProfile"("mobileFingerprint");

-- AlterTable SellerProfile: drop aadhaarNumber, add mobileFingerprint
ALTER TABLE "SellerProfile" DROP COLUMN IF EXISTS "aadhaarNumber";
ALTER TABLE "SellerProfile" ADD COLUMN IF NOT EXISTS "mobileFingerprint" TEXT;
CREATE INDEX IF NOT EXISTS "SellerProfile_mobileFingerprint_idx" ON "SellerProfile"("mobileFingerprint");

-- AlterTable User: add mobileFingerprint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mobileFingerprint" TEXT;
CREATE INDEX IF NOT EXISTS "User_mobileFingerprint_idx" ON "User"("mobileFingerprint");

-- AlterTable Organization: add panFingerprint
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "panFingerprint" TEXT;
CREATE INDEX IF NOT EXISTS "Organization_panFingerprint_idx" ON "Organization"("panFingerprint");
