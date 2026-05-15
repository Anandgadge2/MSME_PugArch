UPDATE "PurchaseOrder"
SET "title" = COALESCE(NULLIF(TRIM("title"), ''), 'Purchase Order')
WHERE "title" IS NULL OR TRIM("title") = '';

UPDATE "PurchaseOrder"
SET "totalValue" = COALESCE("totalValue", "amount"::DOUBLE PRECISION, 0)
WHERE "totalValue" IS NULL;

ALTER TABLE "PurchaseOrder" ALTER COLUMN "title" SET NOT NULL;
ALTER TABLE "PurchaseOrder" ALTER COLUMN "totalValue" SET NOT NULL;
