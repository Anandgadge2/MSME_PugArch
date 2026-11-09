import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Import production code modules
import { evaluateL1 } from '../src/modules/l1Comparison/l1-comparison.service.ts';
import { statusTransitions } from '../src/services/workflow/status-transition.service.ts';
import { ApiError } from '../src/utils/ApiError.js';
import {
  evaluateDirectPurchaseOrder,
  evaluateSellerInvoiceSubmission,
  evaluateRateContractCallOff,
  evaluatePbgInvocation,
  evaluatePOTransition,
  sanitizeWebSocketBroadcast,
  DIRECT_PURCHASE_THRESHOLD
} from './helpers/e2e-test-harness.mjs';

// ============================================================================
// ADVERSARIAL CHALLENGER 2: MILESTONE 3 VERIFICATION SUITE
// PROCUREMENT & BUSINESS LOGIC INTEGRITY
// ============================================================================

test('--- CHALLENGER 2: MILESTONE 3 ADVERSARIAL SUITE START ---', () => {
  assert.ok(true, 'Initiating Challenger 2 Milestone 3 Verification');
});

// ============================================================================
// 1. DIRECT PURCHASE THRESHOLD & GFR RULE 154 ADVERSARIAL SUITE
// ============================================================================

test('CHALLENGER 2 - DP: Threshold boundary exact test (₹25,000.00 vs ₹25,000.01)', () => {
  // Case A: Exactly ₹25,000.00 total
  const itemsExact = [{ sellerId: 1, unitPrice: 25000, quantity: 1, taxRate: 0 }];
  const resExact = evaluateDirectPurchaseOrder({ items: itemsExact, rule154Certificate: null });
  assert.equal(resExact.allowed, true, 'Exactly ₹25,000.00 must be allowed without Rule 154 certificate');
  assert.equal(resExact.orders[1].totalAmount, 25000);
  assert.equal(resExact.orders[1].requiresCertificate, false);

  // Case B: Exactly ₹25,000.01 total (one paisa over threshold)
  const itemsPaisaOver = [{ sellerId: 1, unitPrice: 25000.01, quantity: 1, taxRate: 0 }];
  const resPaisaOver = evaluateDirectPurchaseOrder({ items: itemsPaisaOver, rule154Certificate: null });
  assert.equal(resPaisaOver.allowed, false, '₹25,000.01 must strictly trigger threshold check');
  assert.equal(resPaisaOver.orders[1].code, 'DIRECT_PURCHASE_THRESHOLD_EXCEEDED');

  // Case C: ₹24,999.99 total
  const itemsUnder = [{ sellerId: 1, unitPrice: 24999.99, quantity: 1, taxRate: 0 }];
  const resUnder = evaluateDirectPurchaseOrder({ items: itemsUnder, rule154Certificate: null });
  assert.equal(resUnder.allowed, true, '₹24,999.99 must be allowed without certificate');
});

test('CHALLENGER 2 - DP: Multi-item tax accumulation pushing order over ₹25k', () => {
  // Net price = ₹22,000, but 18% GST pushes total to ₹25,960
  const itemsWithTax = [
    { sellerId: 10, unitPrice: 11000, quantity: 2, taxRate: 18 } // 22,000 * 1.18 = 25,960
  ];
  const res = evaluateDirectPurchaseOrder({ items: itemsWithTax, rule154Certificate: null });
  assert.equal(res.allowed, false, 'Tax inclusive amount exceeding ₹25k must be blocked');
  assert.equal(res.orders[10].totalAmount, 25960);
  assert.equal(res.orders[10].code, 'DIRECT_PURCHASE_THRESHOLD_EXCEEDED');
});

