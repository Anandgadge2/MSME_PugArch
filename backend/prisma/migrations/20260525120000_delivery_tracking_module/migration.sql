-- Delivery Tracking Module: extend DeliveryStatus, add DeliveryTracking columns,
-- and add DeliveryStatusLog, DeliveryDocument, DeliveryParticipant, BuyerAcceptance,
-- PaymentSettlement, LogisticsPartner. All operations are guarded with IF NOT EXISTS
-- to keep this migration idempotent and safe to re-run.

-- 1. Add new DeliveryStatus enum values (PG 12+ supports IF NOT EXISTS)
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'SELLER_ACCEPTED';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'SELLER_REJECTED';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'PACKED';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_PICKUP';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'PICKUP_SCHEDULED';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'PICKED_UP';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'AT_HUB';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'DELIVERY_CONFIRMATION_PENDING';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'RETURN_INITIATED';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'REPLACEMENT_REQUESTED';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'DISPUTE_RAISED';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'DISPUTE_RESOLVED';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'INVOICE_VERIFIED';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_APPROVED';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_RELEASED';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'REATTEMPT_SCHEDULED';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'DELIVERY_FAILED';

-- 2. New enums (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryParticipantRole') THEN
    CREATE TYPE "DeliveryParticipantRole" AS ENUM ('CONSIGNEE','LOGISTICS_PARTNER','FINANCE_OFFICER','DISPUTE_OFFICER');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeliveryDocumentType') THEN
    CREATE TYPE "DeliveryDocumentType" AS ENUM (
      'PURCHASE_ORDER','TAX_INVOICE','DELIVERY_CHALLAN','PACKING_SLIP','COURIER_RECEIPT',
      'EWAY_BILL','PROOF_OF_DISPATCH','PROOF_OF_DELIVERY','INSPECTION_REPORT','REJECTION_REPORT',
      'RETURN_DOCUMENT','PAYMENT_PROOF','OTHER'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentSettlementStatus') THEN
    CREATE TYPE "PaymentSettlementStatus" AS ENUM (
      'PENDING','INVOICE_VERIFIED','APPROVED','REJECTED','RELEASED','ON_HOLD'
    );
  END IF;
END$$;

-- 3. Extend DeliveryTracking with seller dispatch + logistics + audit columns
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "sellerAcceptedAt" TIMESTAMP(3);
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "sellerRejectedAt" TIMESTAMP(3);
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "sellerRejectReason" TEXT;
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "packedAt" TIMESTAMP(3);
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "pickupScheduledAt" TIMESTAMP(3);
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "pickedUpAt" TIMESTAMP(3);
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "packageWeightKg" DECIMAL(10,3);
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "packageDimensions" TEXT;
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "packageCount" INTEGER;
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "logisticsPartnerId" INTEGER;
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "logisticsPartnerName" TEXT;
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "logisticsContact" TEXT;
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "ewayBillNumber" TEXT;
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "courierReceiptNumber" TEXT;
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "remarks" TEXT;
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "DeliveryTracking" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

-- 4. LogisticsPartner table
CREATE TABLE IF NOT EXISTS "LogisticsPartner" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "contactName" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "trackingUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LogisticsPartner_code_key" ON "LogisticsPartner"("code");
CREATE INDEX IF NOT EXISTS "LogisticsPartner_isActive_idx" ON "LogisticsPartner"("isActive");

-- 5. DeliveryStatusLog table
CREATE TABLE IF NOT EXISTS "DeliveryStatusLog" (
  "id" SERIAL PRIMARY KEY,
  "deliveryTrackingId" INTEGER NOT NULL,
  "previousStatus" "DeliveryStatus",
  "newStatus" "DeliveryStatus" NOT NULL,
  "changedById" INTEGER,
  "actorRole" TEXT,
  "remarks" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "fileAssetId" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "DeliveryStatusLog_deliveryTrackingId_idx" ON "DeliveryStatusLog"("deliveryTrackingId");
CREATE INDEX IF NOT EXISTS "DeliveryStatusLog_changedById_idx" ON "DeliveryStatusLog"("changedById");
CREATE INDEX IF NOT EXISTS "DeliveryStatusLog_newStatus_idx" ON "DeliveryStatusLog"("newStatus");
CREATE INDEX IF NOT EXISTS "DeliveryStatusLog_createdAt_idx" ON "DeliveryStatusLog"("createdAt");

-- 6. DeliveryDocument table
CREATE TABLE IF NOT EXISTS "DeliveryDocument" (
  "id" SERIAL PRIMARY KEY,
  "deliveryTrackingId" INTEGER NOT NULL,
  "fileAssetId" INTEGER NOT NULL,
  "documentType" "DeliveryDocumentType" NOT NULL,
  "uploadedById" INTEGER NOT NULL,
  "uploaderRole" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "DeliveryDocument_deliveryTrackingId_idx" ON "DeliveryDocument"("deliveryTrackingId");
CREATE INDEX IF NOT EXISTS "DeliveryDocument_fileAssetId_idx" ON "DeliveryDocument"("fileAssetId");
CREATE INDEX IF NOT EXISTS "DeliveryDocument_documentType_idx" ON "DeliveryDocument"("documentType");
CREATE INDEX IF NOT EXISTS "DeliveryDocument_uploadedById_idx" ON "DeliveryDocument"("uploadedById");

-- 7. DeliveryParticipant table
CREATE TABLE IF NOT EXISTS "DeliveryParticipant" (
  "id" SERIAL PRIMARY KEY,
  "deliveryTrackingId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "participantRole" "DeliveryParticipantRole" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "assignedById" INTEGER,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "notes" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryParticipant_deliveryTrackingId_userId_role_key"
  ON "DeliveryParticipant"("deliveryTrackingId","userId","participantRole");
CREATE INDEX IF NOT EXISTS "DeliveryParticipant_userId_idx" ON "DeliveryParticipant"("userId");
CREATE INDEX IF NOT EXISTS "DeliveryParticipant_participantRole_idx" ON "DeliveryParticipant"("participantRole");

-- 8. BuyerAcceptance table
CREATE TABLE IF NOT EXISTS "BuyerAcceptance" (
  "id" SERIAL PRIMARY KEY,
  "deliveryTrackingId" INTEGER NOT NULL UNIQUE,
  "acceptedById" INTEGER,
  "accepted" BOOLEAN NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "inspectionStatus" TEXT,
  "damageNotes" TEXT,
  "missingQuantity" DECIMAL(18,3),
  "remarks" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "BuyerAcceptance_acceptedById_idx" ON "BuyerAcceptance"("acceptedById");
CREATE INDEX IF NOT EXISTS "BuyerAcceptance_accepted_idx" ON "BuyerAcceptance"("accepted");

-- 9. PaymentSettlement table
CREATE TABLE IF NOT EXISTS "PaymentSettlement" (
  "id" SERIAL PRIMARY KEY,
  "deliveryTrackingId" INTEGER NOT NULL UNIQUE,
  "invoiceId" INTEGER,
  "paymentTransactionId" INTEGER,
  "status" "PaymentSettlementStatus" NOT NULL DEFAULT 'PENDING',
  "invoiceVerifiedAt" TIMESTAMP(3),
  "invoiceVerifiedById" INTEGER,
  "approvedAt" TIMESTAMP(3),
  "approvedById" INTEGER,
  "releasedAt" TIMESTAMP(3),
  "releasedById" INTEGER,
  "rejectedAt" TIMESTAMP(3),
  "rejectedById" INTEGER,
  "rejectionReason" TEXT,
  "deductionAmount" DECIMAL(18,2),
  "penaltyAmount" DECIMAL(18,2),
  "netReleasedAmount" DECIMAL(18,2),
  "transactionReference" TEXT,
  "remarks" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PaymentSettlement_status_idx" ON "PaymentSettlement"("status");
CREATE INDEX IF NOT EXISTS "PaymentSettlement_invoiceId_idx" ON "PaymentSettlement"("invoiceId");
CREATE INDEX IF NOT EXISTS "PaymentSettlement_paymentTransactionId_idx" ON "PaymentSettlement"("paymentTransactionId");

-- 10. Foreign keys (idempotent, only add if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryTracking_logisticsPartnerId_fkey') THEN
    ALTER TABLE "DeliveryTracking"
      ADD CONSTRAINT "DeliveryTracking_logisticsPartnerId_fkey"
      FOREIGN KEY ("logisticsPartnerId") REFERENCES "LogisticsPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
CREATE INDEX IF NOT EXISTS "DeliveryTracking_logisticsPartnerId_idx" ON "DeliveryTracking"("logisticsPartnerId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryStatusLog_deliveryTrackingId_fkey') THEN
    ALTER TABLE "DeliveryStatusLog"
      ADD CONSTRAINT "DeliveryStatusLog_deliveryTrackingId_fkey"
      FOREIGN KEY ("deliveryTrackingId") REFERENCES "DeliveryTracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryStatusLog_changedById_fkey') THEN
    ALTER TABLE "DeliveryStatusLog"
      ADD CONSTRAINT "DeliveryStatusLog_changedById_fkey"
      FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryStatusLog_fileAssetId_fkey') THEN
    ALTER TABLE "DeliveryStatusLog"
      ADD CONSTRAINT "DeliveryStatusLog_fileAssetId_fkey"
      FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryDocument_deliveryTrackingId_fkey') THEN
    ALTER TABLE "DeliveryDocument"
      ADD CONSTRAINT "DeliveryDocument_deliveryTrackingId_fkey"
      FOREIGN KEY ("deliveryTrackingId") REFERENCES "DeliveryTracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryDocument_fileAssetId_fkey') THEN
    ALTER TABLE "DeliveryDocument"
      ADD CONSTRAINT "DeliveryDocument_fileAssetId_fkey"
      FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryDocument_uploadedById_fkey') THEN
    ALTER TABLE "DeliveryDocument"
      ADD CONSTRAINT "DeliveryDocument_uploadedById_fkey"
      FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryParticipant_deliveryTrackingId_fkey') THEN
    ALTER TABLE "DeliveryParticipant"
      ADD CONSTRAINT "DeliveryParticipant_deliveryTrackingId_fkey"
      FOREIGN KEY ("deliveryTrackingId") REFERENCES "DeliveryTracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryParticipant_userId_fkey') THEN
    ALTER TABLE "DeliveryParticipant"
      ADD CONSTRAINT "DeliveryParticipant_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryParticipant_assignedById_fkey') THEN
    ALTER TABLE "DeliveryParticipant"
      ADD CONSTRAINT "DeliveryParticipant_assignedById_fkey"
      FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuyerAcceptance_deliveryTrackingId_fkey') THEN
    ALTER TABLE "BuyerAcceptance"
      ADD CONSTRAINT "BuyerAcceptance_deliveryTrackingId_fkey"
      FOREIGN KEY ("deliveryTrackingId") REFERENCES "DeliveryTracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuyerAcceptance_acceptedById_fkey') THEN
    ALTER TABLE "BuyerAcceptance"
      ADD CONSTRAINT "BuyerAcceptance_acceptedById_fkey"
      FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentSettlement_deliveryTrackingId_fkey') THEN
    ALTER TABLE "PaymentSettlement"
      ADD CONSTRAINT "PaymentSettlement_deliveryTrackingId_fkey"
      FOREIGN KEY ("deliveryTrackingId") REFERENCES "DeliveryTracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentSettlement_invoiceId_fkey') THEN
    ALTER TABLE "PaymentSettlement"
      ADD CONSTRAINT "PaymentSettlement_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentSettlement_paymentTransactionId_fkey') THEN
    ALTER TABLE "PaymentSettlement"
      ADD CONSTRAINT "PaymentSettlement_paymentTransactionId_fkey"
      FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentSettlement_invoiceVerifiedById_fkey') THEN
    ALTER TABLE "PaymentSettlement"
      ADD CONSTRAINT "PaymentSettlement_invoiceVerifiedById_fkey"
      FOREIGN KEY ("invoiceVerifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentSettlement_approvedById_fkey') THEN
    ALTER TABLE "PaymentSettlement"
      ADD CONSTRAINT "PaymentSettlement_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentSettlement_releasedById_fkey') THEN
    ALTER TABLE "PaymentSettlement"
      ADD CONSTRAINT "PaymentSettlement_releasedById_fkey"
      FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentSettlement_rejectedById_fkey') THEN
    ALTER TABLE "PaymentSettlement"
      ADD CONSTRAINT "PaymentSettlement_rejectedById_fkey"
      FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
