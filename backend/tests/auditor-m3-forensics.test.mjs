import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Direct imports of actual production TypeScript modules
import { evaluateL1 } from '../src/modules/l1Comparison/l1-comparison.service.ts';
import { statusTransitions } from '../src/services/workflow/status-transition.service.ts';
import { validateCallOffOrderRequest, getRateContractUtilization } from '../src/modules/rateContract/rate-contract.service.ts';
import { PbgService } from '../src/modules/pbg/pbg.service.ts';

test('--- FORENSIC AUDITOR INDEPENDENT TEST SUITE: MILESTONE 3 ---', () => {
  assert.ok(true, 'Starting Forensic Verification');
});

// 1. Direct Purchase GFR Rule 154 Forensic Check
test('FORENSIC 1: direct-purchase.routes.ts strictly enforces GFR 154 threshold and persists cert', () => {
  const content = readFileSync(path.resolve('src/routes/direct-purchase.routes.ts'), 'utf8');

  // Verify threshold check is present
  assert.match(content, /if\s*\(\s*totalAmount\s*>\s*25000\s*\)/, 'Must contain totalAmount > 25000 condition');
  assert.match(content, /DIRECT_PURCHASE_THRESHOLD_EXCEEDED/, 'Must throw DIRECT_PURCHASE_THRESHOLD_EXCEEDED');
  assert.match(content, /certifierName\s*&&\s*cert\.designation\s*&&\s*\(cert\.reason\s*\|\|\s*cert\.justification\)\s*&&\s*cert\.certifiedDate/, 'Must validate certificate fields');
  assert.match(content, /rule154Certificate:\s*body\.rule154Certificate\s*\|\|\s*body\.rule154Justification/, 'Must persist certificate into PO metadata');
});