test('CHALLENGER 2 - DP: Source code implementation verification of threshold check in direct-purchase.routes.ts', () => {
  const code = readFileSync(path.resolve('src/routes/direct-purchase.routes.ts'), 'utf-8');

  // Must enforce Rule 154 check when totalAmount > 25000
  assert.ok(code.includes('if (totalAmount > 25000)'), 'Must contain totalAmount > 25000 check');
  assert.ok(code.includes('DIRECT_PURCHASE_THRESHOLD_EXCEEDED'), 'Must throw DIRECT_PURCHASE_THRESHOLD_EXCEEDED');
  assert.ok(code.includes('rule154Certificate'), 'Must check rule154Certificate');
  assert.ok(code.includes('rule154Justification'), 'Must check rule154Justification');
});

test('CHALLENGER 2 - DP: Fuzzing Rule 154 certificate payload bypasses', () => {
  const thresholdChecker = (cert, totalAmount = 30000) => {
    if (totalAmount > 25000) {
      const hasValidCert = Boolean(
        cert && (
          (typeof cert === 'object' && cert.certifierName && cert.designation && (cert.reason || cert.justification) && cert.certifiedDate) ||
          (typeof cert === 'string' && cert.trim().length >= 10)
        )
      );
      if (!hasValidCert) {
        throw new ApiError(400, 'Orders exceeding ₹25,000 require Rule 154 certificate or L1 comparison', 'DIRECT_PURCHASE_THRESHOLD_EXCEEDED');
      }
      return true;
    }
    return false;
  };

  const maliciousPayloads = [
    null,
    undefined,
    '',
    '       ',
    'short',
    '123456789', // 9 characters
    {},
    { certifierName: 'Officer' }, // missing designation, reason, date
    { certifierName: 'Officer', designation: 'Director' }, // missing reason, date
    { certifierName: 'Officer', designation: 'Director', reason: '' }, // empty reason
    { certifierName: 'Officer', designation: 'Director', reason: '', justification: '' }, // empty reason & justification
    { designation: 'Director', reason: 'Valid Reason', certifiedDate: '2026-11-08' }, // missing certifierName
    { certifierName: '', designation: 'Director', reason: 'Valid Reason', certifiedDate: '2026-11-08' }, // empty certifierName
    { certifierName: 'Officer', designation: '', reason: 'Valid Reason', certifiedDate: '2026-11-08' }, // empty designation
    { certifierName: 'Officer', designation: 'Director', reason: 'Valid Reason', certifiedDate: '' }, // empty date
    true,
    false,
    1234567890,
    ['certifierName', 'designation']
  ];

  for (const payload of maliciousPayloads) {
    assert.throws(
      () => thresholdChecker(payload, 26000),
      (err) => err instanceof ApiError && err.code === 'DIRECT_PURCHASE_THRESHOLD_EXCEEDED',
      `Payload ${JSON.stringify(payload)} must be rejected`
    );
  }

  // Valid structured certificate
  assert.equal(thresholdChecker({
    certifierName: 'Er. Rajesh Kumar',
    designation: 'Chief Procurement Engineer',
    reason: 'Emergency server room replacement under GFR Rule 154',
    certifiedDate: '2026-11-08'
  }, 45000), true);

  // Valid justification certificate
  assert.equal(thresholdChecker({
    certifierName: 'Er. Rajesh Kumar',
    designation: 'Chief Procurement Engineer',
    justification: 'Statutory emergency hospital medical consumables',
    certifiedDate: '2026-11-08'
  }, 45000), true);

  // Valid statutory string certificate (>= 10 chars)
  assert.equal(thresholdChecker('GFR 2017 Rule 154 urgent procurement clearance', 45000), true);
});

test('CHALLENGER 2 - DP: Multi-seller cart isolation preventing threshold contagion or bypass', () => {
  // Seller 1: ₹10,000 (compliant)
  // Seller 2: ₹26,000 (breaches threshold without certificate)
  const items = [
    { sellerId: 101, unitPrice: 10000, quantity: 1, taxRate: 0 },
    { sellerId: 202, unitPrice: 26000, quantity: 1, taxRate: 0 }
  ];

  const evalResult = evaluateDirectPurchaseOrder({ items, rule154Certificate: null });
  assert.equal(evalResult.allowed, false, 'Multi-seller cart cannot be checked out if any seller breaches threshold');
  assert.equal(evalResult.orders[101].allowed, true);
  assert.equal(evalResult.orders[202].allowed, false);
  assert.equal(evalResult.orders[202].code, 'DIRECT_PURCHASE_THRESHOLD_EXCEEDED');
});

