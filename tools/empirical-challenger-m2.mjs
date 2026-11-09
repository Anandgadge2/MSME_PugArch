/**
 * Milestone 2 Empirical Adversarial Challenger Test Suite
 * Archetype: EMPIRICAL CHALLENGER
 * Roles: critic, specialist
 * Target: Gap 2 (Bulk CSV / Report Export Egress Masking) & Gap 3 (Session-Bound CSRF Token Protection)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { maskSensitive, maskPAN, maskGST, maskAadhaar, maskBankAccount, maskEmail, maskPhone } from '../backend/dist/src/utils/maskSensitive.js';
import { generateSessionCsrfToken, setCsrfCookie, setAuthCookies, readCookie } from '../backend/dist/src/services/auth-cookie.service.js';
import { csrfProtection } from '../backend/dist/src/middleware/csrfProtection.js';
import { signAccessToken } from '../backend/dist/src/services/token.service.js';

// Replica of sendCsv and flattenRecord logic from backend/src/routes/master-admin.routes.ts
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
};

const flattenRecord = (record) => {
  const flattened = {};
  for (const [key, value] of Object.entries(record)) {
    if (value instanceof Date) flattened[key] = value.toISOString();
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        flattened[`${key}_${nestedKey}`] = nestedValue instanceof Date ? nestedValue.toISOString() : nestedValue;
      }
    } else {
      flattened[key] = value;
    }
  }
  return flattened;
};

const generateCsvOutput = (rows) => {
  const safeRows = rows.map(row => flattenRecord(maskSensitive(row)));
  const columns = Array.from(safeRows.reduce((set, row) => {
    Object.keys(row).forEach(key => set.add(key));
    return set;
  }, new Set()));
  const csv = [
    columns.join(','),
    ...safeRows.map(row => columns.map(column => csvCell(row[column])).join(','))
  ].join('\n');
  return { csv, columns, safeRows };
};

console.log('================================================================');
console.log('STARTING EMPIRICAL CHALLENGER SUITE: MILESTONE 2 (GAPS 2 & 3)');
console.log('================================================================\n');

// ============================================================================
// SUITE 1: BULK CSV GENERATION & PII EGRESS MASKING ACROSS ALL 12+ MODULES
// ============================================================================

test('CHALLENGER 1 - GAP 2: Module "companies" masks email and phone numbers in CSV', () => {
  const rawEmail = 'md_jharsuguda@odisha.gov.in';
  const rawPhone = '+91 6645 272101';
  const rows = [
    {
      id: 1,
      name: 'Collectorate Jharsuguda',
      shortName: 'Jharsuguda',
      portalDisplayName: 'Collectorate Jharsuguda Portal',
      contactEmail: rawEmail,
      contactPhone: rawPhone,
      district: 'Jharsuguda',
      state: 'Odisha',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z')
    }
  ];

  const { csv, safeRows } = generateCsvOutput(rows);

  // Assert raw email and phone are NEVER present anywhere in CSV string
  assert.equal(csv.includes(rawEmail), false, `Raw email ${rawEmail} leaked into CSV output`);
  assert.equal(csv.includes('272101'), false, `Raw phone digits leaked into CSV output`);
  
  // Assert masked values
  assert.match(safeRows[0].contactEmail, /^m\*\*\*a@odisha\.gov\.in$/);
  assert.match(safeRows[0].contactPhone, /\*{4,}2101$/);
  assert.equal(safeRows[0].isActive, true);
});

test('CHALLENGER 1 - GAP 2: Module "organizations" masks PAN and GSTIN, preserves verificationStatus', () => {
  const rawPan = 'AAACT2727Q';
  const rawGst = '21AAACT2727Q1ZW';
  const rows = [
    {
      id: 10,
      organizationName: 'Tata Steel Processing Ltd',
      organizationType: 'PRIVATE_LIMITED',
      gstin: rawGst,
      panNumber: rawPan,
      udyamNumber: 'UDYAM-OD-12-0012345',
      verificationStatus: 'approved',
      isBlacklisted: false,
      city: 'Jharsuguda',
      district: 'Jharsuguda',
      state: 'Odisha',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 11,
      organizationName: 'Rejected Vendor Works',
      organizationType: 'PROPRIETORSHIP',
      gstin: '21ABCDE1234F1Z5',
      panNumber: 'ABCDE1234F',
      udyamNumber: 'UDYAM-OD-12-0099999',
      verificationStatus: 'rejected',
      isBlacklisted: true,
      city: 'Rourkela',
      district: 'Sundargarh',
      state: 'Odisha'
    }
  ];

  const { csv, safeRows } = generateCsvOutput(rows);

  // Leaks check
  assert.equal(csv.includes(rawPan), false, `Raw PAN ${rawPan} leaked into CSV`);
  assert.equal(csv.includes(rawGst), false, `Raw GST ${rawGst} leaked into CSV`);
  assert.equal(csv.includes('ABCDE1234F'), false, 'Raw PAN ABCDE1234F leaked into CSV');
  assert.equal(csv.includes('21ABCDE1234F1Z5'), false, 'Raw GSTIN 21ABCDE1234F1Z5 leaked into CSV');

  // Verify masking format
  assert.equal(safeRows[0].panNumber, 'AA***7Q');
  assert.equal(safeRows[0].gstin, '21***********ZW');
  assert.equal(safeRows[1].panNumber, 'AB***4F');
  assert.equal(safeRows[1].gstin, '21***********Z5');

  // Verify workflow status columns remain strictly uncorrupted
  assert.equal(safeRows[0].verificationStatus, 'approved');
  assert.equal(safeRows[1].verificationStatus, 'rejected');
  assert.match(csv, /"approved"/);
  assert.match(csv, /"rejected"/);
});

test('CHALLENGER 1 - GAP 2: Module "users" masks email and mobile, preserves role & accountStatus', () => {
  const rawEmail = 'collector.jharsuguda@gov.in';
  const rawMobile = '9876543210';
  const rows = [
    {
      id: 50,
      userId: 'USR-JSG-001',
      name: 'Collector Officer',
      email: rawEmail,
      mobile: rawMobile,
      role: 'DISTRICT_COLLECTOR',
      onboardingStatus: 'verified',
      accountStatus: 'active',
      emailVerified: true,
      mobileVerified: true,
      lastLoginAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      organization: { organizationName: 'District Collectorate' }
    }
  ];

  const { csv, safeRows } = generateCsvOutput(rows);

  assert.equal(csv.includes(rawEmail), false, `Raw user email ${rawEmail} leaked`);
  assert.equal(csv.includes(rawMobile), false, `Raw user mobile ${rawMobile} leaked`);

  // Masked values
  assert.match(safeRows[0].email, /^c\*\*\*a@gov\.in$/);
  assert.equal(safeRows[0].mobile, '******3210');

  // Workflow statuses and metadata intact
  assert.equal(safeRows[0].role, 'DISTRICT_COLLECTOR');
  assert.equal(safeRows[0].onboardingStatus, 'verified');
  assert.equal(safeRows[0].accountStatus, 'active');
  assert.equal(safeRows[0].emailVerified, true);
  assert.equal(safeRows[0].organization_organizationName, 'District Collectorate');
});

test('CHALLENGER 1 - GAP 2: Module "tenders" masks nested buyer email and preserves tender status', () => {
  const buyerEmail = 'tender.evaluator@dept.gov.in';
  const rows = [
    {
      id: 101,
      tenderId: 'TND-2026-009',
      title: 'Supply of Smart Classrooms',
      category: 'GOODS',
      status: 'active',
      budget: 1500000,
      bidsCount: 4,
      publishedAt: new Date(),
      closesAt: new Date(),
      organization: { organizationName: 'School Dept' },
      buyer: { name: 'Evaluation Comm', email: buyerEmail }
    }
  ];

  const { csv, safeRows } = generateCsvOutput(rows);

  assert.equal(csv.includes(buyerEmail), false, `Nested buyer email ${buyerEmail} leaked in CSV`);
  assert.equal(safeRows[0].buyer_email, 't***r@dept.gov.in');
  assert.equal(safeRows[0].status, 'active');
});

test('CHALLENGER 1 - GAP 2: Module "rfqs" masks nested buyer and seller emails and preserves status', () => {
  const buyerEmail = 'buyer.rfq@industry.org';
  const sellerEmail = 'seller.sales@machinetools.com';
  const rows = [
    {
      id: 201,
      subject: 'CNC Lathe Machine RFQ',
      status: 'pending',
      estimatedValue: 450000,
      deadlineDate: new Date(),
      buyer: { name: 'Buyer Org', email: buyerEmail },
      seller: { name: 'Seller Org', email: sellerEmail }
    }
  ];

  const { csv, safeRows } = generateCsvOutput(rows);

  assert.equal(csv.includes(buyerEmail), false);
  assert.equal(csv.includes(sellerEmail), false);
  assert.equal(safeRows[0].buyer_email, 'b***q@industry.org');
  assert.equal(safeRows[0].seller_email, 's***s@machinetools.com');
  assert.equal(safeRows[0].status, 'pending');
});

test('CHALLENGER 1 - GAP 2: Module "orders" masks nested buyer & seller emails and preserves status', () => {
  const rows = [
    {
      id: 301,
      poNumber: 'PO-2026-888',
      title: 'Steel Fasteners Order',
      amount: 125000,
      totalValue: 125000,
      currency: 'INR',
      status: 'approved',
      sourceType: 'DIRECT',
      expectedDelivery: new Date(),
      buyer: { name: 'District Hospital', email: 'procurement@hospital.gov.in' },
      seller: { name: 'Fastener Works', email: 'sales@fasteners.in' }
    }
  ];

  const { csv, safeRows } = generateCsvOutput(rows);

  assert.equal(csv.includes('procurement@hospital.gov.in'), false);
  assert.equal(csv.includes('sales@fasteners.in'), false);
  assert.equal(safeRows[0].buyer_email, 'p***t@hospital.gov.in');
  assert.equal(safeRows[0].seller_email, 's***s@fasteners.in');
  assert.equal(safeRows[0].status, 'approved');
});

test('CHALLENGER 1 - GAP 2: Module "invoices" masks buyer & seller emails, preserves invoiceStatus & status', () => {
  const rows = [
    {
      id: 401,
      invoiceNumber: 'INV-2026-0044',
      amount: 250000,
      currency: 'INR',
      status: 'submitted',
      invoiceStatus: 'approved',
      taxableAmount: 211864,
      totalTaxAmount: 38136,
      purchaseOrder: { poNumber: 'PO-2026-888', title: 'Steel Fasteners' },
      buyer: { name: 'District Hospital', email: 'finance@hospital.gov.in' },
      seller: { name: 'Fastener Works', email: 'billing@fasteners.in' }
    }
  ];

  const { csv, safeRows } = generateCsvOutput(rows);

  assert.equal(csv.includes('finance@hospital.gov.in'), false);
  assert.equal(csv.includes('billing@fasteners.in'), false);
  assert.equal(safeRows[0].buyer_email, 'f***e@hospital.gov.in');
  assert.equal(safeRows[0].seller_email, 'b***g@fasteners.in');
  assert.equal(safeRows[0].status, 'submitted');
  assert.equal(safeRows[0].invoiceStatus, 'approved');
});

test('CHALLENGER 1 - GAP 2: Module "payments" masks payer & payee emails, preserves paymentStatus', () => {
  const rows = [
    {
      id: 501,
      referenceId: 'PAY-SBI-991122',
      gateway: 'SBI_EPAY',
      method: 'NET_BANKING',
      amount: 100000,
      currency: 'INR',
      status: 'completed',
      paymentStatus: 'approved',
      payer: { name: 'Payer Admin', email: 'treasury@district.gov.in' },
      payee: { name: 'Payee Vendor', email: 'receivables@vendor.com' }
    }
  ];

  const { csv, safeRows } = generateCsvOutput(rows);

  assert.equal(csv.includes('treasury@district.gov.in'), false);
  assert.equal(csv.includes('receivables@vendor.com'), false);
  assert.equal(safeRows[0].payer_email, 't***y@district.gov.in');
  assert.equal(safeRows[0].payee_email, 'r***s@vendor.com');
  assert.equal(safeRows[0].paymentStatus, 'approved');
});

test('CHALLENGER 1 - GAP 2: Modules "products", "services", "documents", "audit-logs" mask all actor emails', () => {
  const rows = [
    {
      id: 601,
      name: 'Hydraulic Press',
      seller: { name: 'Industrial Tools', email: 'service@industrial.com' },
      status: 'active'
    },
    {
      id: 701,
      originalName: 'cancelled_cheque.pdf',
      owner: { name: 'Owner User', email: 'owner@business.org' },
      status: 'verified'
    },
    {
      id: 801,
      action: 'admin.export',
      User: { name: 'Security Auditor', email: 'auditor@cert-in.gov.in', role: 'MASTER_ADMIN' }
    }
  ];

  const { csv, safeRows } = generateCsvOutput(rows);

  assert.equal(csv.includes('service@industrial.com'), false);
  assert.equal(csv.includes('owner@business.org'), false);
  assert.equal(csv.includes('auditor@cert-in.gov.in'), false);
  assert.equal(safeRows[0].seller_email, 's***e@industrial.com');
  assert.equal(safeRows[1].owner_email, 'o***r@business.org');
  assert.equal(safeRows[2].User_email, 'a***r@cert-in.gov.in');
});

// ============================================================================
// SUITE 2: ADVERSARIAL STRESS TESTING: WORKFLOW STATUS INTEGRITY & EDGE CASES
// ============================================================================

test('CHALLENGER 1 - STRESS: sectionStatus colliding keys (pan, gstin, aadhaar, bankAccount) remain verbatim', () => {
  const userWithSectionStatus = {
    id: 999,
    userId: 'USR-SECTION-TEST',
    email: 'admin@audit.org',
    sectionStatus: {
      pan: 'approved',
      gstin: 'rejected',
      bankAccount: 'under_review',
      aadhaar: 'verified',
      businessDetails: 'pending'
    },
    sectionRejectionReasons: {
      pan: 'PAN name mismatch with Aadhaar',
      gstin: 'Inactive GST status on portal'
    },
    complianceViolations: ['MISMATCH_NAME']
  };

  const masked = maskSensitive(userWithSectionStatus);

  // Passthrough trees must be preserved 100% verbatim
  assert.equal(masked.sectionStatus.pan, 'approved', 'Workflow status "approved" in sectionStatus.pan was corrupted');
  assert.equal(masked.sectionStatus.gstin, 'rejected', 'Workflow status "rejected" in sectionStatus.gstin was corrupted');
  assert.equal(masked.sectionStatus.bankAccount, 'under_review');
  assert.equal(masked.sectionStatus.aadhaar, 'verified');
  assert.equal(masked.sectionStatus.businessDetails, 'pending');

  assert.equal(masked.sectionRejectionReasons.pan, 'PAN name mismatch with Aadhaar');
  assert.equal(masked.sectionRejectionReasons.gstin, 'Inactive GST status on portal');

  // But user.email must still be masked
  assert.equal(masked.email, 'a***n@audit.org');

  // Now verify flattenRecord and CSV emission for this record
  const flattened = flattenRecord(masked);
  assert.equal(flattened.sectionStatus_pan, 'approved');
  assert.equal(flattened.sectionStatus_gstin, 'rejected');
  assert.equal(flattened.sectionStatus_bankAccount, 'under_review');
});

test('CHALLENGER 1 - STRESS: Direct keys named pan or gstin containing workflow status are NOT masked', () => {
  const recordWithStatusInPanKey = {
    id: 12,
    pan: 'approved',
    gst: 'rejected',
    gstin: 'pending',
    actualPan: 'ABCDE1234F',
    actualGst: '21ABCDE1234F1Z5'
  };

  const masked = maskSensitive(recordWithStatusInPanKey);
  assert.equal(masked.pan, 'approved', 'Direct workflow status string in "pan" was wrongly masked');
  assert.equal(masked.gst, 'rejected', 'Direct workflow status string in "gst" was wrongly masked');
  assert.equal(masked.gstin, 'pending', 'Direct workflow status string in "gstin" was wrongly masked');

  // Actual PII is masked
  assert.equal(maskPAN(recordWithStatusInPanKey.actualPan), 'AB***4F');
  assert.equal(maskGST(recordWithStatusInPanKey.actualGst), '21***********Z5');
});

test('CHALLENGER 1 - STRESS: Bank account numbers across various key casings are masked', () => {
  const bankRecord = {
    accountNumber: '1234567890123456',
    bankAccountNo: '987654321012',
    officialPhone: '+919876543210',
    contactPersonMobile: '9988776655',
    verifyingEmail: 'verifier@portal.gov.in'
  };

  const masked = maskSensitive(bankRecord);
  assert.equal(masked.accountNumber, '************3456');
  assert.equal(masked.bankAccountNo, '********1012');
  assert.equal(masked.officialPhone, '*********3210');
  assert.equal(masked.contactPersonMobile, '******6655');
  assert.equal(masked.verifyingEmail, 'v***r@portal.gov.in');
});

test('CHALLENGER 1 - STRESS: Circular references and null/primitive inputs handled gracefully', () => {
  const circularObj = { id: 1, email: 'circ@test.com' };
  circularObj.self = circularObj;

  // Must not throw RangeError: Maximum call stack size exceeded
  const masked = maskSensitive(circularObj);
  assert.equal(masked.email, 'c***c@test.com');
  assert.equal(masked.self, '[Circular]');

  // Null, undefined, primitives pass through
  assert.equal(maskSensitive(null), null);
  assert.equal(maskSensitive(undefined), undefined);
  assert.equal(maskSensitive(42), 42);
  assert.equal(maskSensitive('hello'), 'hello');
});

test('CHALLENGER 1 - STRESS: CSV escaping handles commas, double quotes, and newlines safely', () => {
  const adversarialRows = [
    {
      id: 99,
      organizationName: 'Tata "Steel" & Allied, Corp',
      address: 'Line 1\nLine 2\r\nLine 3',
      notes: '=SUM(1+1)',
      contactEmail: 'director@tata.com'
    }
  ];

  const { csv } = generateCsvOutput(adversarialRows);

  // Must quote and double inner quotes per RFC 4180
  assert.match(csv, /"Tata ""Steel"" & Allied, Corp"/);
  // Newlines must be replaced or safely enclosed so CSV row count is predictable
  assert.equal(csv.includes('Line 1 Line 2 Line 3'), true);
  // Email must be masked
  assert.equal(csv.includes('director@tata.com'), false);
  assert.match(csv, /"d\*\*\*r@tata\.com"/);
});

// ============================================================================
// SUITE 3: SESSION-BOUND CSRF TOKEN PROTECTION (GAP 3)
// ============================================================================

test('CHALLENGER 1 - GAP 3: Session CSRF token is cryptographically bound to userId and sessionVersion', () => {
  const tokenUser1V1 = generateSessionCsrfToken(1, 1);
  const tokenUser1V2 = generateSessionCsrfToken(1, 2);
  const tokenUser2V1 = generateSessionCsrfToken(2, 1);

  assert.equal(tokenUser1V1.length, 64, 'Token must be a 64-char SHA256 hex string');
  assert.notEqual(tokenUser1V1, tokenUser1V2, 'Session version increment must yield completely different token');
  assert.notEqual(tokenUser1V1, tokenUser2V1, 'Different users with same sessionVersion must yield distinct tokens');

  // Verify determinism for same user and version
  assert.equal(generateSessionCsrfToken(1, 1), tokenUser1V1);
});

test('CHALLENGER 1 - GAP 3: csrfProtection permits valid session-bound CSRF token on mutating request', () => {
  const userId = 88;
  const sessionVersion = 1;
  const accessToken = signAccessToken({ id: userId, sessionVersion, role: 'BUYER' });
  const validCsrf = generateSessionCsrfToken(userId, sessionVersion);

  let nextCalled = false;
  let statusResult = null;

  const mockReq = {
    method: 'POST',
    path: '/api/tenders/create',
    headers: {
      cookie: `token=${accessToken}; csrfToken=${validCsrf}`,
      'x-csrf-token': validCsrf
    }
  };

  const mockRes = {
    status(code) { statusResult = code; return this; },
    json(body) { return this; }
  };

  csrfProtection(mockReq, mockRes, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true, 'Valid session-bound CSRF request must call next()');
  assert.equal(statusResult, null, 'Status must not be set to error');
});

test('CHALLENGER 1 - GAP 3: ADVERSARIAL COOKIE TOSSING: Attacker-tossed arbitrary cookie is REJECTED', () => {
  // Attacker tosses cookie csrfToken=attacker_arbitrary_value on subdomain
  // and sends header X-CSRF-Token: attacker_arbitrary_value
  // Even though cookie == header (passing naive double-submit), session binding MUST catch it!
  const victimUserId = 88;
  const victimSessionVersion = 1;
  const victimAccessToken = signAccessToken({ id: victimUserId, sessionVersion: victimSessionVersion, role: 'BUYER' });
  
  const attackerTossedToken = crypto.randomBytes(32).toString('hex');

  let nextCalled = false;
  let statusCode = null;
  let errorResponse = null;

  const mockReq = {
    method: 'POST',
    path: '/api/orders/accept',
    headers: {
      cookie: `token=${victimAccessToken}; csrfToken=${attackerTossedToken}`,
      'x-csrf-token': attackerTossedToken
    }
  };

  const mockRes = {
    status(code) { statusCode = code; return this; },
    json(body) { errorResponse = body; return this; }
  };

  csrfProtection(mockReq, mockRes, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false, 'Attacker tossed cookie must NOT call next()');
  assert.equal(statusCode, 403, 'Attacker tossed cookie must return 403 Forbidden');
  assert.equal(errorResponse.code, 'CSRF_TOKEN_INVALID');
  assert.equal(errorResponse.errorCode, 'CSRF_TOKEN_INVALID');
});

test('CHALLENGER 1 - GAP 3: ADVERSARIAL REPLAY: Token from attacker userId=99 cannot be used for victim userId=88', () => {
  const victimUserId = 88;
  const victimAccessToken = signAccessToken({ id: victimUserId, sessionVersion: 1, role: 'BUYER' });
  
  // Attacker gets valid token for themselves
  const attackerUserId = 99;
  const attackerValidCsrf = generateSessionCsrfToken(attackerUserId, 1);

  let nextCalled = false;
  let statusCode = null;

  const mockReq = {
    method: 'POST',
    path: '/api/profile/update',
    headers: {
      cookie: `token=${victimAccessToken}; csrfToken=${attackerValidCsrf}`,
      'x-csrf-token': attackerValidCsrf
    }
  };

  const mockRes = {
    status(code) { statusCode = code; return this; },
    json() { return this; }
  };

  csrfProtection(mockReq, mockRes, () => { nextCalled = true; });

  assert.equal(nextCalled, false, 'Cross-user token replay must be rejected');
  assert.equal(statusCode, 403);
});

test('CHALLENGER 1 - GAP 3: ADVERSARIAL SESSION REVOCATION: Old session version token rejected after version bump', () => {
  const userId = 77;
  // User had session version 1, but revoked it to version 2
  const oldV1Token = generateSessionCsrfToken(userId, 1);
  const newV2AccessToken = signAccessToken({ id: userId, sessionVersion: 2, role: 'SELLER' });

  let nextCalled = false;
  let statusCode = null;

  const mockReq = {
    method: 'DELETE',
    path: '/api/products/123',
    headers: {
      cookie: `token=${newV2AccessToken}; csrfToken=${oldV1Token}`,
      'x-csrf-token': oldV1Token
    }
  };

  const mockRes = {
    status(code) { statusCode = code; return this; },
    json() { return this; }
  };

  csrfProtection(mockReq, mockRes, () => { nextCalled = true; });

  assert.equal(nextCalled, false, 'Stale session version token must be rejected');
  assert.equal(statusCode, 403);
});

test('CHALLENGER 1 - GAP 3: Mismatched cookie vs header token is rejected', () => {
  const userId = 100;
  const validToken = generateSessionCsrfToken(userId, 1);
  const accessToken = signAccessToken({ id: userId, sessionVersion: 1, role: 'ADMIN' });

  let nextCalled = false;
  let statusCode = null;

  const mockReq = {
    method: 'POST',
    path: '/api/users/disable',
    headers: {
      cookie: `token=${accessToken}; csrfToken=${validToken}`,
      'x-csrf-token': 'wrong-header-token-12345'
    }
  };

  const mockRes = {
    status(code) { statusCode = code; return this; },
    json() { return this; }
  };

  csrfProtection(mockReq, mockRes, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(statusCode, 403);
});

test('CHALLENGER 1 - GAP 3: Missing cookie or missing header token is rejected', () => {
  const userId = 100;
  const accessToken = signAccessToken({ id: userId, sessionVersion: 1, role: 'ADMIN' });

  // Case A: Missing header
  let nextA = false, statusA = null;
  csrfProtection(
    { method: 'POST', path: '/api/action', headers: { cookie: `token=${accessToken}; csrfToken=abc` } },
    { status(c) { statusA = c; return this; }, json() { return this; } },
    () => { nextA = true; }
  );
  assert.equal(nextA, false);
  assert.equal(statusA, 403);

  // Case B: Missing cookie
  let nextB = false, statusB = null;
  csrfProtection(
    { method: 'POST', path: '/api/action', headers: { cookie: `token=${accessToken}`, 'x-csrf-token': 'abc' } },
    { status(c) { statusB = c; return this; }, json() { return this; } },
    () => { nextB = true; }
  );
  assert.equal(nextB, false);
  assert.equal(statusB, 403);
});

test('CHALLENGER 1 - GAP 3: Stateless Authorization: Bearer header is exempt from CSRF checks', () => {
  const dummyJwt = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_bearer_token_over_20_chars_long_for_api_client';
  let nextCalled = false;

  const mockReq = {
    method: 'POST',
    path: '/api/b2b/integrations/order',
    headers: {
      authorization: dummyJwt
    }
  };

  csrfProtection(mockReq, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true, 'Stateless Bearer token requests must be exempt from CSRF');
});

test('CHALLENGER 1 - GAP 3: Safe HTTP methods (GET, HEAD, OPTIONS) pass through unconditionally', () => {
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    let nextCalled = false;
    csrfProtection({ method, path: '/api/data' }, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true, `Method ${method} must pass through`);
  }
});

test('CHALLENGER 1 - GAP 3: Exempt public auth endpoints pass through unconditionally', () => {
  const exemptPaths = ['/api/auth/login', '/api/auth/register', '/api/seller/register', '/api/buyer/register'];
  for (const path of exemptPaths) {
    let nextCalled = false;
    csrfProtection({ method: 'POST', path }, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true, `Exempt path ${path} must pass through without CSRF`);
  }
});

test('CHALLENGER 1 - ADVERSARIAL FUZZ: 500 randomized records verify zero PII leaks and 100% workflow status integrity', () => {
  const panLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const panDigits = '0123456789';
  const workflowStatuses = ['approved', 'rejected', 'pending', 'submitted', 'verified', 'incomplete', 'under_review', 'active', 'inactive', 'suspended', 'cancelled'];
  
  const generatedRecords = [];
  const rawPans = [];
  const rawGstins = [];
  const rawEmails = [];
  const rawMobiles = [];
  const assignedStatuses = [];

  for (let i = 0; i < 500; i++) {
    // Generate valid Indian PAN: 5 uppercase letters + 4 digits + 1 uppercase letter
    const p1 = Array.from({ length: 5 }, () => panLetters[Math.floor(Math.random() * panLetters.length)]).join('');
    const p2 = Array.from({ length: 4 }, () => panDigits[Math.floor(Math.random() * panDigits.length)]).join('');
    const p3 = panLetters[Math.floor(Math.random() * panLetters.length)];
    const pan = `${p1}${p2}${p3}`;
    rawPans.push(pan);

    // Generate valid Indian GSTIN: 2 state digits + PAN + 1 entity digit + 'Z' + 1 checksum digit/char
    const gstState = String(Math.floor(Math.random() * 35) + 1).padStart(2, '0');
    const gstin = `${gstState}${pan}1Z5`;
    rawGstins.push(gstin);

    // Generate valid 10-digit mobile
    const mobile = `9${Array.from({ length: 9 }, () => panDigits[Math.floor(Math.random() * panDigits.length)]).join('')}`;
    rawMobiles.push(mobile);

    // Generate email
    const email = `user_${i}_${p1.toLowerCase()}@domain${i % 10}.gov.in`;
    rawEmails.push(email);

    // Pick workflow status
    const wfStatus = workflowStatuses[i % workflowStatuses.length];
    assignedStatuses.push(wfStatus);

    generatedRecords.push({
      id: i + 1,
      panNumber: pan,
      gstin: gstin,
      mobile: mobile,
      email: email,
      status: wfStatus,
      approvalStatus: wfStatus,
      verificationStatus: wfStatus,
      sectionStatus: {
        pan: wfStatus,
        gstin: wfStatus
      },
      buyer: {
        email: `buyer_${email}`,
        mobile: `8${mobile.slice(1)}`
      },
      seller: {
        email: `seller_${email}`,
        contactPhone: mobile
      }
    });
  }

  const { csv, safeRows } = generateCsvOutput(generatedRecords);

  // 1. Assert NONE of the 500 raw PANs exist in the emitted CSV
  for (const pan of rawPans) {
    assert.equal(csv.includes(pan), false, `Raw PAN ${pan} was found in emitted CSV!`);
  }

  // 2. Assert NONE of the 500 raw GSTINs exist in the emitted CSV
  for (const gstin of rawGstins) {
    assert.equal(csv.includes(gstin), false, `Raw GSTIN ${gstin} was found in emitted CSV!`);
  }

  // 3. Assert NONE of the raw Emails exist in the emitted CSV
  for (const email of rawEmails) {
    assert.equal(csv.includes(email), false, `Raw Email ${email} was found in emitted CSV!`);
  }

  // 4. Assert NONE of the raw Mobiles exist in the emitted CSV
  for (const mobile of rawMobiles) {
    assert.equal(csv.includes(mobile), false, `Raw Mobile ${mobile} was found in emitted CSV!`);
  }

  // 5. Assert 100% of workflow status columns remained verbatim
  for (let i = 0; i < 500; i++) {
    const expectedStatus = assignedStatuses[i];
    assert.equal(safeRows[i].status, expectedStatus);
    assert.equal(safeRows[i].approvalStatus, expectedStatus);
    assert.equal(safeRows[i].verificationStatus, expectedStatus);
    assert.equal(safeRows[i].sectionStatus_pan, expectedStatus);
    assert.equal(safeRows[i].sectionStatus_gstin, expectedStatus);
  }
});

console.log('\n================================================================');
console.log('ALL EMPIRICAL CHALLENGER TEST SUITES READY FOR EXECUTION');
console.log('================================================================');
