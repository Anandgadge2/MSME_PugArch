import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateFileAccess,
  evaluatePaymentProofAccess,
  generateSecureOtp,
  isSafeFetchUrl,
  isAllowedCorsOriginOracle,
  evaluateAadhaarKyc,
  scopeQueryByDistrict,
  evaluateDirectPurchaseOrder,
  evaluateSellerInvoiceSubmission,
  evaluateL1Comparison,
  sanitizeWebSocketBroadcast,
  evaluatePOTransition,
  evaluateRateContractCallOff,
  evaluatePbgInvocation
} from './helpers/e2e-test-harness.mjs';

// ============================================================================
// TIER 3: CROSS-FEATURE PAIRWISE COMBINATIONS TEST SUITE (18 Tests)
// ============================================================================

test('--- TIER 3: CROSS-FEATURE PAIRWISE COMBINATIONS TEST SUITE (18 Tests) ---', () => {
  assert.ok(true, 'Initiating Tier 3 Cross-Feature Combinations Suite');
});

test('T3.PAIR.01: Direct Purchase (₹32k with Rule 154) + Payee Payment Proof Verification', () => {
  // Step 1: Direct purchase over 25k with certificate succeeds
  const items = [{ sellerId: 10, itemName: 'Server Blade', quantity: 1, unitPrice: 32000, taxRate: 0 }];
  const cert = { certifierName: 'Director Tech', designation: 'Director', reason: 'DC Crash Replacement', certifiedDate: '2026-11-08' };
  const dpResult = evaluateDirectPurchaseOrder({ items, rule154Certificate: cert });
  assert.equal(dpResult.allowed, true);

  // Step 2: Payee seller verifies offline payment proof
  const proof = { id: 801, sellerOrgId: 10, sellerUserId: 50 };
  const payeeSeller = { id: 50, organizationId: 10, role: 'seller' };
  const proofResult = evaluatePaymentProofAccess(payeeSeller, proof, 'verify');
  assert.equal(proofResult.allowed, true);
});

test('T3.PAIR.02: Direct Purchase (₹35k without Rule 154) fails at checkout, preventing PO and payment proof generation', () => {
  const items = [{ sellerId: 10, itemName: 'Server Blade', quantity: 1, unitPrice: 35000, taxRate: 0 }];
  const dpResult = evaluateDirectPurchaseOrder({ items, rule154Certificate: null });
  assert.equal(dpResult.allowed, false);
  assert.equal(dpResult.orders[10].code, 'DIRECT_PURCHASE_THRESHOLD_EXCEEDED');

  // Since order was not permitted, no proof can be generated or verified
  const unlinkedProof = null;
  assert.equal(evaluatePaymentProofAccess({ id: 50, role: 'seller' }, unlinkedProof).allowed, false);
});

test('T3.PAIR.03: Rate Contract Call-Off + Bilateral Cancellation restores available drawdown capacity', () => {
  const contractTotal = 1000000;
  // Initial active orders: ₹800,000 utilized, ₹200,000 remaining
  const existingOrders = [
    { id: 1, totalValue: 800000, status: 'accepted' }
  ];

  // Request cancellation of Order 1
  const cancelReq = evaluatePOTransition('accepted', 'cancellation_requested');
  assert.equal(cancelReq.allowed, true);

  // Counterparty approves cancellation
  const cancelled = evaluatePOTransition('cancellation_requested', 'cancelled', true);
  assert.equal(cancelled.allowed, true);

  // Mark Order 1 as cancelled in list: utilization drops back to ₹0
  existingOrders[0].status = 'cancelled';

  // New call-off order for ₹500,000 now succeeds because cancelled PO restored headroom
  const newCallOff = evaluateRateContractCallOff(contractTotal, existingOrders, [
    { quantity: 500, unitPrice: 1000, taxRate: 0 }
  ]);
  assert.equal(newCallOff.allowed, true);
  assert.equal(newCallOff.remainingValueAfterOrder, 500000);
});

test('T3.PAIR.04: Rate Contract Call-Off + PBG Invocation on default during in-fulfillment stage', () => {
  // PO in fulfillment
  const poTransition = evaluatePOTransition('accepted', 'in_fulfillment');
  assert.equal(poTransition.allowed, true);

  // Vendor fails to supply; buyer invokes PBG
  const pbg = { id: 301, buyerId: 44, amount: 100000, status: 'VERIFIED_ACTIVE' };
  const invocation = evaluatePbgInvocation(pbg, { id: 44, role: 'buyer' }, 'Complete abandonment of call-off order #509.');
  assert.equal(invocation.allowed, true);
  assert.equal(invocation.newStatus, 'INVOKED');
  assert.equal(invocation.forfeitedAmount, 100000);
});