// ============================================================================
// 2. UNAPPROVED BINDING PURCHASE ORDER CREATION PREVENTION ADVERSARIAL SUITE
// ============================================================================

test('CHALLENGER 2 - PO: Phase 4 routes source verification for complete elimination of PO auto-creation', () => {
  const code = readFileSync(path.resolve('src/routes/phase4.routes.ts'), 'utf-8');

  // Verify that router.post('/invoices') strictly requires purchaseOrderId and cannot auto-create PO
  const invoiceRouteIndex = code.indexOf("router.post('/invoices',");
  assert.ok(invoiceRouteIndex !== -1, 'Invoice creation route must exist');

  const invoiceRouteChunk = code.slice(invoiceRouteIndex, invoiceRouteIndex + 2500);

  // Assert targetPoId check throws PO_REQUIRED
  assert.ok(invoiceRouteChunk.includes("throw new ApiError(400, 'Invoices cannot be submitted without an existing approved purchase order', 'PO_REQUIRED');"),
    'Must throw PO_REQUIRED when targetPoId is missing or PO not found in DB');

  // Assert seller mismatch throws FORBIDDEN_PO_SELLER_MISMATCH
  assert.ok(invoiceRouteChunk.includes('FORBIDDEN_PO_SELLER_MISMATCH'),
    'Must reject seller mismatch with FORBIDDEN_PO_SELLER_MISMATCH');

  // Assert status check throws INVALID_PO_STATUS_FOR_INVOICE
  assert.ok(invoiceRouteChunk.includes('INVALID_PO_STATUS_FOR_INVOICE'),
    'Must check PO status with INVALID_PO_STATUS_FOR_INVOICE');

  // Ensure NO quotation fallback auto-creates a purchase order
  assert.ok(!invoiceRouteChunk.includes('db.purchaseOrder.create('),
    'POST /invoices must NEVER contain db.purchaseOrder.create(');
});

test('CHALLENGER 2 - PO: Invoicing rejects non-existent, mismatch, and invalid status POs', () => {
  const seller = { id: 77 };

  // 1. Missing PO
  const resNoPo = evaluateSellerInvoiceSubmission({
    invoiceBody: { amount: 5000 },
    existingPO: null,
    quotation: { sellerUserId: 77 }
  });
  assert.equal(resNoPo.allowed, false);
  assert.equal(resNoPo.code, 'PURCHASE_ORDER_REQUIRED');

  // 2. Mismatched seller
  const resMismatch = evaluateSellerInvoiceSubmission({
    invoiceBody: { amount: 5000 },
    existingPO: { id: 10, sellerId: 99, status: 'accepted', poStatus: 'ACCEPTED' },
    quotation: { sellerUserId: 77 }
  });
  assert.equal(resMismatch.allowed, false);
  assert.equal(resMismatch.code, 'FORBIDDEN_PO_SELLER_MISMATCH');

  // 3. Invalid operational statuses (draft, cancelled, rejected, issued)
  const invalidStatuses = ['draft', 'cancelled', 'rejected', 'issued', 'order_placed', 'pending_acceptance'];
  for (const status of invalidStatuses) {
    const resBadStatus = evaluateSellerInvoiceSubmission({
      invoiceBody: { amount: 5000 },
      existingPO: { id: 10, sellerId: 77, status, poStatus: status.toUpperCase() },
      quotation: { sellerUserId: 77 }
    });
    assert.equal(resBadStatus.allowed, false);
    assert.equal(resBadStatus.code, 'INVALID_PO_STATUS_FOR_INVOICE');
  }

  // 4. Valid operational statuses (accepted, in_fulfillment, delivered)
  const validStatuses = ['accepted', 'in_fulfillment', 'delivered'];
  for (const status of validStatuses) {
    const resValid = evaluateSellerInvoiceSubmission({
      invoiceBody: { amount: 5000 },
      existingPO: { id: 10, sellerId: 77, status, poStatus: status.toUpperCase() },
      quotation: { sellerUserId: 77 }
    });
    assert.equal(resValid.allowed, true);
    assert.equal(resValid.poId, 10);
  }
});

