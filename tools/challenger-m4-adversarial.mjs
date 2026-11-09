/**
 * Milestone 4 Empirical Adversarial Verification Suite
 * Authored by: Challenger 1 (teamwork_challenger)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');

// ============================================================================
// SUITE 1: CI Test Script Verification & Non-Silencing
// ============================================================================

test('ADV-CI-01: CI script in backend/package.json exists and targets all .test.mjs files', () => {
  const pkgJson = JSON.parse(fs.readFileSync(path.join(BACKEND_DIR, 'package.json'), 'utf8'));
  assert.ok(pkgJson.scripts, 'scripts object must exist in backend/package.json');
  assert.ok(pkgJson.scripts.test, 'test script must exist in backend/package.json');
  assert.equal(
    pkgJson.scripts.test,
    'npx tsx --test tests/*.test.mjs',
    'test script must be "npx tsx --test tests/*.test.mjs"'
  );
  
  // Verify that there are no suppressing flags like || true, 2>/dev/null, --bail=false, etc.
  assert.doesNotMatch(pkgJson.scripts.test, /\|\|\s*true/, 'test script must not silence errors with || true');
  assert.doesNotMatch(pkgJson.scripts.test, /2>\s*\/dev\/null/, 'test script must not redirect stderr');
});

test('ADV-CI-02: CI test script strictly propagates non-zero exit code on test failure', () => {
  const tempTestPath = path.join(BACKEND_DIR, 'tests', '__adversarial_failing_temp.test.mjs');
  try {
    fs.writeFileSync(
      tempTestPath,
      `import test from 'node:test';\nimport assert from 'node:assert';\ntest('intentional failure', () => { assert.equal(1, 2, 'intentional assertion failure'); });\n`,
      'utf8'
    );

    const result = spawnSync('npx', ['tsx', '--test', 'tests/__adversarial_failing_temp.test.mjs'], {
      cwd: BACKEND_DIR,
      encoding: 'utf8',
      shell: true
    });

    assert.notEqual(result.status, 0, 'Spawned failing test must exit with non-zero exit code');
    assert.match(
      result.stdout + result.stderr,
      /intentional assertion failure/,
      'Output must contain failure message'
    );
  } finally {
    if (fs.existsSync(tempTestPath)) {
      fs.unlinkSync(tempTestPath);
    }
  }
});

test('ADV-CI-03: All 40 backend test files match the glob pattern and are eligible for execution', () => {
  const testsDir = path.join(BACKEND_DIR, 'tests');
  const allEntries = fs.readdirSync(testsDir);
  const testFiles = allEntries.filter(f => f.endsWith('.test.mjs'));
  assert.equal(testFiles.length, 40, 'backend/tests must have exactly 40 .test.mjs suites');
  
  for (const f of testFiles) {
    assert.match(f, /\.test\.mjs$/, `Test file ${f} must match glob pattern tests/*.test.mjs`);
  }
});

// ============================================================================
// SUITE 2: Stress-Testing Fixed Test Suites & Robustness
// ============================================================================

test('ADV-FIX-01: catalogue-import-critic resolves duplicate SKUs for test seller idempotently', () => {
  const code = fs.readFileSync(path.join(BACKEND_DIR, 'tests', 'catalogue-import-critic.test.mjs'), 'utf8');
  assert.match(
    code,
    /deleteMany\(\s*\{\s*where:\s*\{\s*sellerId:\s*actor\.id,\s*sku:\s*\{\s*in:\s*\['SAF-HLM-001',\s*'FAS-HEX-M12'\]/s,
    'Must clean up conflicting SKUs for actor before previewing template'
  );
});

test('ADV-FIX-02: contract-period-rfq-guard gates serviceDetails strictly to SERVICES procurement category', () => {
  const wizardCode = fs.readFileSync(
    path.join(FRONTEND_DIR, 'src', 'features', 'procurementWizard', 'pages', 'CreateProcurementPage.tsx'),
    'utf8'
  );

  // Check payloadJson logic
  assert.match(
    wizardCode,
    /serviceDetails:\s*draft\.basics\.procurementCategory\s*===\s*'SERVICES'\s*\?/,
    'payloadJson must strictly gate serviceDetails to SERVICES'
  );

  // Check INITIAL_WIZARD_DATA has clean defaults (zero dummy data)
  assert.match(wizardCode, /duration:\s*''/, 'duration default must be empty');
  assert.match(wizardCode, /slaResponseTime:\s*''/, 'slaResponseTime default must be empty');
  assert.match(wizardCode, /milestones:\s*\[\]/, 'milestones default must be empty array');
});

test('ADV-FIX-03: direct-reverse-auction-option-a handles Windows CRLF line endings safely', () => {
  const testCode = fs.readFileSync(path.join(BACKEND_DIR, 'tests', 'direct-reverse-auction-option-a.test.mjs'), 'utf8');
  assert.match(
    testCode,
    /\.replace\(\/\\r\\n\/g,\s*'\\n'\)/,
    'Must normalize CRLF to LF to prevent Windows test failures'
  );
});

test('ADV-FIX-04: reverse-auction-rank-visibility-privacy has complete VPAT accessibility attributes', () => {
  const wizardCode = fs.readFileSync(
    path.join(FRONTEND_DIR, 'src', 'features', 'procurementWizard', 'pages', 'CreateProcurementPage.tsx'),
    'utf8'
  );

  assert.match(wizardCode, /id="auction-rank-visibility"/, 'Must have accessible id');
  assert.match(wizardCode, /name="rankVisibility"/, 'Must have explicit name="rankVisibility"');
  assert.match(wizardCode, /aria-required="true"/, 'Must have aria-required="true"');
  assert.match(wizardCode, /aria-label="Supplier Rank & Competitor Visibility"/, 'Must have descriptive aria-label');
});

test('ADV-FIX-05: po-branding-payment-proof verifies secure regex matching for file assets & tokens', () => {
  const testCode = fs.readFileSync(path.join(BACKEND_DIR, 'tests', 'po-branding-payment-proof.test.mjs'), 'utf8');
  assert.ok(testCode.includes('receiptFileUrl:'), 'Must match asset URL check');
  assert.match(testCode, /proof\(\?:\?\\\.|\\\.\)receiptFileId/, 'Must support optional chaining for receiptFileId');
  assert.match(testCode, /\(\?:rawToken\|token\)/, 'Must support rawToken or token variable name');
});

// ============================================================================
// SUITE 3: Smoke Test Failure Handling (Empirical Probing)
// ============================================================================

test('ADV-SMOKE-01: portal-smoke-test.mjs exits with code 1 when DATABASE_URL is invalid/unreachable', () => {
  const result = spawnSync('node', ['tools/portal-smoke-test.mjs'], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL: 'postgresql://invalid_user:invalid_pass@127.0.0.1:59999/nonexistent_db'
    },
    shell: true
  });

  assert.notEqual(result.status, 0, 'Smoke test must exit non-zero when database cannot be reached');
  assert.match(
    result.stdout + result.stderr,
    /Database health probe failed/i,
    'Smoke test must report Database health probe failed'
  );
});

test('ADV-SMOKE-02: portal-smoke-test.mjs exits with code 1 when running against an unhealthy HTTP server (HTTP 500)', async () => {
  // Spawn a mock HTTP server on a random port that returns 500 Internal Server Error
  const server = http.createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Database connection failed' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const badPort = server.address().port;

  try {
    const result = spawnSync('node', ['tools/portal-smoke-test.mjs'], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      env: {
        ...process.env,
        PORT: String(badPort)
      },
      shell: true
    });

    assert.notEqual(result.status, 0, 'Smoke test must fail with non-zero exit code when server returns 500');
    assert.match(
      result.stdout + result.stderr,
      /HTTP health probe failed|returned status 500/i,
      'Smoke test must report HTTP health probe failure on status 500'
    );
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('ADV-SMOKE-03: portal-smoke-test.mjs exits with code 1 when health returns 200 but success: false', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, checks: { api: 'ok', database: 'error' } }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    const result = spawnSync('node', ['tools/portal-smoke-test.mjs'], {
      cwd: ROOT_DIR,
      encoding: 'utf8',
      env: {
        ...process.env,
        PORT: String(port)
      },
      shell: true
    });

    assert.notEqual(result.status, 0, 'Smoke test must fail when health endpoint reports success: false');
    assert.match(
      result.stdout + result.stderr,
      /reported unhealthy status/i,
      'Must report unhealthy status'
    );
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

// ============================================================================
// SUITE 4: Zero-Mock Dashboard Analytics Stress-Testing
// ============================================================================

test('ADV-ZERO-01: Zero synthetic multiplier 0.082 or 8.2% remains in dashboard analytics service', () => {
  const analyticsCode = fs.readFileSync(
    path.join(BACKEND_DIR, 'src', 'services', 'dashboard-analytics.service.ts'),
    'utf8'
  );

  assert.doesNotMatch(analyticsCode, /0\.082/, 'No 0.082 multiplier must exist in dashboard-analytics.service.ts');
  assert.doesNotMatch(analyticsCode, /8\.2/, 'No 8.2 percentage must exist in dashboard-analytics.service.ts');
  assert.doesNotMatch(analyticsCode, /\* 0\.08/, 'No fake savings formula must exist');
});

test('ADV-ZERO-02: Authentic savings logic returns 0 and 0% for empty order list', () => {
  // Pure implementation of the service calculation logic
  const calculateSavings = (periodOrders) => {
    let authenticSavings = 0;
    let totalBaselineBudget = 0;
    let periodTotalSpend = 0;

    for (const po of periodOrders) {
      const amount = Number(po.amount || po.totalValue || 0);
      periodTotalSpend += amount;

      const poMeta = (po.metadata && typeof po.metadata === 'object') ? po.metadata : {};
      const tenderBudget = Number(po.tender?.budget || 0);
      const metaBudget = Number(poMeta.estimatedBudget || poMeta.budget || poMeta.estimatedCost || poMeta.baselineAmount || 0);
      const originalAmount = Number(poMeta.originalAmount || poMeta.originalPrice || 0);

      const baseline = tenderBudget > 0 ? tenderBudget : (metaBudget > 0 ? metaBudget : (originalAmount > amount ? originalAmount : 0));
      if (baseline > amount && amount > 0) {
        authenticSavings += (baseline - amount);
        totalBaselineBudget += baseline;
      }
    }

    const estimatedSavings = Math.round(authenticSavings);
    const savingsPercent = totalBaselineBudget > 0
      ? Number(((authenticSavings / totalBaselineBudget) * 100).toFixed(1))
      : (periodTotalSpend > 0 && authenticSavings > 0
          ? Number(((authenticSavings / (periodTotalSpend + authenticSavings)) * 100).toFixed(1))
          : 0);

    return { estimatedSavings, savingsPercent, periodTotalSpend };
  };

  // Case 1: Empty orders
  const res1 = calculateSavings([]);
  assert.equal(res1.estimatedSavings, 0, 'Zero orders must result in 0 estimated savings');
  assert.equal(res1.savingsPercent, 0, 'Zero orders must result in 0% savings');
  assert.equal(res1.periodTotalSpend, 0, 'Zero orders must result in ₹0 spend');

  // Case 2: Orders with no tender budget or baseline metadata
  const res2 = calculateSavings([
    { amount: 10000, tender: null, metadata: {} },
    { totalValue: 5000, tender: { budget: 0 }, metadata: null }
  ]);
  assert.equal(res2.estimatedSavings, 0, 'Orders without baseline budget must result in 0 estimated savings');
  assert.equal(res2.savingsPercent, 0, 'Orders without baseline budget must result in 0% savings');
  assert.equal(res2.periodTotalSpend, 15000, 'Total spend must accurately equal ₹15,000');

  // Case 3: Orders with cost overrun (actual spend exceeds baseline)
  const res3 = calculateSavings([
    { amount: 12000, tender: { budget: 10000 }, metadata: {} }
  ]);
  assert.equal(res3.estimatedSavings, 0, 'Cost overruns must NOT produce negative savings');
  assert.equal(res3.savingsPercent, 0, 'Cost overruns must NOT produce negative percentage');

  // Case 4: Authentic tender budget savings (budget = 50,000, spent = 40,000)
  const res4 = calculateSavings([
    { amount: 40000, tender: { budget: 50000 }, metadata: {} }
  ]);
  assert.equal(res4.estimatedSavings, 10000, 'Authentic savings must equal ₹10,000');
  assert.equal(res4.savingsPercent, 20.0, 'Savings percent must equal 20.0% of baseline budget (10000/50000)');

  // Case 5: Metadata quote delta savings (originalAmount = 25,000, spent = 20,000)
  const res5 = calculateSavings([
    { amount: 20000, tender: null, metadata: { originalAmount: 25000 } }
  ]);
  assert.equal(res5.estimatedSavings, 5000, 'Delta savings must equal ₹5,000');
  assert.equal(res5.savingsPercent, 20.0, 'Savings percent must equal 20.0%');
});

// ============================================================================
// SUITE 5: Frontend Component Permutation & ReferenceError Fuzzing
// ============================================================================

test('ADV-FE-01: ProcurementDetailUnifiedView declares isReverseAuctionType before shouldShowEstimatedCost', () => {
  const componentPath = path.join(
    FRONTEND_DIR,
    'src',
    'features',
    'rfq',
    'components',
    'ProcurementDetailUnifiedView.tsx'
  );
  const code = fs.readFileSync(componentPath, 'utf8').replace(/\r\n/g, '\n');
  const raIndex = code.indexOf('const isReverseAuctionType =');
  const costIndex = code.indexOf('const shouldShowEstimatedCost =');

  assert.ok(raIndex !== -1, 'isReverseAuctionType must be declared');
  assert.ok(costIndex !== -1, 'shouldShowEstimatedCost must be declared');
  assert.ok(
    raIndex < costIndex,
    `isReverseAuctionType (pos ${raIndex}) must be declared before shouldShowEstimatedCost (pos ${costIndex}) to resolve render TDZ ReferenceError`
  );
});

test('ADV-FE-02: Fuzz 256 prop permutations of shouldShowEstimatedCost without ReferenceError or NaN', () => {
  const computeShouldShowEstimatedCost = ({
    isBuyerSide = false,
    isBuyerOrAdmin = false,
    discloseEstimatedCost = false,
    isRateContractType = false,
    hasRaPrefix = false,
    procurementType = '',
    procurementMethod = '',
    pathname = ''
  }) => {
    const isReverseAuctionType =
      !isRateContractType &&
      (hasRaPrefix ||
        procurementType === 'REVERSE_AUCTION' ||
        procurementType === 'reverse-auction' ||
        procurementMethod === 'REVERSE_AUCTION' ||
        (typeof pathname === 'string' && (pathname.includes('REVERSE AUCTION') || pathname.includes('/reverse-auction'))));

    const shouldShowEstimatedCost = Boolean(
      isBuyerSide ||
      isBuyerOrAdmin ||
      discloseEstimatedCost ||
      isReverseAuctionType
    );

    return { isReverseAuctionType, shouldShowEstimatedCost };
  };

  const bools = [true, false];
  const stringTypes = ['', 'BID', 'REVERSE_AUCTION', 'reverse-auction', 'CUSTOM', 'RATE_CONTRACT', null, undefined];
  const paths = ['', '/rfq/123', '/reverse-auction/456', 'REVERSE AUCTION BID', null, undefined];

  let combinationsTested = 0;

  for (const isBuyerSide of bools) {
    for (const isBuyerOrAdmin of bools) {
      for (const discloseEstimatedCost of bools) {
        for (const isRateContractType of bools) {
          for (const hasRaPrefix of bools) {
            for (const procurementType of stringTypes) {
              for (const pathname of paths) {
                combinationsTested++;
                let res;
                assert.doesNotThrow(() => {
                  res = computeShouldShowEstimatedCost({
                    isBuyerSide,
                    isBuyerOrAdmin,
                    discloseEstimatedCost,
                    isRateContractType,
                    hasRaPrefix,
                    procurementType,
                    pathname
                  });
                }, `Permutation failed at combo ${combinationsTested}`);

                assert.equal(typeof res.isReverseAuctionType, 'boolean');
                assert.equal(typeof res.shouldShowEstimatedCost, 'boolean');

                // If buyer side or admin or disclosed, must ALWAYS show estimated cost
                if (isBuyerSide || isBuyerOrAdmin || discloseEstimatedCost) {
                  assert.equal(
                    res.shouldShowEstimatedCost,
                    true,
                    `Expected true for combo ${combinationsTested} when buyer/admin/disclosed`
                  );
                }

                // If reverse auction and not rate contract, must ALWAYS show estimated cost
                if (!isRateContractType && (hasRaPrefix || procurementType === 'REVERSE_AUCTION' || procurementType === 'reverse-auction')) {
                  assert.equal(
                    res.shouldShowEstimatedCost,
                    true,
                    `Expected true for reverse auction in combo ${combinationsTested}`
                  );
                }

                // If sealed seller bid without disclosure or RA, must strictly be FALSE
                if (!isBuyerSide && !isBuyerOrAdmin && !discloseEstimatedCost && !res.isReverseAuctionType) {
                  assert.equal(
                    res.shouldShowEstimatedCost,
                    false,
                    `Expected false for sealed seller bid in combo ${combinationsTested}`
                  );
                }
              }
            }
          }
        }
      }
    }
  }

  assert.ok(combinationsTested >= 256, `Must test at least 256 permutations (tested ${combinationsTested})`);
});
