-- Add missing Category.imageUrl
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- Create PlatformFeature table if not exists
CREATE TABLE IF NOT EXISTS "PlatformFeature" (
    "featureId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlatformFeature_pkey" PRIMARY KEY ("featureId")
);
CREATE INDEX IF NOT EXISTS "PlatformFeature_enabled_idx" ON "PlatformFeature"("enabled");
CREATE INDEX IF NOT EXISTS "PlatformFeature_updatedById_idx" ON "PlatformFeature"("updatedById");

-- Create DeliveryDpExtension table if not exists
CREATE TABLE IF NOT EXISTS "DeliveryDpExtension" (
    "id" SERIAL NOT NULL,
    "deliveryTrackingId" INTEGER NOT NULL,
    "purchaseOrderId" INTEGER NOT NULL,
    "requestedDeliveryDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "waiveLd" BOOLEAN NOT NULL DEFAULT false,
    "approvedDeliveryDate" TIMESTAMP(3),
    "responseRemarks" TEXT,
    "requestedById" INTEGER NOT NULL,
    "respondedById" INTEGER,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeliveryDpExtension_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DeliveryDpExtension_deliveryTrackingId_idx" ON "DeliveryDpExtension"("deliveryTrackingId");
CREATE INDEX IF NOT EXISTS "DeliveryDpExtension_purchaseOrderId_idx" ON "DeliveryDpExtension"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "DeliveryDpExtension_status_idx" ON "DeliveryDpExtension"("status");

-- Create EmdPayment table if not exists
CREATE TABLE IF NOT EXISTS "EmdPayment" (
    "id" SERIAL NOT NULL,
    "requirementId" INTEGER,
    "bidId" INTEGER,
    "sellerId" INTEGER NOT NULL,
    "sellerOrgId" INTEGER,
    "amount" DECIMAL(18,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'ONLINE',
    "transactionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "refundPolicy" TEXT,
    "instructions" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmdPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmdPayment_transactionId_key" ON "EmdPayment"("transactionId");
CREATE INDEX IF NOT EXISTS "EmdPayment_sellerId_idx" ON "EmdPayment"("sellerId");
CREATE INDEX IF NOT EXISTS "EmdPayment_requirementId_idx" ON "EmdPayment"("requirementId");
CREATE INDEX IF NOT EXISTS "EmdPayment_bidId_idx" ON "EmdPayment"("bidId");
CREATE INDEX IF NOT EXISTS "EmdPayment_status_idx" ON "EmdPayment"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "EmdPayment_sellerId_requirementId_key" ON "EmdPayment"("sellerId", "requirementId");
CREATE UNIQUE INDEX IF NOT EXISTS "EmdPayment_sellerId_bidId_key" ON "EmdPayment"("sellerId", "bidId");
