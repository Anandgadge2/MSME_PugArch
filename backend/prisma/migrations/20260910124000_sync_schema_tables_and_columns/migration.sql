-- AlterEnum
ALTER TYPE "BannerType" ADD VALUE IF NOT EXISTS 'TOP_SHG_PROMOTION';

-- AlterEnum
ALTER TYPE "DirectPurchaseStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';

-- AlterEnum
ALTER TYPE "OrganizationRankType" ADD VALUE IF NOT EXISTS 'SHG';

-- AlterEnum
ALTER TYPE "PaymentGateway" ADD VALUE IF NOT EXISTS 'BANDHAN';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ProcurementBidStatus" ADD VALUE IF NOT EXISTS 'PUBLISHED';
ALTER TYPE "ProcurementBidStatus" ADD VALUE IF NOT EXISTS 'OPEN_FOR_BIDDING';
ALTER TYPE "ProcurementBidStatus" ADD VALUE IF NOT EXISTS 'UNDER_EVALUATION';
ALTER TYPE "ProcurementBidStatus" ADD VALUE IF NOT EXISTS 'NEGOTIATION';
ALTER TYPE "ProcurementBidStatus" ADD VALUE IF NOT EXISTS 'PO_GENERATED';
ALTER TYPE "ProcurementBidStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "ProcurementBidStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "ProcurementBidStatus" ADD VALUE IF NOT EXISTS 'GRN_COMPLETED';
ALTER TYPE "ProcurementBidStatus" ADD VALUE IF NOT EXISTS 'INVOICE_SUBMITTED';
ALTER TYPE "ProcurementBidStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_COMPLETED';

-- AlterEnum
ALTER TYPE "QuoteResponseStatus" ADD VALUE IF NOT EXISTS 'SHORTLISTED';

-- AlterEnum
ALTER TYPE "RequirementResponseStatus" ADD VALUE IF NOT EXISTS 'DRAFT';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'financier';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'PENDING_CLOSURE';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'MERGED';

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_companyId_fkey";

-- DropForeignKey
ALTER TABLE "BuyerRequirement" DROP CONSTRAINT IF EXISTS "BuyerRequirement_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyFeature" DROP CONSTRAINT IF EXISTS "CompanyFeature_companyId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyFeature" DROP CONSTRAINT IF EXISTS "CompanyFeature_featureId_fkey";

-- DropForeignKey
ALTER TABLE "CompanyFeature" DROP CONSTRAINT IF EXISTS "CompanyFeature_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "CompanySetting" DROP CONSTRAINT IF EXISTS "CompanySetting_companyId_fkey";

-- DropForeignKey
ALTER TABLE "ContentPage" DROP CONSTRAINT IF EXISTS "ContentPage_companyId_fkey";

-- DropForeignKey
ALTER TABLE "GuestCart" DROP CONSTRAINT IF EXISTS "GuestCart_companyId_fkey";

-- DropForeignKey
ALTER TABLE "Organization" DROP CONSTRAINT IF EXISTS "Organization_companyId_fkey";

-- DropForeignKey
ALTER TABLE "RbacRole" DROP CONSTRAINT IF EXISTS "RbacRole_companyId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_companyId_fkey";

-- DropForeignKey
ALTER TABLE "UserRole" DROP CONSTRAINT IF EXISTS "UserRole_companyId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Auction_procurementMethod_status_idx";

-- DropIndex
DROP INDEX IF EXISTS "Auction_rankVisibility_idx";

-- DropIndex
DROP INDEX IF EXISTS "AuditLog_companyId_idx";

-- DropIndex
DROP INDEX IF EXISTS "BuyerRequirement_companyId_idx";

-- DropIndex
DROP INDEX IF EXISTS "ContentPage_companyId_idx";

-- DropIndex
DROP INDEX IF EXISTS "ContentPage_companyId_slug_key";

-- DropIndex
DROP INDEX IF EXISTS "GuestCart_companyId_idx";

-- DropIndex
DROP INDEX IF EXISTS "MarketplaceBanner_companyId_idx";

-- DropIndex
DROP INDEX IF EXISTS "MarketplaceNotice_companyId_idx";

