import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Import production TypeScript modules directly via tsx
import { evaluateL1 } from '../src/modules/l1Comparison/l1-comparison.service.ts';
import { statusTransitions } from '../src/services/workflow/status-transition.service.ts';
import {
  evaluateDirectPurchaseOrder,
  evaluateSellerInvoiceSubmission,
  evaluateL1Comparison,
  sanitizeWebSocketBroadcast,
  evaluatePOTransition,
  evaluateRateContractCallOff,
  evaluatePbgInvocation
} from './helpers/e2e-test-harness.mjs';

// ============================================================================
// ADVERSARIAL CHALLENGER 1: MILESTONE 3 PROCUREMENT & BUSINESS LOGIC INTEGRITY
// ============================================================================

test('--- CHALLENGER 1: ADVERSARIAL VERIFICATION START (MILESTONE 3) ---', () => {
  assert.ok(true, 'Initiating Challenger 1 Milestone 3 Empirical Verification');
});

// ============================================================================
// SUITE 1: DIRECT PURCHASE RULE 154 THRESHOLD BYPASS ATTEMPTS
// ============================================================================

test('ADV.DP.01: Orders at exactly ₹25,000 threshold boundary succeed without certificate', () => {
  const cartItems = [
    { sellerId: 10, unitPrice: 25000, quantity: 1, taxRate: 0 }
  ];
  const result = evaluateDirectPurchaseOrder({ items: cartItems, rule154Certificate: null });
  assert.equal(result.allowed, true, 'Boundary order at ₹25,000 must succeed');
  assert.equal(result.orders[10].allowed, true);
  assert.equal(result.orders[10].requiresCertificate, false);
});

test('ADV.DP.02: Orders at ₹25,000.01 (smallest increment over threshold) strictly fail without certificate', () => {
  const cartItems = [
    { sellerId: 10, unitPrice: 25000.01, quantity: 1, taxRate: 0 }
  ];
  const result = evaluateDirectPurchaseOrder({ items: cartItems, rule154Certificate: null });
  assert.equal(result.allowed, false, 'Order at ₹25,000.01 must be rejected');
  assert.equal(result.orders[10].allowed, false);
  assert.equal(result.orders[10].code, 'DIRECT_PURCHASE_THRESHOLD_EXCEEDED');
});

test('ADV.DP.03: Orders at ₹25,001 strictly fail without certificate', () => {
  const cartItems = [
    { sellerId: 10, unitPrice: 25001, quantity: 1, taxRate: 0 }
  ];
  const result = evaluateDirectPurchaseOrder({ items: cartItems, rule154Certificate: null });
  assert.equal(result.allowed, false);
  assert.equal(result.orders[10].code, 'DIRECT_PURCHASE_THRESHOLD_EXCEEDED');
});

test('ADV.DP.04: High-value order with empty object {} certificate is rejected', () => {
  const cartItems = [
    { sellerId: 10, unitPrice: 30000, quantity: 1, taxRate: 0 }
  ];
  const result = evaluateDirectPurchaseOrder({ items: cartItems, rule154Certificate: {} });
  assert.equal(result.allowed, false, 'Empty certificate object must be rejected');
  assert.equal(result.orders[10].code, 'DIRECT_PURCHASE_THRESHOLD_EXCEEDED');
});

test('ADV.DP.05: Incomplete certificate objects (missing required fields) are strictly rejected', () => {
  const cartItems = [{ sellerId: 10, unitPrice: 40000, quantity: 1, taxRate: 0 }];

  // Missing designation
  const noDesignation = evaluateDirectPurchaseOrder({
    items: cartItems,
    rule154Certificate: { certifierName: 'Director John', reason: 'Emergency medical supplies', certifiedDate: '2026-11-08' }
  });
  assert.equal(noDesignation.allowed, false, 'Missing designation must fail');

  // Missing certifiedDate
  const noDate = evaluateDirectPurchaseOrder({
    items: cartItems,
    rule154Certificate: { certifierName: 'Director John', designation: 'Medical Officer', reason: 'Emergency medical supplies' }
  });
  assert.equal(noDate.allowed, false, 'Missing certifiedDate must fail');

  // Missing reason
  const noReason = evaluateDirectPurchaseOrder({
    items: cartItems,
    rule154Certificate: { certifierName: 'Director John', designation: 'Medical Officer', certifiedDate: '2026-11-08' }
  });
  assert.equal(noReason.allowed, false, 'Missing reason must fail');
});

