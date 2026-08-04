import { existsSync, readFileSync } from 'node:fs';

console.log('[production-readiness-check] Validating production controls...');

const parseEnv = file => {
  if (!existsSync(file)) return {};
  return Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && line.includes('='))
      .map(line => {
        const index = line.indexOf('=');
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')];
      })
  );
};

const fileEnv = parseEnv('backend/.env');
const config = { ...fileEnv, ...process.env };
const failures = [];
const requiredExampleKeys = ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'FRONTEND_URL'];
const example = readFileSync('backend/.env.example', 'utf8');

for (const key of requiredExampleKeys) {
  if (!new RegExp(`^${key}=`, 'm').test(example)) failures.push(`backend/.env.example must document ${key}`);
}

const gcsSource = readFileSync('backend/src/config/gcs.ts', 'utf8');
if (/BEGIN (?:RSA )?PRIVATE KEY/.test(gcsSource)) failures.push('GCS source contains an embedded private key');

if (config.NODE_ENV === 'production' || process.env.PRODUCTION_CHECK_STRICT === '1') {
  for (const key of ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'FRONTEND_URL']) {
    if (!config[key]) failures.push(`${key} is required in production`);
  }
  for (const key of ['JWT_SECRET', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
    if (config[key] && config[key].length < 32) failures.push(`${key} must contain at least 32 characters`);
  }
  const jwtSecrets = [config.JWT_SECRET, config.JWT_ACCESS_SECRET, config.JWT_REFRESH_SECRET].filter(Boolean);
  if (new Set(jwtSecrets).size !== jwtSecrets.length) failures.push('JWT signing secrets must be distinct');
  if (config.FRONTEND_URL && !config.FRONTEND_URL.startsWith('https://')) failures.push('FRONTEND_URL must use HTTPS');
  if (config.CORS_ALLOWED_ORIGINS?.split(',').some(origin => origin.trim() === '*')) failures.push('Wildcard CORS origins are forbidden');
  if (/^(true|1|yes)$/i.test(config.APISETU_ALLOW_INSECURE_TLS || '')) failures.push('Insecure API Setu TLS is forbidden');
  if (config.PAYMENT_PROVIDER === 'bandhan' && !config.BANDHAN_WEBHOOK_SECRET) failures.push('BANDHAN_WEBHOOK_SECRET is required');
}

if (failures.length) {
  failures.forEach(failure => console.error(`[production-readiness-check] FAIL: ${failure}`));
  process.exit(1);
}

console.log(`[production-readiness-check] Passed${config.NODE_ENV === 'production' ? ' strict production' : ''} configuration checks.`);