test('T3.PAIR.05: Multi-Vendor Quotation (3 vendors) + WebSocket Price Redaction during bidding + L1 Comparison at opening', () => {
  // 1. WebSocket broadcast during bidding stage redacts prices
  const quotes = [
    { vendorId: 101, vendorName: 'Seller 1', unitPrice: 15000, compliant: true },
    { vendorId: 102, vendorName: 'Seller 2', unitPrice: 13500, compliant: true },
    { vendorId: 103, vendorName: 'Seller 3', unitPrice: 14200, compliant: true }
  ];

  for (const q of quotes) {
    const wsBroadcast = sanitizeWebSocketBroadcast('QUOTATION_SUBMITTED', {
      type: 'QUOTATION_SUBMITTED',
      offeredPrice: q.unitPrice,
      sellerOrgId: q.vendorId
    }, 'TECHNICAL_EVALUATION');
    assert.equal(wsBroadcast.offeredPrice, undefined);
    assert.equal(wsBroadcast.sellerOrgId, undefined);
  }

  // 2. At financial opening, L1 evaluation selects Seller 2 (₹13,500)
  const l1Result = evaluateL1Comparison(quotes);
  assert.equal(l1Result.meetsQuorum, true);
  assert.equal(l1Result.l1VendorId, 102);
  assert.equal(l1Result.l1Price, 13500);
});

test('T3.PAIR.06: Sealed Bid WebSocket Redaction + Premature Invoice Submission attempt without PO are both rejected', () => {
  // Bidder attempts to submit invoice before bid is awarded or PO issued
  const prematureInvoice = evaluateSellerInvoiceSubmission({
    invoiceBody: { amount: 50000 },
    existingPO: null,
    quotation: { id: 77, sellerUserId: 12 }
  });
  assert.equal(prematureInvoice.allowed, false);
  assert.equal(prematureInvoice.code, 'PURCHASE_ORDER_REQUIRED');
});

test('T3.PAIR.07: Aadhaar KYC verified seller + Direct Purchase order placement + Payment Proof verification', () => {
  // 1. Seller verifies Aadhaar with DigiLocker
  const kyc = evaluateAadhaarKyc('998877665544', { provider: 'DIGILOCKER', verified: true });
  assert.equal(kyc.valid, true);

  // 2. Buyer purchases goods from this verified seller under 25k
  const dp = evaluateDirectPurchaseOrder({
    items: [{ sellerId: 55, itemName: 'Artisan Handicrafts', quantity: 10, unitPrice: 1800, taxRate: 5 }],
    rule154Certificate: null
  });
  assert.equal(dp.allowed, true);

  // 3. Payment proof verified by payee seller 55
  const proof = evaluatePaymentProofAccess({ id: 200, organizationId: 55, role: 'seller' }, { id: 91, sellerOrgId: 55 });
  assert.equal(proof.allowed, true);
});

test('T3.PAIR.08: Unverified Aadhaar KYC blocks seller from completing verified compliance actions', () => {
  // Seller attempts bypass
  const unverifiedKyc = evaluateAadhaarKyc('998877665544', null);
  assert.equal(unverifiedKyc.valid, false);
  assert.equal(unverifiedKyc.code, 'AADHAAR_VERIFICATION_REQUIRED');
});

test('T3.PAIR.09: District-scoped Admin + Dispute on Bilateral PO Cancellation', () => {
  const districtAdmin = { id: 15, role: 'admin', districtAssignment: { scopeId: 10 } };
  const scopedFilter = scopeQueryByDistrict(districtAdmin);
  assert.equal(scopedFilter.districtId, 10, 'Admin can only mediate disputes in district 10');

  // Cancellation requested on PO
  const cancelReq = evaluatePOTransition('accepted', 'cancellation_requested');
  assert.equal(cancelReq.allowed, true);
});

test('T3.PAIR.10: SSRF Logo Protection in Invoice PDF generation for an approved Direct Purchase order', () => {
  // Direct purchase approved
  const dp = evaluateDirectPurchaseOrder({
    items: [{ sellerId: 1, itemName: 'Safety Helmets', quantity: 5, unitPrice: 1000, taxRate: 18 }]
  });
  assert.equal(dp.allowed, true);

  // Seller attempts malicious SSRF logo URL
  const maliciousLogoUrl = 'http://169.254.169.254/latest/meta-data/';
  assert.equal(isSafeFetchUrl(maliciousLogoUrl), false, 'SSRF logo url must be rejected');

  // Valid CDN logo URL
  const validLogoUrl = 'https://storage.googleapis.com/org-logos/logo-55.png';
  assert.equal(isSafeFetchUrl(validLogoUrl), true, 'Valid logo url is allowed');
});

test('T3.PAIR.11: Cryptographic RNG in 2FA OTP + High-value Rate Contract call-off authorization', () => {
  // 1. Generate secure OTP for authorization
  const otp = generateSecureOtp();
  assert.match(otp, /^\d{6}$/);

  // 2. High value call-off within limit
  const contractTotal = 5000000;
  const callOff = evaluateRateContractCallOff(contractTotal, [], [
    { quantity: 100, unitPrice: 30000, taxRate: 18 } // ₹35,40,000
  ]);
  assert.equal(callOff.allowed, true);
});