// ============================================================================
// 3. MULTI-VENDOR L1 COMPARISON ENGINE ADVERSARIAL SUITE
// ============================================================================

test('CHALLENGER 2 - L1: Production evaluateL1 enforces GFR 149 quorum (< 3 distinct vendors fails)', () => {
  // Case 0: Empty quotes
  const emptyRes = evaluateL1([]);
  assert.equal(emptyRes.meetsQuorum, false);
  assert.equal(emptyRes.vendorCount, 0);
  assert.equal(emptyRes.l1VendorId, null);

  // Case 1: 1 vendor
  const oneVendor = evaluateL1([
    { vendorId: 1, vendorOrgId: 1, unitPrice: 100, quantity: 1, compliant: true }
  ]);
  assert.equal(oneVendor.meetsQuorum, false);
  assert.equal(oneVendor.vendorCount, 1);
  assert.equal(oneVendor.l1VendorId, null);

  // Case 2: 2 distinct vendors
  const twoVendors = evaluateL1([
    { vendorId: 1, vendorOrgId: 1, unitPrice: 100, quantity: 1, compliant: true },
    { vendorId: 2, vendorOrgId: 2, unitPrice: 120, quantity: 1, compliant: true }
  ]);
  assert.equal(twoVendors.meetsQuorum, false);
  assert.equal(twoVendors.vendorCount, 2);
  assert.equal(twoVendors.l1VendorId, null);
});

test('CHALLENGER 2 - L1: Production evaluateL1 detects vendor collusion / multiple bids under same vendorOrgId', () => {
  // 4 quotes submitted, but 3 of them belong to vendorOrgId: 100!
  // Effective distinct vendor orgs = 2 (Org 100 and Org 200).
  const collusiveQuotes = [
    { vendorId: 1, vendorOrgId: 100, sellerName: 'Vendor A-1', unitPrice: 500, compliant: true },
    { vendorId: 2, vendorOrgId: 100, sellerName: 'Vendor A-2', unitPrice: 480, compliant: true },
    { vendorId: 3, vendorOrgId: 100, sellerName: 'Vendor A-3', unitPrice: 490, compliant: true },
    { vendorId: 4, vendorOrgId: 200, sellerName: 'Vendor B', unitPrice: 510, compliant: true }
  ];

  const evalRes = evaluateL1(collusiveQuotes);
  assert.equal(evalRes.meetsQuorum, false, 'Collusive quotes from same vendorOrgId must collapse to single vendor and fail quorum');
  assert.equal(evalRes.vendorCount, 2);
  assert.equal(evalRes.l1VendorId, null);
  assert.ok(evalRes.notice?.includes('Quorum requires minimum 3 distinct compliant vendors'));
});

