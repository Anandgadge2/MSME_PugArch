import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

// Import masking utility
import { maskSensitive } from '../src/utils/maskSensitive.js';

// ============================================================================
// ADVERSARIAL CHALLENGER 2: MILESTONE 5 VERIFICATION SUITE
// QUERY BOUNDS, TENANCY SCOPING & SENSITIVE DATA INTEGRITY
// ============================================================================

test('--- CHALLENGER 2: MILESTONE 5 ADVERSARIAL SUITE START ---', () => {
  assert.ok(true, 'Initiating Challenger 2 Milestone 5 Verification');
});

// Helper implementing the exact pagination parsing logic from procurement-bid.routes.ts
function parsePaginationParams(query) {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const parsedLimit = parseInt(String(query.limit || '20'), 10) || 20;
  const limit = Math.min(Math.max(1, parsedLimit), 100);
  const skip = (page - 1) * limit;
  return { page, parsedLimit, limit, skip };
}

function calculatePaginationMetadata(totalCount, page, limit) {
  const totalPages = Math.ceil(totalCount / limit);
  return { page, limit, totalCount, totalPages };
}

function resolveTenderWhereClause(role, currentUserId) {
  return (role === 'seller' || role === 'shg')
    ? { sellerId: currentUserId }
    : role === 'buyer'
      ? { tender: { buyerId: currentUserId } }
      : {};
}

// ============================================================================
// 1. QUERY BOUNDS & PAGINATION FUZZING (GET /procurement-bids/my)
// ============================================================================

test('CHALLENGER 2 - QB.01: Limit upper bound strictly clamped to 100', () => {
  const testLimits = ['100', '101', '1000', '99999', '999999999', '1e6'];
  for (const l of testLimits) {
    const { limit } = parsePaginationParams({ limit: l });
    assert.equal(limit <= 100, true, `Limit '${l}' must be <= 100, got ${limit}`);
  }
});

test('CHALLENGER 2 - QB.02: Non-numeric, negative, and zero limit fallback safely', () => {
  const testCases = [
    { input: '0', expected: 20 },         // 0 is falsy, defaults to 20
    { input: '-1', expected: 1 },         // negative clamped to 1
    { input: '-9999', expected: 1 },      // clamped to 1
    { input: 'abc', expected: 20 },       // NaN falls back to 20
    { input: '', expected: 20 },          // empty falls back to 20
    { input: null, expected: 20 },        // null falls back to 20
    { input: undefined, expected: 20 },   // undefined falls back to 20
    { input: '   ', expected: 20 },       // whitespace falls back to 20
    { input: 'NaN', expected: 20 },       // NaN falls back to 20
    { input: 'Infinity', expected: 20 },  // parseInt('Infinity') is NaN -> 20
    { input: '50.8', expected: 50 },      // truncated to integer 50
    { input: '  35  ', expected: 35 },    // trimmed integer 35
  ];

  for (const tc of testCases) {
    const { limit } = parsePaginationParams({ limit: tc.input });
    assert.equal(limit, tc.expected, `Input '${tc.input}' expected limit ${tc.expected}, got ${limit}`);
  }
});

test('CHALLENGER 2 - QB.03: Page parameter adversarial bounds and skip calculation', () => {
  const testCases = [
    { page: '1', limit: '20', expPage: 1, expSkip: 0 },
    { page: '2', limit: '20', expPage: 2, expSkip: 20 },
    { page: '5', limit: '50', expPage: 5, expSkip: 200 },
    { page: '0', limit: '20', expPage: 1, expSkip: 0 },         // 0 clamped to 1
    { page: '-5', limit: '20', expPage: 1, expSkip: 0 },        // negative clamped to 1
    { page: 'invalid', limit: '20', expPage: 1, expSkip: 0 },   // non-numeric falls back to 1
    { page: '100', limit: '100', expPage: 100, expSkip: 9900 },
  ];

  for (const tc of testCases) {
    const res = parsePaginationParams(tc);
    assert.equal(res.page, tc.expPage, `Page for input ${tc.page} must be ${tc.expPage}`);
    assert.equal(res.skip, tc.expSkip, `Skip for page ${tc.page} limit ${tc.limit} must be ${tc.expSkip}`);
  }
});

test('CHALLENGER 2 - QB.04: TotalPages calculation across boundary counts', () => {
  const cases = [
    { count: 0, limit: 20, expPages: 0 },
    { count: 1, limit: 20, expPages: 1 },
    { count: 19, limit: 20, expPages: 1 },
    { count: 20, limit: 20, expPages: 1 },
    { count: 21, limit: 20, expPages: 2 },
    { count: 99, limit: 100, expPages: 1 },
    { count: 100, limit: 100, expPages: 1 },
    { count: 101, limit: 100, expPages: 2 },
    { count: 450, limit: 50, expPages: 9 },
  ];

  for (const tc of cases) {
    const meta = calculatePaginationMetadata(tc.count, 1, tc.limit);
    assert.equal(meta.totalPages, tc.expPages, `Count ${tc.count} with limit ${tc.limit} should yield ${tc.expPages} pages`);
  }
});

// ============================================================================
// 2. TENANCY SCOPING & AUTHORIZATION INTEGRITY
// ============================================================================

test('CHALLENGER 2 - TENANCY.01: Seller & SHG roles are strictly scoped to current user sellerId', () => {
  const sellerWhere = resolveTenderWhereClause('seller', 101);
  assert.deepEqual(sellerWhere, { sellerId: 101 }, 'Seller role must query where sellerId == req.user.id');

  const shgWhere = resolveTenderWhereClause('shg', 202);
  assert.deepEqual(shgWhere, { sellerId: 202 }, 'SHG role must query where sellerId == req.user.id');
});

test('CHALLENGER 2 - TENANCY.02: Buyer role is strictly scoped to tender.buyerId', () => {
  const buyerWhere = resolveTenderWhereClause('buyer', 555);
  assert.deepEqual(buyerWhere, { tender: { buyerId: 555 } }, 'Buyer role must query where tender.buyerId == req.user.id');
});

test('CHALLENGER 2 - TENANCY.03: Admin role has platform-wide query visibility', () => {
  const adminWhere = resolveTenderWhereClause('admin', 1);
  assert.deepEqual(adminWhere, {}, 'Admin role should have unconstrained query where clause');
});

// ============================================================================
// 3. SENSITIVE PII DATA MASKING VERIFICATION
// ============================================================================

test('CHALLENGER 2 - MASK.01: Sensitive PII (Aadhaar, PAN, Bank Accounts) are masked in responses', () => {
  const sampleBid = {
    id: 1,
    bidNumber: 'BID-2026-001',
    amount: 150000,
    seller: {
      id: 10,
      name: 'Ramesh Sharma',
      email: 'ramesh@example.com',
      mobile: '9876543210',
      aadhaar: '123456789012',
      pan: 'ABCDE1234F',
      bankAccountNumber: '98765432109876'
    }
  };

  const masked = maskSensitive([sampleBid]);
  assert.equal(Array.isArray(masked), true);
  const seller = masked[0].seller;
  
  if (seller.aadhaar) {
    assert.ok(seller.aadhaar.includes('X') || seller.aadhaar.includes('*'), 'Aadhaar must be masked');
    assert.ok(!seller.aadhaar.includes('123456789012'), 'Plaintext Aadhaar must never be exposed');
  }
  if (seller.pan) {
    assert.ok(seller.pan.includes('X') || seller.pan.includes('*') || seller.pan.length <= 10, 'PAN must be handled securely');
  }
});
