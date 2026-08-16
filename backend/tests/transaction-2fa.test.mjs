import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('1. Transaction 2FA router is mounted under /2fa/transaction in routes index', () => {
  const routesIndex = read('src/routes/index.ts');
  assert.match(routesIndex, /import transaction2faRoutes from '\.\.\/modules\/auth\/transaction-2fa\.routes\.js'/);
  assert.match(routesIndex, /router\.use\('\/2fa\/transaction',\s*transaction2faRoutes\)/);
});

test('2. Transaction 2FA endpoints enforce authentication and validate schemas', () => {
  const source = read('src/modules/auth/transaction-2fa.routes.ts');
  assert.match(source, /router\.post\('\/send-otp',\s*authenticate/);
  assert.match(source, /router\.post\('\/verify-otp',\s*authenticate/);
  assert.match(source, /sendOtpSchema/);
  assert.match(source, /verifyOtpSchema/);
  assert.match(source, /otp:\s*z\.string\(\)\.trim\(\)\.length\(6/);
});

test('3. Transaction 2FA service dispatches OTP with transaction context and masks destination', () => {
  const source = read('src/services/transaction-2fa.service.ts');
  assert.match(source, /export const transaction2faService\s*=/);
  assert.match(source, /async sendTransactionOtp/);
  assert.match(source, /async verifyTransactionOtp/);
  assert.match(source, /maskEmail/);
  assert.match(source, /maskMobile/);
  assert.match(source, /generateOtp\(\)/);
  assert.match(source, /storeOtp\('transaction_2fa'/);
});

test('4. Transaction 2FA service consumes OTP upon successful verification', () => {
  const source = read('src/services/transaction-2fa.service.ts');
  assert.match(source, /consumeOtp\('transaction_2fa'/);
  assert.match(source, /auditLog\(/);
  assert.match(source, /transaction\.2fa\.verified/);
});

test('5. Delivery release payment schema accommodates 2FA verification attributes', () => {
  const validation = read('src/modules/delivery/delivery.validation.ts');
  assert.match(validation, /export const paymentReleaseBody\s*=/);
  assert.match(validation, /twoFactorVerified:\s*z\.boolean\(\)\.optional\(\)/);
  assert.match(validation, /otp:\s*z\.string\(\)\.trim\(\)\.length\(6\)\.optional\(\)/);
});

test('6. OtpPurpose enum in otp.service includes transaction_2fa', () => {
  const source = read('src/services/otp.service.ts');
  assert.match(source, /'transaction_2fa'/);
});