// 2. Unapproved Binding PO Auto-Creation Removal Forensic Check
test('FORENSIC 2: phase4.routes.ts has completely eradicated quotation-based PO auto-creation in invoices', () => {
  const content = readFileSync(path.resolve('src/routes/phase4.routes.ts'), 'utf8');

  // Must require targetPoId
  assert.match(content, /if\s*\(!targetPoId\)\s*\{\s*throw new ApiError\(400,\s*'Invoices cannot be submitted without an existing approved purchase order',\s*'PO_REQUIRED'\);/);
  // Must verify seller ownership
  assert.match(content, /if\s*\(!isAdmin\(req\)\s*&&\s*po\.sellerId\s*!==\s*userId\(req\)\)\s*\{\s*throw new ApiError\(403,\s*'You are not the seller of this purchase order',\s*'FORBIDDEN_PO_SELLER_MISMATCH'\);/);
  // Verify that db.purchaseOrder.create inside /invoices route is gone
  const invoiceRouteSegment = content.slice(content.indexOf("router.post('/invoices'"), content.indexOf("router.post('/invoices/upload-external'"));
  assert.doesNotMatch(invoiceRouteSegment, /db\.purchaseOrder\.create/, 'Must not contain any purchaseOrder.create in POST /invoices');
  assert.doesNotMatch(invoiceRouteSegment, /quoteResp/, 'Must not contain quoteResp in POST /invoices');
});

// 3. Multi-Vendor L1 Comparison Engine Forensic Check
test('FORENSIC 3: evaluateL1 enforces GFR 149 >=3 sellers quorum, aggregates quotes, and breaks ties deterministically', () => {
  // Test 3a: Empty quotes
  const resEmpty = evaluateL1([]);
  assert.equal(resEmpty.meetsQuorum, false);
  assert.equal(resEmpty.l1VendorId, null);

  // Test 3b: Less than 3 compliant vendors
  const res2Vendors = evaluateL1([
    { vendorOrgId: 1, vendorName: 'Vendor A', totalPrice: 50000, compliant: true, submittedAt: '2026-11-01T10:00:00Z' },
    { vendorOrgId: 2, vendorName: 'Vendor B', totalPrice: 45000, compliant: true, submittedAt: '2026-11-01T10:05:00Z' }
  ]);
  assert.equal(res2Vendors.meetsQuorum, false, '2 vendors must fail quorum');
  assert.equal(res2Vendors.l1VendorId, null);
  assert.equal(res2Vendors.compliantQuotes.length, 2);

  // Test 3c: 3 distinct vendors where 1 is non-compliant -> quorum fails
  const res3Vendors1NonCompliant = evaluateL1([
    { vendorOrgId: 1, vendorName: 'Vendor A', totalPrice: 50000, compliant: true, submittedAt: '2026-11-01T10:00:00Z' },
    { vendorOrgId: 2, vendorName: 'Vendor B', totalPrice: 45000, compliant: true, submittedAt: '2026-11-01T10:05:00Z' },
    { vendorOrgId: 3, vendorName: 'Vendor C', totalPrice: 30000, compliant: false, complianceStatus: 'Non-compliant', submittedAt: '2026-11-01T10:10:00Z' }
  ]);
  assert.equal(res3Vendors1NonCompliant.meetsQuorum, false, 'Non-compliant vendor must not count towards quorum');
  assert.equal(res3Vendors1NonCompliant.l1VendorId, null);

  // Test 3d: 3 compliant distinct vendors -> succeeds and L1 is lowest total
  const res3Compliant = evaluateL1([
    { vendorOrgId: 1, vendorName: 'Vendor A', totalPrice: 50000, compliant: true, submittedAt: '2026-11-01T10:00:00Z' },
    { vendorOrgId: 2, vendorName: 'Vendor B', totalPrice: 45000, compliant: true, submittedAt: '2026-11-01T10:05:00Z' },
    { vendorOrgId: 3, vendorName: 'Vendor C', totalPrice: 48000, compliant: true, submittedAt: '2026-11-01T10:10:00Z' }
  ]);
  assert.equal(res3Compliant.meetsQuorum, true, '3 compliant vendors must meet quorum');
  assert.equal(res3Compliant.l1VendorId, 2, 'Vendor B (₹45,000) must be L1');
  assert.equal(res3Compliant.l1Price, 45000);
  assert.equal(res3Compliant.rankings[0].rank, 'L1');
  assert.equal(res3Compliant.rankings[0].vendorId, 2);
  assert.equal(res3Compliant.rankings[1].rank, 'L2');
  assert.equal(res3Compliant.rankings[1].vendorId, 3);
  assert.equal(res3Compliant.rankings[2].rank, 'L3');
  assert.equal(res3Compliant.rankings[2].vendorId, 1);

  // Test 3e: Multi-line items aggregate per vendor
  const resMultiLine = evaluateL1([
    { vendorOrgId: 1, itemName: 'Server A', unitPrice: 20000, quantity: 2, compliant: true }, // 40,000
    { vendorOrgId: 1, itemName: 'Server B', unitPrice: 15000, quantity: 1, compliant: true }, // 15,000 -> Total 55,000
    { vendorOrgId: 2, itemName: 'Server A', unitPrice: 18000, quantity: 2, compliant: true }, // 36,000
    { vendorOrgId: 2, itemName: 'Server B', unitPrice: 16000, quantity: 1, compliant: true }, // 16,000 -> Total 52,000
    { vendorOrgId: 3, itemName: 'Bundle', totalPrice: 60000, compliant: true }                 // Total 60,000
  ]);
  assert.equal(resMultiLine.meetsQuorum, true);
  assert.equal(resMultiLine.l1VendorId, 2, 'Vendor 2 total (52k) must beat Vendor 1 (55k)');
  assert.equal(resMultiLine.l1Price, 52000);

  // Test 3f: Deterministic tie-breaking on identical pricing
  const resTie = evaluateL1([
    { vendorOrgId: 1, vendorName: 'Vendor Late', totalPrice: 50000, compliant: true, submittedAt: '2026-11-01T12:00:00Z' },
    { vendorOrgId: 2, vendorName: 'Vendor Early', totalPrice: 50000, compliant: true, submittedAt: '2026-11-01T09:00:00Z' },
    { vendorOrgId: 3, vendorName: 'Vendor Third', totalPrice: 60000, compliant: true, submittedAt: '2026-11-01T10:00:00Z' }
  ]);
  assert.equal(resTie.meetsQuorum, true);
  assert.equal(resTie.l1VendorId, 2, 'Earlier timestamp must win tie-break');
});

// 4. Sealed Bid WebSocket Leakage Forensic Check
test('FORENSIC 4: marketplace.routes.ts redacts price and sellerOrgId from QUOTATION_SUBMITTED broadcasts', () => {
  const content = readFileSync(path.resolve('src/routes/marketplace.routes.ts'), 'utf8');

  const wsSegment = content.slice(content.indexOf("type: 'QUOTATION_SUBMITTED'"), content.indexOf("type: 'QUOTATION_SUBMITTED'") + 300);
  assert.doesNotMatch(wsSegment, /offeredPrice/, 'QUOTATION_SUBMITTED broadcast must not contain offeredPrice');
  assert.doesNotMatch(wsSegment, /sellerOrgId/, 'QUOTATION_SUBMITTED broadcast must not contain sellerOrgId');
  assert.doesNotMatch(wsSegment, /unitPrice/, 'QUOTATION_SUBMITTED broadcast must not contain unitPrice');
});

// 5. Bilateral PO Status Transitions Forensic Check
test('FORENSIC 5: statusTransitions strictly blocks unilateral PO cancellation for accepted or fulfilling POs', () => {
  // Test 5a: Unilateral accepted -> cancelled
  assert.throws(
    () => statusTransitions.purchaseOrder('accepted', 'cancelled'),
    (err) => err?.statusCode === 409 && err?.message?.includes('bilateral cancellation approval')
  );

  // Test 5b: Unilateral in_fulfillment -> cancelled
  assert.throws(
    () => statusTransitions.purchaseOrder('in_fulfillment', 'cancelled'),
    (err) => err?.statusCode === 409 && err?.message?.includes('bilateral cancellation approval')
  );

  // Test 5c: Transition accepted -> cancellation_requested succeeds
  assert.doesNotThrow(() => statusTransitions.purchaseOrder('accepted', 'cancellation_requested'));

  // Test 5d: Transition in_fulfillment -> cancellation_requested succeeds
  assert.doesNotThrow(() => statusTransitions.purchaseOrder('in_fulfillment', 'cancellation_requested'));

  // Test 5e: cancellation_requested -> cancelled without counterparty approval throws 403
  assert.throws(
    () => statusTransitions.purchaseOrder('cancellation_requested', 'cancelled', { counterpartyApproved: false }),
    (err) => err?.statusCode === 403 && err?.code === 'COUNTERPARTY_APPROVAL_REQUIRED'
  );

  // Test 5f: cancellation_requested -> cancelled with counterparty approval succeeds
  assert.doesNotThrow(
    () => statusTransitions.purchaseOrder('cancellation_requested', 'cancelled', { counterpartyApproved: true })
  );

  // Test 5g: Pre-acceptance POs (draft, issued) can still be cancelled directly
  assert.doesNotThrow(() => statusTransitions.purchaseOrder('draft', 'cancelled'));
  assert.doesNotThrow(() => statusTransitions.purchaseOrder('issued', 'cancelled'));
});

// 6. Rate Contract Cumulative Monetary Cap Forensic Check
test('FORENSIC 6: rate-contract.service.ts enforces cumulative spend against totalContractValue', async () => {
  const content = readFileSync(path.resolve('src/modules/rateContract/rate-contract.service.ts'), 'utf8');

  // Verify financial cap check exists in validateCallOffOrderRequest
  assert.match(content, /if\s*\(totalContractValue\s*>\s*0\s*&&\s*\(cumulativeSpent\s*\+\s*newOrderAmount\s*>\s*totalContractValue\)\)/);
  assert.match(content, /throw new ApiError\(\s*400,\s*'Order exceeds remaining monetary value of Rate Contract',\s*'RATE_CONTRACT_CAP_EXCEEDED'\s*\);/);
});

// 7. PBG Invocation & GFR 170 EMD Schema Forensic Check
test('FORENSIC 7: pbg.service.ts and schema.prisma implement PBG invocation and GFR 170 EMD models', () => {
  // Check PbgService.invokePbg implementation
  assert.equal(typeof PbgService.invokePbg, 'function', 'PbgService.invokePbg must be a static function');

  // Check schema.prisma
  const schema = readFileSync(path.resolve('prisma/schema.prisma'), 'utf8');
  assert.match(schema, /enum\s+EmdStatus\s*\{[^}]*PENDING[^}]*SUBMITTED[^}]*VERIFIED[^}]*RETURNED[^}]*FORFEITED[^}]*EXEMPTED[^}]*\}/s, 'EmdStatus enum must contain all GFR 170 statuses');
  assert.match(schema, /model\s+EmdDeposit\s*\{[^}]*id\s+Int[^}]*sellerId\s+Int[^}]*amount\s+Decimal[^}]*status\s+EmdStatus[^}]*\}/s, 'EmdDeposit model must exist with required fields');
  assert.match(schema, /sellerEmdDeposits\s+EmdDeposit\[\]\s+@relation\("SellerEmdDeposits"\)/, 'User model must have sellerEmdDeposits relation');
  assert.match(schema, /enum\s+PbgStatus\s*\{[^}]*INVOKED[^}]*FORFEITED[^}]*\}/s, 'PbgStatus enum must include INVOKED and FORFEITED');
});
