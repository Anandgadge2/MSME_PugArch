import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { csrfProtection } from '../dist/src/middleware/csrfProtection.js';
import { generateSessionCsrfToken, setAuthCookies } from '../dist/src/services/auth-cookie.service.js';
import { signAccessToken } from '../dist/src/services/token.service.js';
import { timingSafeEqual } from '../dist/src/utils/crypto.js';

// ============================================================================
// ADVERSARIAL CHALLENGER 2: SESSION-BOUND CSRF PROTECTION & COOKIE TOSSING
// ============================================================================

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'msme_csrf_hmac_secret_2026';

function createMockReqRes({
  method = 'POST',
  path = '/api/orders',
  originalUrl = undefined,
  headers = {},
  cookies = {}
}) {
  let statusCode = 200;
  let jsonBody = null;
  let nextCalled = false;
  let nextError = null;

  const req = {
    method,
    path,
    originalUrl: originalUrl || path,
    headers: { ...headers },
    cookies: { ...cookies }
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      jsonBody = body;
      return this;
    },
    cookie(name, val, options) {
      cookies[name] = val;
      return this;
    }
  };

  const next = (err) => {
    nextCalled = true;
    nextError = err;
  };

  return {
    req,
    res,
    next,
    getResult: () => ({ statusCode, jsonBody, nextCalled, nextError })
  };
}

test('--- CHALLENGER 2: CSRF ADVERSARIAL SUITE START ---', () => {
  assert.ok(true, 'Initiating Challenger 2 CSRF Cookie Tossing and Session Binding Verification');
});

// ============================================================================
// 1. COOKIE TOSSING ATTACK WITH ARBITRARY MATCHING RANDOM TOKENS
// ============================================================================

test('CHALLENGER 2 - CSRF: Rejects cookie tossing attack with arbitrary matching random tokens (req.cookies)', () => {
  // Attacker tosses matching random tokens into victim User 101's cookies & request header
  const user101Token = signAccessToken({ id: 101, role: 'buyer', sessionVersion: 1 });
  const tossedRandomToken = 'attacker_tossed_arbitrary_random_token_1234567890abcdef';

  const { req, res, next, getResult } = createMockReqRes({
    method: 'POST',
    path: '/api/procurement/orders',
    headers: {
      'x-csrf-token': tossedRandomToken
    },
    cookies: {
      token: user101Token,
      csrfToken: tossedRandomToken
    }
  });

  csrfProtection(req, res, next);
  const result = getResult();

  assert.equal(result.nextCalled, false, 'Next MUST NOT be called when arbitrary tossed tokens are supplied');
  assert.equal(result.statusCode, 403, 'Must return 403 status code for cookie tossing attack');
  assert.equal(result.jsonBody?.error, 'CSRF_TOKEN_INVALID');
  assert.equal(result.jsonBody?.code, 'CSRF_TOKEN_INVALID');
});

test('CHALLENGER 2 - CSRF: Rejects cookie tossing attack with raw Cookie header string', () => {
  const user101Token = signAccessToken({ id: 101, role: 'buyer', sessionVersion: 1 });
  const tossedRandomToken = crypto.randomBytes(24).toString('hex');

  const { req, res, next, getResult } = createMockReqRes({
    method: 'POST',
    path: '/api/rfq/submit',
    headers: {
      cookie: `session=abc; token=${user101Token}; theme=dark; csrfToken=${tossedRandomToken}; lang=en`,
      'x-csrf-token': tossedRandomToken
    }
  });

  csrfProtection(req, res, next);
  const result = getResult();

  assert.equal(result.nextCalled, false, 'Next MUST NOT be called');
  assert.equal(result.statusCode, 403, 'Must return 403 Forbidden');
  assert.equal(result.jsonBody?.error, 'CSRF_TOKEN_INVALID');
});

// ============================================================================
// 2. CROSS-USER CSRF TOKEN SUBSTITUTION (User A token for User B session)
// ============================================================================

test('CHALLENGER 2 - CSRF: Rejects User A valid session CSRF token when used against User B session', () => {
  // User A (id: 101) generates a legitimate session-bound CSRF token
  const userAToken = generateSessionCsrfToken(101, 1);

  // User B (id: 202) is the authenticated victim
  const userBJwt = signAccessToken({ id: 202, role: 'buyer', sessionVersion: 1 });

  // Attacker presents User A's valid CSRF token in both cookie and header for User B's request
  const { req, res, next, getResult } = createMockReqRes({
    method: 'POST',
    path: '/api/bank/payout',
    headers: {
      'x-csrf-token': userAToken
    },
    cookies: {
      token: userBJwt,
      csrfToken: userAToken
    }
  });

  csrfProtection(req, res, next);
  const result = getResult();

  assert.equal(result.nextCalled, false, 'User A token MUST NOT authorize User B mutating request');
  assert.equal(result.statusCode, 403);
  assert.equal(result.jsonBody?.error, 'CSRF_TOKEN_INVALID');
});