-- DropIndex
DROP INDEX IF EXISTS "MarketplaceSetting_companyId_idx";

-- DropIndex
DROP INDEX IF EXISTS "MarketplaceSetting_companyId_key_key";

-- DropIndex
DROP INDEX IF EXISTS "Organization_companyId_idx";

-- DropIndex
DROP INDEX IF EXISTS "RbacRole_companyId_idx";

-- DropIndex
DROP INDEX IF EXISTS "User_companyId_idx";

-- DropIndex
DROP INDEX IF EXISTS "UserRole_companyId_idx";

-- DropIndex
DROP INDEX IF EXISTS "UserRole_userId_roleId_companyId_organizationId_key";

-- AlterTable
ALTER TABLE "AccountType" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuctionParticipant" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "companyId";

-- AlterTable
ALTER TABLE "BannerEligibility" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "acknowledgement" JSONB;

-- AlterTable
ALTER TABLE "BuyerProfile" ADD COLUMN IF NOT EXISTS "address" TEXT,
ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT,
ADD COLUMN IF NOT EXISTS "contactPersonDesignation" TEXT,
ADD COLUMN IF NOT EXISTS "contactPersonEmail" TEXT,
ADD COLUMN IF NOT EXISTS "contactPersonMobile" TEXT,
ADD COLUMN IF NOT EXISTS "contactPersonName" TEXT,
ADD COLUMN IF NOT EXISTS "departmentName" TEXT,
ADD COLUMN IF NOT EXISTS "gstNumber" TEXT,
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
ADD COLUMN IF NOT EXISTS "officialEmail" TEXT,
ADD COLUMN IF NOT EXISTS "officialPhone" TEXT,
ADD COLUMN IF NOT EXISTS "panNumber" TEXT,
ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT,
ADD COLUMN IF NOT EXISTS "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT;

-- AlterTable
ALTER TABLE "BuyerRequirement" DROP COLUMN IF EXISTS "companyId",
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CatalogueImportBatch" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ContentPage" DROP COLUMN IF EXISTS "companyId",
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DeliveryDpExtension" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DirectPurchase" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT,
ADD COLUMN IF NOT EXISTS "budgetHead" TEXT,
ADD COLUMN IF NOT EXISTS "consigneeName" TEXT,
ADD COLUMN IF NOT EXISTS "costCenter" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryAddressId" INTEGER,
ADD COLUMN IF NOT EXISTS "deliveryAddressText" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryInstructions" TEXT,
ADD COLUMN IF NOT EXISTS "department" TEXT,
ADD COLUMN IF NOT EXISTS "email" TEXT,
ADD COLUMN IF NOT EXISTS "justification" TEXT,
ADD COLUMN IF NOT EXISTS "mobileNumber" TEXT,
ADD COLUMN IF NOT EXISTS "remarks" TEXT,
ADD COLUMN IF NOT EXISTS "requiredDeliveryDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "workflowStatus" TEXT;

-- AlterTable
ALTER TABLE "EmdPayment" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Feature" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FileAsset" ADD COLUMN IF NOT EXISTS "bucketName" TEXT,
ADD COLUMN IF NOT EXISTS "fileUrl" TEXT,
ADD COLUMN IF NOT EXISTS "objectName" TEXT,
ADD COLUMN IF NOT EXISTS "parentId" INTEGER,
ADD COLUMN IF NOT EXISTS "uploadedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "storageProviderEnum" SET DEFAULT 'GCP';

-- AlterTable
ALTER TABLE "GlobalSetting" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GuestCart" DROP COLUMN IF EXISTS "companyId",
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GuestCartItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MarketplaceBanner" DROP COLUMN IF EXISTS "companyId";

-- AlterTable
ALTER TABLE "MarketplaceHomeSection" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MarketplaceNotice" DROP COLUMN IF EXISTS "companyId";

-- AlterTable
ALTER TABLE "MarketplaceSetting" DROP COLUMN IF EXISTS "companyId";

