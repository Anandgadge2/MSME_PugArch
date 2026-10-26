import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePenaltyTerms } from '../src/modules/rateContract/rate-contract.service.ts';
import { calculateLiquidatedDamages } from '../src/modules/delivery/delivery.service.ts';

test('1. LD Parser: Correctly parses standard weekly penalty clause', () => {
  const parsed = parsePenaltyTerms({ penaltyClause: '0.5% per week delay (max 10%)' });
  assert.equal(parsed.ratePerWeek, 0.5);
  assert.equal(parsed.maxCapPercent, 10);
  assert.equal(parsed.calculationBasis, 'weekly');
  assert.equal(parsed.gracePeriodDays, 0);
});

test('2. LD Parser: Correctly parses daily SLA downtime penalty clause', () => {
  const parsed = parsePenaltyTerms({ penaltyClause: '1% per day SLA downtime penalty' });
  assert.equal(parsed.ratePerDay, 1.0);
  assert.equal(parsed.ratePerWeek, 7.0);
  assert.equal(parsed.calculationBasis, 'daily');
  assert.equal(parsed.maxCapPercent, 10);
});

test('3. LD Parser: Correctly parses fractional daily delay with cap', () => {
  const parsed = parsePenaltyTerms({ penaltyClause: '0.1% per day of delay up to 10% maximum' });
  assert.equal(parsed.ratePerDay, 0.1);
  assert.equal(parsed.ratePerWeek, 0.7);
  assert.equal(parsed.calculationBasis, 'daily');
  assert.equal(parsed.maxCapPercent, 10);
});

test('4. LD Parser: Correctly handles grace days and custom caps in text', () => {
  const parsed = parsePenaltyTerms({ penaltyClause: '0.5% per week delay with 3 days grace period capped at 15%' });
  assert.equal(parsed.ratePerWeek, 0.5);
  assert.equal(parsed.gracePeriodDays, 3);
  assert.equal(parsed.maxCapPercent, 15);
});

test('5. LD Parser: Standard fallback when text is generic', () => {
  const parsed = parsePenaltyTerms({ penaltyClause: 'Standard LD per GCC / PO' });
  assert.equal(parsed.ratePerWeek, 0.5);
  assert.equal(parsed.maxCapPercent, 10);
});

test('6. Delivery LD Math: Zero penalty for on-time delivery', () => {
  const delivery = {
    expectedDelivery: new Date('2026-11-01T00:00:00Z'),
    actualDelivery: new Date('2026-10-31T12:00:00Z'),
    purchaseOrder: {
      amount: 100000,
      metadata: { penaltyClause: '0.5% per week delay (max 10%)' }
    }
  };
  const result = calculateLiquidatedDamages(delivery);
  assert.equal(result.delayDays, 0);
  assert.equal(result.calculatedLdAmount, 0);
});

test('7. Delivery LD Math: Weekly penalty calculation (14 days = 2 weeks @ 0.5% = 1%)', () => {
  const delivery = {
    expectedDelivery: new Date('2026-11-01T00:00:00Z'),
    actualDelivery: new Date('2026-11-15T00:00:00Z'), // 14 days
    purchaseOrder: {
      amount: 100000,
      metadata: { penaltyClause: '0.5% per week delay (max 10%)' }
    }
  };
  const result = calculateLiquidatedDamages(delivery);
  assert.equal(result.delayDays, 14);
  assert.equal(result.delayedWeeks, 2);
  assert.equal(result.calculatedLdAmount, 1000); // 1% of 100000
});

test('8. Delivery LD Math: Daily penalty calculation (5 days @ 1% per day = 5%)', () => {
  const delivery = {
    expectedDelivery: new Date('2026-11-01T00:00:00Z'),
    actualDelivery: new Date('2026-11-06T00:00:00Z'), // 5 days
    purchaseOrder: {
      amount: 100000,
      metadata: { penaltyClause: '1% per day SLA downtime penalty' }
    }
  };
  const result = calculateLiquidatedDamages(delivery);
  assert.equal(result.delayDays, 5);
  assert.equal(result.calculationBasis, 'daily');
  assert.equal(result.calculatedLdAmount, 5000); // 5% of 100000
});

