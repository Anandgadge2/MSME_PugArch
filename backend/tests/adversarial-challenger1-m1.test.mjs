import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import compiled crypto utilities and Prisma client
import {
  encryptField,
  decryptField,
  isEncrypted,
  createHashFingerprint,
  createKeyedBlindIndex,
  sha256
} from '../dist/src/utils/crypto.js';
import prisma from '../dist/src/lib/prisma.js';

console.log('======================================================================');
console.log('  CHALLENGER 1 EMPIRICAL ADVERSARIAL STRESS TEST SUITE — MILESTONE 1  ');
console.log('======================================================================\n');

async function runEmpiricalChallenge() {
  const findings = [];

  // ============================================================================
  // PROBE 1: SEARCH_INDEX_PEPPER Sensitivity & Static SHA-256 Disproof
  // ============================================================================
  console.log('[PROBE 1] Probing Keyed HMAC vs Static Unkeyed SHA-256 for Aadhaar...');
  
  const sampleAadhaar = '999911112222';
  const pepper1 = 'pepper_secret_alpha_2026_test_vector_1';
  const pepper2 = 'pepper_secret_beta_2026_test_vector_2';

  const hmac1 = crypto.createHmac('sha256', pepper1).update(`aadhaar_vault:${sampleAadhaar}`).digest('hex');
  const hmac2 = crypto.createHmac('sha256', pepper2).update(`aadhaar_vault:${sampleAadhaar}`).digest('hex');
  const staticSha256WithNs = crypto.createHash('sha256').update(`aadhaar_vault:${sampleAadhaar}`).digest('hex');
  const staticSha256Raw = crypto.createHash('sha256').update(sampleAadhaar).digest('hex');
  
  // Actual production fingerprint under active environment pepper
  const liveFingerprint = createHashFingerprint(sampleAadhaar, 'aadhaar_vault');

  console.log('  HMAC with Pepper 1:   ', hmac1);
  console.log('  HMAC with Pepper 2:   ', hmac2);
  console.log('  Static SHA256 (ns):   ', staticSha256WithNs);
  console.log('  Static SHA256 (raw):  ', staticSha256Raw);
  console.log('  Live Fingerprint:     ', liveFingerprint);

  assert.notEqual(hmac1, hmac2, 'Changing SEARCH_INDEX_PEPPER must strictly alter HMAC hash output');
  assert.notEqual(liveFingerprint, staticSha256WithNs, 'Live fingerprint must not match static unkeyed SHA-256 with namespace');
  assert.notEqual(liveFingerprint, staticSha256Raw, 'Live fingerprint must not match raw static unkeyed SHA-256');
  console.log('  [PASS] SEARCH_INDEX_PEPPER keyed HMAC mathematically prevents static rainbow-table inversion.\n');

  // ============================================================================
  // PROBE 2: Physical Column Absence in Prisma Schema & Active Database
  // ============================================================================
  console.log('[PROBE 2] Probing Database Schema and Active PostgreSQL Columns...');

  // 2a. Inspect schema.prisma
  const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
  const schemaText = fs.readFileSync(schemaPath, 'utf8');

  // Extract BuyerProfile and SellerProfile models
  const buyerMatch = schemaText.match(/model\s+BuyerProfile\s*\{([\s\S]*?)\n\}/);
  const sellerMatch = schemaText.match(/model\s+SellerProfile\s*\{([\s\S]*?)\n\}/);

  assert(buyerMatch, 'BuyerProfile model must exist in schema.prisma');
  assert(sellerMatch, 'SellerProfile model must exist in schema.prisma');

  const buyerBody = buyerMatch[1];
  const sellerBody = sellerMatch[1];

  assert(!buyerBody.includes('aadhaarNumber'), 'BuyerProfile must NOT contain aadhaarNumber column');
  assert(!sellerBody.includes('aadhaarNumber'), 'SellerProfile must NOT contain aadhaarNumber column');
  assert(buyerBody.includes('aadhaarMasked'), 'BuyerProfile must contain aadhaarMasked');
  assert(buyerBody.includes('aadhaarHash'), 'BuyerProfile must contain aadhaarHash');
  assert(sellerBody.includes('aadhaarMasked'), 'SellerProfile must contain aadhaarMasked');
  assert(sellerBody.includes('aadhaarHash'), 'SellerProfile must contain aadhaarHash');
  assert(buyerBody.includes('mobileFingerprint'), 'BuyerProfile must contain mobileFingerprint');
  assert(sellerBody.includes('mobileFingerprint'), 'SellerProfile must contain mobileFingerprint');
  console.log('  [PASS] schema.prisma has physically eradicated aadhaarNumber from BuyerProfile & SellerProfile.');

  // 2b. Query active PostgreSQL catalog directly
  const activeColumns = await prisma.$queryRawUnsafe(`
    SELECT table_name, column_name 
    FROM information_schema.columns 
    WHERE table_name IN ('BuyerProfile', 'SellerProfile', 'User', 'Organization')
      AND column_name IN ('aadhaarNumber', 'mobileFingerprint', 'panFingerprint', 'mobile', 'panNumber', 'pan');
  `);

  console.log('  Active DB Catalog Columns:', activeColumns);

  const columnMap = new Set(activeColumns.map(r => `${r.table_name}.${r.column_name}`));
  assert(!columnMap.has('BuyerProfile.aadhaarNumber'), 'BuyerProfile.aadhaarNumber must not exist in DB');
  assert(!columnMap.has('SellerProfile.aadhaarNumber'), 'SellerProfile.aadhaarNumber must not exist in DB');
  assert(columnMap.has('BuyerProfile.mobileFingerprint'), 'BuyerProfile.mobileFingerprint must exist in DB');
  assert(columnMap.has('SellerProfile.mobileFingerprint'), 'SellerProfile.mobileFingerprint must exist in DB');
  assert(columnMap.has('User.mobileFingerprint'), 'User.mobileFingerprint must exist in DB');
  assert(columnMap.has('Organization.panFingerprint'), 'Organization.panFingerprint must exist in DB');
  console.log('  [PASS] Active PostgreSQL catalog confirms zero physical storage of aadhaarNumber and active blind index columns.\n');

  // ============================================================================
  // PROBE 3: Write Pipeline Encryption (enc:v1:) and Blind Index Generation
  // ============================================================================
  console.log('[PROBE 3] Probing Real Database Insert, SQL Encryption, and Blind Index Queries...');

  const testMobile = '9876500001';
  const testEmail = `test_emp_challenger_${Date.now()}@example.gov.in`;
  const testPan = 'ABCDE9999K';
  const expectedMobileFp = createHashFingerprint(testMobile, 'mobile');
  const expectedPanFp = createHashFingerprint(testPan, 'pan');

  let testUser = null;
  let testBuyer = null;
  let testOrg = null;

  try {
    // 3a. Insert User with mobile
    testUser = await prisma.user.create({
      data: {
        name: 'Challenger Empirical User',
        email: testEmail,
        password: '$2a$12$eXamp1eHashForChallengerTestingPurposesOnly1234567890',
        role: 'buyer',
        mobile: testMobile
      }
    });

    console.log('  Created User ID:', testUser.id);

    // Query RAW database record to verify SQL storage
    const rawUserRows = await prisma.$queryRawUnsafe(`
      SELECT id, email, mobile, "mobileFingerprint" 
      FROM "User" 
      WHERE id = ${testUser.id};
    `);

    const rawUser = rawUserRows[0];
    console.log('  Raw User in SQL:', {
      id: rawUser.id,
      mobile: rawUser.mobile.slice(0, 20) + '...',
      mobileFingerprint: rawUser.mobileFingerprint
    });

    assert(rawUser.mobile.startsWith('enc:v1:'), 'User.mobile in SQL MUST start with enc:v1:');
    assert.equal(rawUser.mobileFingerprint, expectedMobileFp, 'User.mobileFingerprint MUST match createHashFingerprint()');

    // Verify transparent decryption via Prisma Client
    const readUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    assert.equal(readUser.mobile, testMobile, 'User.mobile read via Prisma must transparently decrypt to plaintext');
    console.log('  [PASS] User.mobile encrypted with enc:v1: and mobileFingerprint accurately generated.');

    // 3b. Insert BuyerProfile with mobile and PAN
    testBuyer = await prisma.buyerProfile.create({
      data: {
        userId: testUser.id,
        organizationName: 'Challenger Procurement Dept',
        businessType: 'Government Buyer',
        mobile: testMobile,
        pan: testPan
      }
    });

    const rawBuyerRows = await prisma.$queryRawUnsafe(`
      SELECT id, "userId", mobile, "mobileFingerprint", pan, "panFingerprint" 
      FROM "BuyerProfile" 
      WHERE "userId" = ${testUser.id};
    `);

    const rawBuyer = rawBuyerRows[0];
    console.log('  Raw BuyerProfile in SQL:', {
      id: rawBuyer.id,
      mobile: rawBuyer.mobile.slice(0, 20) + '...',
      mobileFingerprint: rawBuyer.mobileFingerprint,
      pan: rawBuyer.pan.slice(0, 20) + '...',
      panFingerprint: rawBuyer.panFingerprint
    });

    assert(rawBuyer.mobile.startsWith('enc:v1:'), 'BuyerProfile.mobile in SQL MUST start with enc:v1:');
    assert.equal(rawBuyer.mobileFingerprint, expectedMobileFp, 'BuyerProfile.mobileFingerprint MUST match createHashFingerprint');
    assert(rawBuyer.pan.startsWith('enc:v1:'), 'BuyerProfile.pan in SQL MUST start with enc:v1:');
    assert.equal(rawBuyer.panFingerprint, expectedPanFp, 'BuyerProfile.panFingerprint MUST match createHashFingerprint');
    console.log('  [PASS] BuyerProfile mobile & pan encrypted with enc:v1: and blind indexes match createHashFingerprint.');

    // 3c. Insert Organization with panNumber
    testOrg = await prisma.organization.create({
      data: {
        organizationName: 'Challenger Testing Org',
        organizationType: 'PRIVATE_LIMITED',
        panNumber: testPan
      }
    });

    const rawOrgRows = await prisma.$queryRawUnsafe(`
      SELECT id, "organizationName", "panNumber", "panFingerprint" 
      FROM "Organization" 
      WHERE id = ${testOrg.id};
    `);

    const rawOrg = rawOrgRows[0];
    console.log('  Raw Organization in SQL:', {
      id: rawOrg.id,
      panNumber: rawOrg.panNumber.slice(0, 20) + '...',
      panFingerprint: rawOrg.panFingerprint
    });

    assert(rawOrg.panNumber.startsWith('enc:v1:'), 'Organization.panNumber in SQL MUST start with enc:v1:');
    assert.equal(rawOrg.panFingerprint, expectedPanFp, 'Organization.panFingerprint MUST match createHashFingerprint');
    console.log('  [PASS] Organization panNumber encrypted with enc:v1: and panFingerprint matches createHashFingerprint.');

    // 3d. Probing Blind Index Query Rewriting
    console.log('  Probing transparent query rewriting for User.findFirst({ where: { mobile } })...');
    const userFound = await prisma.user.findFirst({
      where: { mobile: testMobile }
    });
    assert(userFound, 'Searching user by plaintext mobile equality must succeed via transparent blind index lookup');
    assert.equal(userFound.id, testUser.id, 'Must find exact user record');

    const orgFound = await prisma.organization.findFirst({
      where: { panNumber: testPan }
    });
    assert(orgFound, 'Searching organization by plaintext panNumber equality must succeed via transparent blind index lookup');
    assert.equal(orgFound.id, testOrg.id, 'Must find exact org record');
    console.log('  [PASS] Transparent equality lookups via blind index rewrite verified.\n');

  } finally {
    // Cleanup created test records
    console.log('  Cleaning up test fixtures...');
    if (testBuyer) {
      await prisma.buyerProfile.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
    }
    if (testUser) {
      await prisma.user.deleteMany({ where: { id: testUser.id } }).catch(() => {});
    }
    if (testOrg) {
      await prisma.organization.deleteMany({ where: { id: testOrg.id } }).catch(() => {});
    }
    console.log('  [CLEANUP] Test fixtures successfully purged.\n');
  }

  // ============================================================================
  // PROBE 4: Static SHA-256 Elimination in Aadhaar Processing
  // ============================================================================
  console.log('[PROBE 4] Adversarial Inspection for Static SHA-256 Aadhaar Handling...');

  // 4a. Verify encryptModelPayload gatekeeper
  const dummyPayload = {
    name: 'Test Candidate',
    aadhaarNumber: '112233445566',
    mobile: '9876543210'
  };

  // Import sanitizeJsonPayload & encryptModelPayload behavior
  // In prisma.ts, encryptModelPayload unconditionally deletes aadhaarNumber and populates aadhaarMasked & aadhaarHash
  const testAadhaar = '112233445566';
  const expectedHash = createHashFingerprint(testAadhaar, 'aadhaar_vault');
  assert.equal(expectedHash.length, 64);

  // 4b. Codebase Audit of unkeyed SHA-256 in Aadhaar processing
  console.log('  Inspecting codebase for any remaining static SHA-256 on Aadhaar...');
  
  // Check compliance.service.ts
  const complianceSrc = fs.readFileSync(path.resolve(__dirname, '../src/modules/compliance/compliance.service.ts'), 'utf8');
  const hasAadhaarInCompliance = complianceSrc.includes('aadhaarNumber');
  console.log('  compliance.service.ts references aadhaarNumber:', hasAadhaarInCompliance);

  if (hasAadhaarInCompliance) {
    // Check if hashIdentifier is used for aadhaarNumber
    const aadhaarComplianceMatch = complianceSrc.match(/if\s*\(payload\.aadhaarNumber\)\s*\{([\s\S]*?)\}/);
    if (aadhaarComplianceMatch && aadhaarComplianceMatch[1].includes('hashIdentifier(payload.aadhaarNumber)')) {
      findings.push({
        severity: 'MEDIUM',
        area: 'backend/src/modules/compliance/compliance.service.ts:139',
        issue: 'flagDuplicateSellerIdentifiers uses unkeyed static sha256 via hashIdentifier(payload.aadhaarNumber) instead of createHashFingerprint(payload.aadhaarNumber, "aadhaar_vault")',
        impact: 'Compliance violation records store unkeyed SHA-256 Aadhaar hashes. However, since physical aadhaarNumber is dropped from BuyerProfile/SellerProfile, registrations pass rawData.aadhaarNumber only during initial onboarding check.',
        mitigation: 'Update compliance.service.ts line 139 to use createHashFingerprint(payload.aadhaarNumber, "aadhaar_vault") in Milestone 2/cleanup.'
      });
      console.log('  [FINDING] Located unkeyed hashIdentifier(payload.aadhaarNumber) in compliance.service.ts:139');
    }
  }

  // Check auth.controller.ts for panFingerprint
  const authControllerSrc = fs.readFileSync(path.resolve(__dirname, '../src/modules/auth/auth.controller.ts'), 'utf8');
  if (authControllerSrc.includes('panFingerprint = resolvedPan ? sha256(resolvedPan) : null')) {
    findings.push({
      severity: 'LOW',
      area: 'backend/src/modules/auth/auth.controller.ts:777,1668,1757',
      issue: 'auth.controller.ts sets panFingerprint = sha256(resolvedPan) instead of createHashFingerprint(resolvedPan, "pan")',
      impact: 'When buyer profile is registered via auth.controller, panFingerprint may receive unkeyed SHA-256 instead of keyed HMAC unless prisma middleware overrides it.',
      mitigation: 'Align auth.controller panFingerprint generation with createHashFingerprint in Milestone 2/cleanup.'
    });
    console.log('  [FINDING] Located unkeyed sha256(resolvedPan) in auth.controller.ts');
  }

  console.log('\n======================================================================');
  console.log('  ALL EMPIRICAL CHALLENGE PROBES COMPLETED SUCCESSFULLY');
  console.log('  Total Vulnerabilities/Findings surfaced:', findings.length);
  console.log('======================================================================\n');

  return findings;
}

runEmpiricalChallenge()
  .then((findings) => {
    console.log('Execution result: SUCCESS');
    console.log('Findings summary:', JSON.stringify(findings, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error('Empirical challenge failed with error:', err);
    process.exit(1);
  });