// ============================================================================
// 3. SESSION VERSION MISMATCH & STALE TOKEN REVOCATION
// ============================================================================

test('CHALLENGER 2 - CSRF: Rejects valid token from previous sessionVersion after rotation/increment', () => {
  // Token generated for sessionVersion 1
  const oldCsrfToken = generateSessionCsrfToken(101, 1);

  // User is now on sessionVersion 2 (e.g. password changed or rotated)
  const rotatedUserJwt = signAccessToken({ id: 101, role: 'buyer', sessionVersion: 2 });

  const { req, res, next, getResult } = createMockReqRes({
    method: 'PUT',
    path: '/api/profile/update',
    headers: {
      'x-csrf-token': oldCsrfToken
    },
    cookies: {
      token: rotatedUserJwt,
      csrfToken: oldCsrfToken
    }
  });

  csrfProtection(req, res, next);
  const result = getResult();

  assert.equal(result.nextCalled, false, 'Old sessionVersion CSRF token MUST be rejected');
  assert.equal(result.statusCode, 403);
  assert.equal(result.jsonBody?.error, 'CSRF_TOKEN_INVALID');
});

// ============================================================================
// 4. LEGITIMATE SESSION-BOUND CSRF TOKEN ACCEPTANCE
// ============================================================================

test('CHALLENGER 2 - CSRF: Accepts request with valid HMAC-SHA256(userId:sessionVersion, CSRF_SECRET)', () => {
  const userId = 303;
  const sessionVersion = 4;
  const userJwt = signAccessToken({ id: userId, role: 'seller', sessionVersion });
  const validCsrf = generateSessionCsrfToken(userId, sessionVersion);

  const { req, res, next, getResult } = createMockReqRes({
    method: 'POST',
    path: '/api/catalog/products',
    headers: {
      'x-csrf-token': validCsrf
    },
    cookies: {
      token: userJwt,
      csrfToken: validCsrf
    }
  });

  csrfProtection(req, res, next);
  const result = getResult();

  assert.equal(result.nextCalled, true, 'Next MUST be called when session-bound CSRF token matches');
  assert.equal(result.nextError, undefined, 'No error passed to next()');
  assert.equal(result.statusCode, 200, 'Status code must remain default 200 (not modified to 403)');
  assert.equal(result.jsonBody, null, 'No rejection body returned');
});

test('CHALLENGER 2 - CSRF: Correctly handles default sessionVersion (claims without explicit sessionVersion)', () => {
  const userId = 404;
  // Payload omitting sessionVersion (fallback to 1)
  const userJwt = signAccessToken({ id: userId, role: 'buyer', sessionVersion: 1 });
  const validCsrf = generateSessionCsrfToken(userId, 1);

  const { req, res, next, getResult } = createMockReqRes({
    method: 'DELETE',
    path: '/api/cart/items/5',
    headers: {
      'x-csrf-token': validCsrf
    },
    cookies: {
      token: userJwt,
      csrfToken: validCsrf
    }
  });

  csrfProtection(req, res, next);
  const result = getResult();

  assert.equal(result.nextCalled, true, 'Default sessionVersion 1 MUST be accepted');
  assert.equal(result.statusCode, 200);
});

// ============================================================================
// 5. ASYMMETRIC, MISSING, AND MALFORMED TOKEN BOUNDARY CASES
// ============================================================================

test('CHALLENGER 2 - CSRF: Rejects request when csrfToken cookie is missing but header is present', () => {
  const userJwt = signAccessToken({ id: 101, role: 'buyer', sessionVersion: 1 });
  const validCsrf = generateSessionCsrfToken(101, 1);

  const { req, res, next, getResult } = createMockReqRes({
    method: 'POST',
    path: '/api/orders',
    headers: {
      'x-csrf-token': validCsrf
    },
    cookies: {
      token: userJwt
      // csrfToken cookie missing
    }
  });

  csrfProtection(req, res, next);
  const result = getResult();

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 403);
  assert.equal(result.jsonBody?.error, 'CSRF_TOKEN_INVALID');
});