test('9. Delivery LD Math: Maximum cap strictly enforced', () => {
  const delivery = {
    expectedDelivery: new Date('2026-10-01T00:00:00Z'),
    actualDelivery: new Date('2026-11-15T00:00:00Z'), // 45 days @ 1% per day would be 45%
    purchaseOrder: {
      amount: 200000,
      metadata: { penaltyClause: '1% per day SLA downtime penalty' } // default cap 10%
    }
  };
  const result = calculateLiquidatedDamages(delivery);
  assert.equal(result.calculatedLdAmount, 20000); // exactly 10% of 200000
});

test('10. Delivery LD Math: Grace period postpones penalty start', () => {
  const delivery = {
    expectedDelivery: new Date('2026-11-01T00:00:00Z'),
    actualDelivery: new Date('2026-11-03T00:00:00Z'), // 2 days, but 3 days grace
    purchaseOrder: {
      amount: 100000,
      metadata: { penaltyClause: '1% per day delay with 3 days grace' }
    }
  };
  const result = calculateLiquidatedDamages(delivery);
  assert.equal(result.delayDays, 0);
  assert.equal(result.calculatedLdAmount, 0);
});

test('11. Delivery LD Math: Waived on approved DP extension', () => {
  const delivery = {
    expectedDelivery: new Date('2026-11-01T00:00:00Z'),
    actualDelivery: new Date('2026-11-10T00:00:00Z'),
    dpExtensions: [{ status: 'APPROVED', waiveLd: true }],
    purchaseOrder: {
      amount: 100000,
      metadata: { penaltyClause: '0.5% per week delay (max 10%)' }
    }
  };
  const result = calculateLiquidatedDamages(delivery);
  assert.equal(result.isWaived, true);
  assert.equal(result.calculatedLdAmount, 0);
});

test('12. PO Service Code Inspection: Enforces LD, Warranty, and PBG Award Persistence', () => {
  const orderServiceCode = readFileSync(new URL('../src/modules/procurementBid/procurement-order.service.ts', import.meta.url), 'utf8');
  assert.match(orderServiceCode, /warrantyTerms:/, 'Order service must persist warrantyTerms in metadata');
  assert.match(orderServiceCode, /termsDocuments:\s*\{/, 'Order service must build termsDocuments for PO UI');
  assert.match(orderServiceCode, /penaltyTerms\s*=\s*parsePenaltyTerms/, 'Order service must structure penaltyTerms');
  assert.match(orderServiceCode, /resolvedPbgAmount\s*=/, 'Order service must calculate resolvedPbgAmount on awarded value');
});

test('13. PO PDF Generator Code Inspection: Enforces Contractual Terms in Generated PDF', () => {
  const pdfServiceCode = readFileSync(new URL('../src/services/invoice-pdf.service.ts', import.meta.url), 'utf8');
  assert.match(pdfServiceCode, /Liquidated Damages \(Late Delivery\):/, 'PDF service must declare Liquidated Damages');
  assert.match(pdfServiceCode, /Warranty Terms & Support Obligation:/, 'PDF service must declare Warranty Terms');
  assert.match(pdfServiceCode, /Performance Security \(GFR Rule 171\):/, 'PDF service must declare Performance Security clause');
  assert.match(pdfServiceCode, /100% Waived under Public Procurement Policy for MSEs Order, 2012/, 'PDF service must declare MSE statutory waiver');
});

test('14. Purchase Orders UI Code Inspection: Enforces Dual Fallback for Terms & Warranty', () => {
  const poUiCode = readFileSync(new URL('../../frontend/src/views/PurchaseOrders.tsx', import.meta.url), 'utf8');
  assert.match(poUiCode, /warrantyTerms\s*=\s*terms\.warrantyTerms\s*\|\|\s*meta\.warrantyTerms/, 'UI must check both termsDocuments and metadata for warrantyTerms');
  assert.match(poUiCode, /delayPenaltyDetails\s*=\s*terms\.delayPenaltyDetails\s*\|\|\s*meta\.ldTerms\s*\|\|\s*meta\.penaltyClause/, 'UI must check both termsDocuments and metadata for delay penalty');
});