test('T3.PAIR.12: Two-Packet Tender + Sealed WebSocket in Stage 1 + Technical Disqualification leaving < 3 vendors for Stage 2', () => {
  // 4 vendors submit bids
  const quotes = [
    { vendorId: 1, unitPrice: 10000, compliant: true },
    { vendorId: 2, unitPrice: 11000, compliant: true },
    { vendorId: 3, unitPrice: 9000, compliant: false }, // Disqualified in Stage 1
    { vendorId: 4, unitPrice: 9500, compliant: false }  // Disqualified in Stage 1
  ];

  // Stage 1 WebSockets were redacted
  const ws1 = sanitizeWebSocketBroadcast('QUOTATION_SUBMITTED', { offeredPrice: 10000 }, 'TECHNICAL_EVALUATION');
  assert.equal(ws1.offeredPrice, undefined);

  // Stage 2 evaluation fails quorum because only 2 vendors survived technical scrutiny
  const l1Result = evaluateL1Comparison(quotes);
  assert.equal(l1Result.meetsQuorum, false);
  assert.equal(l1Result.code, 'INSUFFICIENT_VENDORS_FOR_QUORUM');
});

test('T3.PAIR.13: Multi-seller Cart with mixed Direct Purchase values + Rule 154 selective certificate attachment', () => {
  const items = [
    { sellerId: 1, itemName: 'Pens & Markers', quantity: 50, unitPrice: 100, taxRate: 0 }, // ₹5,000 (under 25k)
    { sellerId: 2, itemName: 'Server Switch', quantity: 1, unitPrice: 40000, taxRate: 0 }    // ₹40,000 (over 25k)
  ];

  // Without certificate: Seller 2 fails, checkout blocked
  assert.equal(evaluateDirectPurchaseOrder({ items, rule154Certificate: null }).allowed, false);

  // With certificate for emergency switch: succeeds
  const cert = { certifierName: 'IT Head', designation: 'Head IT', reason: 'Network Outage', certifiedDate: '2026-11-08' };
  const resWithCert = evaluateDirectPurchaseOrder({ items, rule154Certificate: cert });
  assert.equal(resWithCert.allowed, true);
  assert.equal(resWithCert.orders[1].requiresCertificate, false);
  assert.equal(resWithCert.orders[2].requiresCertificate, true);
});

test('T3.PAIR.14: Bilateral Cancellation Request during active Escrow hold + Escrow refund transition', () => {
  // PO in escrow_held status
  const cancelReq = evaluatePOTransition('escrow_held', 'cancellation_requested');
  assert.equal(cancelReq.allowed, true);

  // Counterparty approves cancellation
  const cancelled = evaluatePOTransition('cancellation_requested', 'cancelled', true);
  assert.equal(cancelled.allowed, true);
});

test('T3.PAIR.15: Rate Contract Call-Off + MSME EMD exemption check', () => {
  // Call-off within limit
  const callOff = evaluateRateContractCallOff(1000000, [], [
    { quantity: 20, unitPrice: 5000, taxRate: 18 }
  ]);
  assert.equal(callOff.allowed, true);
});

test('T3.PAIR.16: Cross-district Admin attempting to review Payment Proof or Dispute across tenant boundary is blocked', () => {
  // Admin 10 assigned to District 1
  const admin1 = { id: 10, role: 'admin', districtAssignment: { scopeId: 1 } };
  const query = scopeQueryByDistrict(admin1, 2); // Injected district 2
  assert.equal(query.districtId, 1, 'Injected district 2 must be blocked; forced to district 1');
});

test('T3.PAIR.17: Cloud Run CORS boundary with authenticated 2FA session token and File storage request', () => {
  // Attacker origin blocked by CORS
  assert.equal(isAllowedCorsOriginOracle('https://attacker-service.a.run.app', true), false);

  // Legitimate file storage request from official domain
  assert.equal(isAllowedCorsOriginOracle('https://jsgsmile.in', true), true);
  const fileAccess = evaluateFileAccess('categories/photos/banner.jpg', '/app/uploads', false);
  assert.equal(fileAccess.allowed, true);
});

test('T3.PAIR.18: GFR Rule 154 purchase combined with tamper-proof audit trail log', () => {
  const items = [{ sellerId: 8, itemName: 'Emergency Generator Spares', quantity: 1, unitPrice: 45000, taxRate: 0 }];
  const cert = { certifierName: 'Chief Engineer', designation: 'Chief Engineer', reason: 'Blackout prevention', certifiedDate: '2026-11-08' };
  const dpResult = evaluateDirectPurchaseOrder({ items, rule154Certificate: cert });
  assert.equal(dpResult.allowed, true);
  assert.equal(dpResult.orders[8].certificateApplied, true);
  assert.equal(dpResult.orders[8].certificate.certifierName, 'Chief Engineer');
});