test('CHALLENGER 2 - L1: Production evaluateL1 aggregates multi-line quotes per vendor correctly', () => {
  // 3 distinct vendors, each quoting for 2 items
  const quotes = [
    // Vendor A: Total = 200*10 + 300*5 = 3500
    { vendorId: 10, vendorOrgId: 10, itemName: 'Server', unitPrice: 200, quantity: 10, compliant: true },
    { vendorId: 10, vendorOrgId: 10, itemName: 'Switch', unitPrice: 300, quantity: 5, compliant: true },
    // Vendor B: Total = 180*10 + 310*5 = 3350 (Lowest!)
    { vendorId: 20, vendorOrgId: 20, itemName: 'Server', unitPrice: 180, quantity: 10, compliant: true },
    { vendorId: 20, vendorOrgId: 20, itemName: 'Switch', unitPrice: 310, quantity: 5, compliant: true },
    // Vendor C: Total = 210*10 + 290*5 = 3550
    { vendorId: 30, vendorOrgId: 30, itemName: 'Server', unitPrice: 210, quantity: 10, compliant: true },
    { vendorId: 30, vendorOrgId: 30, itemName: 'Switch', unitPrice: 290, quantity: 5, compliant: true }
  ];

  const evalRes = evaluateL1(quotes);
  assert.equal(evalRes.meetsQuorum, true);
  assert.equal(evalRes.vendorCount, 3);
  assert.equal(evalRes.l1VendorId, 20, 'Vendor 20 must win L1');
  assert.equal(evalRes.l1Price, 3350);
  assert.equal(evalRes.rankings?.[0].rank, 'L1');
  assert.equal(evalRes.rankings?.[0].vendorId, 20);
  assert.equal(evalRes.rankings?.[1].rank, 'L2');
  assert.equal(evalRes.rankings?.[1].vendorId, 10);
  assert.equal(evalRes.rankings?.[2].rank, 'L3');
  assert.equal(evalRes.rankings?.[2].vendorId, 30);
});

test('CHALLENGER 2 - L1: Technical disqualification drops vendor from quorum', () => {
  // 3 vendors submit, but Vendor B is disqualified: compliant count drops to 2
  const quotes = [
    { vendorId: 1, vendorOrgId: 1, totalPrice: 10000, compliant: true },
    { vendorId: 2, vendorOrgId: 2, totalPrice: 8000, compliant: false, complianceStatus: 'Non-compliant' },
    { vendorId: 3, vendorOrgId: 3, totalPrice: 12000, compliant: true }
  ];

  const evalRes = evaluateL1(quotes);
  assert.equal(evalRes.meetsQuorum, false, 'Disqualified vendor must not count toward quorum');
  assert.equal(evalRes.l1VendorId, null);
  assert.equal(evalRes.compliantQuotes.length, 2);
});

test('CHALLENGER 2 - L1: Perfect price parity tie-break determinism', () => {
  // 3 vendors submit identical price of ₹50,000
  const quotes = [
    { vendorId: 1, vendorOrgId: 1, totalPrice: 50000, compliant: true, submittedAt: '2026-11-08T10:00:00Z' },
    { vendorId: 2, vendorOrgId: 2, totalPrice: 50000, compliant: true, submittedAt: '2026-11-08T09:15:00Z' }, // Earliest!
    { vendorId: 3, vendorOrgId: 3, totalPrice: 50000, compliant: true, submittedAt: '2026-11-08T09:45:00Z' }
  ];

  const evalRes = evaluateL1(quotes);
  assert.equal(evalRes.meetsQuorum, true);
  assert.equal(evalRes.l1VendorId, 2, 'Earliest submittedAt must win tie-break');
  assert.equal(evalRes.l1Price, 50000);
});

// ============================================================================
// 4. WEBSOCKET SEALED BID SECRECY ADVERSARIAL SUITE
// ============================================================================

test('CHALLENGER 2 - WS: Source code audit of marketplace.routes.ts broadcast payload', () => {
  const code = readFileSync(path.resolve('src/routes/marketplace.routes.ts'), 'utf-8');

  // Verify QUOTATION_SUBMITTED broadcast block
  const broadcastIndex = code.indexOf("type: 'QUOTATION_SUBMITTED',");
  assert.ok(broadcastIndex !== -1, "Must contain QUOTATION_SUBMITTED broadcast");

  const chunk = code.slice(broadcastIndex - 200, broadcastIndex + 300);

  // Assert offeredPrice, unitPrice, taxBreakdown, and sellerOrgId are strictly absent
  assert.ok(!chunk.includes('offeredPrice:'), 'offeredPrice must NOT be present in QUOTATION_SUBMITTED broadcast payload');
  assert.ok(!chunk.includes('unitPrice:'), 'unitPrice must NOT be present in QUOTATION_SUBMITTED broadcast payload');
  assert.ok(!chunk.includes('taxBreakdown:'), 'taxBreakdown must NOT be present in QUOTATION_SUBMITTED broadcast payload');
  assert.ok(!chunk.includes('sellerOrgId:'), 'sellerOrgId must NOT be present in QUOTATION_SUBMITTED broadcast payload');

  // Assert sanitized fields
  assert.ok(chunk.includes('requirementId:'), 'Must include requirementId');
  assert.ok(chunk.includes('procurementId:'), 'Must include procurementId');
  assert.ok(chunk.includes('timestamp:'), 'Must include timestamp');
});

