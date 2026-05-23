-- Repair organization visibility for deployments that already have buyer/seller
-- profiles but did not backfill the additive Organization table.

ALTER TYPE "VerificationStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';

INSERT INTO "Organization" (
  "organizationName",
  "organizationType",
  "gstin",
  "panNumber",
  "city",
  "district",
  "state",
  "pincode",
  "country",
  "website",
  "verificationStatus",
  "organizationOnboardingStatus",
  "createdAt",
  "updatedAt"
)
SELECT
  COALESCE(NULLIF(TRIM(bp."organizationName"), ''), u."name", 'Buyer Organization'),
  'GOVERNMENT'::"OrganizationType",
  NULLIF(TRIM(bp."gst"), ''),
  NULLIF(TRIM(bp."pan"), ''),
  NULLIF(TRIM(bp."city"), ''),
  NULLIF(TRIM(bp."district"), ''),
  NULLIF(TRIM(bp."state"), ''),
  NULLIF(TRIM(bp."pincode"), ''),
  COALESCE(NULLIF(TRIM(bp."country"), ''), 'India'),
  NULLIF(TRIM(bp."website"), ''),
  COALESCE(bp."verificationStatusEnum", 'PENDING'::"VerificationStatus"),
  u."onboardingStatus",
  LEAST(bp."createdAt", u."createdAt"),
  GREATEST(bp."updatedAt", u."updatedAt")
FROM "BuyerProfile" bp
JOIN "User" u ON u."id" = bp."userId"
WHERE bp."organizationId" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Organization" existing
    WHERE existing."organizationName" = COALESCE(NULLIF(TRIM(bp."organizationName"), ''), u."name", 'Buyer Organization')
      AND COALESCE(existing."gstin", '') = COALESCE(NULLIF(TRIM(bp."gst"), ''), '')
      AND COALESCE(existing."panNumber", '') = COALESCE(NULLIF(TRIM(bp."pan"), ''), '')
  );

INSERT INTO "Organization" (
  "organizationName",
  "organizationType",
  "gstin",
  "panNumber",
  "city",
  "state",
  "country",
  "verificationStatus",
  "organizationOnboardingStatus",
  "createdAt",
  "updatedAt"
)
SELECT
  COALESCE(NULLIF(TRIM(sp."businessName"), ''), NULLIF(TRIM(sp."nameAsInPan"), ''), u."name", 'Seller Organization'),
  COALESCE(sp."organizationTypeEnum", 'MSME'::"OrganizationType"),
  NULLIF(TRIM(office."gstNumber"), ''),
  NULLIF(TRIM(sp."pan"), ''),
  NULLIF(TRIM(office."city"), ''),
  NULLIF(TRIM(office."state"), ''),
  'India',
  COALESCE(sp."verificationStatusEnum", 'PENDING'::"VerificationStatus"),
  u."onboardingStatus",
  LEAST(sp."createdAt", u."createdAt"),
  GREATEST(sp."updatedAt", u."updatedAt")
FROM "SellerProfile" sp
JOIN "User" u ON u."id" = sp."userId"
LEFT JOIN LATERAL (
  SELECT so."gstNumber", so."city", so."state"
  FROM "SellerOffice" so
  WHERE so."sellerProfileId" = sp."id"
  ORDER BY so."isMandatory" DESC, so."id" ASC
  LIMIT 1
) office ON true
WHERE sp."organizationId" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Organization" existing
    WHERE existing."organizationName" = COALESCE(NULLIF(TRIM(sp."businessName"), ''), NULLIF(TRIM(sp."nameAsInPan"), ''), u."name", 'Seller Organization')
      AND COALESCE(existing."gstin", '') = COALESCE(NULLIF(TRIM(office."gstNumber"), ''), '')
      AND COALESCE(existing."panNumber", '') = COALESCE(NULLIF(TRIM(sp."pan"), ''), '')
  );

UPDATE "BuyerProfile" bp
SET "organizationId" = org."id"
FROM "User" u, "Organization" org
WHERE u."id" = bp."userId"
  AND bp."organizationId" IS NULL
  AND org."organizationName" = COALESCE(NULLIF(TRIM(bp."organizationName"), ''), u."name", 'Buyer Organization')
  AND COALESCE(org."gstin", '') = COALESCE(NULLIF(TRIM(bp."gst"), ''), '')
  AND COALESCE(org."panNumber", '') = COALESCE(NULLIF(TRIM(bp."pan"), ''), '');

UPDATE "SellerProfile" sp
SET "organizationId" = org."id"
FROM "User" u, "Organization" org
WHERE u."id" = sp."userId"
  AND sp."organizationId" IS NULL
  AND org."organizationName" = COALESCE(NULLIF(TRIM(sp."businessName"), ''), NULLIF(TRIM(sp."nameAsInPan"), ''), u."name", 'Seller Organization')
  AND COALESCE(org."panNumber", '') = COALESCE(NULLIF(TRIM(sp."pan"), ''), '');

UPDATE "User" u
SET "organizationId" = COALESCE(bp."organizationId", sp."organizationId")
FROM "BuyerProfile" bp
FULL JOIN "SellerProfile" sp ON sp."userId" = bp."userId"
WHERE u."organizationId" IS NULL
  AND u."id" = COALESCE(bp."userId", sp."userId")
  AND COALESCE(bp."organizationId", sp."organizationId") IS NOT NULL;