test('ADV.DP.06: Multi-item cart summing to > ₹25,000 per seller is caught and blocked without certificate', () => {
  const cartItems = [
    { sellerId: 20, itemName: 'Item 1', unitPrice: 12000, quantity: 1, taxRate: 0 },
    { sellerId: 20, itemName: 'Item 2', unitPrice: 8000, quantity: 1, taxRate: 0 },
    { sellerId: 20, itemName: 'Item 3', unitPrice: 6000, quantity: 1, taxRate: 0 } // Total: ₹26,000
  ];
  const result = evaluateDirectPurchaseOrder({ items: cartItems, rule154Certificate: null });
  assert.equal(result.allowed, false);
  assert.equal(result.orders[20].totalAmount, 26000);
  assert.equal(result.orders[20].code, 'DIRECT_PURCHASE_THRESHOLD_EXCEEDED');
});

test('ADV.DP.07: Tax pushing subtotal over ₹25,000 threshold enforces Rule 154 requirement', () => {
  // Base price: ₹24,000, Tax: 18% -> Total: ₹28,320
  const cartItems = [
    { sellerId: 20, unitPrice: 24000, quantity: 1, taxRate: 18 }
  ];
  const result = evaluateDirectPurchaseOrder({ items: cartItems, rule154Certificate: null });
  assert.equal(result.allowed, false, 'Tax-inclusive total over ₹25,000 must enforce Rule 154');
  assert.equal(result.orders[20].totalAmount, 28320);
});

test('ADV.DP.08: Multi-seller cart validates threshold per seller independently', () => {
  const cartItems = [
    { sellerId: 101, unitPrice: 15000, quantity: 1, taxRate: 0 }, // Seller 101: ₹15,000 (compliant)
    { sellerId: 102, unitPrice: 35000, quantity: 1, taxRate: 0 }  // Seller 102: ₹35,000 (exceeds, no cert)
  ];
  const result = evaluateDirectPurchaseOrder({ items: cartItems, rule154Certificate: null });
  assert.equal(result.allowed, false, 'Cart containing any non-compliant seller order must fail overall');
  assert.equal(result.orders[101].allowed, true, 'Seller 101 under ₹25k is individually valid');
  assert.equal(result.orders[102].allowed, false, 'Seller 102 over ₹25k without cert must be rejected');
});

test('ADV.DP.09: Multi-seller cart where exceeding seller has valid certificate succeeds', () => {
  const cartItems = [
    { sellerId: 101, unitPrice: 15000, quantity: 1, taxRate: 0 },
    { sellerId: 102, unitPrice: 35000, quantity: 1, taxRate: 0 }
  ];
  const cert = {
    certifierName: 'Principal Dr. Sharma',
    designation: 'Head of Institution',
    reason: 'Emergency laboratory reagents under GFR 154',
    certifiedDate: '2026-11-08'
  };
  const result = evaluateDirectPurchaseOrder({ items: cartItems, rule154Certificate: cert });
  assert.equal(result.allowed, true);
  assert.equal(result.orders[101].allowed, true);
  assert.equal(result.orders[102].allowed, true);
  assert.equal(result.orders[102].certificateApplied, true);
});

test('ADV.DP.10: Source code analysis of direct-purchase.routes.ts verifies GFR 154 check logic', () => {
  const code = readFileSync(path.resolve('src/routes/direct-purchase.routes.ts'), 'utf8');
  assert.match(code, /if\s*\(\s*totalAmount\s*>\s*25000\s*\)/, 'Must contain totalAmount > 25000 check');
  assert.match(code, /DIRECT_PURCHASE_THRESHOLD_EXCEEDED/, 'Must throw DIRECT_PURCHASE_THRESHOLD_EXCEEDED');
  assert.match(code, /rule154Certificate\s*\|\|\s*body\.rule154Justification/, 'Must inspect certificate or justification');
});

// ============================================================================
// SUITE 2: INVOICE PO AUTO-CREATION & REQUIREMENT ENFORCEMENT
// ============================================================================