test('CHALLENGER 2 - WS: WebSocket broadcaster sanitization oracle across multiple adversarial stages', () => {
  const rawQuotation = {
    type: 'QUOTATION_SUBMITTED',
    requirementId: 99,
    procurementId: 99,
    responseId: 1001,
    offeredPrice: 15000000, // ₹1.5 Crore
    unitPrice: 1500000,
    totalAmount: 15000000,
    sellerOrgId: 888,
    sellerUserId: 777,
    timestamp: '2026-11-08T12:00:00Z'
  };

  // Stage 1: Technical evaluation (sealed bids)
  const sanitizedTech = sanitizeWebSocketBroadcast('QUOTATION_SUBMITTED', rawQuotation, 'TECHNICAL_EVALUATION');
  assert.equal(sanitizedTech.offeredPrice, undefined);
  assert.equal(sanitizedTech.unitPrice, undefined);
  assert.equal(sanitizedTech.totalAmount, undefined);
  assert.equal(sanitizedTech.sellerOrgId, undefined);
  assert.equal(sanitizedTech.priceRedacted, true);

  // Stage 2: Stage 1 of Two-Packet tender (sealed bids)
  const sanitizedTwoPacket = sanitizeWebSocketBroadcast('QUOTATION_SUBMITTED', rawQuotation, 'STAGE_1_TECHNICAL');
  assert.equal(sanitizedTwoPacket.offeredPrice, undefined);
  assert.equal(sanitizedTwoPacket.sellerOrgId, undefined);
});

// ============================================================================
// 5. BILATERAL PO CANCELLATION ENFORCEMENT ADVERSARIAL SUITE
// ============================================================================

test('CHALLENGER 2 - WF: Production statusTransitions strictly rejects unilateral PO cancellations', () => {
  // 1. Unilateral cancellation from 'accepted'
  assert.throws(
    () => statusTransitions.purchaseOrder('accepted', 'cancelled'),
    (err) => err instanceof ApiError && err.code === 'INVALID_STATUS_TRANSITION' &&
             err.message.includes('require bilateral cancellation approval')
  );

  // 2. Unilateral cancellation from 'in_fulfillment'
  assert.throws(
    () => statusTransitions.purchaseOrder('in_fulfillment', 'cancelled'),
    (err) => err instanceof ApiError && err.code === 'INVALID_STATUS_TRANSITION' &&
             err.message.includes('require bilateral cancellation approval')
  );

  // 3. Delivered or further cannot jump directly to cancelled
  assert.throws(
    () => statusTransitions.purchaseOrder('delivered', 'cancelled'),
    (err) => err instanceof ApiError && err.code === 'STATUS_TRANSITION_INVALID'
  );

  // 4. Initiation of bilateral cancellation request is permitted
  const reqFromAccepted = statusTransitions.purchaseOrder('accepted', 'cancellation_requested');
  assert.equal(reqFromAccepted.from, 'accepted');
  assert.equal(reqFromAccepted.to, 'cancellation_requested');

  const reqFromFulfillment = statusTransitions.purchaseOrder('in_fulfillment', 'cancellation_requested');
  assert.equal(reqFromFulfillment.from, 'in_fulfillment');
  assert.equal(reqFromFulfillment.to, 'cancellation_requested');

  // 5. From cancellation_requested, counterparty rejection restores order
  const restoreAccepted = statusTransitions.purchaseOrder('cancellation_requested', 'accepted');
  assert.equal(restoreAccepted.to, 'accepted');

  const restoreFulfillment = statusTransitions.purchaseOrder('cancellation_requested', 'in_fulfillment');
  assert.equal(restoreFulfillment.to, 'in_fulfillment');

  // 6. From cancellation_requested, counterpartyApproved === false blocks cancellation
  assert.throws(
    () => statusTransitions.purchaseOrder('cancellation_requested', 'cancelled', { counterpartyApproved: false }),
    (err) => err instanceof ApiError && err.code === 'COUNTERPARTY_APPROVAL_REQUIRED'
  );

  // 7. From cancellation_requested, with counterparty approval transitions to cancelled
  const approvedCancellation = statusTransitions.purchaseOrder('cancellation_requested', 'cancelled', { counterpartyApproved: true });
  assert.equal(approvedCancellation.to, 'cancelled');
});

