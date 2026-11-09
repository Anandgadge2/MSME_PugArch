import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { evaluateFileAccess, PUBLIC_STORAGE_PREFIX } from './helpers/e2e-test-harness.mjs';

// ============================================================================
// ADVERSARIAL CHALLENGER 1: MILESTONE 2 ROUND 2 GATE REMEDIATION TEST SUITE
// ============================================================================

const BASE_DIR = '/app/uploads';

test('--- CHALLENGER 1: ADVERSARIAL VERIFICATION START ---', () => {
  assert.ok(true, 'Initiating Challenger 1 Milestone 2 Round 2 Verification');
});

// ============================================================================
// 1. NESTED TRAVERSAL SEQUENCES (....//, ....\/, ..././, etc.)
// ============================================================================

test('CHALLENGER 1 - NESTED TRAVERSAL: Blocks nested dot-slash sequences unauthenticated and authenticated', () => {
  const nestedVectors = [
    '....//etc/passwd',
    '....//....//etc/passwd',
    'categories/photos/....//invoices/secret.pdf',
    'categories/photos/....//....//invoices/secret.pdf',
    '....\\/etc/passwd',
    'categories/photos/....\\/invoices/secret.pdf',
    '..././etc/passwd',
    'categories/photos/..././invoices/secret.pdf',
    '.../invoices/secret.pdf',
    'categories/photos/.../invoices/secret.pdf',
    '.....///secret.pdf',
    'categories/photos/.....///secret.pdf'
  ];

  for (const vector of nestedVectors) {
    // Unauthenticated MUST NOT be allowed
    const unauth = evaluateFileAccess(vector, BASE_DIR, false);
    assert.equal(unauth.allowed, false, `Unauthenticated payload "${vector}" must NOT be allowed`);
    assert.ok(
      unauth.status === 401 || unauth.status === 403,
      `Unauthenticated payload "${vector}" must yield 401 or 403, got ${unauth.status}`
    );

    // Authenticated MUST NOT traverse outside storage or be allowed if it contains ..
    const auth = evaluateFileAccess(vector, BASE_DIR, true);
    assert.equal(auth.allowed, false, `Authenticated traversal payload "${vector}" must NOT be allowed`);
    assert.equal(auth.status, 403, `Authenticated traversal payload "${vector}" must be 403`);
    assert.equal(auth.code, 'PATH_TRAVERSAL_DETECTED');
  }
});

// ============================================================================
// 2. URL-ENCODED & MULTI-ENCODED TRAVERSAL SEQUENCES (%2e%2e%2f, %252e%252e%252f)
// ============================================================================

test('CHALLENGER 1 - ENCODED TRAVERSAL: Blocks standard and double-encoded traversal sequences', () => {
  const encodedVectors = [
    // Standard URL-encoded
    '%2e%2e%2fetc%2fpasswd',
    'categories/photos/%2e%2e/%2e%2e/invoices/secret.pdf',
    'categories/photos/%2e%2e%2finvoices%2fsecret.pdf',
    '..%2f..%2finvoices/secret.pdf',
    'categories/photos/..%2f..%2finvoices/secret.pdf',
    // Double URL-encoded
    '%252e%252e%252fetc%252fpasswd',
    'categories/photos/%252e%252e%252f%252e%252e%252finvoices/secret.pdf',
    'categories/photos/%252e%252e%252finvoices/secret.pdf',
    // Encoded backslashes
    '%2e%2e%5cetc%5cpasswd',
    'categories/photos/%2e%2e%5c%2e%2e%5cinvoices%5csecret.pdf',
    '%252e%252e%255cetc%255cpasswd',
    '..%5c..%5cinvoices/secret.pdf',
    'categories/photos/..%5c..%5cinvoices/secret.pdf'
  ];

  for (const vector of encodedVectors) {
    const unauth = evaluateFileAccess(vector, BASE_DIR, false);
    assert.equal(unauth.allowed, false, `Unauthenticated encoded vector "${vector}" must NOT be allowed`);
    assert.ok(
      unauth.status === 401 || unauth.status === 403,
      `Unauthenticated encoded vector "${vector}" must return 401 or 403`
    );

    const auth = evaluateFileAccess(vector, BASE_DIR, true);
    assert.equal(auth.allowed, false, `Authenticated encoded vector "${vector}" must NOT be allowed`);
    assert.equal(auth.status, 403, `Authenticated encoded vector "${vector}" must return 403`);
    assert.equal(auth.code, 'PATH_TRAVERSAL_DETECTED');
  }
});

// ============================================================================
// 3. BACKSLASHES AND MIXED SLASHES
// ============================================================================