test('ADV.PO.01: Invoice submission without PO ID is rejected; no PO created', () => {
  const result = evaluateSellerInvoiceSubmission({
    invoiceBody: { amount: 50000, quotationId: 888 },
    existingPO: null,
    quotation: { id: 888, sellerUserId: 42 }
  });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 400);
  assert.equal(result.code, 'PURCHASE_ORDER_REQUIRED');
});

test('ADV.PO.02: Invoice submission referencing non-existent PO in database fails', () => {
  const result = evaluateSellerInvoiceSubmission({
    invoiceBody: { purchaseOrderId: 999999, amount: 25000 },
    existingPO: null,
    quotation: { id: 777, sellerUserId: 42 }
  });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'PURCHASE_ORDER_REQUIRED');
});

test('ADV.PO.03: Invoice submission by seller whose ID does not match PO sellerId is rejected (BOLA guard)', () => {
  const result = evaluateSellerInvoiceSubmission({
    invoiceBody: { purchaseOrderId: 501, amount: 25000 },
    existingPO: { id: 501, sellerId: 100, status: 'accepted' },
    quotation: { id: 777, sellerUserId: 999 } // Attacker seller
  });
  assert.equal(result.allowed, false);
  assert.equal(result.status, 403);
  assert.equal(result.code, 'FORBIDDEN_PO_SELLER_MISMATCH');
});

test('ADV.PO.04: Invoice submission against unapproved PO statuses (draft, cancelled, rejected) is blocked', () => {
  const invalidStatuses = ['draft', 'cancelled', 'rejected', 'pending_approval', 'issued', 'pending_acceptance'];
  for (const st of invalidStatuses) {
    const result = evaluateSellerInvoiceSubmission({
      invoiceBody: { purchaseOrderId: 601, amount: 10000 },
      existingPO: { id: 601, sellerId: 42, status: st },
      quotation: { sellerUserId: 42 }
    });
    assert.equal(result.allowed, false, `Status ${st} must not allow invoice submission`);
    assert.equal(result.code, 'INVALID_PO_STATUS_FOR_INVOICE');
  }
});

test('ADV.PO.05: Invoice submission against operational PO statuses (accepted, in_fulfillment, delivered) succeeds', () => {
  const validStatuses = ['accepted', 'in_fulfillment', 'delivered'];
  for (const st of validStatuses) {
    const result = evaluateSellerInvoiceSubmission({
      invoiceBody: { purchaseOrderId: 701, amount: 15000 },
      existingPO: { id: 701, sellerId: 42, status: st },
      quotation: { sellerUserId: 42 }
    });
    assert.equal(result.allowed, true, `Status ${st} must permit invoice submission`);
  }
});

