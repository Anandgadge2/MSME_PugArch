-- Phase 2B: additive core foundation enums, models, and optional relations.

CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'BLOCKED', 'SUSPENDED', 'DELETED');
CREATE TYPE "OrganizationType" AS ENUM ('MSME', 'PROPRIETORSHIP', 'PARTNERSHIP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'TRUST', 'SOCIETY', 'STARTUP', 'NGO', 'EDUCATIONAL_INSTITUTION', 'GOVERNMENT', 'PSU');
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'FAILED', 'MANUAL_REVIEW_REQUIRED', 'EXPIRED');
CREATE TYPE "MSMECategory" AS ENUM ('MICRO', 'SMALL', 'MEDIUM', 'NOT_APPLICABLE');
CREATE TYPE "ProcurementMethod" AS ENUM ('DIRECT_PURCHASE', 'RFQ', 'TENDER', 'REVERSE_AUCTION', 'RATE_CONTRACT');
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMISSION_REQUIRED');
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'ARCHIVED');
CREATE TYPE "CategoryType" AS ENUM ('PRODUCT', 'SERVICE', 'BOTH');
CREATE TYPE "PricingModel" AS ENUM ('FIXED', 'HOURLY', 'DAILY', 'MONTHLY', 'PER_PROJECT', 'CUSTOM');
CREATE TYPE "StorageProvider" AS ENUM ('CLOUDINARY', 'GCP', 'LOCAL');
CREATE TYPE "FileStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED', 'QUARANTINED');
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "PaymentGateway" AS ENUM ('RAZORPAY', 'CASHFREE', 'BANK_TRANSFER', 'MANUAL');
CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'CARD', 'NET_BANKING', 'BANK_TRANSFER', 'CORPORATE_ACCOUNT');
CREATE TYPE "NotificationChannel" AS ENUM ('SYSTEM', 'EMAIL', 'SMS', 'PUSH');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DELIVERED', 'READ');
CREATE TYPE "VerificationType" AS ENUM ('GST', 'PAN', 'UDYAM', 'BANK', 'AADHAAR', 'EMAIL', 'MOBILE');
CREATE TYPE "FraudAlertStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'CONFIRMED', 'DISMISSED', 'RESOLVED');
CREATE TYPE "FraudAlertType" AS ENUM ('DUPLICATE_PAN', 'DUPLICATE_GST', 'DUPLICATE_BANK', 'DUPLICATE_AADHAAR_HASH', 'SAME_IP_MULTIPLE_ACCOUNTS', 'SUSPICIOUS_BID_PATTERN', 'PAYMENT_ANOMALY', 'DOCUMENT_MISMATCH', 'MANUAL_FLAG');
CREATE TYPE "ComplianceRuleCode" AS ENUM ('MISSING_REQUIRED_DOCUMENT', 'EXPIRED_CERTIFICATE', 'DUPLICATE_IDENTIFIER', 'INVALID_GST', 'INVALID_PAN', 'INVALID_BANK', 'SUSPICIOUS_REGISTRATION', 'POLICY_VIOLATION');