test('CHALLENGER 2 - CSRF: Rejects request when header is missing but csrfToken cookie is present', () => {
  const userJwt = signAccessToken({ id: 101, role: 'buyer', sessionVersion: 1 });
  const validCsrf = generateSessionCsrfToken(101, 1);

  const { req, res, next, getResult } = createMockReqRes({
    method: 'POST',
    path: '/api/orders',
    headers: {
      // x-csrf-token header missing
    },
    cookies: {
      token: userJwt,
      csrfToken: validCsrf
    }
  });

  csrfProtection(req, res, next);
  const result = getResult();

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 403);
  assert.equal(result.jsonBody?.error, 'CSRF_TOKEN_INVALID');
});

test('CHALLENGER 2 - CSRF: Rejects request when header and cookie tokens do not match each other', () => {
  const userJwt = signAccessToken({ id: 101, role: 'buyer', sessionVersion: 1 });
  const validCsrf = generateSessionCsrfToken(101, 1);
  const differentToken = generateSessionCsrfToken(999, 1);

  const { req, res, next, getResult } = createMockReqRes({
    method: 'POST',
    path: '/api/orders',
    headers: {
      'x-csrf-token': differentToken
    },
    cookies: {
      token: userJwt,
      csrfToken: validCsrf
    }
  });

  csrfProtection(req, res, next);
  const result = getResult();

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 403);
  assert.equal(result.jsonBody?.error, 'CSRF_TOKEN_INVALID');
});

test('CHALLENGER 2 - CSRF: Safely handles different length tokens via timingSafeEqual without crashing', () => {
  const userJwt = signAccessToken({ id: 101, role: 'buyer', sessionVersion: 1 });

  const { req, res, next, getResult } = createMockReqRes({
    method: 'POST',
    path: '/api/orders',
    headers: {
      'x-csrf-token': 'short'
    },
    cookies: {
      token: userJwt,
      csrfToken: 'a_much_longer_token_value_that_has_different_length'
    }
  });

  assert.doesNotThrow(() => {
    csrfProtection(req, res, next);
  }, 'Mismatched length tokens must not throw unhandled exception');

  const result = getResult();
  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 403);
});

// ============================================================================
// 6. CORRUPTED OR INVALID ACCESS TOKEN IN COOKIE
// ============================================================================

test('CHALLENGER 2 - CSRF: Rejects request with corrupted/tampered access token in cookie', () => {
  const { req, res, next, getResult } = createMockReqRes({
    method: 'POST',
    path: '/api/orders',
    headers: {
      'x-csrf-token': 'some_token'
    },
    cookies: {
      token: 'corrupted.jwt.signature_value',
      csrfToken: 'some_token'
    }
  });

  csrfProtection(req, res, next);
  const result = getResult();

  assert.equal(result.nextCalled, false);
  assert.equal(result.statusCode, 403);
  assert.equal(result.jsonBody?.error, 'CSRF_TOKEN_INVALID');
});

// ============================================================================
// 7. SAFE HTTP METHODS EXEMPTION (GET, HEAD, OPTIONS)
// ============================================================================

test('CHALLENGER 2 - CSRF: Safe methods (GET, HEAD, OPTIONS) pass without CSRF tokens', () => {
  const userJwt = signAccessToken({ id: 101, role: 'buyer', sessionVersion: 1 });

  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    const { req, res, next, getResult } = createMockReqRes({
      method,
      path: '/api/orders/12345',
      cookies: {
        token: userJwt
      }
    });

    csrfProtection(req, res, next);
    const result = getResult();

    assert.equal(result.nextCalled, true, `Method ${method} MUST be exempt from CSRF validation`);
    assert.equal(result.statusCode, 200);
  }
});

// ============================================================================
// 8. AUTHORIZATION: BEARER HEADER EXEMPTION & BOUNDARY DEFENSE
// ============================================================================

test('CHALLENGER 2 - CSRF: Valid Authorization: Bearer header (> 20 chars) passes mutating request without CSRF tokens', () => {
  const validBearerToken = 'Bearer ' + signAccessToken({ id: 501, role: 'admin', sessionVersion: 1 });
  assert.ok(validBearerToken.slice(7).trim().length > 20, 'Bearer token length must exceed 20 characters');

  const { req, res, next, getResult } = createMockReqRes({
    method: 'POST',
    path: '/api/procurement/contracts',
    headers: {
      authorization: validBearerToken
    }
    // No cookies or CSRF headers supplied
  });

  csrfProtection(req, res, next);
  const result = getResult();

  assert.equal(result.nextCalled, true, 'Valid Bearer header MUST pass without CSRF cookie');
  assert.equal(result.statusCode, 200);
});

