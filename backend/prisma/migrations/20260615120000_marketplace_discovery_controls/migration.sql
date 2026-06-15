-- Additive marketplace discovery APIs, offers, section controls, and interaction tracking.

DO $$ BEGIN
  CREATE TYPE "MarketplaceHomeSectionRuleType" AS ENUM (
    'AUTO_POPULAR',
    'AUTO_DISCOUNTED',
    'AUTO_MOST_PURCHASED',
    'MANUAL_FEATURED',
    'LOCAL_MSME',
    'HERSHG',
    'SERVICES',
    'BUYER_REQUIREMENTS'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MarketplaceInteractionAction" AS ENUM (
    'VIEW',
    'CATEGORY_CLICK',
    'ADD_TO_CART',
    'COMPARE',
    'ORDER',
    'REQUIREMENT_POSTED',
    'SEARCH'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "originalPrice" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "discountPrice" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "discountPercent" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "offerLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "offerStartAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "offerEndAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isOfferActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bulkDealAvailable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bulkMinQuantity" DECIMAL(18,3);

ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "originalPrice" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "discountPrice" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "discountPercent" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "offerLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "offerStartAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "offerEndAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isOfferActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bulkDealAvailable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bulkMinQuantity" DECIMAL(18,3);

CREATE INDEX IF NOT EXISTS "Product_isOfferActive_idx" ON "Product"("isOfferActive");
CREATE INDEX IF NOT EXISTS "Product_offerStartAt_offerEndAt_idx" ON "Product"("offerStartAt", "offerEndAt");
CREATE INDEX IF NOT EXISTS "Service_isOfferActive_idx" ON "Service"("isOfferActive");
CREATE INDEX IF NOT EXISTS "Service_offerStartAt_offerEndAt_idx" ON "Service"("offerStartAt", "offerEndAt");

CREATE TABLE IF NOT EXISTS "MarketplaceHomeSection" (
  "id" SERIAL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "itemLimit" INTEGER NOT NULL DEFAULT 12,
  "ruleType" "MarketplaceHomeSectionRuleType" NOT NULL DEFAULT 'AUTO_POPULAR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceHomeSection_key_key" ON "MarketplaceHomeSection"("key");
CREATE INDEX IF NOT EXISTS "MarketplaceHomeSection_enabled_displayOrder_idx" ON "MarketplaceHomeSection"("enabled", "displayOrder");
CREATE INDEX IF NOT EXISTS "MarketplaceHomeSection_ruleType_idx" ON "MarketplaceHomeSection"("ruleType");

CREATE TABLE IF NOT EXISTS "MarketplaceInteraction" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER,
  "organizationId" INTEGER,
  "itemId" INTEGER,
  "itemType" "CartItemType",
  "categoryId" INTEGER,
  "action" "MarketplaceInteractionAction" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "MarketplaceInteraction_userId_action_createdAt_idx" ON "MarketplaceInteraction"("userId", "action", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketplaceInteraction_organizationId_action_createdAt_idx" ON "MarketplaceInteraction"("organizationId", "action", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketplaceInteraction_itemType_itemId_idx" ON "MarketplaceInteraction"("itemType", "itemId");
CREATE INDEX IF NOT EXISTS "MarketplaceInteraction_categoryId_idx" ON "MarketplaceInteraction"("categoryId");
CREATE INDEX IF NOT EXISTS "MarketplaceInteraction_createdAt_idx" ON "MarketplaceInteraction"("createdAt");

DO $$ BEGIN
  ALTER TABLE "MarketplaceInteraction" ADD CONSTRAINT "MarketplaceInteraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MarketplaceInteraction" ADD CONSTRAINT "MarketplaceInteraction_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "MarketplaceInteraction" ADD CONSTRAINT "MarketplaceInteraction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO "MarketplaceHomeSection" ("key", "title", "enabled", "displayOrder", "itemLimit", "ruleType")
VALUES
  ('popular_picks', 'Popular Picks', true, 10, 12, 'AUTO_POPULAR'),
  ('most_purchased', 'Mostly Purchased Items', true, 20, 12, 'AUTO_MOST_PURCHASED'),
  ('discounted_products', 'Discounted Products and Offers', true, 30, 12, 'AUTO_DISCOUNTED'),
  ('local_msme', 'Local MSME Products', true, 40, 12, 'LOCAL_MSME'),
  ('hershg_products', 'HerSHG and Women SHG Products', true, 50, 12, 'HERSHG'),
  ('services', 'Services You May Need', true, 60, 12, 'SERVICES'),
  ('buyer_requirements', 'Trending Buyer Requirements', true, 70, 8, 'BUYER_REQUIREMENTS')
ON CONFLICT ("key") DO NOTHING;
