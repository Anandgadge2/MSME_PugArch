import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

console.log('[security-static-checks] Running static security checks...');

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean);
const failures = [];

for (const forbidden of ['backend/.env', 'frontend/.env', '.env']) {
  if (tracked.includes(forbidden)) failures.push(`${forbidden} must not be tracked`);
}

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/=\r\n]{100,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bsk-[A-Za-z0-9_-]{32,}\b/
];

for (const file of tracked.filter(file => /\.(?:ts|tsx|js|mjs|json|ya?ml|md)$/i.test(file))) {
  const source = readFileSync(file, 'utf8');
  if (secretPatterns.some(pattern => pattern.test(source))) failures.push(`${file} contains a likely embedded credential`);
}

const authSource = readFileSync('backend/src/middleware/authenticate.ts', 'utf8');
if (!authSource.includes('getNotificationStreamToken')) failures.push('query bearer tokens are not restricted to SSE');

const paymentRoutes = readFileSync('backend/src/modules/payments/payment.routes.ts', 'utf8');
if (!paymentRoutes.includes("env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test'")) failures.push('payment simulation lacks an environment guard');

if (failures.length) {
  failures.forEach(failure => console.error(`[security-static-checks] FAIL: ${failure}`));
  process.exit(1);
}

console.log(`[security-static-checks] Passed ${tracked.length} tracked-file and security-invariant checks.`);