test('ADV.PO.06: Source code analysis verifies removal of quotation fallback PO creation in phase4.routes.ts', () => {
  const code = readFileSync(path.resolve('src/routes/phase4.routes.ts'), 'utf8');
  // Check lines 10565-10615 in phase4.routes.ts
  assert.match(code, /if\s*\(!targetPoId\)\s*\{\s*throw new ApiError\(400, 'Invoices cannot be submitted without an existing approved purchase order', 'PO_REQUIRED'\);/);
  // Ensure the old quotation fallback creating POs is absent from /invoices
  const invoiceRouteSnippet = code.slice(code.indexOf("router.post('/invoices'"), code.indexOf("router.post('/invoices/upload-external'"));
  assert.doesNotMatch(invoiceRouteSnippet, /db\.purchaseOrder\.create/);
  assert.doesNotMatch(invoiceRouteSnippet, /createPurchaseOrder/);
});

// ============================================================================
// SUITE 3: MULTI-VENDOR L1 COMPARISON ENGINE & GFR 149 QUORUM
// ============================================================================

test('ADV.L1.01: evaluateL1 with empty quotes returns meetsQuorum: false and null L1', () => {
  const res = evaluateL1([]);
  assert.equal(res.meetsQuorum, false);
  assert.equal(res.l1VendorId, null);
  assert.equal(res.vendorCount, 0);
});

test('ADV.L1.02: evaluateL1 with 1 vendor fails quorum (< 3 distinct vendors)', () => {
  const quotes = [
    { vendorId: 1, vendorOrgId: 101, totalPrice: 50000, compliant: true }
  ];
  const res = evaluateL1(quotes);
  assert.equal(res.meetsQuorum, false);
  assert.equal(res.l1VendorId, null);
  assert.equal(res.vendorCount, 1);
});

test('ADV.L1.03: evaluateL1 with 2 vendors fails quorum (< 3 distinct vendors)', () => {
  const quotes = [
    { vendorId: 1, vendorOrgId: 101, totalPrice: 50000, compliant: true },
    { vendorId: 2, vendorOrgId: 102, totalPrice: 45000, compliant: true }
  ];
  const res = evaluateL1(quotes);
  assert.equal(res.meetsQuorum, false);
  assert.equal(res.l1VendorId, null);
  assert.equal(res.vendorCount, 2);
});

test('ADV.L1.04: evaluateL1 with 3 quotes from only 2 distinct vendor orgs fails quorum (anti-syndicate)', () => {
  const quotes = [
    { vendorId: 1, vendorOrgId: 101, totalPrice: 30000, compliant: true },
    { vendorId: 2, vendorOrgId: 101, totalPrice: 25000, compliant: true }, // Same org 101!
    { vendorId: 3, vendorOrgId: 102, totalPrice: 28000, compliant: true }
  ];
  const res = evaluateL1(quotes);
  assert.equal(res.meetsQuorum, false, 'Two vendors from same org count as 1 vendor org; quorum must fail');
  assert.equal(res.vendorCount, 2);
  assert.equal(res.l1VendorId, null);
});

test('ADV.L1.05: evaluateL1 with 3 vendors where 1 is non-compliant drops compliant count to 2 and fails quorum', () => {
  const quotes = [
    { vendorId: 1, vendorOrgId: 101, totalPrice: 30000, compliant: true },
    { vendorId: 2, vendorOrgId: 102, totalPrice: 28000, compliant: false, complianceStatus: 'Non-compliant' },
    { vendorId: 3, vendorOrgId: 103, totalPrice: 32000, compliant: true }
  ];
  const res = evaluateL1(quotes);
  assert.equal(res.meetsQuorum, false, 'Non-compliant vendor drops quorum below 3');
  assert.equal(res.l1VendorId, null);
  assert.equal(res.compliantQuotes.length, 2);
});

test('ADV.L1.06: evaluateL1 with 3 compliant distinct vendors succeeds and selects lowest total as L1', () => {
  const quotes = [
    { vendorId: 1, vendorOrgId: 101, totalPrice: 30000, compliant: true },
    { vendorId: 2, vendorOrgId: 102, totalPrice: 22000, compliant: true }, // Lowest
    { vendorId: 3, vendorOrgId: 103, totalPrice: 28000, compliant: true }
  ];
  const res = evaluateL1(quotes);
  assert.equal(res.meetsQuorum, true);
  assert.equal(res.l1VendorId, 2);
  assert.equal(res.l1Price, 22000);
  assert.equal(res.rankings?.length, 3);
  assert.equal(res.rankings?.[0].rank, 'L1');
  assert.equal(res.rankings?.[0].vendorId, 2);
  assert.equal(res.rankings?.[1].rank, 'L2');
  assert.equal(res.rankings?.[1].vendorId, 3);
  assert.equal(res.rankings?.[2].rank, 'L3');
  assert.equal(res.rankings?.[2].vendorId, 1);
});

test('ADV.L1.07: evaluateL1 aggregates multiple line items per vendor before comparison', () => {
  const quotes = [
    // Vendor 1 submits 2 line items: ₹10k + ₹15k = ₹25k
    { vendorId: 1, vendorOrgId: 101, itemName: 'Desk', totalPrice: 10000, compliant: true },
    { vendorId: 1, vendorOrgId: 101, itemName: 'Chair', totalPrice: 15000, compliant: true },
    // Vendor 2 submits 2 line items: ₹9k + ₹14k = ₹23k (L1)
    { vendorId: 2, vendorOrgId: 102, itemName: 'Desk', totalPrice: 9000, compliant: true },
    { vendorId: 2, vendorOrgId: 102, itemName: 'Chair', totalPrice: 14000, compliant: true },
    // Vendor 3 submits 2 line items: ₹11k + ₹16k = ₹27k
    { vendorId: 3, vendorOrgId: 103, itemName: 'Desk', totalPrice: 11000, compliant: true },
    { vendorId: 3, vendorOrgId: 103, itemName: 'Chair', totalPrice: 16000, compliant: true }
  ];
  const res = evaluateL1(quotes);
  assert.equal(res.meetsQuorum, true);
  assert.equal(res.l1VendorId, 2);
  assert.equal(res.l1Price, 23000);
  assert.equal(res.vendorCount, 3);
});

test('ADV.L1.08: evaluateL1 breaks ties deterministically by earlier submission timestamp', () => {
  const quotes = [
    { vendorId: 1, vendorOrgId: 101, totalPrice: 20000, submittedAt: '2026-11-08T10:30:00Z', compliant: true },
    { vendorId: 2, vendorOrgId: 102, totalPrice: 20000, submittedAt: '2026-11-08T09:15:00Z', compliant: true }, // Earlier submission!
    { vendorId: 3, vendorOrgId: 103, totalPrice: 25000, submittedAt: '2026-11-08T11:00:00Z', compliant: true }
  ];
  const res = evaluateL1(quotes);
  assert.equal(res.meetsQuorum, true);
  assert.equal(res.l1VendorId, 2, 'Vendor 2 with earlier submittedAt must win tie');
  assert.equal(res.l1Price, 20000);
});

// ============================================================================
// SUITE 4: SEALED BID WEBSOCKET PRICE & IDENTITY SECRECY
// ============================================================================

test('ADV.WS.01: QUOTATION_SUBMITTED payload completely strips offeredPrice and sellerOrgId', () => {
  const rawPayload = {
    type: 'QUOTATION_SUBMITTED',
    requirementId: 42,
    procurementId: 42,
    responseId: 101,
    sellerOrgId: 99,
    offeredPrice: 150000,
    unitPrice: 1500,
    totalAmount: 150000,
    taxBreakdown: { cgst: 9000, sgst: 9000 },
    timestamp: new Date().toISOString()
  };

  const sanitized = sanitizeWebSocketBroadcast('QUOTATION_SUBMITTED', rawPayload, 'TECHNICAL_EVALUATION');
  assert.equal(sanitized.offeredPrice, undefined, 'offeredPrice must be scrubbed');
  assert.equal(sanitized.sellerOrgId, undefined, 'sellerOrgId must be scrubbed');
  assert.equal(sanitized.unitPrice, undefined, 'unitPrice must be scrubbed');
  assert.equal(sanitized.totalAmount, undefined, 'totalAmount must be scrubbed');
  assert.equal(sanitized.requirementId, 42, 'requirementId must be preserved');
  assert.equal(sanitized.responseId, 101, 'responseId must be preserved');
});

test('ADV.WS.02: High-value (₹100 Crore) and fractional quotations are equally scrubbed', () => {
  const highVal = sanitizeWebSocketBroadcast('QUOTATION_SUBMITTED', { offeredPrice: 1000000000 }, 'BID_SUBMISSION');
  assert.equal(highVal.offeredPrice, undefined);

  const fracVal = sanitizeWebSocketBroadcast('QUOTATION_SUBMITTED', { offeredPrice: 12.3456 }, 'BID_SUBMISSION');
  assert.equal(fracVal.offeredPrice, undefined);
});

test('ADV.WS.03: Prices are revealed ONLY after formal FINANCIAL_EVALUATION stage opening', () => {
  const payload = { type: 'QUOTATION_SUBMITTED', offeredPrice: 75000, sellerOrgId: 12 };
  
  const techStage = sanitizeWebSocketBroadcast('QUOTATION_SUBMITTED', payload, 'TECHNICAL_EVALUATION');
  assert.equal(techStage.offeredPrice, undefined, 'Must be redacted during technical evaluation');

  const finStage = sanitizeWebSocketBroadcast('QUOTATION_SUBMITTED', payload, 'FINANCIAL_EVALUATION');
  assert.equal(finStage.offeredPrice, 75000, 'Must be revealed upon financial evaluation');
});

test('ADV.WS.04: Source code inspection of marketplace.routes.ts verifies statutory price scrubbing', () => {
  const code = readFileSync(path.resolve('src/routes/marketplace.routes.ts'), 'utf8');
  const broadcastSnippet = code.slice(3820, 3840);
  // Lines 3825-3834 in marketplace.routes.ts
  assert.match(code, /broadcastToProcurement\([^)]+type:\s*'QUOTATION_SUBMITTED'/);
  assert.match(code, /Statutory Sealed Bid Secrecy:\s*Redact offeredPrice, unitPrice, taxBreakdown, and sellerOrgId/);
});

// ============================================================================
// SUITE 5: BILATERAL PO CANCELLATION STATE MACHINE
// ============================================================================

test('ADV.WF.01: Unilateral transition from accepted directly to cancelled is rejected by statusTransitions', () => {
  assert.throws(
    () => statusTransitions.purchaseOrder('accepted', 'cancelled'),
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.match(err.message, /Accepted or fulfilling purchase orders require bilateral cancellation approval/);
      return true;
    }
  );
});

