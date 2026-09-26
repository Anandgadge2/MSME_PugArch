import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Set test environment configuration before loading services
process.env.MERIPEHCHAAN_CLIENT_ID = process.env.MERIPEHCHAAN_CLIENT_ID || 'test_digilocker_client_id';
process.env.MERIPEHCHAAN_CLIENT_SECRET = process.env.MERIPEHCHAAN_CLIENT_SECRET || 'test_digilocker_client_secret_xyz123';
process.env.MERIPEHCHAAN_AUTH_URL = process.env.MERIPEHCHAAN_AUTH_URL || 'https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize';
process.env.MERIPEHCHAAN_TOKEN_URL = process.env.MERIPEHCHAAN_TOKEN_URL || 'https://digilocker.meripehchaan.gov.in/public/oauth2/1/token';
process.env.MERIPEHCHAAN_REDIRECT_URI = process.env.MERIPEHCHAAN_REDIRECT_URI || 'http://localhost:5001/api/kyc/aadhaar/callback';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
process.env.JWT_SECRET = process.env.JWT_SECRET || '12345678901234567890123456789012';

describe('DigiLocker Requestor Authorization URL Compliance Tests', async () => {
  let aadhaarKycService;
  let prisma;
  let testUser;

  before(async () => {
    const mod = await import('../src/modules/kyc/aadhaar-kyc.service.ts');
    aadhaarKycService = mod.aadhaarKycService;
    const prismaMod = await import('../src/lib/prisma.ts');
    prisma = prismaMod.default;

    testUser = await prisma.user.create({
      data: {
        email: `digilocker.test.${Date.now()}@example.com`,
        password: 'TestPassword123!',
        name: 'DigiLocker Test User',
        role: 'buyer'
      }
    });
  });

  after(async () => {
    if (testUser?.id) {
      await prisma.kycAuthSession.deleteMany({ where: { userId: testUser.id } }).catch(() => null);
      await prisma.userKycVerification.deleteMany({ where: { userId: testUser.id } }).catch(() => null);
      await prisma.kycAuditLog.deleteMany({ where: { userId: testUser.id } }).catch(() => null);
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => null);
    }
  });

  test('TC-DL-001: Pre-Registration Get Authorization Code URL contains mandatory parameters', async () => {
    const payload = {
      consent: true,
      mobile: '9876543210',
      redirectPath: '/register',
      frontendOrigin: 'http://localhost:3000'
    };
    const meta = { ipAddress: '127.0.0.1', userAgent: 'ComplianceTestRunner/1.0' };

    const result = await aadhaarKycService.preRegisterStart(payload, meta);
    assert.ok(result.authorizationUrl, 'authorizationUrl must be returned');
    assert.ok(result.kycSessionToken, 'kycSessionToken must be returned');

    const parsedUrl = new URL(result.authorizationUrl);

    // 1. Mandatory Parameter: service_name
    assert.ok(parsedUrl.searchParams.has('service_name'), 'URL must contain mandatory service_name parameter');
    const serviceName = parsedUrl.searchParams.get('service_name');
    assert.equal(serviceName, 'JsgSmile MSME Portal', 'service_name must match configured portal name');
    assert.ok(serviceName.length <= 50, `service_name length (${serviceName.length}) must be <= 50 characters`);

    // 2. Mandatory Parameter: purpose
    assert.ok(parsedUrl.searchParams.has('purpose'), 'URL must contain mandatory purpose parameter');
    const purpose = parsedUrl.searchParams.get('purpose');
    assert.equal(purpose, 'Pre Registration KYC Verification', 'purpose must accurately describe pre-reg operation');
    assert.ok(purpose.length <= 50, `purpose length (${purpose.length}) must be <= 50 characters`);

    // 3. Existing OAuth 2.0 PKCE Parameters
    assert.equal(parsedUrl.searchParams.get('response_type'), 'code', 'response_type must be "code"');
    assert.equal(parsedUrl.searchParams.get('client_id'), 'test_digilocker_client_id');
    assert.equal(parsedUrl.searchParams.get('redirect_uri'), 'http://localhost:5001/api/kyc/aadhaar/callback');
    assert.equal(parsedUrl.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(parsedUrl.searchParams.get('code_challenge'), 'code_challenge must be present');
    assert.ok(parsedUrl.searchParams.get('state'), 'CSRF state must be present');
  });

  test('TC-DL-002: Authenticated User Get Authorization Code URL contains mandatory parameters', async () => {
    const meta = { ipAddress: '127.0.0.1', userAgent: 'ComplianceTestRunner/1.0' };

    const urlString = await aadhaarKycService.start(testUser, meta, '/onboarding/kyc', 'http://localhost:3000');
    assert.ok(urlString, 'Authorization URL must be returned');

    const parsedUrl = new URL(urlString);

    // 1. Mandatory Parameter: service_name
    assert.ok(parsedUrl.searchParams.has('service_name'), 'URL must contain service_name');
    const serviceName = parsedUrl.searchParams.get('service_name');
    assert.equal(serviceName, 'JsgSmile MSME Portal');
    assert.ok(serviceName.length <= 50);

    // 2. Mandatory Parameter: purpose
    assert.ok(parsedUrl.searchParams.has('purpose'), 'URL must contain purpose');
    const purpose = parsedUrl.searchParams.get('purpose');
    assert.equal(purpose, 'User Onboarding KYC Verification', 'purpose must accurately describe user onboarding');
    assert.ok(purpose.length <= 50);

    // 3. Encoding check
    assert.ok(urlString.includes('service_name=JsgSmile+MSME+Portal') || urlString.includes('service_name=JsgSmile%20MSME%20Portal'));
    assert.ok(urlString.includes('purpose=User+Onboarding+KYC+Verification') || urlString.includes('purpose=User%20Onboarding%20KYC%20Verification'));
  });

  test('TC-DL-003: Dynamic Custom Purpose is sanitized and capped at 50 characters', async () => {
    const meta = { ipAddress: '127.0.0.1', userAgent: 'ComplianceTestRunner/1.0' };

    // Reset status to allow start call
    await prisma.userKycVerification.updateMany({
      where: { userId: testUser.id },
      data: { status: 'NOT_STARTED' }
    });

    // Pass a custom purpose exceeding 50 characters to verify defensive truncation
    const longPurpose = 'A'.repeat(80);
    const urlString = await aadhaarKycService.start(testUser, meta, '/onboarding/kyc', 'http://localhost:3000', longPurpose);
    
    const parsedUrl = new URL(urlString);
    const resolvedPurpose = parsedUrl.searchParams.get('purpose');
    assert.ok(resolvedPurpose, 'purpose must be resolved');
    assert.equal(resolvedPurpose.length, 50, 'Overlong purpose must be strictly truncated to 50 characters');
    assert.equal(resolvedPurpose, 'A'.repeat(50));
  });

  test('TC-DL-004: Pre-Registration Custom Purpose is sanitized and capped at 50 characters', async () => {
    const payload = {
      consent: true,
      mobile: '9876543211',
      purpose: 'Special Procurement Vendor Verification - Document Access Req'
    };
    const meta = { ipAddress: '127.0.0.1', userAgent: 'ComplianceTestRunner/1.0' };

    const result = await aadhaarKycService.preRegisterStart(payload, meta);
    const parsedUrl = new URL(result.authorizationUrl);
    const resolvedPurpose = parsedUrl.searchParams.get('purpose');
    assert.ok(resolvedPurpose);
    assert.ok(resolvedPurpose.length <= 50, `purpose length must be <= 50 (got ${resolvedPurpose.length})`);
    assert.equal(resolvedPurpose, 'Special Procurement Vendor Verification Document A');
  });

  test('TC-DL-005: Pre-Registration status returns verified mobile when available', async () => {
    const payload = {
      consent: true,
      mobile: '9123456780',
      redirectPath: '/register',
      frontendOrigin: 'http://localhost:3000'
    };
    const meta = { ipAddress: '127.0.0.1', userAgent: 'ComplianceTestRunner/1.0' };

    const startResult = await aadhaarKycService.preRegisterStart(payload, meta);
    assert.ok(startResult.kycSessionToken);

    // Simulate callback storing verifiedMobile
    const crypto = await import('node:crypto');
    const tokenHash = crypto.createHash('sha256').update(startResult.kycSessionToken).digest('hex');
    await prisma.preRegistrationKycSession.update({
      where: { kycSessionTokenHash: tokenHash },
      data: {
        status: 'VERIFIED',
        verifiedName: 'Anand Milind Gadge',
        verifiedMobile: '9876543210',
        aadhaarLast4: '5417'
      }
    });

    const statusResult = await aadhaarKycService.preRegisterStatus(startResult.kycSessionToken);
    assert.equal(statusResult.status, 'VERIFIED');
    assert.equal(statusResult.verifiedMobile, '9876543210', 'preRegisterStatus must return verified mobile');
    assert.equal(statusResult.aadhaarLast4, '5417');
    assert.equal(statusResult.verifiedName, 'Anand Milind Gadge');

    // Clean up
    await prisma.preRegistrationKycSession.delete({ where: { kycSessionTokenHash: tokenHash } }).catch(() => null);
  });
});

