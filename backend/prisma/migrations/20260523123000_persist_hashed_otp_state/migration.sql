-- Persist hashed OTP state so email verification survives stateless/serverless
-- backend instances. Plain OTP values are never stored.

ALTER TABLE "OtpVerification" ADD COLUMN IF NOT EXISTS "otpHash" TEXT;
ALTER TABLE "OtpVerification" ADD COLUMN IF NOT EXISTS "otpHashes" JSONB;
ALTER TABLE "OtpVerification" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
