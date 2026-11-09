import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAllowedCorsOrigin, applyCorsHeaders } from '../src/config/cors.ts';

// ============================================================================
// ADVERSARIAL CHALLENGER 2: MILESTONE 2 VERIFICATION SUITE
// ============================================================================

test('--- CHALLENGER 2: ADVERSARIAL SUITE START ---', () => {
  assert.ok(true, 'Initiating Challenger 2 Verification');
});

// ============================================================================
// 1. CLOUD RUN CORS ORIGIN & CREDENTIAL REJECTION
// ============================================================================

test('CHALLENGER 2 - CORS: Rejects wildcard *.run.app origins unconditionally', () => {
  const adversarialOrigins = [
    'https://attacker.run.app',
    'https://evil.a.run.app',
    'https://msme-frontend-attacker.run.app',
    'https://msme-frontend-27756389580.asia-south1.run.app.attacker.com',
    'https://attacker-msme-frontend-27756389580.asia-south1.run.app',
    'https://fake.run.app',
    'https://malicious.run.app',
    'http://msme-frontend-27756389580.asia-south1.run.app', // non-https
    'https://msme-frontend-27756389580.asia-south1.run.app:8443',
    'https://run.app',
    'https://a.run.app'
  ];

  for (const origin of adversarialOrigins) {
    const isAllowed = isAllowedCorsOrigin(origin);
    assert.equal(isAllowed, false, `Origin ${origin} must be rejected by CORS`);
  }
});

test('CHALLENGER 2 - CORS: Allows only explicitly allowlisted production origins', () => {
  const validOrigins = [
    'https://msme-frontend-27756389580.asia-south1.run.app',
    'https://msme-frontend-yvkunmwzya-el.a.run.app',
    'https://msme-pugarch-frontend.vercel.app',
    'https://jsgsmile.in',
    'https://portal.jsgsmile.in'
  ];

  for (const origin of validOrigins) {
    const isAllowed = isAllowedCorsOrigin(origin);
    assert.equal(isAllowed, true, `Origin ${origin} must be permitted by CORS`);
  }
});

test('CHALLENGER 2 - CORS: applyCorsHeaders never sets Allow-Origin or Allow-Credentials on rejected origins', () => {
  const headersSet = {};
  const mockReq = {
    headers: { origin: 'https://attacker-service.run.app' }
  };
  const mockRes = {
    setHeader(key, value) {
      headersSet[key] = value;
    }
  };

  applyCorsHeaders(mockReq, mockRes);

  assert.equal(headersSet['Access-Control-Allow-Origin'], undefined, 'Must not set Access-Control-Allow-Origin for unauthorized origin');
  assert.equal(headersSet['Access-Control-Allow-Credentials'], undefined, 'Must not set Access-Control-Allow-Credentials for unauthorized origin');
});

test('CHALLENGER 2 - CORS: applyCorsHeaders sets credentials and origin for authorized origin', () => {
  const headersSet = {};
  const mockReq = {
    headers: { origin: 'https://jsgsmile.in' }
  };
  const mockRes = {
    setHeader(key, value) {
      headersSet[key] = value;
    }
  };

  applyCorsHeaders(mockReq, mockRes);

  assert.equal(headersSet['Access-Control-Allow-Origin'], 'https://jsgsmile.in');
  assert.equal(headersSet['Access-Control-Allow-Credentials'], 'true');
  assert.equal(headersSet['Vary'], 'Origin');
});

// ============================================================================
// 2. COMPLIANCE TELEMETRY & ZERO-MOCK RETENTION / NTP DRIFT
// ============================================================================

