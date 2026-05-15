ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "purchaseRequestId" INTEGER;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "contractId" INTEGER;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL DEFAULT 'Purchase Order';
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "totalValue" DOUBLE PRECISION;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "expectedDelivery" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "deliveryAddress" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "amendmentHistory" JSONB;

UPDATE "PurchaseOrder"
SET "totalValue" = COALESCE("totalValue", "amount"::DOUBLE PRECISION, 0)
WHERE "totalValue" IS NULL;