test('CHALLENGER 1 - BACKSLASH & MIXED SLASH: Normalizes slashes and blocks directory traversal', () => {
  const backslashVectors = [
    'categories\\photos\\..\\..\\invoices\\secret.pdf',
    'categories/photos\\..\\..\\invoices\\secret.pdf',
    'categories/photos/..\\..\\invoices/secret.pdf',
    'categories\\photos/../../invoices/secret.pdf',
    '..\\..\\invoices\\secret.pdf',
    '..\\../invoices/secret.pdf',
    '../..\\invoices/secret.pdf',
    '..\\..\\..\\..\\Windows\\win.ini',
    'categories\\photos\\..\\..\\..\\Windows\\win.ini'
  ];

  for (const vector of backslashVectors) {
    const unauth = evaluateFileAccess(vector, BASE_DIR, false);
    assert.equal(unauth.allowed, false, `Unauthenticated backslash vector "${vector}" must NOT be allowed`);
    assert.ok(
      unauth.status === 401 || unauth.status === 403,
      `Unauthenticated backslash vector "${vector}" must return 401 or 403`
    );

    const auth = evaluateFileAccess(vector, BASE_DIR, true);
    assert.equal(auth.allowed, false, `Authenticated backslash vector "${vector}" must NOT be allowed`);
    assert.equal(auth.status, 403, `Authenticated backslash vector "${vector}" must return 403`);
    assert.equal(auth.code, 'PATH_TRAVERSAL_DETECTED');
  }

  // Legitimate backslash path within public whitelist resolves safely
  const legitBackslash = 'categories\\photos\\product-banner.png';
  const unauthLegit = evaluateFileAccess(legitBackslash, BASE_DIR, false);
  assert.equal(unauthLegit.allowed, true, 'Legitimate backslash path must be permitted unauthenticated');
  assert.equal(unauthLegit.status, 200);
  assert.equal(unauthLegit.isPublic, true);
  assert.ok(unauthLegit.resolved.includes('categories'), 'Must resolve inside categories directory');
});

// ============================================================================
// 4. NULL BYTES & CONTROL CHARACTERS
// ============================================================================

test('CHALLENGER 1 - NULL BYTES: Rejects null byte injection and control characters', () => {
  const nullVectors = [
    'categories/photos/legit.png\0.php',
    'categories/photos/\0/../../secret.pdf',
    '\0',
    'categories/photos/banner.png\x00',
    'categories/photos/banner.png\x08',
    'categories/photos/banner.png\x1b',
    'categories/photos/banner.png\r\n'
  ];

  for (const vector of nullVectors) {
    const unauth = evaluateFileAccess(vector, BASE_DIR, false);
    assert.equal(unauth.allowed, false, `Null byte vector ${JSON.stringify(vector)} must be rejected`);
    assert.equal(unauth.status, 403);
    assert.equal(unauth.code, 'PATH_TRAVERSAL_DETECTED');

    const auth = evaluateFileAccess(vector, BASE_DIR, true);
    assert.equal(auth.allowed, false, `Null byte vector ${JSON.stringify(vector)} must be rejected`);
    assert.equal(auth.status, 403);
    assert.equal(auth.code, 'PATH_TRAVERSAL_DETECTED');
  }
});

// ============================================================================
// 5. PREFIX LOOKALIKES & BOUNDARY TRUNCATION
// ============================================================================

test('CHALLENGER 1 - PREFIX LOOKALIKES: Strictly enforces directory delimiter after public prefix', () => {
  const lookalikeVectors = [
    'categories/photos_evil/secret.pdf',
    'categories/photos-evil/secret.pdf',
    'categories/photos.evil/secret.pdf',
    'categories/photosfake/secret.pdf',
    'categories/photos', // exact match without trailing slash
    'categories',
    'public_evil/secret.pdf',
    'public-evil/secret.pdf',
    'publicevil/secret.pdf',
    'public.evil/secret.pdf',
    'public' // exact match without trailing slash
  ];

  for (const vector of lookalikeVectors) {
    // Unauthenticated caller MUST NOT gain public access to lookalike prefixes
    const unauth = evaluateFileAccess(vector, BASE_DIR, false);
    assert.equal(unauth.allowed, false, `Lookalike "${vector}" must NOT be granted public access`);
    assert.equal(unauth.status, 401, `Lookalike "${vector}" must require authentication`);
    assert.equal(unauth.code, 'AUTHENTICATION_REQUIRED');

    // Authenticated caller does not get isPublic = true
    const auth = evaluateFileAccess(vector, BASE_DIR, true);
    if (auth.allowed) {
      assert.equal(auth.isPublic, false, `Lookalike "${vector}" must not have isPublic=true`);
      // Must remain strictly inside base directory
      const relative = path.relative(BASE_DIR, auth.resolved);
      assert.equal(relative.startsWith('..'), false, `Resolved path for "${vector}" must be inside baseDir`);
    }
  }
});