-- AlterTable
ALTER TABLE "OfflinePaymentProof" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "OrgCustomRole" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "companyId",
ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "archivedBy" INTEGER,
ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "closedBy" INTEGER,
ADD COLUMN IF NOT EXISTS "closureReason" TEXT,
ADD COLUMN IF NOT EXISTS "gstReuseAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "gstReuseAllowedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "gstReuseAllowedBy" INTEGER,
ADD COLUMN IF NOT EXISTS "gstReuseReason" TEXT,
ADD COLUMN IF NOT EXISTS "previousOrganizationId" INTEGER,
ADD COLUMN IF NOT EXISTS "replacementOrganizationId" INTEGER;

-- AlterTable
ALTER TABLE "OrganizationProfile" ADD COLUMN IF NOT EXISTS "bannerUrl" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PlatformFeature" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProcurementBid" ADD COLUMN IF NOT EXISTS "allowWithdrawal" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "canonicalMethod" TEXT,
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProcurementBidAward" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProcurementBidClarification" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProcurementBidEvaluation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProcurementBidParticipation" ADD COLUMN IF NOT EXISTS "acknowledgement" JSONB,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProcurementRequest" ADD COLUMN IF NOT EXISTS "canonicalMethod" TEXT;

-- AlterTable
ALTER TABLE "QuoteRequest" ADD COLUMN IF NOT EXISTS "allowSellerRevision" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "allowWithdrawal" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "deadlineDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "revisionRequestedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "QuoteResponse" ADD COLUMN IF NOT EXISTS "acknowledgement" JSONB,
ADD COLUMN IF NOT EXISTS "buyerRemarks" TEXT,
ADD COLUMN IF NOT EXISTS "commercialRemarks" TEXT,
ADD COLUMN IF NOT EXISTS "complianceStatus" TEXT,
ADD COLUMN IF NOT EXISTS "deliveryLocation" TEXT,
ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(18,2),
ADD COLUMN IF NOT EXISTS "discountPercent" DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS "evaluatedPrice" DECIMAL(18,2),
ADD COLUMN IF NOT EXISTS "financialStatus" TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "gstRate" DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS "isShortlisted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "paymentTerms" TEXT,
ADD COLUMN IF NOT EXISTS "rank" INTEGER,
ADD COLUMN IF NOT EXISTS "taxAmount" DECIMAL(18,2),
ADD COLUMN IF NOT EXISTS "technicalRemarks" TEXT,
ADD COLUMN IF NOT EXISTS "technicalStatus" TEXT DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS "warrantyPeriod" TEXT;

-- AlterTable
ALTER TABLE "RbacRole" DROP COLUMN IF EXISTS "companyId";

-- AlterTable
ALTER TABLE "RequirementResponse" ADD COLUMN IF NOT EXISTS "responseData" JSONB,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ScopedInvitation" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShgBankAccount" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShgDocument" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShgDocumentRequirementConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShgMeeting" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShgMember" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShgOnboardingProgress" ALTER COLUMN "savedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShgProfile" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShgRepresentativeVerification" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ShgResolution" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SupplierRating" ADD COLUMN IF NOT EXISTS "documentationScore" INTEGER;

-- AlterTable
ALTER TABLE "Tender" ADD COLUMN IF NOT EXISTS "allowWithdrawal" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "User" DROP COLUMN IF EXISTS "companyId";

-- AlterTable
ALTER TABLE "UserKycVerification" ADD COLUMN IF NOT EXISTS "idTokenVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "UserRole" DROP COLUMN IF EXISTS "companyId";

-- DropTable
DROP TABLE IF EXISTS "Company" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "CompanyFeature" CASCADE;

