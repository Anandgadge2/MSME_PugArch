CREATE TABLE IF NOT EXISTS "FileAsset" (
  "id" SERIAL PRIMARY KEY,
  "ownerId" INTEGER NOT NULL,
  "ownerRole" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" INTEGER,
  "storageProvider" TEXT NOT NULL,
  "bucket" TEXT,
  "key" TEXT NOT NULL,
  "url" TEXT,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FileAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "FileAsset_ownerId_idx" ON "FileAsset"("ownerId");
CREATE INDEX IF NOT EXISTS "FileAsset_entityType_entityId_idx" ON "FileAsset"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "FileAsset_checksum_idx" ON "FileAsset"("checksum");
CREATE INDEX IF NOT EXISTS "FileAsset_status_idx" ON "FileAsset"("status");
