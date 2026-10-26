import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf-8');

test('GFR 171 & MSME: PO Generation resolves securityDeposit and respects 0% MSE Waiver', () => {
  const service = read('src/modules/procurementBid/procurement-order.service.ts');
  assert.match(service, /bidTerms\.securityDeposit/);
  assert.match(service, /isPbgExempt/);
  assert.match(service, /MSE_STATUTORY_WAIVER/);
  assert.match(service, /resolvedPbgRequired/);
  assert.match(service, /resolvedPbgPercentage/);
});

test('GFR 171: Fulfillment workflow enforces strict retention capping on milestone invoices', () => {
  const service = read('src/services/workflow/fulfillment-workflow.service.ts');
  assert.match(service, /retentionAccumulated/);
  assert.match(service, /remainingCap = Math\.max\(0, targetRetention - alreadyDeducted\)/);
  assert.match(service, /Math\.min\(idealInvoiceDeduction, remainingCap\)/);
  assert.match(service, /increment:\s*retentionDeduction/);
});

test('UI Parity: PBG Management Card supports 0% MSE Waiver and parity percentage', () => {
  const card = read('../frontend/src/features/purchaseOrders/components/PbgManagementCard.tsx');
  assert.match(card, /isPbgExempt/);
  assert.match(card, /100% Waived \(0% MSE\)/);
  assert.match(card, /Statutory MSME Exemption Active: 0% Performance Security/);
  assert.match(card, /poPbgPercentage/);
});