-- DropTable
DROP TABLE IF EXISTS "CompanySetting" CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "RequirementClarification" (
    "id" SERIAL NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'REQUIREMENT',
    "entityId" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "response" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "askedById" INTEGER NOT NULL,
    "answeredById" INTEGER,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementClarification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuoteRequestClarification" (
    "id" SERIAL NOT NULL,
    "quoteRequestId" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "response" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "askedById" INTEGER NOT NULL,
    "answeredById" INTEGER,
    "askedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteRequestClarification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InvoiceFactoring" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "sellerId" INTEGER NOT NULL,
    "financierId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'INITIATED',
    "requestedAmount" DECIMAL(18,2) NOT NULL,
    "factoredAmount" DECIMAL(18,2),
    "feeAmount" DECIMAL(18,2),
    "discountRate" DECIMAL(18,2),
    "repaymentAmount" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceFactoring_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AddressGroup" (
    "id" SERIAL NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "organizationId" INTEGER,
    "groupName" TEXT NOT NULL,
    "groupDescription" TEXT,
    "isDefaultGroup" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddressGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DeliveryAddress" (
    "id" SERIAL NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "organizationId" INTEGER,
    "addressGroupId" INTEGER,
    "addressLabel" TEXT NOT NULL,
    "organizationName" TEXT,
    "contactPersonName" TEXT NOT NULL,
    "mobileNumber" TEXT NOT NULL,
    "alternateMobileNumber" TEXT,
    "email" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "landmark" TEXT,
    "gstState" TEXT,
    "placeOfSupply" TEXT,
    "addressType" TEXT NOT NULL DEFAULT 'OFFICE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BuyerFrequentlyBoughtItem" (
    "id" SERIAL NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "organizationProfileId" INTEGER NOT NULL,
    "serialNo" TEXT,
    "itemDescription" TEXT NOT NULL,
    "category" TEXT,
    "estimatedMonthlyRequirement" TEXT,
    "unit" TEXT,
    "remarks" TEXT,
    "status" TEXT DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerFrequentlyBoughtItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "BuyerItemUploadBatch" (
    "id" SERIAL NOT NULL,
    "buyerId" INTEGER NOT NULL,
    "organizationProfileId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT,
    "totalRows" INTEGER NOT NULL,
    "validRows" INTEGER NOT NULL,
    "invalidRows" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',

    CONSTRAINT "BuyerItemUploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RequirementClarification_entityType_entityId_visibility_idx" ON "RequirementClarification"("entityType", "entityId", "visibility");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RequirementClarification_askedById_idx" ON "RequirementClarification"("askedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RequirementClarification_answeredById_idx" ON "RequirementClarification"("answeredById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteRequestClarification_quoteRequestId_visibility_idx" ON "QuoteRequestClarification"("quoteRequestId", "visibility");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteRequestClarification_askedById_idx" ON "QuoteRequestClarification"("askedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteRequestClarification_answeredById_idx" ON "QuoteRequestClarification"("answeredById");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceFactoring_invoiceId_key" ON "InvoiceFactoring"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvoiceFactoring_status_idx" ON "InvoiceFactoring"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvoiceFactoring_sellerId_idx" ON "InvoiceFactoring"("sellerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvoiceFactoring_financierId_idx" ON "InvoiceFactoring"("financierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AddressGroup_buyerId_idx" ON "AddressGroup"("buyerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AddressGroup_organizationId_idx" ON "AddressGroup"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeliveryAddress_buyerId_idx" ON "DeliveryAddress"("buyerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeliveryAddress_organizationId_idx" ON "DeliveryAddress"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeliveryAddress_addressGroupId_idx" ON "DeliveryAddress"("addressGroupId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BuyerFrequentlyBoughtItem_buyerId_idx" ON "BuyerFrequentlyBoughtItem"("buyerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BuyerFrequentlyBoughtItem_organizationProfileId_idx" ON "BuyerFrequentlyBoughtItem"("organizationProfileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BuyerItemUploadBatch_buyerId_idx" ON "BuyerItemUploadBatch"("buyerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "BuyerItemUploadBatch_organizationProfileId_idx" ON "BuyerItemUploadBatch"("organizationProfileId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Approval_userId_idx" ON "Approval"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_entityId_idx" ON "AuditLog"("entityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Bid_createdAt_idx" ON "Bid"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Bid_updatedAt_idx" ON "Bid"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContentPage_slug_key" ON "ContentPage"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Conversation_sellerId_idx" ON "Conversation"("sellerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeliveryDpExtension_requestedById_idx" ON "DeliveryDpExtension"("requestedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeliveryDpExtension_respondedById_idx" ON "DeliveryDpExtension"("respondedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeliveryParticipant_assignedById_idx" ON "DeliveryParticipant"("assignedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeliveryStatusLog_fileAssetId_idx" ON "DeliveryStatusLog"("fileAssetId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeliveryTracking_createdAt_idx" ON "DeliveryTracking"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeliveryTracking_updatedAt_idx" ON "DeliveryTracking"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DirectPurchase_deliveryAddressId_idx" ON "DirectPurchase"("deliveryAddressId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Dispute_buyerOrgId_idx" ON "Dispute"("buyerOrgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Dispute_sellerOrgId_idx" ON "Dispute"("sellerOrgId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Dispute_resolvedById_idx" ON "Dispute"("resolvedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DisputeEvidence_uploadedById_idx" ON "DisputeEvidence"("uploadedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FileAsset_parentId_idx" ON "FileAsset"("parentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FinancialEvaluation_evaluatorId_idx" ON "FinancialEvaluation"("evaluatorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FraudAlert_reviewedById_idx" ON "FraudAlert"("reviewedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GoodsReceiptNote_createdAt_idx" ON "GoodsReceiptNote"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GoodsReceiptNote_updatedAt_idx" ON "GoodsReceiptNote"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GrievanceAttachment_uploadedById_idx" ON "GrievanceAttachment"("uploadedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_updatedAt_idx" ON "Invoice"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_isArchived_idx" ON "Notification"("userId", "isRead", "isArchived");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrgInvitation_invitedById_idx" ON "OrgInvitation"("invitedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrgMembership_accessTransferredFromUserId_idx" ON "OrgMembership"("accessTransferredFromUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrgMembership_customRoleId_idx" ON "OrgMembership"("customRoleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Organization_organizationName_idx" ON "Organization"("organizationName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Organization_state_idx" ON "Organization"("state");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentSettlement_invoiceVerifiedById_idx" ON "PaymentSettlement"("invoiceVerifiedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentSettlement_approvedById_idx" ON "PaymentSettlement"("approvedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentSettlement_releasedById_idx" ON "PaymentSettlement"("releasedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentSettlement_rejectedById_idx" ON "PaymentSettlement"("rejectedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentTransaction_createdAt_idx" ON "PaymentTransaction"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentTransaction_updatedAt_idx" ON "PaymentTransaction"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentTransaction_amount_idx" ON "PaymentTransaction"("amount");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentTransaction_currency_idx" ON "PaymentTransaction"("currency");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentTransaction_gateway_idx" ON "PaymentTransaction"("gateway");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBid_createdAt_idx" ON "ProcurementBid"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBid_updatedAt_idx" ON "ProcurementBid"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBid_estimatedValue_idx" ON "ProcurementBid"("estimatedValue");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBid_approvalStatus_idx" ON "ProcurementBid"("approvalStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBid_status_idx" ON "ProcurementBid"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBid_buyerOrganizationName_idx" ON "ProcurementBid"("buyerOrganizationName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBid_title_idx" ON "ProcurementBid"("title");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBid_canonicalMethod_idx" ON "ProcurementBid"("canonicalMethod");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBid_canonicalMethod_status_idx" ON "ProcurementBid"("canonicalMethod", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBid_approvedById_idx" ON "ProcurementBid"("approvedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBidAward_participationId_idx" ON "ProcurementBidAward"("participationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBidAward_awardedById_idx" ON "ProcurementBidAward"("awardedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBidClarification_buyerId_idx" ON "ProcurementBidClarification"("buyerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBidClarification_requestedById_idx" ON "ProcurementBidClarification"("requestedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBidClarification_respondedById_idx" ON "ProcurementBidClarification"("respondedById");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBidEvaluation_evaluatorId_idx" ON "ProcurementBidEvaluation"("evaluatorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementBidParticipationDocument_sellerId_idx" ON "ProcurementBidParticipationDocument"("sellerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementModeSetting_organizationId_idx" ON "ProcurementModeSetting"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementRequest_canonicalMethod_idx" ON "ProcurementRequest"("canonicalMethod");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProcurementRequest_l1ComparisonId_idx" ON "ProcurementRequest"("l1ComparisonId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_sellerId_status_idx" ON "Product"("sellerId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_organizationId_status_idx" ON "Product"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PurchaseOrder_createdAt_idx" ON "PurchaseOrder"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PurchaseOrder_updatedAt_idx" ON "PurchaseOrder"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PurchaseOrder_bidId_idx" ON "PurchaseOrder"("bidId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PurchaseOrder_contractId_idx" ON "PurchaseOrder"("contractId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteResponse_quoteRequestId_status_technicalStatus_idx" ON "QuoteResponse"("quoteRequestId", "status", "technicalStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteResponse_quoteRequestId_isShortlisted_idx" ON "QuoteResponse"("quoteRequestId", "isShortlisted");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Service_sellerId_status_idx" ON "Service"("sellerId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Service_organizationId_status_idx" ON "Service"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TechnicalEvaluationResult_criteriaId_idx" ON "TechnicalEvaluationResult"("criteriaId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tender_status_category_idx" ON "Tender"("status", "category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tender_status_closesAt_idx" ON "Tender"("status", "closesAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tender_updatedAt_idx" ON "Tender"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_updatedAt_idx" ON "User"("updatedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_onboardingStatus_idx" ON "User"("onboardingStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_name_idx" ON "User"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserRole_assignedById_idx" ON "UserRole"("assignedById");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RequirementClarification_answeredById_fkey') THEN
        ALTER TABLE "RequirementClarification" ADD CONSTRAINT "RequirementClarification_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RequirementClarification_askedById_fkey') THEN
        ALTER TABLE "RequirementClarification" ADD CONSTRAINT "RequirementClarification_askedById_fkey" FOREIGN KEY ("askedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformFeature_featureId_fkey') THEN
        ALTER TABLE "PlatformFeature" ADD CONSTRAINT "PlatformFeature_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "Feature"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlatformFeature_updatedById_fkey') THEN
        ALTER TABLE "PlatformFeature" ADD CONSTRAINT "PlatformFeature_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DirectPurchase_deliveryAddressId_fkey') THEN
        ALTER TABLE "DirectPurchase" ADD CONSTRAINT "DirectPurchase_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "DeliveryAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FileAsset_parentId_fkey') THEN
        ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryDpExtension_deliveryTrackingId_fkey') THEN
        ALTER TABLE "DeliveryDpExtension" ADD CONSTRAINT "DeliveryDpExtension_deliveryTrackingId_fkey" FOREIGN KEY ("deliveryTrackingId") REFERENCES "DeliveryTracking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryDpExtension_requestedById_fkey') THEN
        ALTER TABLE "DeliveryDpExtension" ADD CONSTRAINT "DeliveryDpExtension_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryDpExtension_respondedById_fkey') THEN
        ALTER TABLE "DeliveryDpExtension" ADD CONSTRAINT "DeliveryDpExtension_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuoteRequestClarification_answeredById_fkey') THEN
        ALTER TABLE "QuoteRequestClarification" ADD CONSTRAINT "QuoteRequestClarification_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuoteRequestClarification_askedById_fkey') THEN
        ALTER TABLE "QuoteRequestClarification" ADD CONSTRAINT "QuoteRequestClarification_askedById_fkey" FOREIGN KEY ("askedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'QuoteRequestClarification_quoteRequestId_fkey') THEN
        ALTER TABLE "QuoteRequestClarification" ADD CONSTRAINT "QuoteRequestClarification_quoteRequestId_fkey" FOREIGN KEY ("quoteRequestId") REFERENCES "QuoteRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceFactoring_financierId_fkey') THEN
        ALTER TABLE "InvoiceFactoring" ADD CONSTRAINT "InvoiceFactoring_financierId_fkey" FOREIGN KEY ("financierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceFactoring_invoiceId_fkey') THEN
        ALTER TABLE "InvoiceFactoring" ADD CONSTRAINT "InvoiceFactoring_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceFactoring_sellerId_fkey') THEN
        ALTER TABLE "InvoiceFactoring" ADD CONSTRAINT "InvoiceFactoring_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AddressGroup_buyerId_fkey') THEN
        ALTER TABLE "AddressGroup" ADD CONSTRAINT "AddressGroup_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AddressGroup_organizationId_fkey') THEN
        ALTER TABLE "AddressGroup" ADD CONSTRAINT "AddressGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryAddress_addressGroupId_fkey') THEN
        ALTER TABLE "DeliveryAddress" ADD CONSTRAINT "DeliveryAddress_addressGroupId_fkey" FOREIGN KEY ("addressGroupId") REFERENCES "AddressGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryAddress_buyerId_fkey') THEN
        ALTER TABLE "DeliveryAddress" ADD CONSTRAINT "DeliveryAddress_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DeliveryAddress_organizationId_fkey') THEN
        ALTER TABLE "DeliveryAddress" ADD CONSTRAINT "DeliveryAddress_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuyerFrequentlyBoughtItem_buyerId_fkey') THEN
        ALTER TABLE "BuyerFrequentlyBoughtItem" ADD CONSTRAINT "BuyerFrequentlyBoughtItem_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuyerFrequentlyBoughtItem_organizationProfileId_fkey') THEN
        ALTER TABLE "BuyerFrequentlyBoughtItem" ADD CONSTRAINT "BuyerFrequentlyBoughtItem_organizationProfileId_fkey" FOREIGN KEY ("organizationProfileId") REFERENCES "BuyerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuyerItemUploadBatch_buyerId_fkey') THEN
        ALTER TABLE "BuyerItemUploadBatch" ADD CONSTRAINT "BuyerItemUploadBatch_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BuyerItemUploadBatch_organizationProfileId_fkey') THEN
        ALTER TABLE "BuyerItemUploadBatch" ADD CONSTRAINT "BuyerItemUploadBatch_organizationProfileId_fkey" FOREIGN KEY ("organizationProfileId") REFERENCES "BuyerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- RenameIndex
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'MarketplaceBanner_status_startAt_endAt_priority_displayLocation') AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'MarketplaceBanner_status_startAt_endAt_priority_displayLoca_idx') THEN
        ALTER INDEX "MarketplaceBanner_status_startAt_endAt_priority_displayLocation" RENAME TO "MarketplaceBanner_status_startAt_endAt_priority_displayLoca_idx";
    END IF;
END $$;

-- RenameIndex
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'OrganizationMonthlyRank_organizationId_organizationType_month_y') AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'OrganizationMonthlyRank_organizationId_organizationType_mon_key') THEN
        ALTER INDEX "OrganizationMonthlyRank_organizationId_organizationType_month_y" RENAME TO "OrganizationMonthlyRank_organizationId_organizationType_mon_key";
    END IF;
END $$;

-- RenameIndex
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ProcurementBidParticipation_bidId_technicalStatus_financialStat') AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ProcurementBidParticipation_bidId_technicalStatus_financial_idx') THEN
        ALTER INDEX "ProcurementBidParticipation_bidId_technicalStatus_financialStat" RENAME TO "ProcurementBidParticipation_bidId_technicalStatus_financial_idx";
    END IF;
END $$;

-- RenameIndex
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ProcurementBidParticipationDocument_participationId_documentCat') AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ProcurementBidParticipationDocument_participationId_documen_idx') THEN
        ALTER INDEX "ProcurementBidParticipationDocument_participationId_documentCat" RENAME TO "ProcurementBidParticipationDocument_participationId_documen_idx";
    END IF;
END $$;

-- RenameIndex
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ShgDocumentRequirementConfig_state_district_shgType_activityTyp') AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ShgDocumentRequirementConfig_state_district_shgType_activit_key') THEN
        ALTER INDEX "ShgDocumentRequirementConfig_state_district_shgType_activityTyp" RENAME TO "ShgDocumentRequirementConfig_state_district_shgType_activit_key";
    END IF;
END $$;

-- RenameIndex
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ShgRepresentativeVerification_verificationType_verificationStat') AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ShgRepresentativeVerification_verificationType_verification_idx') THEN
        ALTER INDEX "ShgRepresentativeVerification_verificationType_verificationStat" RENAME TO "ShgRepresentativeVerification_verificationType_verification_idx";
    END IF;
END $$;