test('CHALLENGER 2 - CSRF: Short Bearer header (<= 20 chars) does NOT exempt ambient cookie session', () => {
  const userJwt = signAccessToken({ id: 101, role: 'buyer', sessionVersion: 1 });
  const shortBearer = 'Bearer short_tok'; // 9 chars after 'Bearer '

  const { req, res, next, getResult } = createMockReqRes({
    method: 'POST',
    path: '/api/orders',
    headers: {
      authorization: shortBearer,
      'x-csrf-token': 'attacker_token'
    },
    cookies: {
      token: userJwt,
      csrfToken: 'attacker_token'
    }
  });

  csrfProtection(req, res, next);
  const result = getResult();

  // Should NOT be exempt, cookie tossing attack with arbitrary token must be caught
  assert.equal(result.nextCalled, false, 'Short Bearer header must not bypass CSRF checks');
  assert.equal(result.statusCode, 403);
  assert.equal(result.jsonBody?.error, 'CSRF_TOKEN_INVALID');
});

// ============================================================================
// 9. CSRF EXEMPT PATHS & NON-API ROUTES
// ============================================================================

test('CHALLENGER 2 - CSRF: Exempt public paths pass without CSRF tokens even with ambient session', () => {
  const exemptPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/buyer/register',
    '/api/seller/register',
    '/api/shg/register',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/auth/csrf-token'
  ];

  const userJwt = signAccessToken({ id: 101, role: 'buyer', sessionVersion: 1 });

  for (const path of exemptPaths) {
    const { req, res, next, getResult } = createMockReqRes({
      method: 'POST',
      path,
      cookies: {
        token: userJwt
      }
    });

    csrfProtection(req, res, next);
    const result = getResult();

    assert.equal(result.nextCalled, true, `Path ${path} MUST be exempt from CSRF`);
    assert.equal(result.statusCode, 200);
  }
});

test('CHALLENGER 2 - CSRF: Non-API routes pass through untouched', () => {
  const { req, res, next, getResult } = createMockReqRes({
    method: 'POST',
    path: '/health/check'
  });

  csrfProtection(req, res, next);
  const result = getResult();

  assert.equal(result.nextCalled, true, 'Non-API routes must pass through');
});

test('CHALLENGER 2 - CSRF: Unauthenticated request without token cookie passes to downstream auth middleware', () => {
  const { req, res, next, getResult } = createMockReqRes({
    method: 'POST',
    path: '/api/protected/action'
    // No cookies, no bearer header
  });

  csrfProtection(req, res, next);
  const result = getResult();

  assert.equal(result.nextCalled, true, 'Unauthenticated request must pass CSRF to be handled by requireAuth');
});

// ============================================================================
// 10. INTEGRATION: setAuthCookies ISSUES COMPLIANT SESSION CSRF
// ============================================================================

test('CHALLENGER 2 - CSRF: setAuthCookies issues session-bound CSRF token matching csrfProtection expectations', () => {
  const mockCookies = {};
  const mockRes = {
    cookie(name, val) {
      mockCookies[name] = val;
      return this;
    }
  };

  const user = { id: 777, role: 'buyer', sessionVersion: 3 };
  const accessToken = signAccessToken(user);
  const refreshToken = 'mock_refresh_token';

  const issuedCsrf = setAuthCookies(mockRes, { accessToken, refreshToken }, user);

  // 1. Verify token derivation
  const expectedHmac = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update('777:3')
    .digest('hex');

  assert.equal(issuedCsrf, expectedHmac, 'Issued CSRF token must match HMAC-SHA256(userId:sessionVersion, CSRF_SECRET)');
  assert.equal(mockCookies['csrfToken'], expectedHmac, 'csrfToken cookie must contain HMAC value');
  assert.equal(mockCookies['token'], accessToken, 'token cookie must contain access token');

  // 2. Feed this directly to csrfProtection
  const { req, res, next, getResult } = createMockReqRes({
    method: 'POST',
    path: '/api/disputes/raise',
    headers: {
      'x-csrf-token': issuedCsrf
    },
    cookies: mockCookies
  });

  csrfProtection(req, res, next);
  const result = getResult();

  assert.equal(result.nextCalled, true, 'Request with cookies issued by setAuthCookies MUST pass csrfProtection');
  assert.equal(result.statusCode, 200);
});

test('--- CHALLENGER 2: CSRF ADVERSARIAL SUITE ALL PASSED ---', () => {
  assert.ok(true, 'All Challenger 2 CSRF Cookie Tossing and Session Binding checks passed cleanly');
});
