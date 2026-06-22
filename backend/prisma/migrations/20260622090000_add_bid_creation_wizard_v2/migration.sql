-- BidCreationWizardV2 draft storage and two-packet bid metadata.

CREATE TYPE "BidType" AS ENUM (
  'PRODUCT_BID',
  'SERVICE_BID',
  'CUSTOM_BID',
  'BOQ_BID',
  'BID_WITH_RA',
  'REVERSE_AUCTION',
  'PAC_BID'
);

CREATE TYPE "DraftStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'PUBLISHED',
  'CANCELLED'
);

CREATE TYPE "PacketType" AS ENUM (
  'SINGLE_PACKET',
  'TWO_PACKET'
);

ALTER TABLE "ProcurementBid"
  ADD COLUMN "packetType" "PacketType" NOT NULL DEFAULT 'SINGLE_PACKET',
  ADD COLUMN "technicalPacket" JSONB,
  ADD COLUMN "financialPacket" JSONB;

CREATE TABLE "BidWizardDraft" (
  "id" SERIAL NOT NULL,
  "buyerId" INTEGER NOT NULL,
  "bidType" "BidType" NOT NULL,
  "currentStep" INTEGER NOT NULL DEFAULT 1,
  "completedSteps" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "formData" JSONB NOT NULL,
  "validationState" JSONB,
  "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "draftStatus" "DraftStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BidWizardDraft_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BidWizardDraft_buyerId_updatedAt_idx" ON "BidWizardDraft"("buyerId", "updatedAt");
CREATE INDEX "BidWizardDraft_bidType_draftStatus_idx" ON "BidWizardDraft"("bidType", "draftStatus");

ALTER TABLE "BidWizardDraft"
  ADD CONSTRAINT "BidWizardDraft_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