CREATE TABLE "Organization" (
  "id" SERIAL NOT NULL,
  "organizationName" TEXT NOT NULL,
  "organizationType" "OrganizationType" NOT NULL,
  "gstin" TEXT,
  "panNumber" TEXT,
  "cinNumber" TEXT,
  "udyamNumber" TEXT,
  "addressLine1" TEXT,
  "addressLine2" TEXT,
  "city" TEXT,
  "district" TEXT,
  "state" TEXT,
  "pincode" TEXT,
  "country" TEXT NOT NULL DEFAULT 'India',
  "website" TEXT,
  "organizationLogoFileId" INTEGER,
  "annualTurnover" DECIMAL(18,2),
  "employeeCount" INTEGER,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "organizationOnboardingStatus" TEXT,
  "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
  "blacklistReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserSession" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "refreshTokenHash" TEXT NOT NULL,
  "deviceId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RbacRole" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isSystemRole" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RbacRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Permission" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RolePermission" (
  "id" SERIAL NOT NULL,
  "roleId" INTEGER NOT NULL,
  "permissionId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SellerDocument" (
  "id" SERIAL NOT NULL,
  "sellerProfileId" INTEGER NOT NULL,
  "documentType" TEXT NOT NULL,
  "fileAssetId" INTEGER NOT NULL,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "remarks" TEXT,
  "verifiedById" INTEGER,
  "verifiedAt" TIMESTAMP(3),
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiVerificationLog" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER,
  "provider" TEXT NOT NULL,
  "verificationType" "VerificationType" NOT NULL,
  "requestReference" TEXT,
  "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "responseSummary" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiVerificationLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiLog" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "durationMs" INTEGER,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "requestId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApiLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ComplianceRule" (
  "id" SERIAL NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ComplianceRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FraudAlert" (
  "id" SERIAL NOT NULL,
  "alertType" "FraudAlertType" NOT NULL,
  "severity" "Severity" NOT NULL DEFAULT 'MEDIUM',
  "userId" INTEGER,
  "organizationId" INTEGER,
  "entityType" TEXT,
  "entityId" INTEGER,
  "details" JSONB NOT NULL,
  "status" "FraudAlertStatus" NOT NULL DEFAULT 'OPEN',
  "reviewedById" INTEGER,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FraudAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationLog" (
  "id" SERIAL NOT NULL,
  "notificationId" INTEGER,
  "channel" "NotificationChannel" NOT NULL,
  "recipient" TEXT NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "providerResponse" JSONB,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN "organizationId" INTEGER;
ALTER TABLE "User" ADD COLUMN "accountStatus" "UserStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "BuyerProfile" ADD COLUMN "organizationId" INTEGER;
ALTER TABLE "BuyerProfile" ADD COLUMN "organizationTypeEnum" "OrganizationType";
ALTER TABLE "BuyerProfile" ADD COLUMN "verificationStatusEnum" "VerificationStatus";
ALTER TABLE "SellerProfile" ADD COLUMN "organizationId" INTEGER;
ALTER TABLE "SellerProfile" ADD COLUMN "organizationTypeEnum" "OrganizationType";
ALTER TABLE "SellerProfile" ADD COLUMN "msmeCategoryEnum" "MSMECategory";
ALTER TABLE "SellerProfile" ADD COLUMN "verificationStatusEnum" "VerificationStatus";
ALTER TABLE "FileAsset" ADD COLUMN "storageProviderEnum" "StorageProvider";
ALTER TABLE "FileAsset" ADD COLUMN "fileStatus" "FileStatus";
ALTER TABLE "PaymentTransaction" ADD COLUMN "gatewayEnum" "PaymentGateway";
ALTER TABLE "PaymentTransaction" ADD COLUMN "methodEnum" "PaymentMethod";
ALTER TABLE "ComplianceViolation" ADD COLUMN "ruleId" INTEGER;

CREATE UNIQUE INDEX "RbacRole_code_key" ON "RbacRole"("code");
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");
CREATE UNIQUE INDEX "ComplianceRule_code_key" ON "ComplianceRule"("code");

CREATE INDEX "Organization_gstin_idx" ON "Organization"("gstin");
CREATE INDEX "Organization_panNumber_idx" ON "Organization"("panNumber");
CREATE INDEX "Organization_udyamNumber_idx" ON "Organization"("udyamNumber");
CREATE INDEX "Organization_verificationStatus_idx" ON "Organization"("verificationStatus");
CREATE INDEX "Organization_isBlacklisted_idx" ON "Organization"("isBlacklisted");
CREATE INDEX "Organization_organizationLogoFileId_idx" ON "Organization"("organizationLogoFileId");
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");
CREATE INDEX "User_accountStatus_idx" ON "User"("accountStatus");
CREATE INDEX "BuyerProfile_organizationId_idx" ON "BuyerProfile"("organizationId");
CREATE INDEX "BuyerProfile_organizationTypeEnum_idx" ON "BuyerProfile"("organizationTypeEnum");
CREATE INDEX "BuyerProfile_verificationStatusEnum_idx" ON "BuyerProfile"("verificationStatusEnum");
CREATE INDEX "SellerProfile_organizationId_idx" ON "SellerProfile"("organizationId");
CREATE INDEX "SellerProfile_organizationTypeEnum_idx" ON "SellerProfile"("organizationTypeEnum");
CREATE INDEX "SellerProfile_msmeCategoryEnum_idx" ON "SellerProfile"("msmeCategoryEnum");
CREATE INDEX "SellerProfile_verificationStatusEnum_idx" ON "SellerProfile"("verificationStatusEnum");
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");
CREATE INDEX "UserSession_refreshTokenHash_idx" ON "UserSession"("refreshTokenHash");
CREATE INDEX "UserSession_expiresAt_idx" ON "UserSession"("expiresAt");
CREATE INDEX "UserSession_revokedAt_idx" ON "UserSession"("revokedAt");
CREATE INDEX "Permission_module_idx" ON "Permission"("module");
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");
CREATE INDEX "SellerDocument_sellerProfileId_idx" ON "SellerDocument"("sellerProfileId");
CREATE INDEX "SellerDocument_fileAssetId_idx" ON "SellerDocument"("fileAssetId");
CREATE INDEX "SellerDocument_verificationStatus_idx" ON "SellerDocument"("verificationStatus");
CREATE INDEX "SellerDocument_verifiedById_idx" ON "SellerDocument"("verifiedById");
CREATE INDEX "ApiVerificationLog_userId_idx" ON "ApiVerificationLog"("userId");
CREATE INDEX "ApiVerificationLog_provider_idx" ON "ApiVerificationLog"("provider");
CREATE INDEX "ApiVerificationLog_verificationType_idx" ON "ApiVerificationLog"("verificationType");
CREATE INDEX "ApiVerificationLog_status_idx" ON "ApiVerificationLog"("status");
CREATE INDEX "ApiVerificationLog_createdAt_idx" ON "ApiVerificationLog"("createdAt");
CREATE INDEX "ApiLog_userId_idx" ON "ApiLog"("userId");
CREATE INDEX "ApiLog_method_idx" ON "ApiLog"("method");
CREATE INDEX "ApiLog_path_idx" ON "ApiLog"("path");
CREATE INDEX "ApiLog_statusCode_idx" ON "ApiLog"("statusCode");
CREATE INDEX "ApiLog_requestId_idx" ON "ApiLog"("requestId");
CREATE INDEX "ApiLog_createdAt_idx" ON "ApiLog"("createdAt");
CREATE INDEX "ComplianceRule_severity_idx" ON "ComplianceRule"("severity");
CREATE INDEX "ComplianceRule_isActive_idx" ON "ComplianceRule"("isActive");
CREATE INDEX "ComplianceViolation_ruleId_idx" ON "ComplianceViolation"("ruleId");
CREATE INDEX "FraudAlert_alertType_idx" ON "FraudAlert"("alertType");
CREATE INDEX "FraudAlert_severity_idx" ON "FraudAlert"("severity");
CREATE INDEX "FraudAlert_status_idx" ON "FraudAlert"("status");
CREATE INDEX "FraudAlert_userId_idx" ON "FraudAlert"("userId");
CREATE INDEX "FraudAlert_organizationId_idx" ON "FraudAlert"("organizationId");
CREATE INDEX "FraudAlert_entityType_entityId_idx" ON "FraudAlert"("entityType", "entityId");
CREATE INDEX "FraudAlert_createdAt_idx" ON "FraudAlert"("createdAt");
CREATE INDEX "FileAsset_storageProviderEnum_idx" ON "FileAsset"("storageProviderEnum");
CREATE INDEX "FileAsset_fileStatus_idx" ON "FileAsset"("fileStatus");
CREATE INDEX "PaymentTransaction_gatewayEnum_idx" ON "PaymentTransaction"("gatewayEnum");
CREATE INDEX "PaymentTransaction_methodEnum_idx" ON "PaymentTransaction"("methodEnum");
CREATE INDEX "NotificationLog_notificationId_idx" ON "NotificationLog"("notificationId");
CREATE INDEX "NotificationLog_channel_idx" ON "NotificationLog"("channel");
CREATE INDEX "NotificationLog_status_idx" ON "NotificationLog"("status");
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

ALTER TABLE "Organization" ADD CONSTRAINT "Organization_organizationLogoFileId_fkey" FOREIGN KEY ("organizationLogoFileId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BuyerProfile" ADD CONSTRAINT "BuyerProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SellerProfile" ADD CONSTRAINT "SellerProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "RbacRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerDocument" ADD CONSTRAINT "SellerDocument_sellerProfileId_fkey" FOREIGN KEY ("sellerProfileId") REFERENCES "SellerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerDocument" ADD CONSTRAINT "SellerDocument_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerDocument" ADD CONSTRAINT "SellerDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiVerificationLog" ADD CONSTRAINT "ApiVerificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApiLog" ADD CONSTRAINT "ApiLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComplianceViolation" ADD CONSTRAINT "ComplianceViolation_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "ComplianceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FraudAlert" ADD CONSTRAINT "FraudAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FraudAlert" ADD CONSTRAINT "FraudAlert_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FraudAlert" ADD CONSTRAINT "FraudAlert_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
