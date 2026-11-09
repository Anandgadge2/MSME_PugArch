import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../dist/src/lib/prisma.js';
import {
  createHashFingerprint,
  isEncrypted,
  decryptField
} from '../dist/src/utils/crypto.js';
import { toLocalIndianMobile } from '../dist/src/services/sms.service.js';

test('--- CHALLENGER 2: MILESTONE 1 EMPIRICAL VERIFICATION START ---', () => {
  assert.ok(true, 'Initiating Challenger 2 Verification');
});

// ============================================================================
// PART 1: PHYSICAL SCHEMA VERIFICATION (GAP 4 & GAP 5)
// ============================================================================

test('EMPIRICAL SCHEMA: Physical aadhaarNumber columns are completely absent from BuyerProfile and SellerProfile', async () => {
  const buyerAadhaarCols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'BuyerProfile' AND column_name = 'aadhaarNumber'
  `);
  assert.equal(buyerAadhaarCols.length, 0, 'BuyerProfile must NOT have an aadhaarNumber column');

  const sellerAadhaarCols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'SellerProfile' AND column_name = 'aadhaarNumber'
  `);
  assert.equal(sellerAadhaarCols.length, 0, 'SellerProfile must NOT have an aadhaarNumber column');

  // Verify blind index columns exist
  const buyerCols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'BuyerProfile' AND column_name IN ('aadhaarMasked', 'aadhaarHash', 'mobileFingerprint')
  `);
  const buyerColNames = buyerCols.map((c) => c.column_name);
  assert.ok(buyerColNames.includes('aadhaarMasked'), 'BuyerProfile must have aadhaarMasked');
  assert.ok(buyerColNames.includes('aadhaarHash'), 'BuyerProfile must have aadhaarHash');
  assert.ok(buyerColNames.includes('mobileFingerprint'), 'BuyerProfile must have mobileFingerprint');

  const sellerCols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'SellerProfile' AND column_name IN ('aadhaarMasked', 'aadhaarHash', 'mobileFingerprint')
  `);
  const sellerColNames = sellerCols.map((c) => c.column_name);
  assert.ok(sellerColNames.includes('aadhaarMasked'), 'SellerProfile must have aadhaarMasked');
  assert.ok(sellerColNames.includes('aadhaarHash'), 'SellerProfile must have aadhaarHash');
  assert.ok(sellerColNames.includes('mobileFingerprint'), 'SellerProfile must have mobileFingerprint');

  const userCols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'User' AND column_name = 'mobileFingerprint'
  `);
  assert.equal(userCols.length, 1, 'User table must have mobileFingerprint column');

  const orgCols = await prisma.$queryRawUnsafe(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'Organization' AND column_name = 'panFingerprint'
  `);
  assert.equal(orgCols.length, 1, 'Organization table must have panFingerprint column');
});

// ============================================================================
// PART 2: TASK 1 - MOBILE LOOKUPS WITH FORMAT VARIATIONS & LEGACY FALLBACK
// ============================================================================

