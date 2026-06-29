-- Dynamic scoped RBAC foundation.
-- Keeps legacy User.role and existing RBAC tables intact while adding
-- account type and scoped role/assignment metadata.

CREATE TABLE IF NOT EXISTS "AccountType" (
  "id" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccountType_code_key" ON "AccountType"("code");
CREATE INDEX IF NOT EXISTS "AccountType_isActive_idx" ON "AccountType"("isActive");

INSERT INTO "AccountType" ("id", "code", "name", "description")
VALUES
  (0, 'MASTER_ADMIN', 'Master Admin', 'Platform master administrator'),
  (1, 'SUPERADMIN', 'Superadmin / Collector', 'District or collector administrator'),
  (2, 'SELLER', 'Seller', 'Seller organization account'),
  (3, 'BUYER', 'Buyer', 'Buyer organization account'),
  (4, 'SHG', 'SHG', 'Self-help group account'),
  (5, 'FINANCIER', 'Financier', 'Financing partner account')
ON CONFLICT ("id") DO UPDATE SET
  "code" = EXCLUDED."code",
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "accountTypeId" INTEGER DEFAULT 3;

UPDATE "User"
SET
  "accountTypeId" = CASE "role"::text
    WHEN 'master_admin' THEN 0
    WHEN 'admin' THEN 1
    WHEN 'seller' THEN 2
    WHEN 'buyer' THEN 3
    WHEN 'shg' THEN 4
    WHEN 'financier' THEN 5
    ELSE 3
  END;

ALTER TABLE "User"
  ADD CONSTRAINT "User_accountTypeId_fkey"
  FOREIGN KEY ("accountTypeId") REFERENCES "AccountType"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RbacRole"
  ADD COLUMN IF NOT EXISTS "scopeType" "RoleScope" NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN IF NOT EXISTS "scopeId" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "RoleStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "createdById" INTEGER;

UPDATE "RbacRole"
SET
  "scopeType" = CASE
    WHEN "scope" = 'GLOBAL' THEN 'PLATFORM'::"RoleScope"
    WHEN "scope" = 'COMPANY' THEN 'DISTRICT'::"RoleScope"
    ELSE "scope"
  END,
  "scopeId" = CASE
    WHEN "companyId" IS NOT NULL THEN "companyId"::TEXT
    ELSE "scopeId"
  END;

ALTER TABLE "Permission"
  ADD COLUMN IF NOT EXISTS "resource" TEXT,
  ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Permission"
SET "resource" = COALESCE("resource", split_part("code", '.', 1));

ALTER TABLE "RolePermission"
  ADD COLUMN IF NOT EXISTS "allowed" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "UserRole"
  ADD COLUMN IF NOT EXISTS "scopeType" "RoleScope" NOT NULL DEFAULT 'GLOBAL',
  ADD COLUMN IF NOT EXISTS "scopeId" TEXT,
  ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

UPDATE "UserRole"
SET
  "scopeType" = CASE
    WHEN "organizationId" IS NOT NULL THEN 'ORGANIZATION'::"RoleScope"
    WHEN "companyId" IS NOT NULL THEN 'DISTRICT'::"RoleScope"
    ELSE 'PLATFORM'::"RoleScope"
  END,
  "scopeId" = CASE
    WHEN "organizationId" IS NOT NULL THEN "organizationId"::TEXT
    WHEN "companyId" IS NOT NULL THEN "companyId"::TEXT
    ELSE NULL
  END;

CREATE TABLE IF NOT EXISTS "ScopedInvitation" (
  "id" SERIAL NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "mobile" TEXT,
  "accountTypeId" INTEGER,
  "scopeType" "RoleScope" NOT NULL,
  "scopeId" TEXT,
  "roleIds" JSONB NOT NULL,
  "token" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "invitedById" INTEGER NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScopedInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ScopedInvitation_token_key" ON "ScopedInvitation"("token");
CREATE INDEX IF NOT EXISTS "ScopedInvitation_email_idx" ON "ScopedInvitation"("email");
CREATE INDEX IF NOT EXISTS "ScopedInvitation_scopeType_scopeId_idx" ON "ScopedInvitation"("scopeType", "scopeId");
CREATE INDEX IF NOT EXISTS "ScopedInvitation_status_idx" ON "ScopedInvitation"("status");
CREATE INDEX IF NOT EXISTS "ScopedInvitation_accountTypeId_idx" ON "ScopedInvitation"("accountTypeId");
CREATE INDEX IF NOT EXISTS "ScopedInvitation_invitedById_idx" ON "ScopedInvitation"("invitedById");
CREATE INDEX IF NOT EXISTS "ScopedInvitation_expiresAt_idx" ON "ScopedInvitation"("expiresAt");

ALTER TABLE "ScopedInvitation"
  ADD CONSTRAINT "ScopedInvitation_accountTypeId_fkey"
  FOREIGN KEY ("accountTypeId") REFERENCES "AccountType"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScopedInvitation"
  ADD CONSTRAINT "ScopedInvitation_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "User_accountTypeId_idx" ON "User"("accountTypeId");
CREATE INDEX IF NOT EXISTS "RbacRole_scopeType_scopeId_idx" ON "RbacRole"("scopeType", "scopeId");
CREATE INDEX IF NOT EXISTS "RbacRole_status_idx" ON "RbacRole"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "RbacRole_scopeType_scopeId_name_key" ON "RbacRole"("scopeType", "scopeId", "name");
CREATE INDEX IF NOT EXISTS "Permission_resource_idx" ON "Permission"("resource");
CREATE INDEX IF NOT EXISTS "UserRole_scopeType_scopeId_idx" ON "UserRole"("scopeType", "scopeId");