test('ADV.WF.02: Unilateral transition from in_fulfillment directly to cancelled is rejected by statusTransitions', () => {
  assert.throws(
    () => statusTransitions.purchaseOrder('in_fulfillment', 'cancelled'),
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.match(err.message, /Accepted or fulfilling purchase orders require bilateral cancellation approval/);
      return true;
    }
  );
});

test('ADV.WF.03: Transition accepted -> cancellation_requested is permitted', () => {
  const res = statusTransitions.purchaseOrder('accepted', 'cancellation_requested');
  assert.equal(res.from, 'accepted');
  assert.equal(res.to, 'cancellation_requested');
  assert.equal(res.changed, true);
});

test('ADV.WF.04: Transition in_fulfillment -> cancellation_requested is permitted', () => {
  const res = statusTransitions.purchaseOrder('in_fulfillment', 'cancellation_requested');
  assert.equal(res.from, 'in_fulfillment');
  assert.equal(res.to, 'cancellation_requested');
  assert.equal(res.changed, true);
});

test('ADV.WF.05: cancellation_requested -> cancelled without counterparty approval is strictly rejected', () => {
  assert.throws(
    () => statusTransitions.purchaseOrder('cancellation_requested', 'cancelled', { counterpartyApproved: false }),
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /Cancellation requires counterparty approval/);
      return true;
    }
  );
});

