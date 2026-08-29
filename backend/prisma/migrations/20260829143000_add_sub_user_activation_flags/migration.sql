ALTER TABLE "User"
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "requiresMobileVerification" BOOLEAN NOT NULL DEFAULT false;
