-- AlterTable PurchaseOrder
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "importSource" TEXT DEFAULT 'NATIVE';
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "erpVendorCode" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "externalSystem" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "extractionMetadata" JSONB;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "claimStatus" TEXT DEFAULT 'CLAIMED';

-- CreateTable BuyerVendorAlias
CREATE TABLE IF NOT EXISTS "BuyerVendorAlias" (
    "id" SERIAL NOT NULL,
    "buyerOrgId" INTEGER NOT NULL,
    "sellerOrgId" INTEGER NOT NULL,
    "erpSystem" TEXT NOT NULL DEFAULT 'SAP',
    "erpVendorCode" TEXT NOT NULL,
    "vendorPlantCode" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuyerVendorAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BuyerVendorAlias_buyerOrgId_erpVendorCode_key" ON "BuyerVendorAlias"("buyerOrgId", "erpVendorCode");
CREATE UNIQUE INDEX IF NOT EXISTS "BuyerVendorAlias_buyerOrgId_sellerOrgId_key" ON "BuyerVendorAlias"("buyerOrgId", "sellerOrgId");
CREATE INDEX IF NOT EXISTS "BuyerVendorAlias_buyerOrgId_idx" ON "BuyerVendorAlias"("buyerOrgId");
CREATE INDEX IF NOT EXISTS "BuyerVendorAlias_erpVendorCode_idx" ON "BuyerVendorAlias"("erpVendorCode");
CREATE INDEX IF NOT EXISTS "BuyerVendorAlias_sellerOrgId_idx" ON "BuyerVendorAlias"("sellerOrgId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BuyerVendorAlias_buyerOrgId_fkey'
  ) THEN
    ALTER TABLE "BuyerVendorAlias" ADD CONSTRAINT "BuyerVendorAlias_buyerOrgId_fkey" FOREIGN KEY ("buyerOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BuyerVendorAlias_sellerOrgId_fkey'
  ) THEN
    ALTER TABLE "BuyerVendorAlias" ADD CONSTRAINT "BuyerVendorAlias_sellerOrgId_fkey" FOREIGN KEY ("sellerOrgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