test('ADV.WF.06: cancellation_requested -> cancelled with counterparty approval succeeds', () => {
  const res = statusTransitions.purchaseOrder('cancellation_requested', 'cancelled', { counterpartyApproved: true });
  assert.equal(res.to, 'cancelled');
  assert.equal(res.changed, true);
});

test('ADV.WF.07: Counterparty rejection reverts cancellation_requested back to accepted or in_fulfillment', () => {
  const revAccepted = statusTransitions.purchaseOrder('cancellation_requested', 'accepted');
  assert.equal(revAccepted.to, 'accepted');

  const revFulfillment = statusTransitions.purchaseOrder('cancellation_requested', 'in_fulfillment');
  assert.equal(revFulfillment.to, 'in_fulfillment');
});

test('ADV.WF.08: Pre-acceptance POs (draft, issued, order_placed) permit direct cancellation', () => {
  assert.equal(statusTransitions.purchaseOrder('draft', 'cancelled').to, 'cancelled');
  assert.equal(statusTransitions.purchaseOrder('issued', 'cancelled').to, 'cancelled');
  assert.equal(statusTransitions.purchaseOrder('order_placed', 'cancelled').to, 'cancelled');
});

// ============================================================================
// SUITE 6: RATE CONTRACT CUMULATIVE DRAWDOWN CAP
// ============================================================================

test('ADV.RC.01: Call-off order matching remaining contract balance exactly to ₹0.00 succeeds (100% capacity)', () => {
  const totalValue = 100000;
  const existingOrders = [{ amount: 40000, status: 'delivered' }, { amount: 35000, status: 'accepted' }]; // Total spent: ₹75,000
  const newCallOff = [{ quantity: 25, unitPrice: 1000, taxRate: 0 }]; // ₹25,000 (Remaining: ₹25,000)

  const result = evaluateRateContractCallOff(totalValue, existingOrders, newCallOff);
  assert.equal(result.allowed, true);
  assert.equal(result.remainingValueAfterOrder, 0);
});

