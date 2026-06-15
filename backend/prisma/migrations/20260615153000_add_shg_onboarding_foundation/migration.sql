-- Additive SHG/herSHG registration and onboarding foundation.

ALTER TYPE "OrganizationType" ADD VALUE IF NOT EXISTS 'SHG';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'shg';
ALTER TYPE "VerificationType" ADD VALUE IF NOT EXISTS 'GSTIN';

DO $$ BEGIN
  CREATE TYPE "ShgType" AS ENUM (
    'WOMEN_SHG',
    'FARMER_PRODUCER_GROUP',
    'ARTISAN_HANDICRAFT_SHG',
    'DAIRY_COOPERATIVE_SHG',
    'LIVELIHOOD_SHG',
    'TRIBAL_SHG',
    'YOUTH_SHG',
    'OTHER_SHG'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ShgRegistrationStatus" AS ENUM ('REGISTERED', 'UNREGISTERED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ShgApplicationStatus" AS ENUM (
    'DRAFT',
    'EMAIL_PENDING',
    'IN_PROGRESS',
    'PENDING_REVIEW',
    'CORRECTION_REQUIRED',
    'APPROVED',
    'REJECTED',
    'SUSPENDED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ShgDocumentType" AS ENUM (
    'LEADER_KYC',
    'BANK_PASSBOOK',
    'MEMBER_LIST',
    'ADDRESS_PROOF',
    'FORMATION_RESOLUTION',
    'AUTHORIZATION_LETTER',
    'REGISTRATION_CERTIFICATE',
    'PAN_CARD',
    'UDYAM_CERTIFICATE',
    'GST_CERTIFICATE',
    'NRLM_SRLM_CERTIFICATE',
    'TRAINING_CERTIFICATE',
    'PRODUCT_CATALOGUE',
    'ACTIVITY_CERTIFICATE',
    'MEETING_REGISTER',
    'BANK_STATEMENT',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentVerificationStatus" AS ENUM (
    'NOT_UPLOADED',
    'UPLOADED',
    'UNDER_REVIEW',
    'VERIFIED',
    'REJECTED',
    'NEEDS_CORRECTION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ShgOfficeRole" AS ENUM (
    'PRESIDENT',
    'SECRETARY',
    'TREASURER',
    'LEADER',
    'COORDINATOR',
    'AUTHORIZED_REPRESENTATIVE',
    'MEMBER',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ShgProfile" (
  "id" SERIAL PRIMARY KEY,
  "applicationNumber" TEXT,
  "organizationId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "createdById" INTEGER,
  "shgType" "ShgType" NOT NULL DEFAULT 'WOMEN_SHG',
  "shgName" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "district" TEXT NOT NULL,
  "block" TEXT,
  "gramPanchayat" TEXT,
  "village" TEXT NOT NULL,
  "pincode" TEXT,
  "formationYear" INTEGER,
  "formationDate" TIMESTAMP(3),
  "memberCount" INTEGER NOT NULL DEFAULT 0,
  "registrationStatus" "ShgRegistrationStatus" NOT NULL DEFAULT 'UNREGISTERED',
  "registrationNumber" TEXT,
  "nrlmId" TEXT,
  "promotedBy" TEXT,
  "mainActivity" TEXT,
  "gstin" TEXT,
  "udyamNumber" TEXT,
  "website" TEXT,
  "representativeFirstName" TEXT,
  "representativeLastName" TEXT,
  "representativeMobile" TEXT,
  "representativeEmail" TEXT,
  "representativeRole" "ShgOfficeRole",
  "applicationStatus" "ShgApplicationStatus" NOT NULL DEFAULT 'DRAFT',
  "marketplaceInterested" BOOLEAN NOT NULL DEFAULT false,
  "marketplaceEnabled" BOOLEAN NOT NULL DEFAULT false,
  "termsAcceptedAt" TIMESTAMP(3),
  "termsVersion" TEXT,
  "termsIpAddress" TEXT,
  "termsUserAgent" TEXT,
  "consentVersion" TEXT,
  "draftData" JSONB,
  "businessDetails" JSONB,
  "adminRemarks" TEXT,
  "correctionSections" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShgProfile_applicationNumber_key" ON "ShgProfile"("applicationNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "ShgProfile_organizationId_key" ON "ShgProfile"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "ShgProfile_userId_key" ON "ShgProfile"("userId");
CREATE INDEX IF NOT EXISTS "ShgProfile_organizationId_idx" ON "ShgProfile"("organizationId");
CREATE INDEX IF NOT EXISTS "ShgProfile_createdById_idx" ON "ShgProfile"("createdById");
CREATE INDEX IF NOT EXISTS "ShgProfile_applicationStatus_idx" ON "ShgProfile"("applicationStatus");
CREATE INDEX IF NOT EXISTS "ShgProfile_district_idx" ON "ShgProfile"("district");
CREATE INDEX IF NOT EXISTS "ShgProfile_state_idx" ON "ShgProfile"("state");
CREATE INDEX IF NOT EXISTS "ShgProfile_shgName_idx" ON "ShgProfile"("shgName");
CREATE INDEX IF NOT EXISTS "ShgProfile_createdAt_idx" ON "ShgProfile"("createdAt");
CREATE INDEX IF NOT EXISTS "ShgProfile_registrationStatus_idx" ON "ShgProfile"("registrationStatus");

CREATE TABLE IF NOT EXISTS "ShgRepresentativeVerification" (
  "id" SERIAL PRIMARY KEY,
  "shgProfileId" INTEGER NOT NULL,
  "verificationType" "VerificationType" NOT NULL,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "maskedIdentifier" TEXT,
  "identifierLast4" TEXT,
  "provider" TEXT,
  "referenceId" TEXT,
  "consentTextVersion" TEXT,
  "consentedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShgRepresentativeVerification_referenceId_key" ON "ShgRepresentativeVerification"("referenceId");
CREATE INDEX IF NOT EXISTS "ShgRepresentativeVerification_shgProfileId_idx" ON "ShgRepresentativeVerification"("shgProfileId");
CREATE INDEX IF NOT EXISTS "ShgRepresentativeVerification_verificationType_verificationStatus_idx" ON "ShgRepresentativeVerification"("verificationType", "verificationStatus");
CREATE INDEX IF NOT EXISTS "ShgRepresentativeVerification_verifiedAt_idx" ON "ShgRepresentativeVerification"("verifiedAt");

CREATE TABLE IF NOT EXISTS "ShgMember" (
  "id" SERIAL PRIMARY KEY,
  "shgProfileId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "mobile" TEXT,
  "role" TEXT,
  "officeRole" "ShgOfficeRole",
  "gender" TEXT,
  "age" INTEGER,
  "socialCategory" TEXT,
  "aadhaarLast4" TEXT,
  "kycStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "isOfficeBearer" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ShgMember_shgProfileId_idx" ON "ShgMember"("shgProfileId");
CREATE INDEX IF NOT EXISTS "ShgMember_officeRole_idx" ON "ShgMember"("officeRole");
CREATE INDEX IF NOT EXISTS "ShgMember_kycStatus_idx" ON "ShgMember"("kycStatus");

CREATE TABLE IF NOT EXISTS "ShgBankAccount" (
  "id" SERIAL PRIMARY KEY,
  "shgProfileId" INTEGER NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountHolderName" TEXT NOT NULL,
  "accountNumberMasked" TEXT NOT NULL,
  "accountNumberHash" TEXT,
  "ifsc" TEXT NOT NULL,
  "branchName" TEXT,
  "accountType" TEXT NOT NULL DEFAULT 'Savings',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShgBankAccount_accountNumberHash_key" ON "ShgBankAccount"("accountNumberHash");
CREATE INDEX IF NOT EXISTS "ShgBankAccount_shgProfileId_idx" ON "ShgBankAccount"("shgProfileId");
CREATE INDEX IF NOT EXISTS "ShgBankAccount_isPrimary_idx" ON "ShgBankAccount"("isPrimary");
CREATE INDEX IF NOT EXISTS "ShgBankAccount_verificationStatus_idx" ON "ShgBankAccount"("verificationStatus");

CREATE TABLE IF NOT EXISTS "ShgDocument" (
  "id" SERIAL PRIMARY KEY,
  "shgProfileId" INTEGER NOT NULL,
  "documentType" "ShgDocumentType" NOT NULL,
  "fileAssetId" INTEGER,
  "fileName" TEXT,
  "mimeType" TEXT,
  "size" INTEGER,
  "status" "DocumentVerificationStatus" NOT NULL DEFAULT 'NOT_UPLOADED',
  "description" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "remarks" TEXT,
  "uploadedById" INTEGER,
  "verifiedById" INTEGER,
  "uploadedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ShgDocument_shgProfileId_idx" ON "ShgDocument"("shgProfileId");
CREATE INDEX IF NOT EXISTS "ShgDocument_fileAssetId_idx" ON "ShgDocument"("fileAssetId");
CREATE INDEX IF NOT EXISTS "ShgDocument_documentType_idx" ON "ShgDocument"("documentType");
CREATE INDEX IF NOT EXISTS "ShgDocument_status_idx" ON "ShgDocument"("status");
CREATE INDEX IF NOT EXISTS "ShgDocument_verifiedById_idx" ON "ShgDocument"("verifiedById");

CREATE TABLE IF NOT EXISTS "ShgOnboardingProgress" (
  "id" SERIAL PRIMARY KEY,
  "shgProfileId" INTEGER NOT NULL,
  "step" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "completionPercent" INTEGER NOT NULL DEFAULT 0,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShgOnboardingProgress_shgProfileId_step_key" ON "ShgOnboardingProgress"("shgProfileId", "step");
CREATE INDEX IF NOT EXISTS "ShgOnboardingProgress_shgProfileId_idx" ON "ShgOnboardingProgress"("shgProfileId");
CREATE INDEX IF NOT EXISTS "ShgOnboardingProgress_completed_idx" ON "ShgOnboardingProgress"("completed");

CREATE TABLE IF NOT EXISTS "ShgApplicationAuditLog" (
  "id" SERIAL PRIMARY KEY,
  "shgProfileId" INTEGER NOT NULL,
  "actorUserId" INTEGER,
  "actorRole" TEXT,
  "action" TEXT NOT NULL,
  "section" TEXT,
  "remarks" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ShgApplicationAuditLog_shgProfileId_idx" ON "ShgApplicationAuditLog"("shgProfileId");
CREATE INDEX IF NOT EXISTS "ShgApplicationAuditLog_actorUserId_idx" ON "ShgApplicationAuditLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "ShgApplicationAuditLog_action_idx" ON "ShgApplicationAuditLog"("action");
CREATE INDEX IF NOT EXISTS "ShgApplicationAuditLog_createdAt_idx" ON "ShgApplicationAuditLog"("createdAt");

CREATE TABLE IF NOT EXISTS "ShgMeeting" (
  "id" SERIAL PRIMARY KEY,
  "shgProfileId" INTEGER NOT NULL,
  "meetingDate" TIMESTAMP(3) NOT NULL,
  "title" TEXT NOT NULL,
  "agenda" TEXT,
  "decisions" TEXT,
  "minutesFileAssetId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ShgMeeting_shgProfileId_idx" ON "ShgMeeting"("shgProfileId");
CREATE INDEX IF NOT EXISTS "ShgMeeting_meetingDate_idx" ON "ShgMeeting"("meetingDate");
CREATE INDEX IF NOT EXISTS "ShgMeeting_minutesFileAssetId_idx" ON "ShgMeeting"("minutesFileAssetId");

CREATE TABLE IF NOT EXISTS "ShgResolution" (
  "id" SERIAL PRIMARY KEY,
  "shgProfileId" INTEGER NOT NULL,
  "meetingId" INTEGER,
  "title" TEXT NOT NULL,
  "resolutionDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "fileAssetId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ShgResolution_shgProfileId_idx" ON "ShgResolution"("shgProfileId");
CREATE INDEX IF NOT EXISTS "ShgResolution_meetingId_idx" ON "ShgResolution"("meetingId");
CREATE INDEX IF NOT EXISTS "ShgResolution_resolutionDate_idx" ON "ShgResolution"("resolutionDate");
CREATE INDEX IF NOT EXISTS "ShgResolution_fileAssetId_idx" ON "ShgResolution"("fileAssetId");

CREATE TABLE IF NOT EXISTS "ShgDocumentRequirementConfig" (
  "id" SERIAL PRIMARY KEY,
  "state" TEXT,
  "district" TEXT,
  "shgType" "ShgType",
  "activityType" TEXT,
  "registrationStatus" "ShgRegistrationStatus",
  "documentType" "ShgDocumentType" NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "maxFileSizeMb" INTEGER NOT NULL DEFAULT 10,
  "allowedMimeTypes" TEXT[] NOT NULL DEFAULT ARRAY['application/pdf', 'image/jpeg', 'image/png']::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ShgDocumentRequirementConfig_state_district_shgType_activityType_registrationStatus_documentType_key"
  ON "ShgDocumentRequirementConfig"("state", "district", "shgType", "activityType", "registrationStatus", "documentType");
CREATE INDEX IF NOT EXISTS "ShgDocumentRequirementConfig_district_idx" ON "ShgDocumentRequirementConfig"("district");
CREATE INDEX IF NOT EXISTS "ShgDocumentRequirementConfig_shgType_idx" ON "ShgDocumentRequirementConfig"("shgType");
CREATE INDEX IF NOT EXISTS "ShgDocumentRequirementConfig_registrationStatus_idx" ON "ShgDocumentRequirementConfig"("registrationStatus");
CREATE INDEX IF NOT EXISTS "ShgDocumentRequirementConfig_documentType_idx" ON "ShgDocumentRequirementConfig"("documentType");

DO $$ BEGIN
  ALTER TABLE "ShgProfile" ADD CONSTRAINT "ShgProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShgProfile" ADD CONSTRAINT "ShgProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShgRepresentativeVerification" ADD CONSTRAINT "ShgRepresentativeVerification_shgProfileId_fkey" FOREIGN KEY ("shgProfileId") REFERENCES "ShgProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShgMember" ADD CONSTRAINT "ShgMember_shgProfileId_fkey" FOREIGN KEY ("shgProfileId") REFERENCES "ShgProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShgBankAccount" ADD CONSTRAINT "ShgBankAccount_shgProfileId_fkey" FOREIGN KEY ("shgProfileId") REFERENCES "ShgProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShgDocument" ADD CONSTRAINT "ShgDocument_shgProfileId_fkey" FOREIGN KEY ("shgProfileId") REFERENCES "ShgProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShgDocument" ADD CONSTRAINT "ShgDocument_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShgOnboardingProgress" ADD CONSTRAINT "ShgOnboardingProgress_shgProfileId_fkey" FOREIGN KEY ("shgProfileId") REFERENCES "ShgProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShgApplicationAuditLog" ADD CONSTRAINT "ShgApplicationAuditLog_shgProfileId_fkey" FOREIGN KEY ("shgProfileId") REFERENCES "ShgProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShgMeeting" ADD CONSTRAINT "ShgMeeting_shgProfileId_fkey" FOREIGN KEY ("shgProfileId") REFERENCES "ShgProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShgMeeting" ADD CONSTRAINT "ShgMeeting_minutesFileAssetId_fkey" FOREIGN KEY ("minutesFileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShgResolution" ADD CONSTRAINT "ShgResolution_shgProfileId_fkey" FOREIGN KEY ("shgProfileId") REFERENCES "ShgProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShgResolution" ADD CONSTRAINT "ShgResolution_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "ShgMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ShgResolution" ADD CONSTRAINT "ShgResolution_fileAssetId_fkey" FOREIGN KEY ("fileAssetId") REFERENCES "FileAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO "ShgDocumentRequirementConfig" ("state", "district", "shgType", "registrationStatus", "documentType", "isRequired", "description")
VALUES
  (NULL, NULL, NULL, NULL, 'LEADER_KYC', true, 'Group leader Aadhaar/KYC or digital verification proof'),
  (NULL, NULL, NULL, NULL, 'BANK_PASSBOOK', true, 'Bank passbook or cancelled cheque'),
  (NULL, NULL, NULL, NULL, 'MEMBER_LIST', true, 'Member list with signatures'),
  (NULL, NULL, NULL, NULL, 'ADDRESS_PROOF', true, 'SHG address or meeting-place proof'),
  (NULL, NULL, NULL, NULL, 'FORMATION_RESOLUTION', true, 'Formation or meeting resolution'),
  (NULL, NULL, NULL, NULL, 'AUTHORIZATION_LETTER', true, 'Authorization letter for the representative'),
  (NULL, NULL, NULL, 'REGISTERED', 'REGISTRATION_CERTIFICATE', true, 'SHG registration certificate for registered groups'),
  (NULL, NULL, NULL, NULL, 'PAN_CARD', false, 'PAN card where available'),
  (NULL, NULL, NULL, NULL, 'UDYAM_CERTIFICATE', false, 'Udyam registration certificate where available'),
  (NULL, NULL, NULL, NULL, 'GST_CERTIFICATE', false, 'GST certificate where applicable'),
  (NULL, NULL, NULL, NULL, 'NRLM_SRLM_CERTIFICATE', false, 'NRLM/SRLM/Mission Shakti certificate or ID proof'),
  (NULL, NULL, NULL, NULL, 'TRAINING_CERTIFICATE', false, 'Training or skill certificates'),
  (NULL, NULL, NULL, NULL, 'PRODUCT_CATALOGUE', false, 'Product photos or catalogue')
ON CONFLICT DO NOTHING;
