CREATE TABLE IF NOT EXISTS "ComplianceViolation" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'open',
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComplianceViolation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ComplianceViolation_userId_idx" ON "ComplianceViolation"("userId");
CREATE INDEX IF NOT EXISTS "ComplianceViolation_type_idx" ON "ComplianceViolation"("type");
CREATE INDEX IF NOT EXISTS "ComplianceViolation_status_idx" ON "ComplianceViolation"("status");

CREATE TABLE IF NOT EXISTS "LoginEvent" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "deviceHash" TEXT,
  "city" TEXT,
  "state" TEXT,
  "success" BOOLEAN NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "LoginEvent_userId_idx" ON "LoginEvent"("userId");
CREATE INDEX IF NOT EXISTS "LoginEvent_deviceHash_idx" ON "LoginEvent"("deviceHash");
CREATE INDEX IF NOT EXISTS "LoginEvent_createdAt_idx" ON "LoginEvent"("createdAt");

ALTER TYPE "OnboardingStatus" ADD VALUE IF NOT EXISTS 'manual_review_required';