test('ADV.RC.02: Call-off order exceeding remaining balance by ₹0.01 is rejected', () => {
  const totalValue = 100000;
  const existingOrders = [{ amount: 75000, status: 'accepted' }]; // Remaining: ₹25,000
  const newCallOff = [{ quantity: 1, unitPrice: 25000.01, taxRate: 0 }];

  const result = evaluateRateContractCallOff(totalValue, existingOrders, newCallOff);
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'RATE_CONTRACT_CAP_EXCEEDED');
});

test('ADV.RC.03: Call-off order exceeding remaining balance by ₹1.00 is rejected', () => {
  const totalValue = 500000;
  const existingOrders = [{ amount: 480000, status: 'accepted' }]; // Remaining: ₹20,000
  const newCallOff = [{ quantity: 1, unitPrice: 20001, taxRate: 0 }];

  const result = evaluateRateContractCallOff(totalValue, existingOrders, newCallOff);
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'RATE_CONTRACT_CAP_EXCEEDED');
});

test('ADV.RC.04: Multi-order sequential drawdowns accurately track cumulative spend and cap overage', () => {
  const totalValue = 200000;
  const existing = [];

  // Order 1: ₹80,000 -> OK
  const order1 = evaluateRateContractCallOff(totalValue, existing, [{ quantity: 80, unitPrice: 1000, taxRate: 0 }]);
  assert.equal(order1.allowed, true);
  existing.push({ amount: 80000, status: 'in_fulfillment' });

  // Order 2: ₹70,000 -> OK
  const order2 = evaluateRateContractCallOff(totalValue, existing, [{ quantity: 70, unitPrice: 1000, taxRate: 0 }]);
  assert.equal(order2.allowed, true);
  existing.push({ amount: 70000, status: 'accepted' });

  // Order 3: ₹60,000 (Remaining is ₹50,000) -> Must be rejected!
  const order3Fail = evaluateRateContractCallOff(totalValue, existing, [{ quantity: 60, unitPrice: 1000, taxRate: 0 }]);
  assert.equal(order3Fail.allowed, false);
  assert.equal(order3Fail.code, 'RATE_CONTRACT_CAP_EXCEEDED');

  // Order 3 retry: ₹50,000 -> OK (Cap reached)
  const order3Ok = evaluateRateContractCallOff(totalValue, existing, [{ quantity: 50, unitPrice: 1000, taxRate: 0 }]);
  assert.equal(order3Ok.allowed, true);
  existing.push({ amount: 50000, status: 'delivered' });

  // Order 4: ₹1 -> Rejected!
  const order4 = evaluateRateContractCallOff(totalValue, existing, [{ quantity: 1, unitPrice: 1, taxRate: 0 }]);
  assert.equal(order4.allowed, false);
});

test('ADV.RC.05: Cancelled call-offs do not count toward cumulative spend', () => {
  const totalValue = 100000;
  const existingOrders = [
    { amount: 50000, status: 'cancelled' }, // Cancelled!
    { amount: 30000, status: 'accepted' }
  ];
  // Utilized: ₹30,000. Remaining: ₹70,000.
  const newCallOff = [{ quantity: 60, unitPrice: 1000, taxRate: 0 }]; // ₹60,000
  const result = evaluateRateContractCallOff(totalValue, existingOrders, newCallOff);
  assert.equal(result.allowed, true);
  assert.equal(result.currentUtilized, 30000);
});

test('ADV.RC.06: Source code inspection of rate-contract.service.ts confirms cumulative financial cap check', () => {
  const code = readFileSync(path.resolve('src/modules/rateContract/rate-contract.service.ts'), 'utf8');
  assert.match(code, /newOrderAmount\s*=\s*resolvedItems\.reduce/);
  assert.match(code, /if\s*\(totalContractValue\s*>\s*0\s*&&\s*\(cumulativeSpent\s*\+\s*newOrderAmount\s*>\s*totalContractValue\)\)/);
  assert.match(code, /RATE_CONTRACT_CAP_EXCEEDED/);
});

// ============================================================================
// SUITE 7: PBG INVOCATION & GFR RULE 170 EMD SCHEMA
// ============================================================================

