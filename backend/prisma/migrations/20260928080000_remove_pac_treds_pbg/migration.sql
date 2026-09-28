-- Drop InvoiceFactoring table and foreign keys
DROP TABLE IF EXISTS "InvoiceFactoring" CASCADE;

-- Remove PAC columns from ProcurementRequest and ProcurementModeSetting
ALTER TABLE "ProcurementRequest" DROP COLUMN IF EXISTS "pacJustification";
ALTER TABLE "ProcurementModeSetting" DROP COLUMN IF EXISTS "pacApprovalRequired";
