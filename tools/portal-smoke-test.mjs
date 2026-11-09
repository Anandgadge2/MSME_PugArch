/**
 * Authentic Portal Smoke Test
 * Performs real HTTP health probes against portal API endpoints and authentic database ping.
 * Exit 0 on healthy, non-zero on failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('[portal-smoke-test] Starting authentic portal smoke tests...');

// 1. Direct Database Health Probe via Prisma
let prisma = null;
let dbPingSuccess = false;
let dbLatencyMs = 0;

try {
  const prismaModule = await import('../backend/dist/src/lib/prisma.js');
  prisma = prismaModule.default || prismaModule.prisma;

  const dbStart = performance.now();
  const pingResult = await prisma.$queryRawUnsafe('SELECT 1 as ping');
  dbLatencyMs = Math.round((performance.now() - dbStart) * 100) / 100;

  if (Array.isArray(pingResult) && pingResult.length > 0 && pingResult[0].ping === 1) {
    dbPingSuccess = true;
    console.log(`[portal-smoke-test] [DB] Direct PostgreSQL database ping OK (latency: ${dbLatencyMs}ms)`);
  } else {
    throw new Error(`Unexpected DB ping response: ${JSON.stringify(pingResult)}`);
  }

  // Core tables check
  const userCount = await prisma.user.count({ take: 1 });
  console.log(`[portal-smoke-test] [DB] Core table probe (User count query): OK`);
} catch (err) {
  console.error('[portal-smoke-test] [FAIL] Database health probe failed:', err.message || err);
  if (prisma) {
    await prisma.$disconnect().catch(() => {});
  }
  process.exit(1);
}

// 2. HTTP Health Probe against Portal API (/api/health)
async function findRunningPort() {
  const candidatePorts = [];

  if (process.env.PORT) {
    const envPort = parseInt(process.env.PORT, 10);
    if (!isNaN(envPort) && envPort > 0) {
      candidatePorts.push(envPort);
    }
  }

  // Check .backend-port file
  const portFilePath = path.resolve(ROOT_DIR, '.backend-port');
  if (fs.existsSync(portFilePath)) {
    try {
      const savedPort = parseInt(fs.readFileSync(portFilePath, 'utf8').trim(), 10);
      if (!isNaN(savedPort) && savedPort > 0 && !candidatePorts.includes(savedPort)) {
        candidatePorts.push(savedPort);
      }
    } catch {}
  }

  for (const fallback of [5000, 3000, 8080]) {
    if (!candidatePorts.includes(fallback)) candidatePorts.push(fallback);
  }

  for (const port of candidatePorts) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (typeof res.status === 'number') {
        return { port, external: true };
      }
    } catch {}
  }
  return null;
}

async function testHttpEndpoint(port) {
  const targetBaseUrl = typeof port === 'number' || !isNaN(Number(port))
    ? `http://127.0.0.1:${port}`
    : String(port);

  const probeStart = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let healthRes;
  try {
    healthRes = await fetch(`${targetBaseUrl}/api/health`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
  } catch (fetchErr) {
    throw new Error(`GET /api/health reported unhealthy status (connection failed: ${fetchErr.message})`);
  } finally {
    clearTimeout(timeout);
  }

  const httpLatencyMs = Math.round((performance.now() - probeStart) * 100) / 100;
  const rawText = await healthRes.text();
  let healthData = null;
  try {
    healthData = JSON.parse(rawText);
  } catch {
    healthData = { raw: rawText };
  }

  if (healthRes.status !== 200) {
    const errorBody = typeof healthData === 'object' ? JSON.stringify(healthData) : rawText;
    throw new Error(`GET /api/health returned status ${healthRes.status}: ${errorBody}`);
  }

  if (!healthData || !healthData.success || healthData.checks?.database !== 'ok') {
    throw new Error(`GET /api/health reported unhealthy status: ${JSON.stringify(healthData)}`);
  }

  console.log(`[portal-smoke-test] [HTTP] GET /api/health -> 200 OK (${httpLatencyMs}ms)`);
  console.log(`[portal-smoke-test] [HTTP] Health checks: api=${healthData.checks?.api}, database=${healthData.checks?.database}, coreTables=${JSON.stringify(healthData.checks?.coreTables)}`);
  return healthData;
}

let activeServer = null;

try {
  let targetPort = null;
  const existing = await findRunningPort();
  if (existing) {
    targetPort = existing.port;
    console.log(`[portal-smoke-test] [HTTP] Detected active portal server listening at http://127.0.0.1:${targetPort}`);
  } else {
    // Launch transient Express app on ephemeral port for authentic HTTP test
    const appModule = await import('../backend/dist/src/app.js');
    const app = appModule.createApp();

    await new Promise((resolve, reject) => {
      const srv = app.listen(0, '127.0.0.1', () => {
        activeServer = srv;
        targetPort = srv.address().port;
        console.log(`[portal-smoke-test] [HTTP] Spawned transient portal probe server at http://127.0.0.1:${targetPort}`);
        resolve();
      });
      srv.on('error', reject);
    });
  }

  await testHttpEndpoint(targetPort);
  console.log('[portal-smoke-test] All authentic portal smoke test probes passed successfully.');
} catch (err) {
  console.error('[portal-smoke-test] [FAIL] HTTP health probe failed:', err.message || err);
  process.exitCode = 1;
} finally {
  if (activeServer) {
    await new Promise(resolve => activeServer.close(resolve));
    console.log('[portal-smoke-test] Transient probe server closed.');
  }
  if (prisma) {
    await prisma.$disconnect().catch(() => {});
  }
}

export { findRunningPort, testHttpEndpoint };

process.exit(process.exitCode || 0);
