import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('auth.controller calculates dynamic remaining minutes and provides self-serve recovery instructions', () => {
  const source = read('src/modules/auth/auth.controller.ts');
  assert.match(source, /Math\.max\(1,\s*Math\.ceil\(msLeft\s*\/\s*60000\)\)/);
  assert.match(source, /Account is temporarily locked\. Please try again in \$\{minutesLeft\} minute/);
  assert.match(source, /reset your password using 'Forgot Password' to unlock immediately/);
  assert.match(source, /minutesRemaining:\s*minutesLeft/);
  assert.match(source, /isLocked:\s*true/);
});

test('auth.controller clears expired lockout slate preventing single-typo re-lockout', () => {
  const source = read('src/modules/auth/auth.controller.ts');
  assert.match(source, /isLockoutExpired\s*=\s*Boolean\(user\.lockedUntil\s*&&\s*user\.lockedUntil\s*<=\s*new Date\(\)\)/);
  assert.match(source, /effectiveFailedCount\s*=\s*isLockoutExpired\s*\?\s*0\s*:\s*\(user\.failedLoginCount\s*\|\|\s*0\)/);
  assert.match(source, /nextFailedCount\s*=\s*effectiveFailedCount\s*\+\s*1/);
});

test('auth.controller immediately returns HTTP 423 on reaching failed threshold instead of masking as 400', () => {
  const source = read('src/modules/auth/auth.controller.ts');
  assert.match(source, /if\s*\(shouldLock\)\s*\{[^]*?return res\.status\(423\)\.json\(\{/);
  assert.match(source, /Account is temporarily locked due to repeated failed login attempts/);
  assert.match(source, /minutesRemaining:\s*env\.FAILED_LOGIN_LOCK_MINUTES/);
});

test('auth.controller warns user on impending account lockout when attempts remaining is <= 2', () => {
  const source = read('src/modules/auth/auth.controller.ts');
  assert.match(source, /attemptsRemaining\s*=\s*Math\.max\(0,\s*env\.FAILED_LOGIN_LOCK_THRESHOLD\s*-\s*nextFailedCount\)/);
  assert.match(source, /attemptsRemaining\s*<=\s*2/);
  assert.match(source, /remaining before temporary account lockout/);
  assert.match(source, /attemptsRemaining,\s*isLocked:\s*false/);
});

test('authenticate middleware provides dynamic remaining minutes on locked accounts', () => {
  const source = read('src/middleware/authenticate.ts');
  assert.match(source, /cachedUser\.lockedUntil\s*&&\s*new Date\(cachedUser\.lockedUntil\)\s*>\s*new Date\(\)/);
  assert.match(source, /Account is temporarily locked for another \$\{minutesLeft\} minute/);
});

test('frontend Login.tsx provides dedicated inline lockout banner with 1-click recovery', () => {
  const source = read('../frontend/src/views/Login.tsx');
  assert.match(source, /res\.status\s*===\s*423\s*\|\|\s*data\.isLocked/);
  assert.match(source, /setIsAccountLocked\(true\)/);
  assert.match(source, /href=\{`\/forgot-password\?identifier=\$\{encodeURIComponent\(email\.trim\(\)\)\}`\}/);
  assert.match(source, /Reset Password to Unlock Now/);
});

test('frontend ForgotPassword.tsx auto-populates identifier from query params', () => {
  const source = read('../frontend/src/views/ForgotPassword.tsx');
  assert.match(source, /params\.get\('identifier'\)\s*\|\|\s*params\.get\('email'\)/);
  assert.match(source, /setIdentifier\(clean\)/);
});

test('no new lockout thresholds added to .env', () => {
  const envExample = read('.env.example');
  const envLines = envExample.split('\n').filter(l => l.includes('FAILED_LOGIN_LOCK'));
  // Exactly 2 original lines: FAILED_LOGIN_LOCK_THRESHOLD and FAILED_LOGIN_LOCK_MINUTES
  assert.equal(envLines.length, 2);
});
