CREATE TABLE IF NOT EXISTS "Conversation" (
  "id" SERIAL PRIMARY KEY,
  "tenderId" INTEGER,
  "buyerId" INTEGER NOT NULL,
  "sellerId" INTEGER NOT NULL,
  "subject" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "lastMessageAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Message" (
  "id" SERIAL PRIMARY KEY,
  "conversationId" INTEGER NOT NULL,
  "senderId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'sent',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "MessageAttachment" (
  "id" SERIAL PRIMARY KEY,
  "messageId" INTEGER NOT NULL,
  "fileAssetId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Dispute" (
  "id" SERIAL PRIMARY KEY,
  "purchaseOrderId" INTEGER,
  "paymentTransactionId" INTEGER,
  "escrowAccountId" INTEGER,
  "buyerId" INTEGER NOT NULL,
  "sellerId" INTEGER NOT NULL,
  "raisedById" INTEGER NOT NULL,
  "category" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "resolutionRemarks" TEXT,
  "resolvedById" INTEGER,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "DisputeMessage" (
  "id" SERIAL PRIMARY KEY,
  "disputeId" INTEGER NOT NULL,
  "senderId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "internal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "DisputeEvidence" (
  "id" SERIAL PRIMARY KEY,
  "disputeId" INTEGER NOT NULL,
  "fileAssetId" INTEGER NOT NULL,
  "uploadedById" INTEGER NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "GrievanceTicket" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "assignedAdminId" INTEGER,
  "category" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "status" TEXT NOT NULL DEFAULT 'open',
  "slaDueAt" TIMESTAMP(3) NOT NULL,
  "resolutionRemarks" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "GrievanceComment" (
  "id" SERIAL PRIMARY KEY,
  "grievanceId" INTEGER NOT NULL,
  "authorId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "internal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "GrievanceAttachment" (
  "id" SERIAL PRIMARY KEY,
  "grievanceId" INTEGER NOT NULL,
  "fileAssetId" INTEGER NOT NULL,
  "uploadedById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_tenderId_fkey') THEN
    ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenderId_fkey" FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_buyerId_fkey') THEN
    ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_sellerId_fkey') THEN
    ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_conversationId_fkey') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_senderId_fkey') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageAttachment_messageId_fkey') THEN
    ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Dispute_buyerId_fkey') THEN
    ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Dispute_sellerId_fkey') THEN
    ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Dispute_raisedById_fkey') THEN
    ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Dispute_resolvedById_fkey') THEN
    ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DisputeMessage_disputeId_fkey') THEN
    ALTER TABLE "DisputeMessage" ADD CONSTRAINT "DisputeMessage_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DisputeMessage_senderId_fkey') THEN
    ALTER TABLE "DisputeMessage" ADD CONSTRAINT "DisputeMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DisputeEvidence_disputeId_fkey') THEN
    ALTER TABLE "DisputeEvidence" ADD CONSTRAINT "DisputeEvidence_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "Dispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DisputeEvidence_uploadedById_fkey') THEN
    ALTER TABLE "DisputeEvidence" ADD CONSTRAINT "DisputeEvidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrievanceTicket_userId_fkey') THEN
    ALTER TABLE "GrievanceTicket" ADD CONSTRAINT "GrievanceTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrievanceTicket_assignedAdminId_fkey') THEN
    ALTER TABLE "GrievanceTicket" ADD CONSTRAINT "GrievanceTicket_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrievanceComment_grievanceId_fkey') THEN
    ALTER TABLE "GrievanceComment" ADD CONSTRAINT "GrievanceComment_grievanceId_fkey" FOREIGN KEY ("grievanceId") REFERENCES "GrievanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrievanceComment_authorId_fkey') THEN
    ALTER TABLE "GrievanceComment" ADD CONSTRAINT "GrievanceComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrievanceAttachment_grievanceId_fkey') THEN
    ALTER TABLE "GrievanceAttachment" ADD CONSTRAINT "GrievanceAttachment_grievanceId_fkey" FOREIGN KEY ("grievanceId") REFERENCES "GrievanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrievanceAttachment_uploadedById_fkey') THEN
    ALTER TABLE "GrievanceAttachment" ADD CONSTRAINT "GrievanceAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversationTenderPair') THEN
    ALTER TABLE "Conversation" ADD CONSTRAINT "conversationTenderPair" UNIQUE ("tenderId", "buyerId", "sellerId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Conversation_buyerId_sellerId_idx" ON "Conversation"("buyerId", "sellerId");
CREATE INDEX IF NOT EXISTS "Conversation_tenderId_idx" ON "Conversation"("tenderId");
CREATE INDEX IF NOT EXISTS "Conversation_status_idx" ON "Conversation"("status");
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "Message_senderId_createdAt_idx" ON "Message"("senderId", "createdAt");
CREATE INDEX IF NOT EXISTS "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");
CREATE INDEX IF NOT EXISTS "MessageAttachment_fileAssetId_idx" ON "MessageAttachment"("fileAssetId");
CREATE INDEX IF NOT EXISTS "Dispute_buyerId_status_idx" ON "Dispute"("buyerId", "status");
CREATE INDEX IF NOT EXISTS "Dispute_sellerId_status_idx" ON "Dispute"("sellerId", "status");
CREATE INDEX IF NOT EXISTS "Dispute_raisedById_idx" ON "Dispute"("raisedById");
CREATE INDEX IF NOT EXISTS "Dispute_purchaseOrderId_idx" ON "Dispute"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "Dispute_paymentTransactionId_idx" ON "Dispute"("paymentTransactionId");
CREATE INDEX IF NOT EXISTS "Dispute_escrowAccountId_idx" ON "Dispute"("escrowAccountId");
CREATE INDEX IF NOT EXISTS "DisputeMessage_disputeId_createdAt_idx" ON "DisputeMessage"("disputeId", "createdAt");
CREATE INDEX IF NOT EXISTS "DisputeMessage_senderId_createdAt_idx" ON "DisputeMessage"("senderId", "createdAt");
CREATE INDEX IF NOT EXISTS "DisputeEvidence_disputeId_idx" ON "DisputeEvidence"("disputeId");
CREATE INDEX IF NOT EXISTS "DisputeEvidence_fileAssetId_idx" ON "DisputeEvidence"("fileAssetId");
CREATE INDEX IF NOT EXISTS "GrievanceTicket_userId_status_idx" ON "GrievanceTicket"("userId", "status");
CREATE INDEX IF NOT EXISTS "GrievanceTicket_assignedAdminId_status_idx" ON "GrievanceTicket"("assignedAdminId", "status");
CREATE INDEX IF NOT EXISTS "GrievanceTicket_slaDueAt_idx" ON "GrievanceTicket"("slaDueAt");
CREATE INDEX IF NOT EXISTS "GrievanceComment_grievanceId_createdAt_idx" ON "GrievanceComment"("grievanceId", "createdAt");
CREATE INDEX IF NOT EXISTS "GrievanceComment_authorId_createdAt_idx" ON "GrievanceComment"("authorId", "createdAt");
CREATE INDEX IF NOT EXISTS "GrievanceAttachment_grievanceId_idx" ON "GrievanceAttachment"("grievanceId");
CREATE INDEX IF NOT EXISTS "GrievanceAttachment_fileAssetId_idx" ON "GrievanceAttachment"("fileAssetId");
