ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "gateway" TEXT;
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "method" TEXT;
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "gatewayOrderId" TEXT;
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "gatewayPaymentId" TEXT;
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "gatewaySignatureStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_gatewayOrderId_key" ON "PaymentTransaction"("gatewayOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentTransaction_gatewayPaymentId_key" ON "PaymentTransaction"("gatewayPaymentId");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_gateway_status_idx" ON "PaymentTransaction"("gateway", "status");
CREATE INDEX IF NOT EXISTS "PaymentTransaction_gatewayOrderId_idx" ON "PaymentTransaction"("gatewayOrderId");

CREATE TABLE IF NOT EXISTS "PaymentWebhookEvent" (
  "id" SERIAL PRIMARY KEY,
  "gateway" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "rawPayloadHash" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "processed" BOOLEAN NOT NULL DEFAULT false,
  "failureReason" TEXT,
  "metadata" JSONB,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentWebhookEvent_gateway_eventId_key" ON "PaymentWebhookEvent"("gateway", "eventId");
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_gateway_eventType_idx" ON "PaymentWebhookEvent"("gateway", "eventType");
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_processed_idx" ON "PaymentWebhookEvent"("processed");
CREATE INDEX IF NOT EXISTS "PaymentWebhookEvent_receivedAt_idx" ON "PaymentWebhookEvent"("receivedAt");

CREATE TABLE IF NOT EXISTS "EscrowAccount" (
  "id" SERIAL PRIMARY KEY,
  "paymentTransactionId" INTEGER NOT NULL,
  "purchaseOrderId" INTEGER,
  "buyerId" INTEGER NOT NULL,
  "sellerId" INTEGER NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'held',
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fundedAt" TIMESTAMP(3),
  "frozenAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "EscrowAccount_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "PaymentTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EscrowAccount_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EscrowAccount_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EscrowAccount_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "EscrowAccount_paymentTransactionId_key" ON "EscrowAccount"("paymentTransactionId");
CREATE INDEX IF NOT EXISTS "EscrowAccount_buyerId_status_idx" ON "EscrowAccount"("buyerId", "status");
CREATE INDEX IF NOT EXISTS "EscrowAccount_sellerId_status_idx" ON "EscrowAccount"("sellerId", "status");
CREATE INDEX IF NOT EXISTS "EscrowAccount_purchaseOrderId_idx" ON "EscrowAccount"("purchaseOrderId");

CREATE TABLE IF NOT EXISTS "Milestone" (
  "id" SERIAL PRIMARY KEY,
  "escrowAccountId" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "dueDate" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  CONSTRAINT "Milestone_escrowAccountId_fkey" FOREIGN KEY ("escrowAccountId") REFERENCES "EscrowAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "Milestone_escrowAccountId_status_idx" ON "Milestone"("escrowAccountId", "status");

CREATE TABLE IF NOT EXISTS "EscrowTransaction" (
  "id" SERIAL PRIMARY KEY,
  "escrowAccountId" INTEGER NOT NULL,
  "milestoneId" INTEGER,
  "type" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" TEXT NOT NULL DEFAULT 'completed',
  "ledgerEntryId" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EscrowTransaction_escrowAccountId_fkey" FOREIGN KEY ("escrowAccountId") REFERENCES "EscrowAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "EscrowTransaction_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "EscrowTransaction_escrowAccountId_idx" ON "EscrowTransaction"("escrowAccountId");
CREATE INDEX IF NOT EXISTS "EscrowTransaction_milestoneId_idx" ON "EscrowTransaction"("milestoneId");
CREATE INDEX IF NOT EXISTS "EscrowTransaction_type_idx" ON "EscrowTransaction"("type");

CREATE TABLE IF NOT EXISTS "MilestoneApproval" (
  "id" SERIAL PRIMARY KEY,
  "milestoneId" INTEGER NOT NULL,
  "approverId" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'approved',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MilestoneApproval_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MilestoneApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "MilestoneApproval_milestoneId_idx" ON "MilestoneApproval"("milestoneId");
CREATE INDEX IF NOT EXISTS "MilestoneApproval_approverId_idx" ON "MilestoneApproval"("approverId");