// ============================================================================
// 6. ABSOLUTE PATHS & STORAGE ROOT CONTAINMENT
// ============================================================================

test('CHALLENGER 1 - ABSOLUTE PATHS: Rejects absolute paths and cross-drive escapes', () => {
  const absoluteVectors = [
    '/etc/passwd',
    '\\etc\\passwd',
    '/var/log/syslog',
    'C:\\Windows\\win.ini',
    'C:/Windows/win.ini',
    'D:\\secret\\credentials.env',
    '\\\\server\\share\\file',
    '//server/share/file',
    '/app/uploads/../etc/passwd',
    '/app/uploads/invoices/secret.pdf'
  ];

  for (const vector of absoluteVectors) {
    const unauth = evaluateFileAccess(vector, BASE_DIR, false);
    assert.equal(unauth.allowed, false, `Absolute path "${vector}" must NOT be allowed unauthenticated`);
    assert.ok(
      unauth.status === 401 || unauth.status === 403,
      `Absolute path "${vector}" must return 401 or 403`
    );

    const auth = evaluateFileAccess(vector, BASE_DIR, true);
    assert.equal(auth.allowed, false, `Absolute path "${vector}" must NOT be allowed authenticated`);
    assert.equal(auth.status, 403, `Absolute path "${vector}" must return 403`);
    assert.equal(auth.code, 'PATH_TRAVERSAL_DETECTED');
  }
});

// ============================================================================
// 7. LEGITIMATE ACCESS FUNCTIONALITY PRESERVATION
// ============================================================================

test('CHALLENGER 1 - LEGITIMATE ACCESS: Allows legitimate public files and authenticated private files', () => {
  // Public files without authentication
  const publicSamples = [
    'categories/photos/electronics.jpg',
    'categories/photos/sub-category/banner.png',
    'categories/photos/item-123_thumb.webp',
    'public/branding/msme-logo.svg',
    'public/favicon.ico'
  ];

  for (const pub of publicSamples) {
    const unauth = evaluateFileAccess(pub, BASE_DIR, false);
    assert.equal(unauth.allowed, true, `Legitimate public file "${pub}" must be accessible unauthenticated`);
    assert.equal(unauth.status, 200);
    assert.equal(unauth.isPublic, true);
  }

  // Private files with authentication
  const privateSamples = [
    'invoices/tax-invoice-101.pdf',
    'contracts/rate-contract-2026.pdf',
    'kyc/pan-card-scan-99.png',
    'proofs/bank-mandate-44.pdf'
  ];

  for (const priv of privateSamples) {
    // Unauthenticated: rejected with 401
    const unauth = evaluateFileAccess(priv, BASE_DIR, false);
    assert.equal(unauth.allowed, false, `Private file "${priv}" must be rejected unauthenticated`);
    assert.equal(unauth.status, 401);
    assert.equal(unauth.code, 'AUTHENTICATION_REQUIRED');

    // Authenticated: allowed with 200 and isPublic = false
    const auth = evaluateFileAccess(priv, BASE_DIR, true);
    assert.equal(auth.allowed, true, `Private file "${priv}" must be accessible when authenticated`);
    assert.equal(auth.status, 200);
    assert.equal(auth.isPublic, false);
  }
});

// ============================================================================
// 8. CODE INSPECTION & STATIC AUDIT OF phase4.routes.ts DEFENSES
// ============================================================================