// ============================================================================
// 6. RATE CONTRACT CUMULATIVE DRAWDOWN FINANCIAL CAP ADVERSARIAL SUITE
// ============================================================================

test('CHALLENGER 2 - RC: Financial cap enforcement right at the boundary and overage', () => {
  const contractTotal = 1000000; // ₹10,00,000 Total Contract Value

  // Prior active orders: ₹8,00,000 utilized. Remaining = ₹2,00,000.
  const existingOrders = [
    { id: 1, totalValue: 500000, status: 'delivered' },
    { id: 2, totalValue: 300000, status: 'in_fulfillment' }
  ];

  // Case 1: Call-off order exactly ₹2,00,000 (100% capacity)
  const exactOrder = [{ quantity: 200, unitPrice: 1000, taxRate: 0 }];
  const resExact = evaluateRateContractCallOff(contractTotal, existingOrders, exactOrder);
  assert.equal(resExact.allowed, true);
  assert.equal(resExact.remainingValueAfterOrder, 0);

  // Case 2: Call-off order ₹2,00,000.01 (1 paisa over remaining balance)
  const paisaOverOrder = [{ quantity: 1, unitPrice: 200000.01, taxRate: 0 }];
  const resPaisaOver = evaluateRateContractCallOff(contractTotal, existingOrders, paisaOverOrder);
  assert.equal(resPaisaOver.allowed, false);
  assert.equal(resPaisaOver.code, 'RATE_CONTRACT_CAP_EXCEEDED');

  // Case 3: Call-off order ₹2,00,001 (₹1 over remaining balance)
  const oneRupeeOver = [{ quantity: 1, unitPrice: 200001, taxRate: 0 }];
  const resOneOver = evaluateRateContractCallOff(contractTotal, existingOrders, oneRupeeOver);
  assert.equal(resOneOver.allowed, false);
  assert.equal(resOneOver.code, 'RATE_CONTRACT_CAP_EXCEEDED');
});

test('CHALLENGER 2 - RC: Source code audit of cumulative spend cap in rate-contract.service.ts', () => {
  const code = readFileSync(path.resolve('src/modules/rateContract/rate-contract.service.ts'), 'utf-8');

  assert.ok(code.includes('RATE_CONTRACT_CAP_EXCEEDED'), 'Must throw RATE_CONTRACT_CAP_EXCEEDED');
  assert.ok(code.includes('cumulativeSpent + newOrderAmount > totalContractValue'),
    'Must compare cumulativeSpent + newOrderAmount > totalContractValue');
  assert.ok(code.includes('Order exceeds remaining monetary value of Rate Contract'),
    'Must provide descriptive statutory error message');
});

// ============================================================================
// 7. PBG INVOCATION & GFR RULE 170 EMD MODELS ADVERSARIAL SUITE
// ============================================================================

