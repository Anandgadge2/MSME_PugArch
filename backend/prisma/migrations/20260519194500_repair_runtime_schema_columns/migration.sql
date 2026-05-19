-- Repair production schema drift for columns used by runtime list/detail routes.
-- This migration is intentionally idempotent: it only adds missing enum types,
-- columns, and indexes so existing production data is preserved.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserStatus') THEN
    CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'BLOCKED', 'SUSPENDED', 'DELETED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TenderStatusV2') THEN
    CREATE TYPE "TenderStatusV2" AS ENUM ('DRAFT', 'APPROVED', 'PUBLISHED', 'BID_SUBMISSION', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'AWARDED', 'PO_GENERATED', 'CLOSED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BidStatus') THEN
    CREATE TYPE "BidStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_TECHNICAL_EVALUATION', 'TECHNICALLY_QUALIFIED', 'TECHNICALLY_REJECTED', 'UNDER_FINANCIAL_EVALUATION', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'POStatus') THEN
    CREATE TYPE "POStatus" AS ENUM ('GENERATED', 'ISSUED', 'ACCEPTED', 'IN_FULFILLMENT', 'DELIVERED', 'CLOSED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentStatus') THEN
    CREATE TYPE "PaymentStatus" AS ENUM ('INITIATED', 'PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EscrowStatus') THEN
    CREATE TYPE "EscrowStatus" AS ENUM ('CREATED', 'FUNDED', 'HELD', 'PARTIALLY_RELEASED', 'RELEASED', 'FROZEN', 'REFUNDED', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MilestoneStatus') THEN
    CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED', 'PAID');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DisputeStatus') THEN
    CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'AWAITING_RESPONSE', 'RESOLVED', 'REJECTED', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GrievanceStatus') THEN
    CREATE TYPE "GrievanceStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SLAStatus') THEN
    CREATE TYPE "SLAStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'BREACHED', 'PAUSED', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LedgerEntryType') THEN
    CREATE TYPE "LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'REFUND', 'FEE', 'TAX');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"User"') IS NOT NULL THEN
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "userId" TEXT;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mobile" TEXT;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dob" TIMESTAMP(3);
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isDualRole" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mobileVerified" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLoginCount" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastPasswordChangeAt" TIMESTAMP(3);
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetVersion" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "accountStatus" "UserStatus" NOT NULL DEFAULT 'PENDING';
  END IF;

  IF to_regclass('"Tender"') IS NOT NULL THEN
    ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "documentUrl" TEXT;
    ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "awardedBidId" INTEGER;
    ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "categoryId" INTEGER;
    ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
    ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER;
    ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
    ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "requirementId" INTEGER;
    ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "statusEnum" "TenderStatusV2";
  END IF;

  IF to_regclass('"Bid"') IS NOT NULL THEN
    ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "bidNumber" TEXT;
    ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "withdrawnAt" TIMESTAMP(3);
    ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "modifiedAt" TIMESTAMP(3);
    ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "lastIpAddress" TEXT;
    ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "lastUserAgentHash" TEXT;
    ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "deviceHash" TEXT;
    ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "fileAssetId" INTEGER;
    ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "statusEnum" "BidStatus";
  END IF;

  IF to_regclass('"PurchaseOrder"') IS NOT NULL THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "pdfFileId" INTEGER;
    ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "poStatus" "POStatus";
    ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "sourceId" INTEGER;
    ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
  END IF;

  IF to_regclass('"PaymentTransaction"') IS NOT NULL THEN
    ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "paymentStatus" "PaymentStatus";
  END IF;

  IF to_regclass('"FinancialLedgerEntry"') IS NOT NULL THEN
    ALTER TABLE "FinancialLedgerEntry" ADD COLUMN IF NOT EXISTS "entryTypeEnum" "LedgerEntryType";
  END IF;

  IF to_regclass('"EscrowAccount"') IS NOT NULL THEN
    ALTER TABLE "EscrowAccount" ADD COLUMN IF NOT EXISTS "escrowStatus" "EscrowStatus";
  END IF;

  IF to_regclass('"Milestone"') IS NOT NULL THEN
    ALTER TABLE "Milestone" ADD COLUMN IF NOT EXISTS "statusEnum" "MilestoneStatus";
  END IF;

  IF to_regclass('"Dispute"') IS NOT NULL THEN
    ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "statusEnum" "DisputeStatus";
  END IF;

  IF to_regclass('"GrievanceTicket"') IS NOT NULL THEN
    ALTER TABLE "GrievanceTicket" ADD COLUMN IF NOT EXISTS "slaStatus" "SLAStatus";
    ALTER TABLE "GrievanceTicket" ADD COLUMN IF NOT EXISTS "statusEnum" "GrievanceStatus";
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('"Tender"') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "Tender_categoryId_idx" ON "Tender"("categoryId");
    CREATE INDEX IF NOT EXISTS "Tender_requirementId_idx" ON "Tender"("requirementId");
    CREATE INDEX IF NOT EXISTS "Tender_organizationId_idx" ON "Tender"("organizationId");
    CREATE INDEX IF NOT EXISTS "Tender_statusEnum_idx" ON "Tender"("statusEnum");
    CREATE INDEX IF NOT EXISTS "Tender_awardedBidId_idx" ON "Tender"("awardedBidId");
  END IF;

  IF to_regclass('"Bid"') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "Bid_bidNumber_idx" ON "Bid"("bidNumber");
    CREATE INDEX IF NOT EXISTS "Bid_statusEnum_idx" ON "Bid"("statusEnum");
  END IF;
END $$;
