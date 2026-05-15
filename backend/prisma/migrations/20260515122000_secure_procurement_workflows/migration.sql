ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "documentUrl" TEXT;
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "fileAssetId" INTEGER;
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "withdrawnAt" TIMESTAMP(3);
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "lastIpAddress" TEXT;
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "lastUserAgentHash" TEXT;
ALTER TABLE "Bid" ADD COLUMN IF NOT EXISTS "deviceHash" TEXT;

ALTER TABLE "Auction" ADD COLUMN IF NOT EXISTS "minDecrement" DOUBLE PRECISION NOT NULL DEFAULT 1;
ALTER TABLE "Auction" ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3);
ALTER TABLE "Auction" ADD COLUMN IF NOT EXISTS "winnerSellerId" INTEGER;
ALTER TABLE "Auction" ADD COLUMN IF NOT EXISTS "overrideReason" TEXT;
ALTER TABLE "Auction" ALTER COLUMN "status" SET DEFAULT 'scheduled';

CREATE TABLE IF NOT EXISTS "AuctionBid" (
  "id" SERIAL PRIMARY KEY,
  "auctionId" INTEGER NOT NULL,
  "sellerId" INTEGER NOT NULL,
  "bidAmount" DOUBLE PRECISION NOT NULL,
  "ipAddress" TEXT,
  "userAgentHash" TEXT,
  "deviceHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuctionBid_auctionId_fkey'
  ) THEN
    ALTER TABLE "AuctionBid"
    ADD CONSTRAINT "AuctionBid_auctionId_fkey"
    FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuctionBid_sellerId_fkey'
  ) THEN
    ALTER TABLE "AuctionBid"
    ADD CONSTRAINT "AuctionBid_sellerId_fkey"
    FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Auction_winnerSellerId_fkey'
  ) THEN
    ALTER TABLE "Auction"
    ADD CONSTRAINT "Auction_winnerSellerId_fkey"
    FOREIGN KEY ("winnerSellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Bid_tenderId_status_idx" ON "Bid"("tenderId", "status");
CREATE INDEX IF NOT EXISTS "Bid_lastIpAddress_idx" ON "Bid"("lastIpAddress");
CREATE INDEX IF NOT EXISTS "Auction_status_endTime_idx" ON "Auction"("status", "endTime");
CREATE INDEX IF NOT EXISTS "Auction_winnerSellerId_idx" ON "Auction"("winnerSellerId");
CREATE INDEX IF NOT EXISTS "AuctionBid_auctionId_createdAt_idx" ON "AuctionBid"("auctionId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuctionBid_auctionId_bidAmount_idx" ON "AuctionBid"("auctionId", "bidAmount");
CREATE INDEX IF NOT EXISTS "AuctionBid_sellerId_createdAt_idx" ON "AuctionBid"("sellerId", "createdAt");
