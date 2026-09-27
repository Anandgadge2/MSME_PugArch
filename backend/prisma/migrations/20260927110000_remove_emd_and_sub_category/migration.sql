-- Drop ForeignKey & Column for Category parent-child subcategories
ALTER TABLE Category DROP CONSTRAINT IF EXISTS Category_parentId_fkey;
DROP INDEX IF EXISTS Category_parentId_idx;
ALTER TABLE Category DROP COLUMN IF EXISTS parentId;

-- AlterTable: Remove EMD fields from ProcurementBid
ALTER TABLE ProcurementBid DROP COLUMN IF EXISTS isEmdRequired;
ALTER TABLE ProcurementBid DROP COLUMN IF EXISTS emdAmount;

-- DropTable: Remove EmdPayment table
DROP TABLE IF EXISTS EmdPayment CASCADE;