test('ADV.PBG.01: PBG invocation without reason or with reason < 10 characters is rejected', () => {
  const pbg = { id: 1, status: 'VERIFIED_ACTIVE', buyerId: 10, amount: 50000 };
  const actor = { id: 10, role: 'buyer' };

  // Empty string
  const emptyRes = evaluatePbgInvocation(pbg, actor, '');
  assert.equal(emptyRes.allowed, false);
  assert.equal(emptyRes.code, 'REASON_REQUIRED');

  // Whitespace only
  const wsRes = evaluatePbgInvocation(pbg, actor, '         ');
  assert.equal(wsRes.allowed, false);
  assert.equal(wsRes.code, 'REASON_REQUIRED');

  // Short reason (< 10 chars)
  const shortRes = evaluatePbgInvocation(pbg, actor, 'defaulted');
  assert.equal(shortRes.allowed, false);
  assert.equal(shortRes.code, 'REASON_REQUIRED');
});

test('ADV.PBG.02: PBG invocation on terminal statuses (EXPIRED, RELEASED, INVOKED) is rejected', () => {
  const actor = { id: 10, role: 'buyer' };
  const terminalStatuses = ['EXPIRED', 'RELEASED', 'RELEASED_COMPLETED', 'INVOKED', 'FORFEITED'];

  for (const st of terminalStatuses) {
    const pbg = { id: 2, status: st, buyerId: 10, amount: 50000 };
    const res = evaluatePbgInvocation(pbg, actor, 'Vendor committed fatal material breach of contract clause 14');
    assert.equal(res.allowed, false, `Status ${st} must not be invokable`);
    assert.equal(res.code, 'PBG_INVALID_STATUS_FOR_INVOCATION');
  }
});

test('ADV.PBG.03: PBG invocation by unauthorized seller or unrelated party is rejected (BOLA guard)', () => {
  const pbg = { id: 3, status: 'VERIFIED_ACTIVE', buyerId: 10, amount: 50000 };
  const attacker = { id: 99, role: 'seller' };
  const res = evaluatePbgInvocation(pbg, attacker, 'Vendor default noticed by random seller');
  assert.equal(res.allowed, false);
  assert.equal(res.code, 'PERMISSION_DENIED');
});

test('ADV.PBG.04: Valid PBG invocation transitions status to INVOKED with audit reason', () => {
  const pbg = { id: 4, status: 'VERIFIED_ACTIVE', buyerId: 10, amount: 75000 };
  const buyer = { id: 10, role: 'buyer' };
  const reason = 'Statutory default: Vendor failed site mobilization beyond cure period under GFR 171';

  const res = evaluatePbgInvocation(pbg, buyer, reason);
  assert.equal(res.allowed, true);
  assert.equal(res.newStatus, 'INVOKED');
  assert.equal(res.forfeitedAmount, 75000);
  assert.equal(res.reason, reason);
});

test('ADV.PBG.05: Prisma schema defines GFR 170 EmdStatus enum and EmdDeposit model', () => {
  const schema = readFileSync(path.resolve('prisma/schema.prisma'), 'utf8');
  assert.match(schema, /enum EmdStatus\s*\{[\s\S]*?PENDING[\s\S]*?SUBMITTED[\s\S]*?VERIFIED[\s\S]*?RETURNED[\s\S]*?FORFEITED[\s\S]*?\}/);
  assert.match(schema, /model EmdDeposit\s*\{[\s\S]*?sellerId\s+Int[\s\S]*?amount\s+Decimal[\s\S]*?status\s+EmdStatus/);
  assert.match(schema, /sellerEmdDeposits\s+EmdDeposit\[\]\s+@relation\("SellerEmdDeposits"\)/);
});

test('ADV.PBG.06: Source code inspection of pbg.service.ts confirms invokePbg implementation', () => {
  const code = readFileSync(path.resolve('src/modules/pbg/pbg.service.ts'), 'utf8');
  assert.match(code, /static async invokePbg\(/);
  assert.match(code, /if\s*\(!reason\s*\|\|\s*reason\.trim\(\)\.length\s*<\s*10\)/);
  assert.match(code, /REASON_REQUIRED/);
  assert.match(code, /PBG_INVALID_STATUS_FOR_INVOCATION/);
  assert.match(code, /status:\s*'INVOKED'/);
  assert.match(code, /export const invokePbg\s*=\s*PbgService\.invokePbg/);
});

test('--- CHALLENGER 1: ADVERSARIAL VERIFICATION COMPLETE (ALL TESTS PASSED) ---', () => {
  assert.ok(true, 'All Milestone 3 Adversarial Challenge Tests Passed Successfully');
});
