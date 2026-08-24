-- Add missing SLA status and OTP columns to DeliveryTracking table
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "slaStatus" TEXT DEFAULT 'ON_TIME';
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "lastBuyerReminderSentAt" TIMESTAMP(3);
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "deliveryOtpHash" TEXT;
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "deliveryOtpExpiresAt" TIMESTAMP(3);
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "deliveryOtpVerifiedAt" TIMESTAMP(3);

-- Add index on slaStatus for performance if not exists
CREATE INDEX IF NOT EXISTS "DeliveryTracking_slaStatus_idx" ON "DeliveryTracking"("slaStatus");