test('CHALLENGER 1 - STATIC AUDIT: phase4.routes.ts contains all required defensive layers', () => {
  const source = readFileSync(new URL('../src/routes/phase4.routes.ts', import.meta.url), 'utf8');

  // Verify router endpoint existence
  assert.match(source, /router\.get\('\/files\/raw\/:key\(\*\)',\s*optionalAuthenticate/);

  // 1. Raw key null byte and control character check
  assert.match(source, /rawKey\.includes\('\\0'\)\s*\|\|\s*\/\[\\x00-\\x1f\]\/\.test\(rawKey\)/);

  // 2. Double-encoding detection
  assert.match(source, /decodeURIComponent\(decodedKey\)\s*!==\s*decodedKey/);

  // 3. Decoded key null byte check
  assert.match(source, /decodedKey\.includes\('\\0'\)\s*\|\|\s*\/\[\\x00-\\x1f\]\/\.test\(decodedKey\)/);

  // 4. Posix normalization and slash sanitization
  assert.match(source, /path\.posix\.normalize\(rawKey\.replace\(\/\\\\\/g,\s*'\/'\)\)/);
  assert.match(source, /path\.posix\.normalize\(decodedKey\.replace\(\/\\\\\/g,\s*'\/'\)\)\.replace\(\/\^\(\\\/\|\\.\)\+\/,\s*''\)/);

  // 5. Immediate rejection of .. traversal tokens
  assert.match(source, /rawKey\.includes\('\.\.'\)\s*\|\|\s*decodedKey\.includes\('\.\.'\)\s*\|\|\s*normalizedRawKey\.includes\('\.\.'\)\s*\|\|\s*normalizedKey\.includes\('\.\.'\)/);

  // 6. Absolute path rejection
  assert.match(source, /path\.isAbsolute\(decodedKey\)\s*\|\|\s*decodedKey\.startsWith\('\/'\)/);

  // 7. Public storage whitelist requiring normalized key to start with prefix and forbid ..
  assert.match(source, /decodedKey\.startsWith\('categories\/photos\/'\)\s*\|\|\s*decodedKey\.startsWith\('public\/'\)/);
  assert.match(source, /!decodedKey\.includes\('\.\.'\)\s*&&\s*!rawKey\.includes\('\.\.'\)/);

  // 8. Path bounds verification via path.relative
  assert.match(source, /relative\.startsWith\('\.\.'\)\s*\|\|\s*path\.isAbsolute\(relative\)\s*\|\|\s*path\.isAbsolute\(decodedKey\)/);
});

// ============================================================================
// 9. DYNAMIC COMBINATORIAL FUZZER (1,000+ ADVERSARIAL MUTATIONS)
// ============================================================================

test('CHALLENGER 1 - FUZZER: 1,000+ randomized adversarial payloads cannot bypass security boundaries', () => {
  const prefixes = [
    'categories/photos/',
    'public/',
    'categories/photos_evil/',
    'public_evil/',
    'categories/photos.',
    'public.',
    'categories/photosfake/',
    '',
    '/',
    '\\',
    'C:/',
    'C:\\',
    '//',
    '\\\\',
    'uploads/',
    'invoices/'
  ];

  const traversalTokens = [
    '../',
    '..\\',
    '....//',
    '....\\/',
    '..././',
    '....//....//',
    '%2e%2e%2f',
    '%2e%2e%5c',
    '%252e%252e%252f',
    '%252e%252e%255c',
    '..%2f',
    '..%5c',
    './../',
    '.././',
    '..\\../',
    '../..\\',
    '..',
    '....',
    '/'
  ];

  const targets = [
    'invoices/secret-tax-invoice.pdf',
    'etc/passwd',
    'Windows/win.ini',
    'credentials.env',
    'proofs/private-payment.pdf',
    'certs/private.key'
  ];

  let testCount = 0;

  for (const prefix of prefixes) {
    for (const token of traversalTokens) {
      for (const target of targets) {
        testCount++;
        const payload = `${prefix}${token}${target}`;

        // 1. Unauthenticated test:
        const unauth = evaluateFileAccess(payload, BASE_DIR, false);
        if (unauth.allowed) {
          // If allowed, it MUST be public AND resolved path MUST be strictly inside categories/photos/ or public/
          assert.equal(unauth.isPublic, true, `Payload "${payload}" allowed unauthenticated without isPublic`);
          const rel = path.relative(BASE_DIR, unauth.resolved).replace(/\\/g, '/');
          const isUnderPublic = rel.startsWith('categories/photos/') || rel.startsWith('public/');
          assert.ok(
            isUnderPublic,
            `Unauthenticated payload "${payload}" resolved outside public directories: ${unauth.resolved}`
          );

          // It must NEVER access the root private directories
          assert.ok(
            !rel.startsWith('invoices/') &&
            !rel.startsWith('proofs/') &&
            !rel.startsWith('certs/') &&
            !rel.startsWith('etc/') &&
            !rel.startsWith('Windows/'),
            `Unauthenticated payload "${payload}" accessed root private directory: ${rel}`
          );
        }

        // 2. Authenticated test:
        const auth = evaluateFileAccess(payload, BASE_DIR, true);
        if (auth.allowed) {
          // Must NEVER escape BASE_DIR
          const rel = path.relative(BASE_DIR, auth.resolved);
          assert.equal(
            rel.startsWith('..'),
            false,
            `Authenticated payload "${payload}" escaped storage root: ${auth.resolved}`
          );
          assert.equal(
            path.isAbsolute(rel),
            false,
            `Authenticated payload "${payload}" returned absolute relative path: ${auth.resolved}`
          );
        }
      }
    }
  }

  assert.ok(testCount >= 1000, `Expected at least 1,000 fuzzer combinations, tested ${testCount}`);
});


