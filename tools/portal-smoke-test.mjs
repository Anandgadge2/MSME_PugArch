const baseUrl = (process.env.PORTAL_API_URL || process.argv[2] || 'http://localhost:5001').replace(/\/$/, '');
const token = process.env.PORTAL_AUTH_TOKEN || '';

const checks = [
  { name: 'API test', path: '/api/test', auth: false },
  { name: 'Health', path: '/api/health', auth: false },
  { name: 'Public tenders', path: '/api/tenders/public', auth: false },
  { name: 'Current user', path: '/api/auth/me', auth: true },
  { name: 'Tenders', path: '/api/tenders', auth: true },
  { name: 'Payments', path: '/api/payments', auth: true },
  { name: 'Escrow', path: '/api/escrow', auth: true },
  { name: 'Admin onboarding', path: '/api/admin/onboarding', auth: true },
  { name: 'Admin reports summary', path: '/api/admin/reports/summary', auth: true },
  { name: 'Admin users', path: '/api/admin/users', auth: true }
];

const readBody = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

let failures = 0;

for (const check of checks) {
  if (check.auth && !token) {
    console.log(`SKIP ${check.name} ${check.path} - set PORTAL_AUTH_TOKEN to check authenticated pages`);
    continue;
  }

  const headers = check.auth ? { Authorization: `Bearer ${token}` } : {};
  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl}${check.path}`, { headers });
    const body = await readBody(response);
    const duration = Date.now() - started;
    const ok = check.auth ? response.status < 500 : response.ok;
    if (!ok) failures += 1;

    const message = typeof body === 'object' && body ? body.message || body.code || '' : String(body).slice(0, 80);
    console.log(`${ok ? 'OK' : 'FAIL'} ${response.status} ${check.name} ${check.path} ${duration}ms ${message}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL NET ${check.name} ${check.path} ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) process.exit(1);
