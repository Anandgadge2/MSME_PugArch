-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ProcurementCategoryType" AS ENUM ('GOODS', 'SERVICES', 'WORKS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "ProcurementPricingFormat" AS ENUM ('SINGLE_ITEM', 'BOQ', 'SOR');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "SuspensionType" AS ENUM ('MANUAL', 'AUTO_DISPUTE', 'AUTO_KYC_EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AppealStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
ALTER TYPE "BannerEligibilityType" ADD VALUE IF NOT EXISTS 'TOP_SHG';
ALTER TYPE "BannerType" ADD VALUE IF NOT EXISTS 'TOP_SHG_PROMOTION';

-- AlterEnum
DO $$ BEGIN
    CREATE TYPE "BidType_new" AS ENUM ('PRODUCT_BID', 'SERVICE_BID', 'CUSTOM_BID', 'BOQ_BID', 'BID_WITH_RA', 'REVERSE_AUCTION');
    ALTER TABLE "BidWizardDraft" ALTER COLUMN "bidType" TYPE "BidType_new" USING ("bidType"::text::"BidType_new");
    ALTER TYPE "BidType" RENAME TO "BidType_old";
    ALTER TYPE "BidType_new" RENAME TO "BidType";
    DROP TYPE IF EXISTS "public"."BidType_old";
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_SUBMITTED';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'SETTLED';

-- AlterEnum
ALTER TYPE "OrganizationRankType" ADD VALUE IF NOT EXISTS 'SHG';

-- AlterEnum
ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'DISPATCHED';
ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'GRN_APPROVED';
ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'INVOICED';
ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "POStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

-- AlterEnum
ALTER TYPE "ProcurementAwardStatus" ADD VALUE IF NOT EXISTS 'OFFERED';
ALTER TYPE "ProcurementAwardStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "ProcurementAwardStatus" ADD VALUE IF NOT EXISTS 'DECLINED';

-- AlterEnum
ALTER TYPE "ProcurementBidStatus" ADD VALUE IF NOT EXISTS 'AWARD_OFFERED';
ALTER TYPE "ProcurementBidStatus" ADD VALUE IF NOT EXISTS 'AWARD_ACCEPTED';
ALTER TYPE "ProcurementBidStatus" ADD VALUE IF NOT EXISTS 'AWARD_DECLINED';
ALTER TYPE "ProcurementBidStatus" ADD VALUE IF NOT EXISTS 'ORDERED';
ALTER TYPE "ProcurementBidStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

-- AlterEnum
ALTER TYPE "ProcurementFinalStatus" ADD VALUE IF NOT EXISTS 'UNDER_EVALUATION';
ALTER TYPE "ProcurementFinalStatus" ADD VALUE IF NOT EXISTS 'AWARD_OFFERED';
ALTER TYPE "ProcurementFinalStatus" ADD VALUE IF NOT EXISTS 'AWARD_ACCEPTED';
ALTER TYPE "ProcurementFinalStatus" ADD VALUE IF NOT EXISTS 'AWARD_DECLINED';
ALTER TYPE "ProcurementFinalStatus" ADD VALUE IF NOT EXISTS 'ORDERED';

-- AlterTable
ALTER TABLE "BuyerRequirement" ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT;

-- AlterTable
ALTER TABLE "GrievanceTicket" ADD COLUMN IF NOT EXISTS "complainantEmail" TEXT,
ADD COLUMN IF NOT EXISTS "complainantMobile" TEXT,
ADD COLUMN IF NOT EXISTS "complainantName" TEXT,
ADD COLUMN IF NOT EXISTS "enterpriseName" TEXT,
ADD COLUMN IF NOT EXISTS "referenceNumber" TEXT,
ADD COLUMN IF NOT EXISTS "ticketNumber" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "bankName" TEXT,
ADD COLUMN IF NOT EXISTS "grnId" INTEGER,
ADD COLUMN IF NOT EXISTS "paymentDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "paymentReference" TEXT,
ADD COLUMN IF NOT EXISTS "paymentSlipFileId" INTEGER,
ADD COLUMN IF NOT EXISTS "settledAt" TIMESTAMP(3);

-- AlterTable Organization safely
DO $$ BEGIN
    ALTER TABLE "Organization" ALTER COLUMN "appealStatus" DROP DEFAULT;
    ALTER TABLE "Organization" ALTER COLUMN "appealStatus" TYPE "AppealStatus" USING ("appealStatus"::"AppealStatus");
    ALTER TABLE "Organization" ALTER COLUMN "appealStatus" SET DEFAULT 'NONE'::"AppealStatus";
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Organization" ALTER COLUMN "suspensionType" TYPE "SuspensionType" USING ("suspensionType"::"SuspensionType");
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

-- AlterTable
ALTER TABLE "PreRegistrationKycSession" ADD COLUMN IF NOT EXISTS "verifiedMobile" TEXT;

-- AlterTable
ALTER TABLE "ProcurementBid" DROP COLUMN IF EXISTS "allowWithdrawal",
ADD COLUMN IF NOT EXISTS "categoryType" "ProcurementCategoryType" DEFAULT 'GOODS',
ADD COLUMN IF NOT EXISTS "pricingFormat" "ProcurementPricingFormat" DEFAULT 'SINGLE_ITEM';

-- AlterTable
ALTER TABLE "ProcurementBidAward" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "counterOfferDeadline" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "counterOfferNotes" TEXT,
ADD COLUMN IF NOT EXISTS "counterOfferStatus" TEXT DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS "declinedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "declinedReason" TEXT,
ADD COLUMN IF NOT EXISTS "isPriceMatched" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "justificationReason" TEXT,
ADD COLUMN IF NOT EXISTS "originalBidAmount" DECIMAL(18,2),
ADD COLUMN IF NOT EXISTS "priceMatchTargetPrice" DECIMAL(18,2);

-- CreateTable
CREATE TABLE IF NOT EXISTS "EntitySequence" (
    "id" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastVal" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntitySequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EntitySequence_prefix_year_idx" ON "EntitySequence"("prefix", "year");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BuyerRequirement_referenceNumber_key" ON "BuyerRequirement"("referenceNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BuyerRequirement_referenceNumber_idx" ON "BuyerRequirement"("referenceNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeliveryDpExtension_requestedById_idx" ON "DeliveryDpExtension"("requestedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeliveryDpExtension_respondedById_idx" ON "DeliveryDpExtension"("respondedById");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GrievanceTicket_ticketNumber_key" ON "GrievanceTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GrievanceTicket_complainantEmail_idx" ON "GrievanceTicket"("complainantEmail");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GrievanceTicket_ticketNumber_idx" ON "GrievanceTicket"("ticketNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Organization_appealStatus_idx" ON "Organization"("appealStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Organization_suspensionType_idx" ON "Organization"("suspensionType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBid_categoryType_pricingFormat_idx" ON "ProcurementBid"("categoryType", "pricingFormat");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceiptNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentSlipFileId_fkey" FOREIGN KEY ("paymentSlipFileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
