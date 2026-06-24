-- CreateTable
CREATE TABLE "PreRegistrationKycSession" (
    "id" SERIAL NOT NULL,
    "kycSessionTokenHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "verificationType" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "redirectUri" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "used" BOOLEAN NOT NULL DEFAULT false,
    "verifiedName" TEXT,
    "verifiedDob" TIMESTAMP(3),
    "verifiedGender" TEXT,
    "referenceKey" TEXT,
    "idTokenSubject" TEXT,
    "idTokenVerified" BOOLEAN NOT NULL DEFAULT false,
    "aadhaarLast4" TEXT,
    "mobileHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreRegistrationKycSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreRegistrationKycSession_kycSessionTokenHash_key" ON "PreRegistrationKycSession"("kycSessionTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PreRegistrationKycSession_state_key" ON "PreRegistrationKycSession"("state");

-- CreateIndex
CREATE INDEX "PreRegistrationKycSession_kycSessionTokenHash_idx" ON "PreRegistrationKycSession"("kycSessionTokenHash");

-- CreateIndex
CREATE INDEX "PreRegistrationKycSession_state_idx" ON "PreRegistrationKycSession"("state");