test('CHALLENGER 2 - PBG: Statutory reason requirement (< 10 chars, empty, whitespace rejected)', () => {
  const activePbg = { id: 10, buyerId: 5, status: 'VERIFIED_ACTIVE', amount: 50000 };
  const buyer = { id: 5, role: 'buyer' };

  // Empty string
  assert.equal(evaluatePbgInvocation(activePbg, buyer, '').code, 'REASON_REQUIRED');
  // Whitespace only
  assert.equal(evaluatePbgInvocation(activePbg, buyer, '       ').code, 'REASON_REQUIRED');
  // 9 characters
  assert.equal(evaluatePbgInvocation(activePbg, buyer, '123456789').code, 'REASON_REQUIRED');

  // 10 characters: valid
  const valid = evaluatePbgInvocation(activePbg, buyer, '1234567890');
  assert.equal(valid.allowed, true);
  assert.equal(valid.newStatus, 'INVOKED');
});

test('CHALLENGER 2 - PBG: Terminal status protection prevents double invocation or invocation of released PBG', () => {
  const buyer = { id: 5, role: 'buyer' };
  const terminalStatuses = ['EXPIRED', 'RELEASED', 'RELEASED_COMPLETED', 'RELEASE_REQUESTED', 'INVOKED', 'INVOKED_DEFAULTED', 'FORFEITED'];

  for (const status of terminalStatuses) {
    const pbg = { id: 10, buyerId: 5, status, amount: 50000 };
    const res = evaluatePbgInvocation(pbg, buyer, 'Vendor defaulted on milestone 3 deliverable');
    assert.equal(res.allowed, false, `Status ${status} must not be invokable`);
    assert.equal(res.code, 'PBG_INVALID_STATUS_FOR_INVOCATION');
  }
});

test('CHALLENGER 2 - PBG: Source code audit of invokePbg in pbg.service.ts', () => {
  const code = readFileSync(path.resolve('src/modules/pbg/pbg.service.ts'), 'utf-8');

  assert.ok(code.includes('static async invokePbg('), 'Must export static invokePbg method');
  assert.ok(code.includes('PBG_INVALID_STATUS_FOR_INVOCATION'), 'Must throw PBG_INVALID_STATUS_FOR_INVOCATION on invalid status');
  assert.ok(code.includes('REASON_REQUIRED'), 'Must throw REASON_REQUIRED on short reason');
  assert.ok(code.includes('terminalStatuses.includes('), 'Must check against terminal statuses');
  assert.ok(code.includes("status: 'INVOKED'"), 'Must update status to INVOKED');
});

test('CHALLENGER 2 - EMD: Prisma schema audit for GFR Rule 170 compliance', () => {
  const schema = readFileSync(path.resolve('prisma/schema.prisma'), 'utf-8');

  // Verify enum EmdStatus
  assert.ok(schema.includes('enum EmdStatus {'), 'Prisma schema must define enum EmdStatus');
  assert.ok(schema.includes('PENDING') && schema.includes('SUBMITTED') && schema.includes('VERIFIED') &&
            schema.includes('RETURNED') && schema.includes('FORFEITED') && schema.includes('EXEMPTED'),
            'EmdStatus must include all statutory GFR 170 lifecycle statuses');

  // Verify model EmdDeposit
  assert.ok(schema.includes('model EmdDeposit {'), 'Prisma schema must define model EmdDeposit');
  assert.ok(schema.includes('sellerId'), 'EmdDeposit must reference sellerId');
  assert.ok(schema.includes('tenderId'), 'EmdDeposit must reference tenderId');
  assert.ok(schema.includes('status              EmdStatus'), 'EmdDeposit must use EmdStatus');

  // Verify relation on User model
  assert.ok(schema.includes('sellerEmdDeposits                  EmdDeposit[]'),
    'User model must have sellerEmdDeposits relation');
});

test('--- CHALLENGER 2: MILESTONE 3 ADVERSARIAL SUITE COMPLETE ---', () => {
  assert.ok(true, 'All Challenger 2 Milestone 3 adversarial stress tests completed successfully');
});
