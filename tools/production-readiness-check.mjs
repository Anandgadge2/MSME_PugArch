import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const envTs = read('backend/src/config/env.ts');
const corsTs = read('backend/src/config/cors.ts');
const gitignore = read('.gitignore');
const backendIndex = read('backend/index.ts');

assert.equal(envTs.includes('crypto.randomUUID'), false, 'JWT_SECRET must not fall back to a generated random value');
assert.match(envTs, /Missing critical environment variable\(s\):/, 'critical env fail-fast check must exist');
assert.match(envTs, /NODE_ENV === 'production'/, 'production-specific env validation must exist');
assert.match(envTs, /LOG_LEVEL must not be debug or trace in production/, 'debug logs must fail in production');
assert.match(envTs, /APISETU_ALLOW_INSECURE_TLS must be false in production/, 'insecure TLS must fail in production');

assert.match(corsTs, /isProduction \? \[\] : staticOrigins/, 'local development origins must not be allowed by default in production');
assert.match(corsTs, /!isProduction &&/, 'preview wildcard CORS must be disabled in production');

assert.match(gitignore, /^\.env$/m, '.env must be ignored');
assert.match(gitignore, /^\.env\.production\.local$/m, '.env.production.local must be ignored');

assert.match(backendIndex, /env\.NODE_ENV !== 'production'/, 'sample seed data must be gated outside production');
assert.match(backendIndex, /logger\.info\(\{ port \}, 'Server running'\)/, 'server startup must use structured logger');

const requiredDocs = [
  'PRODUCTION_HARDENING.md',
  'BACKUP_AND_RECOVERY.md',
  'OBSERVABILITY.md',
  'DEPLOYMENT_SECURITY_CHECKLIST.md',
  'INCIDENT_RESPONSE.md'
];

for (const doc of requiredDocs) {
  assert.ok(fs.existsSync(path.join(root, doc)), `${doc} is required for production readiness`);
}

console.log('Production readiness checks passed');
