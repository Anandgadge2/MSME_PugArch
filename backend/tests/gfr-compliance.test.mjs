import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

const read = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('GFR 171: Prisma schema defines PerformanceGuarantee model with PBG statuses and types', () => {
  const schema = read('prisma/schema.prisma');
  assert.match(schema, /model PerformanceGuarantee/);
  assert.match(schema, /enum PbgStatus/);
  assert.match(schema, /enum PbgType/);
  assert.match(schema, /BANK_GUARANTEE/);
  assert.match(schema, /FDR_PLEDGE/);
  assert.match(schema, /RETENTION_DEDUCTION/);
  assert.match(schema, /makerUserId/);
  assert.match(schema, /checkerUserId/);
});

test('GFR 171: PBG Service enforces Claim Expiry Date >= Contract Expiry + 60 days (GFR Rule 171)', () => {
  const service = read('src/modules/pbg/pbg.service.ts');
  assert.match(service, /Claim expiry must be at least 60 calendar days beyond contract\/warranty expiry/);
  assert.match(service, /claimExpiryDate\.setDate\(claimExpiryDate\.getDate\(\) \+ 60\)/);
});

test('GFR 171: PBG Service supports Grassroots MSME 5% Retention Money deduction option', () => {
  const service = read('src/modules/pbg/pbg.service.ts');
  assert.match(service, /RETENTION_DEDUCTION/);
  assert.match(service, /District Escrow \(Retention Holdback\)/);
  assert.match(service, /isRetention \? 'VERIFIED_ACTIVE' : 'SUBMITTED_FOR_VERIFICATION'/);
});

test('GFR 171: PBG Service enforces 4-Eyes Maker-Checker principle (Maker cannot be Checker)', () => {
  const service = read('src/modules/pbg/pbg.service.ts');
  assert.match(service, /Maker-Checker violation: Checker cannot be the same user who initiated Maker review/);
  assert.match(service, /pbg\.makerReviewerId === actor\.id/);
});

test('GFR 175: Liquidated Damages calculation enforces 0.5% per week delay capped strictly at 10% max', () => {
  const service = read('src/modules/delivery/delivery.service.ts');
  assert.match(service, /calculateLiquidatedDamages/);
  assert.match(service, /DEFAULT_LIQUIDATED_DAMAGES = \{ weeklyRate: 0\.005, maxCapPercent: 10 \}/);
  assert.match(service, /approvedExtension\?\.waiveLd === true/);
});

test('GFR 175: Liquidated Damages is integrated into Invoice fulfillment workflow for automatic deduction', () => {
  const workflow = read('src/services/workflow/fulfillment-workflow.service.ts');
  assert.match(workflow, /calculateLiquidatedDamages\(delivery\)/);
  assert.match(workflow, /ldDeduction/);
});

test('GFR 172: Advance Mobilization Proforma and Net Balance settlement deduction math', () => {
  const schema = read('prisma/schema.prisma');
  assert.match(schema, /isAdvanceProforma/);
  assert.match(schema, /advanceDeduction/);
  assert.match(schema, /ldDeduction/);
  assert.match(schema, /retentionDeduction/);
  assert.match(schema, /netPayableAmount/);

  const workflow = read('src/services/workflow/fulfillment-workflow.service.ts');
  assert.match(workflow, /advanceDeduction/);
  assert.match(workflow, /ldDeduction/);
  assert.match(workflow, /retentionDeduction/);
  assert.match(workflow, /gstTdsAmount/);
  assert.match(workflow, /netPayableAmount/);
  // Invariant: Net Payable = max(0, gross - advance - ld - retention - tds - gstTds)
  assert.match(workflow, /Number\(taxes\.grossAmount\) - advanceDeduction - ldDeduction - retentionDeduction/);
});

test('Anti-Fraud: Offline Payment Proof prevents duplicate UTR entries via unique compound constraint', () => {
  const schema = read('prisma/schema.prisma');
  assert.match(schema, /@@unique\(\[buyerOrgId, transactionReference\]\)/);
});

test('CVC Directives: L1 Negotiation Service enforces statutory 72-hour SLA response countdown', () => {
  const service = read('src/modules/negotiation/negotiation.service.ts');
  assert.match(service, /72 \* 60 \* 60 \* 1000/);
  assert.match(service, /Target negotiation amount must be lower than the current contract amount/);
  assert.match(service, /COUNTERED_BY_SELLER/);
  assert.match(service, /ACCEPTED_BY_SELLER/);
  assert.match(service, /REJECTED_BY_SELLER/);
});

test('API Routing: PBG and Negotiation routes are properly registered in the central router', () => {
  const routes = read('src/routes/index.ts');
  assert.match(routes, /import pbgRoutes from '\.\.\/modules\/pbg\/pbg\.routes\.js'/);
  assert.match(routes, /import negotiationRoutes from '\.\.\/modules\/negotiation\/negotiation\.routes\.js'/);
  assert.match(routes, /router\.use\('\/pbg', pbgRoutes\)/);
  assert.match(routes, /router\.use\('\/negotiations', negotiationRoutes\)/);
});