test('EMPIRICAL TASK 1: Mobile lookups with standard, whitespace, +91, and legacy records', async () => {
  const testEmail = `ch2_m1_mobile_${Date.now()}@test.internal`;
  const plainMobile = '9876543210';
  const expectedFingerprint = createHashFingerprint(plainMobile, 'mobile');

  // 1. Create a user with standard mobile
  const createdUser = await prisma.user.create({
    data: {
      name: 'Challenger 2 Mobile Test User',
      email: testEmail,
      password: '$2a$10$hashedpasswordplaceholder00000000000000000000000000000000',
      role: 'buyer',
      mobile: plainMobile
    }
  });

  try {
    // 2. Empirically inspect raw DB storage (bypass Prisma decryption)
    const rawRows = await prisma.$queryRawUnsafe(
      `SELECT mobile, "mobileFingerprint" FROM "User" WHERE id = $1`,
      createdUser.id
    );
    assert.equal(rawRows.length, 1, 'User must exist in database');
    const rawMobile = rawRows[0].mobile;
    const rawFp = rawRows[0].mobileFingerprint;

    assert.ok(isEncrypted(rawMobile), 'Database mobile column must be encrypted with enc:v1:');
    assert.notEqual(rawMobile, plainMobile, 'Raw database column must NOT be plaintext');
    assert.equal(decryptField(rawMobile), plainMobile, 'Decryption of raw mobile must equal original plaintext');
    assert.equal(rawFp, expectedFingerprint, 'Database mobileFingerprint must strictly match createHashFingerprint');

    // 3. Test Prisma User.findFirst lookup with exact 10 digits
    const foundExact = await prisma.user.findFirst({
      where: { mobile: plainMobile }
    });
    assert.ok(foundExact, 'User.findFirst with exact 10-digit mobile must succeed');
    assert.equal(foundExact.id, createdUser.id);
    assert.equal(foundExact.mobile, plainMobile, 'Prisma must transparently decrypt mobile on read');

    // 4. Test Prisma User.findFirst lookup with whitespace separation ('98765 43210')
    const foundSpaced = await prisma.user.findFirst({
      where: { mobile: '98765 43210' }
    });
    assert.ok(foundSpaced, 'User.findFirst with internal whitespace mobile must succeed via blind index normalization');
    assert.equal(foundSpaced.id, createdUser.id);

    // 5. Test Prisma User.findFirst lookup with leading/trailing spaces
    const foundPadded = await prisma.user.findFirst({
      where: { mobile: '   9876543210   ' }
    });
    assert.ok(foundPadded, 'User.findFirst with padded whitespace must succeed');
    assert.equal(foundPadded.id, createdUser.id);

    // 6. Test +91 formatting normalization through toLocalIndianMobile
    const normalizedWith91Spaces = toLocalIndianMobile('+91 98765 43210');
    assert.equal(normalizedWith91Spaces, plainMobile, 'toLocalIndianMobile must strip +91 and spaces to 10 digits');
    const foundNormalized1 = await prisma.user.findFirst({
      where: { mobile: normalizedWith91Spaces }
    });
    assert.ok(foundNormalized1, 'User.findFirst with normalized +91 mobile must succeed');
    assert.equal(foundNormalized1.id, createdUser.id);

    const normalizedWith91Plain = toLocalIndianMobile('+919876543210');
    assert.equal(normalizedWith91Plain, plainMobile);
    const foundNormalized2 = await prisma.user.findFirst({
      where: { mobile: normalizedWith91Plain }
    });
    assert.ok(foundNormalized2, 'User.findFirst with normalized +919876543210 must succeed');
    assert.equal(foundNormalized2.id, createdUser.id);

    // 7. Test Dual-Layer Query used in auth.controller.ts (where: { OR: [{ mobileFingerprint }, { mobile }] })
    const foundDualLayer = await prisma.user.findFirst({
      where: {
        OR: [
          { mobileFingerprint: expectedFingerprint },
          { mobile: plainMobile }
        ]
      }
    });
    assert.ok(foundDualLayer, 'Auth controller dual-layer OR query must find encrypted record via blind index');
    assert.equal(foundDualLayer.id, createdUser.id);

    // 8. Test Legacy Plaintext Record Fallback
    const legacyEmail = `ch2_m1_legacy_${Date.now()}@test.internal`;
    const legacyMobile = '9111222333';
    // Insert raw unencrypted record directly into SQL with NULL mobileFingerprint
    await prisma.$executeRawUnsafe(`
      INSERT INTO "User" (name, email, password, role, mobile, "mobileFingerprint", "updatedAt")
      VALUES ('Challenger 2 Legacy User', '${legacyEmail}', 'dummy_hash', 'buyer', '${legacyMobile}', NULL, NOW())
    `);

    // Verify query rewriting matches legacy unencrypted record via { mobile: legacyMobile }
    const foundLegacyDirect = await prisma.user.findFirst({
      where: { mobile: legacyMobile }
    });
    assert.ok(foundLegacyDirect, 'User.findFirst query rewriting must successfully find legacy plaintext record');
    assert.equal(foundLegacyDirect.email, legacyEmail);
    assert.equal(foundLegacyDirect.mobile, legacyMobile);

    // Verify explicit dual-layer query also matches legacy record
    const foundLegacyDual = await prisma.user.findFirst({
      where: {
        OR: [
          { mobileFingerprint: createHashFingerprint(legacyMobile, 'mobile') },
          { mobile: legacyMobile }
        ]
      }
    });
    assert.ok(foundLegacyDual, 'Dual-layer query must match legacy record via mobile fallback branch');
    assert.equal(foundLegacyDual.email, legacyEmail);

    // Cleanup legacy user
    await prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE email = '${legacyEmail}'`);
  } finally {
    // Cleanup created user
    await prisma.user.delete({ where: { id: createdUser.id } }).catch(() => {});
  }
});

// ============================================================================
// PART 3: TASK 2 - ORGANIZATION PAN LOOKUPS & NORMALIZATION
// ============================================================================

test('EMPIRICAL TASK 2: Organization PAN lookups, uppercase/whitespace normalization, and panFingerprint', async () => {
  const testPanSuffix = Math.floor(1000 + Math.random() * 8999);
  const testPan = `ABCDE${testPanSuffix}F`;
  const orgName = `Challenger 2 Org ${Date.now()}`;
  const expectedPanFingerprint = createHashFingerprint(testPan, 'pan');

  // 1. Create Organization with canonical PAN
  const createdOrg = await prisma.organization.create({
    data: {
      organizationName: orgName,
      organizationType: 'PRIVATE_LIMITED',
      panNumber: testPan
    }
  });

  try {
    // 2. Empirically inspect raw DB storage
    const rawOrgRows = await prisma.$queryRawUnsafe(
      `SELECT "panNumber", "panFingerprint" FROM "Organization" WHERE id = $1`,
      createdOrg.id
    );
    assert.equal(rawOrgRows.length, 1);
    const rawPan = rawOrgRows[0].panNumber;
    const rawFp = rawOrgRows[0].panFingerprint;

    assert.ok(isEncrypted(rawPan), 'Organization.panNumber in database must be encrypted with enc:v1:');
    assert.notEqual(rawPan, testPan, 'Raw panNumber must not be plaintext');
    assert.equal(decryptField(rawPan), testPan, 'Decryption must yield exact PAN');
    assert.equal(rawFp, expectedPanFingerprint, 'Organization.panFingerprint must match createHashFingerprint(pan, "pan")');

    // 3. Exact uppercase lookup
    const foundExact = await prisma.organization.findFirst({
      where: { panNumber: testPan }
    });
    assert.ok(foundExact, 'Organization.findFirst with exact uppercase PAN must succeed');
    assert.equal(foundExact.id, createdOrg.id);
    assert.equal(foundExact.panNumber, testPan, 'Prisma must transparently decrypt panNumber on read');

    // 4. Lowercase normalization lookup
    const foundLower = await prisma.organization.findFirst({
      where: { panNumber: testPan.toLowerCase() }
    });
    assert.ok(foundLower, 'Organization.findFirst with lowercase PAN must succeed via blind index .toUpperCase() normalization');
    assert.equal(foundLower.id, createdOrg.id);

    // 5. Internal whitespace normalization lookup
    const spacedPan = `${testPan.slice(0, 5)} ${testPan.slice(5)}`;
    const foundSpaced = await prisma.organization.findFirst({
      where: { panNumber: spacedPan }
    });
    assert.ok(foundSpaced, 'Organization.findFirst with internal space PAN must succeed via .replace(/\\s+/g, "") normalization');
    assert.equal(foundSpaced.id, createdOrg.id);

    // 6. Leading/trailing and lowercase combined
    const messyPan = `   ${testPan.slice(0, 5).toLowerCase()} ${testPan.slice(5).toLowerCase()}   `;
    const foundMessy = await prisma.organization.findFirst({
      where: { panNumber: messyPan }
    });
    assert.ok(foundMessy, 'Organization.findFirst with messy whitespace and lowercase PAN must succeed');
    assert.equal(foundMessy.id, createdOrg.id);

    // 7. Explicit OR query
    const foundDual = await prisma.organization.findFirst({
      where: {
        OR: [
          { panFingerprint: expectedPanFingerprint },
          { panNumber: testPan }
        ]
      }
    });
    assert.ok(foundDual, 'Explicit OR query on Organization must succeed');
    assert.equal(foundDual.id, createdOrg.id);

    // 8. Legacy plaintext Organization record fallback
    const legacyOrgName = `Challenger 2 Legacy Org ${Date.now()}`;
    const legacyPan = 'LEGAC1234P';
    await prisma.$executeRawUnsafe(`
      INSERT INTO "Organization" ("organizationName", "organizationType", "panNumber", "panFingerprint", "updatedAt")
      VALUES ('${legacyOrgName}', 'PRIVATE_LIMITED', '${legacyPan}', NULL, NOW())
    `);

    // Query rewriting matches legacy plaintext PAN
    const foundLegacy = await prisma.organization.findFirst({
      where: { panNumber: legacyPan }
    });
    assert.ok(foundLegacy, 'Organization.findFirst query rewriting must find legacy plaintext record');
    assert.equal(foundLegacy.organizationName, legacyOrgName);
    assert.equal(foundLegacy.panNumber, legacyPan);

    // Cleanup legacy organization
    await prisma.$executeRawUnsafe(`DELETE FROM "Organization" WHERE "organizationName" = '${legacyOrgName}'`);
  } finally {
    // Cleanup created org
    await prisma.organization.delete({ where: { id: createdOrg.id } }).catch(() => {});
  }
});

// ============================================================================
// PART 4: TASK 3 - BUYERPROFILE & SELLERPROFILE AADHAAR ZERO-STORAGE
// ============================================================================

test('EMPIRICAL TASK 3: BuyerProfile & SellerProfile create and update never persist raw aadhaarNumber', async () => {
  const ts = Date.now();
  const testBuyerEmail = `ch2_buyer_${ts}@test.internal`;
  const testSellerEmail = `ch2_seller_${ts}@test.internal`;
  const testPan = `PAN${String(ts).slice(-7)}`;

  // 1. Create prerequisite Users
  const buyerUser = await prisma.user.create({
    data: {
      name: 'Challenger 2 Buyer',
      email: testBuyerEmail,
      password: 'hashed_password_placeholder',
      role: 'buyer',
      mobile: '9811122233'
    }
  });

  const sellerUser = await prisma.user.create({
    data: {
      name: 'Challenger 2 Seller',
      email: testSellerEmail,
      password: 'hashed_password_placeholder',
      role: 'seller',
      mobile: '9822233344'
    }
  });

  try {
    // --- BuyerProfile Create with raw aadhaarNumber in data payload ---
    const rawAadhaarBuyer1 = '123456789012';
    const expectedMaskedBuyer1 = 'XXXXXXXX9012';
    const expectedHashBuyer1 = createHashFingerprint(rawAadhaarBuyer1, 'aadhaar_vault');

    const createdBuyerProfile = await prisma.buyerProfile.create({
      data: {
        userId: buyerUser.id,
        organizationName: 'Challenger 2 Test Buyer Org',
        businessType: 'Enterprise',
        mobile: '9811122233',
        aadhaarNumber: rawAadhaarBuyer1
      }
    });

    assert.equal(createdBuyerProfile.aadhaarMasked, expectedMaskedBuyer1, 'BuyerProfile.aadhaarMasked must be XXXXXXXX9012');
    assert.equal(createdBuyerProfile.aadhaarHash, expectedHashBuyer1, 'BuyerProfile.aadhaarHash must match createHashFingerprint');
    assert.equal(createdBuyerProfile.aadhaarNumber, undefined, 'BuyerProfile must NOT return aadhaarNumber property');

    // Raw SQL inspection on BuyerProfile table: ensure no aadhaarNumber column exists
    const rawBuyerRow = await prisma.$queryRawUnsafe(
      `SELECT * FROM "BuyerProfile" WHERE id = $1`,
      createdBuyerProfile.id
    );
    assert.equal(rawBuyerRow.length, 1);
    assert.equal('aadhaarNumber' in rawBuyerRow[0], false, 'Raw database row must NOT contain aadhaarNumber column');
    assert.equal(rawBuyerRow[0].aadhaarMasked, expectedMaskedBuyer1);
    assert.equal(rawBuyerRow[0].aadhaarHash, expectedHashBuyer1);

    // --- BuyerProfile Update with raw aadhaarNumber in data payload ---
    const rawAadhaarBuyer2 = '987654321098';
    const expectedMaskedBuyer2 = 'XXXXXXXX1098';
    const expectedHashBuyer2 = createHashFingerprint(rawAadhaarBuyer2, 'aadhaar_vault');

    const updatedBuyerProfile = await prisma.buyerProfile.update({
      where: { id: createdBuyerProfile.id },
      data: {
        aadhaarNumber: rawAadhaarBuyer2
      }
    });

    assert.equal(updatedBuyerProfile.aadhaarMasked, expectedMaskedBuyer2);
    assert.equal(updatedBuyerProfile.aadhaarHash, expectedHashBuyer2);
    assert.equal(updatedBuyerProfile.aadhaarNumber, undefined);

    // --- SellerProfile Create with raw aadhaarNumber in data payload ---
    const rawAadhaarSeller1 = '222233334444';
    const expectedMaskedSeller1 = 'XXXXXXXX4444';
    const expectedHashSeller1 = createHashFingerprint(rawAadhaarSeller1, 'aadhaar_vault');

    const createdSellerProfile = await prisma.sellerProfile.create({
      data: {
        userId: sellerUser.id,
        pan: testPan,
        businessName: 'Challenger 2 Test Seller Business',
        mobile: '9822233344',
        aadhaarNumber: rawAadhaarSeller1
      }
    });

    assert.equal(createdSellerProfile.aadhaarMasked, expectedMaskedSeller1, 'SellerProfile.aadhaarMasked must be XXXXXXXX4444');
    assert.equal(createdSellerProfile.aadhaarHash, expectedHashSeller1, 'SellerProfile.aadhaarHash must match createHashFingerprint');
    assert.equal(createdSellerProfile.aadhaarNumber, undefined, 'SellerProfile must NOT return aadhaarNumber property');

    // Raw SQL inspection on SellerProfile table
    const rawSellerRow = await prisma.$queryRawUnsafe(
      `SELECT * FROM "SellerProfile" WHERE id = $1`,
      createdSellerProfile.id
    );
    assert.equal(rawSellerRow.length, 1);
    assert.equal('aadhaarNumber' in rawSellerRow[0], false, 'Raw database row must NOT contain aadhaarNumber column');
    assert.equal(rawSellerRow[0].aadhaarMasked, expectedMaskedSeller1);
    assert.equal(rawSellerRow[0].aadhaarHash, expectedHashSeller1);

    // --- SellerProfile Update with raw aadhaarNumber in data payload ---
    const rawAadhaarSeller2 = '555566667777';
    const expectedMaskedSeller2 = 'XXXXXXXX7777';
    const expectedHashSeller2 = createHashFingerprint(rawAadhaarSeller2, 'aadhaar_vault');

    const updatedSellerProfile = await prisma.sellerProfile.update({
      where: { id: createdSellerProfile.id },
      data: {
        aadhaarNumber: rawAadhaarSeller2
      }
    });

    assert.equal(updatedSellerProfile.aadhaarMasked, expectedMaskedSeller2);
    assert.equal(updatedSellerProfile.aadhaarHash, expectedHashSeller2);
    assert.equal(updatedSellerProfile.aadhaarNumber, undefined);

    // Cleanup profiles
    await prisma.buyerProfile.delete({ where: { id: createdBuyerProfile.id } });
    await prisma.sellerProfile.delete({ where: { id: createdSellerProfile.id } });
  } finally {
    // Cleanup users
    await prisma.buyerProfile.deleteMany({ where: { userId: buyerUser.id } }).catch(() => {});
    await prisma.sellerProfile.deleteMany({ where: { userId: sellerUser.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: buyerUser.id } }).catch(() => {});
    await prisma.user.delete({ where: { id: sellerUser.id } }).catch(() => {});
  }
});