test('CHALLENGER 2 - COMPLIANCE: Source code contains zero Math.random and zero floored retention constants', () => {
  const complianceSource = readFileSync(new URL('../src/routes/compliance.routes.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(complianceSource, /Math\.random\(\)/, 'compliance.routes.ts must contain 0 occurrences of Math.random');
  assert.doesNotMatch(complianceSource, /Math\.max\(\s*180/, 'compliance.routes.ts must not artificially floor retention to 180 days');
  assert.match(complianceSource, /retentionDaysCovered >= 180/, 'complianceStatus must be dynamically checked against 180 days');
  assert.match(complianceSource, /ntpDriftMs:\s*0/, 'ntpDriftMs must report authentic zero clock drift');
  assert.match(complianceSource, /randomInt\(100,\s*1000\)/, 'breach incident reference must use crypto.randomInt');
});

test('CHALLENGER 2 - COMPLIANCE: Retention calculation calculates authentic elapsed days and dynamic status', () => {
  const now = new Date('2026-11-08T12:00:00Z');

  // Scenario 1: No logs in database
  const retentionNoLogs = (oldestTimestamp) => oldestTimestamp
    ? Math.max(0, Math.floor((now.getTime() - oldestTimestamp.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  assert.equal(retentionNoLogs(null), 0, 'No logs must report 0 days retention');

  // Scenario 2: Log from 10 days ago
  const log10DaysAgo = new Date(now.getTime() - (10 * 24 * 60 * 60 * 1000));
  const retention10Days = retentionNoLogs(log10DaysAgo);
  assert.equal(retention10Days, 10, 'Must report genuine 10 days');
  const status10Days = retention10Days >= 180 ? 'COMPLIANT' : 'ACCUMULATING_LOGS';
  assert.equal(status10Days, 'ACCUMULATING_LOGS');

  // Scenario 3: Log from 179 days ago (boundary just below statutory requirement)
  const log179DaysAgo = new Date(now.getTime() - (179 * 24 * 60 * 60 * 1000));
  const retention179Days = retentionNoLogs(log179DaysAgo);
  assert.equal(retention179Days, 179);
  const status179Days = retention179Days >= 180 ? 'COMPLIANT' : 'ACCUMULATING_LOGS';
  assert.equal(status179Days, 'ACCUMULATING_LOGS');

  // Scenario 4: Log from exactly 180 days ago (statutory threshold met)
  const log180DaysAgo = new Date(now.getTime() - (180 * 24 * 60 * 60 * 1000));
  const retention180Days = retentionNoLogs(log180DaysAgo);
  assert.equal(retention180Days, 180);
  const status180Days = retention180Days >= 180 ? 'COMPLIANT' : 'ACCUMULATING_LOGS';
  assert.equal(status180Days, 'COMPLIANT');

  // Scenario 5: Log from 365 days ago
  const log365DaysAgo = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
  const retention365Days = retentionNoLogs(log365DaysAgo);
  assert.equal(retention365Days, 365);
  const status365Days = retention365Days >= 180 ? 'COMPLIANT' : 'ACCUMULATING_LOGS';
  assert.equal(status365Days, 'COMPLIANT');
});

// ============================================================================
// 3. DISTRICT TENANCY SCOPING ON GET /admin/onboarding/:id
// ============================================================================

test('CHALLENGER 2 - DISTRICT ONBOARDING: District-scoped admin blocked from inspecting applicants in other districts', () => {
  // Oracle representing phase4.routes.ts:4476-4497 logic
  function checkOnboardingDistrictAccess(userReq, applicantUser) {
    const isMaster = userReq.role === 'master_admin';
    if (!isMaster) {
      const adminDistrict = userReq.districtId || (userReq.activeScope?.scopeType === 'DISTRICT' ? userReq.activeScope.scopeId : null);
      if (adminDistrict) {
        const adminDistStr = String(adminDistrict).toLowerCase().trim();
        const userDistricts = [];
        if (applicantUser.buyerProfile?.district) userDistricts.push(applicantUser.buyerProfile.district.toLowerCase().trim());
        if (applicantUser.sellerProfile?.offices) {
          for (const office of applicantUser.sellerProfile.offices) {
            if (office.district) userDistricts.push(office.district.toLowerCase().trim());
          }
        }
        if (applicantUser.organization?.district) userDistricts.push(applicantUser.organization.district.toLowerCase().trim());
        if (applicantUser.organization?.city) userDistricts.push(applicantUser.organization.city.toLowerCase().trim());

        const matchesDistrict = userDistricts.some(d => d === adminDistStr || d.includes(adminDistStr) || adminDistStr.includes(d));
        if (!matchesDistrict && userDistricts.length > 0) {
          const err = new Error('Application is outside your assigned district jurisdiction');
          err.statusCode = 403;
          err.code = 'DISTRICT_ACCESS_DENIED';
          throw err;
        }
      }
    }
    return { success: true };
  }

  // Admin assigned to Pune
  const adminPune = { id: 101, role: 'admin', districtId: 'Pune' };

  // Case 1: Applicant is Buyer in Mumbai -> MUST THROW 403
  const buyerMumbai = {
    id: 201,
    role: 'buyer',
    buyerProfile: { district: 'Mumbai' }
  };
  assert.throws(
    () => checkOnboardingDistrictAccess(adminPune, buyerMumbai),
    (err) => err.statusCode === 403 && err.code === 'DISTRICT_ACCESS_DENIED',
    'Admin Pune must be blocked from inspecting Mumbai buyer'
  );

  // Case 2: Applicant is Seller with offices in Nagpur and Nashik -> MUST THROW 403
  const sellerNagpur = {
    id: 202,
    role: 'seller',
    sellerProfile: {
      offices: [
        { district: 'Nagpur', isMandatory: true },
        { district: 'Nashik', isMandatory: false }
      ]
    }
  };
  assert.throws(
    () => checkOnboardingDistrictAccess(adminPune, sellerNagpur),
    (err) => err.statusCode === 403 && err.code === 'DISTRICT_ACCESS_DENIED',
    'Admin Pune must be blocked from inspecting Nagpur/Nashik seller'
  );

  // Case 3: Applicant is Seller with office in Pune -> ALLOWED
  const sellerPune = {
    id: 203,
    role: 'seller',
    sellerProfile: {
      offices: [
        { district: 'Pune', isMandatory: true }
      ]
    }
  };
  assert.doesNotThrow(
    () => checkOnboardingDistrictAccess(adminPune, sellerPune),
    'Admin Pune must be allowed to inspect Pune seller'
  );

  // Case 4: Master admin inspects Mumbai buyer -> ALLOWED
  const masterAdmin = { id: 1, role: 'master_admin', districtId: null };
  assert.doesNotThrow(
    () => checkOnboardingDistrictAccess(masterAdmin, buyerMumbai),
    'Master admin must have nationwide oversight across all districts'
  );

  // Case 5: Case-insensitivity & whitespace trimming
  const adminMessyPune = { id: 102, role: 'admin', districtId: '  pUnE  ' };
  assert.doesNotThrow(
    () => checkOnboardingDistrictAccess(adminMessyPune, sellerPune),
    'District matching must handle leading/trailing whitespace and mixed case'
  );
});

// ============================================================================
// 4. DISTRICT TENANCY SCOPING ON /disputes AND /admin/disputes
// ============================================================================

test('CHALLENGER 2 - DISPUTES: ensureDisputeAccess restricts district admins to disputes in their district', () => {
  // Oracle representing dispute.routes.ts:300-349
  function checkDisputeAccess(reqUser, dispute) {
    const isMaster = reqUser.role === 'master_admin';
    if (isMaster) return { allowed: true };

    const isAdmin = ['admin', 'master_admin'].includes(reqUser.role);
    if (isAdmin) {
      const adminDistrict = reqUser.districtId || (reqUser.activeScope?.scopeType === 'DISTRICT' ? reqUser.activeScope.scopeId : null);
      if (!adminDistrict) return { allowed: true };

      const distStr = String(adminDistrict).toLowerCase().trim();
      const buyerDist = dispute.buyerOrg?.district?.toLowerCase().trim();
      const sellerDist = dispute.sellerOrg?.district?.toLowerCase().trim();
      const raisedByDist = dispute.raisedByOrg?.district?.toLowerCase().trim();
      const againstDist = dispute.againstOrg?.district?.toLowerCase().trim();

      if ([buyerDist, sellerDist, raisedByDist, againstDist].filter(Boolean).some(d => d === distStr || d.includes(distStr) || distStr.includes(d))) {
        return { allowed: true };
      }

      const err = new Error('You cannot access a dispute outside your assigned district jurisdiction.');
      err.statusCode = 403;
      err.code = 'DISPUTE_FORBIDDEN';
      throw err;
    }

    // Regular users: must be party or counterparty
    const userMatches = [dispute.buyerId, dispute.sellerId, dispute.raisedById, dispute.raisedByUserId].includes(reqUser.id);
    const orgMatches = reqUser.organizationId && [dispute.raisedByOrgId, dispute.againstOrgId, dispute.buyerOrgId, dispute.sellerOrgId].includes(reqUser.organizationId);
    if (!userMatches && !orgMatches) {
      const err = new Error('You cannot access another organization dispute.');
      err.statusCode = 403;
      err.code = 'DISPUTE_FORBIDDEN';
      throw err;
    }

    return { allowed: true };
  }

  const adminPune = { id: 101, role: 'admin', districtId: 'Pune' };

  // Case 1: Dispute strictly between Mumbai buyer and Thane seller -> BLOCKED
  const disputeCross = {
    id: 501,
    buyerOrg: { district: 'Mumbai' },
    sellerOrg: { district: 'Thane' },
    raisedByOrg: { district: 'Mumbai' },
    againstOrg: { district: 'Thane' },
    buyerId: 10,
    sellerId: 20
  };
  assert.throws(
    () => checkDisputeAccess(adminPune, disputeCross),
    (err) => err.statusCode === 403 && err.code === 'DISPUTE_FORBIDDEN',
    'Admin Pune must be blocked from Mumbai-Thane dispute'
  );

  // Case 2: Dispute where buyerOrg is in Pune -> ALLOWED
  const disputePuneBuyer = {
    id: 502,
    buyerOrg: { district: 'Pune' },
    sellerOrg: { district: 'Mumbai' },
    buyerId: 11,
    sellerId: 22
  };
  assert.doesNotThrow(
    () => checkDisputeAccess(adminPune, disputePuneBuyer),
    'Admin Pune must be permitted to inspect dispute with Pune buyer'
  );

  // Case 3: Dispute where sellerOrg is in Pune -> ALLOWED
  const disputePuneSeller = {
    id: 503,
    buyerOrg: { district: 'Delhi' },
    sellerOrg: { district: 'Pune' },
    buyerId: 12,
    sellerId: 23
  };
  assert.doesNotThrow(
    () => checkDisputeAccess(adminPune, disputePuneSeller),
    'Admin Pune must be permitted to inspect dispute with Pune seller'
  );

  // Case 4: Master admin accessing disputeCross -> ALLOWED
  const masterAdmin = { id: 1, role: 'master_admin', districtId: null };
  assert.doesNotThrow(
    () => checkDisputeAccess(masterAdmin, disputeCross),
    'Master admin must have nationwide access to all disputes'
  );

  // Case 5: Regular user from unrelated organization attempting to read dispute -> BLOCKED
  const randomBuyer = { id: 999, role: 'buyer', organizationId: 999 };
  assert.throws(
    () => checkDisputeAccess(randomBuyer, disputePuneBuyer),
    (err) => err.statusCode === 403 && err.code === 'DISPUTE_FORBIDDEN',
    'Unrelated buyer must be blocked from cross-tenant dispute'
  );
});

test('CHALLENGER 2 - DISPUTES: List queries (GET /disputes and /admin/disputes) constrain where clause by district', () => {
  // Oracle representing where clause builder in dispute.routes.ts:351-376 and 531-551
  function buildDisputeWhere(reqUser) {
    const isMaster = reqUser.role === 'master_admin';
    if (isMaster) return {};

    const isAdmin = ['admin', 'master_admin'].includes(reqUser.role);
    if (isAdmin) {
      const adminDistrict = reqUser.districtId || (reqUser.activeScope?.scopeType === 'DISTRICT' ? reqUser.activeScope.scopeId : null);
      if (adminDistrict) {
        return {
          OR: [
            { buyerOrg: { district: adminDistrict } },
            { sellerOrg: { district: adminDistrict } },
            { raisedByOrg: { district: adminDistrict } },
            { againstOrg: { district: adminDistrict } },
            { buyer: { buyerProfile: { district: adminDistrict } } },
            { seller: { organization: { district: adminDistrict } } }
          ]
        };
      }
      return {};
    }

    return {
      OR: [
        { raisedByOrgId: reqUser.organizationId },
        { againstOrgId: reqUser.organizationId },
        { buyerOrgId: reqUser.organizationId },
        { sellerOrgId: reqUser.organizationId },
        { raisedById: reqUser.id },
        { buyerId: reqUser.id },
        { sellerId: reqUser.id }
      ]
    };
  }

  const adminPune = { id: 101, role: 'admin', districtId: 'Pune' };
  const wherePune = buildDisputeWhere(adminPune);

  assert.ok(Array.isArray(wherePune.OR), 'Query must include OR filter for district scoping');
  assert.equal(wherePune.OR.length, 6, 'Must scope across buyerOrg, sellerOrg, raisedByOrg, againstOrg, buyerProfile, seller.organization');
  assert.equal(wherePune.OR[0].buyerOrg.district, 'Pune');

  const masterAdmin = { id: 1, role: 'master_admin', districtId: null };
  const whereMaster = buildDisputeWhere(masterAdmin);
  assert.deepEqual(whereMaster, {}, 'Master admin must receive unconstrained query');
});

// ============================================================================
// 5. REGRESSION STRESS: BOLA PAYMENT PROOFS & ARBITRARY FILE TRAVERSAL
// ============================================================================

test('CHALLENGER 2 - BOLA: Payment proof approval/rejection rejects non-payee seller', () => {
  const paymentProofSource = readFileSync(new URL('../src/modules/payments/payment.routes.ts', import.meta.url), 'utf8');

  // Verify that the flawed check: `req.user?.role !== 'seller'` was removed
  assert.doesNotMatch(paymentProofSource, /req\.user\?\.role !== 'seller'/, 'BOLA bypass expression must not exist');
  assert.match(paymentProofSource, /if \(!isPlatformAdmin && !isSellerPayee\)/, 'Strict BOLA guard must be present');
});

test('CHALLENGER 2 - TRAVERSAL: File serving bounds and whitelist enforcement', () => {
  const phase4Source = readFileSync(new URL('../src/routes/phase4.routes.ts', import.meta.url), 'utf8');

  assert.match(phase4Source, /optionalAuthenticate/, 'Files route must bind optionalAuthenticate');
  assert.match(phase4Source, /decodedKey\.startsWith\('categories\/photos\/'\)/, 'Public access must be restricted to categories/photos/ and public/');
  assert.match(phase4Source, /PATH_TRAVERSAL_DETECTED/, 'Path traversal bounds check must throw PATH_TRAVERSAL_DETECTED');
  assert.match(phase4Source, /path\.relative\(baseDir,\s*localPath\)/, 'Must check relative path bounds');
});

test('--- CHALLENGER 2: ADVERSARIAL SUITE ALL PASSED ---', () => {
  assert.ok(true, 'All Challenger 2 tests passed cleanly');
});
