import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateFileAccess,
  evaluatePaymentProofAccess,
  generateSecureOtp,
  generateSecureToken,
  isSafeFetchUrl,
  isAllowedCorsOriginOracle,
  evaluateAadhaarKyc,
  evaluateDirectPurchaseOrder,
  evaluateSellerInvoiceSubmission,
  evaluateL1Comparison,
  sanitizeWebSocketBroadcast,
  evaluatePOTransition,
  evaluateRateContractCallOff,
  evaluatePbgInvocation
} from './helpers/e2e-test-harness.mjs';

// ============================================================================
// TIER 1: FEATURE COVERAGE SUITE (>= 5 tests per feature area)
// ============================================================================

test('--- TIER 1: FEATURE COVERAGE TEST SUITE (34 Tests) ---', () => {
  assert.ok(true, 'Initiating Tier 1 Feature Coverage Suite');
});

// ----------------------------------------------------------------------------
// FEATURE 1: CRITICAL SECURITY & VAPT VULNERABILITY REMEDIATIONS
// ----------------------------------------------------------------------------

test('T1.SEC.01: Path traversal protection strictly bounds file resolution to base directory', () => {
  const baseDir = '/app/uploads';
  // Input: Attacker key trying directory traversal
  const attackKey = '../../etc/passwd';
  const result = evaluateFileAccess(attackKey, baseDir, true);

  assert.equal(result.allowed, false, 'Path traversal must be forbidden');
  assert.equal(result.code, 'PATH_TRAVERSAL_DETECTED');
  assert.equal(result.status, 403);
});

test('T1.SEC.02: Public storage whitelist allows unauthenticated access strictly for categories/photos/', () => {
  const baseDir = '/app/uploads';
  const publicPhotoKey = 'categories/photos/electronics-sample.png';
  const unauthPublicResult = evaluateFileAccess(publicPhotoKey, baseDir, false);
  assert.equal(unauthPublicResult.allowed, true, 'categories/photos/ must be publicly accessible');
  assert.equal(unauthPublicResult.status, 200);

  const privateKey = 'invoices/sensitive-tax-invoice-109.pdf';
  const unauthPrivateResult = evaluateFileAccess(privateKey, baseDir, false);
  assert.equal(unauthPrivateResult.allowed, false, 'Non-public files require authentication');
  assert.equal(unauthPrivateResult.status, 401);
  assert.equal(unauthPrivateResult.code, 'AUTHENTICATION_REQUIRED');
});

test('T1.SEC.03: BOLA payment proof authorization allows payee merchant with matching sellerOrgId', () => {
  const proof = { id: 101, sellerOrgId: 55, sellerUserId: 12 };
  const payeeSeller = { id: 12, organizationId: 55, role: 'seller' };

  const verifyResult = evaluatePaymentProofAccess(payeeSeller, proof, 'verify');
  assert.equal(verifyResult.allowed, true, 'Payee merchant must be authorized to verify payment proof');
  assert.equal(verifyResult.status, 200);
});

test('T1.SEC.04: BOLA payment proof authorization strictly rejects unrelated sellers (BOLA prevention)', () => {
  const proof = { id: 101, sellerOrgId: 55, sellerUserId: 12 };
  // Attacker is a registered seller in a different organization (Org 99 vs Org 55)
  const unrelatedSeller = { id: 98, organizationId: 99, role: 'seller' };

  const attackResult = evaluatePaymentProofAccess(unrelatedSeller, proof, 'verify');
  assert.equal(attackResult.allowed, false, 'Unrelated seller must be denied with 403');
  assert.equal(attackResult.status, 403);
  assert.equal(attackResult.code, 'PERMISSION_DENIED');
});

test('T1.SEC.05: Cryptographic RNG generates 6-digit OTPs using crypto.randomInt', () => {
  const otps = new Set();
  for (let i = 0; i < 50; i++) {
    const otp = generateSecureOtp();
    assert.match(otp, /^\d{6}$/, 'OTP must be exact 6 decimal digits');
    const num = parseInt(otp, 10);
    assert.ok(num >= 100000 && num <= 999999, 'OTP must fall in [100000, 999999]');
    otps.add(otp);
  }
  // With 50 random samples between 100k-999k, diversity must be high
  assert.ok(otps.size >= 45, 'RNG must exhibit high entropy without repetitions');
});

test('T1.SEC.06: SSRF guard blocks private loopback, RFC 1918 subnets, and cloud metadata endpoints', () => {
  assert.equal(isSafeFetchUrl('http://127.0.0.1/logo.png'), false, '127.0.0.1 must be blocked');
  assert.equal(isSafeFetchUrl('http://localhost:8080/logo.png'), false, 'localhost must be blocked');
  assert.equal(isSafeFetchUrl('http://169.254.169.254/computeMetadata/v1/'), false, 'GCP/AWS metadata must be blocked');
  assert.equal(isSafeFetchUrl('http://10.0.0.1/logo.jpg'), false, 'RFC 1918 10.x.x.x must be blocked');
  assert.equal(isSafeFetchUrl('http://192.168.1.1/logo.jpg'), false, 'RFC 1918 192.168.x.x must be blocked');
  assert.equal(isSafeFetchUrl('https://storage.googleapis.com/msme-logos/logo.png'), true, 'Allowlisted CDN is permitted');
});

test('T1.SEC.07: Cloud Run CORS origin enforcement rejects generic wildcard *.run.app in production', () => {
  // Attacker-controlled GCP Cloud Run app
  const attackerCloudRun = 'https://malicious-app-x3j9q-uc.a.run.app';
  assert.equal(
    isAllowedCorsOriginOracle(attackerCloudRun, true),
    false,
    'Wildcard *.run.app origins must be rejected in production'
  );

  // Official production portal domain
  const officialDomain = 'https://jsgsmile.in';
  assert.equal(
    isAllowedCorsOriginOracle(officialDomain, true),
    true,
    'Official production domain must be allowed'
  );
});

test('T1.SEC.08: Aadhaar KYC requires verified UIDAI/DigiLocker proof and rejects unverified bypass', () => {
  const rawAadhaar = '987654321098';

  // 1. Unverified bypass attempt
  const unverifiedResult = evaluateAadhaarKyc(rawAadhaar, null);
  assert.equal(unverifiedResult.valid, false);
  assert.equal(unverifiedResult.code, 'AADHAAR_VERIFICATION_REQUIRED');

  // 2. Verified UIDAI flow
  const verifiedProof = { provider: 'UIDAI', verified: true, verifiedAt: new Date().toISOString() };
  const verifiedResult = evaluateAadhaarKyc(rawAadhaar, verifiedProof);
  assert.equal(verifiedResult.valid, true);
  assert.equal(verifiedResult.masked, 'XXXXXXXX1098');
  assert.equal(verifiedResult.hash.length, 64);
});

// ----------------------------------------------------------------------------
// FEATURE 2: DIRECT PURCHASE THRESHOLD & GFR RULE 154 INTEGRITY
// ----------------------------------------------------------------------------

test('T1.DP.01: Direct purchase under ₹25,000 threshold succeeds without Rule 154 certificate', () => {
  const items = [
    { sellerId: 10, itemName: 'Desk Organizer', quantity: 10, unitPrice: 1200, taxRate: 18 } // 10 * 1200 * 1.18 = 14,160
  ];
  const result = evaluateDirectPurchaseOrder({ items, rule154Certificate: null });
  assert.equal(result.allowed, true);
  assert.equal(result.orders[10].requiresCertificate, false);
  assert.equal(result.orders[10].totalAmount, 14160);
});

test('T1.DP.02: Direct purchase exactly at ₹25,000 threshold boundary succeeds without certificate', () => {
  const items = [
    { sellerId: 10, itemName: 'Office Chairs', quantity: 5, unitPrice: 5000, taxRate: 0 } // Total exactly 25,000
  ];
  const result = evaluateDirectPurchaseOrder({ items, rule154Certificate: null });
  assert.equal(result.allowed, true);
  assert.equal(result.orders[10].totalAmount, 25000);
  assert.equal(result.orders[10].requiresCertificate, false);
});

test('T1.DP.03: Direct purchase exceeding ₹25,000 without certificate is rejected with DIRECT_PURCHASE_THRESHOLD_EXCEEDED', () => {
  const items = [
    { sellerId: 10, itemName: 'Workstation Laptops', quantity: 1, unitPrice: 35000, taxRate: 18 } // 41,300
  ];
  const result = evaluateDirectPurchaseOrder({ items, rule154Certificate: null });
  assert.equal(result.allowed, false);
  assert.equal(result.orders[10].allowed, false);
  assert.equal(result.orders[10].code, 'DIRECT_PURCHASE_THRESHOLD_EXCEEDED');
  assert.equal(result.orders[10].status, 400);
});

test('T1.DP.04: Direct purchase exceeding ₹25,000 with complete Rule 154 certificate is approved', () => {
  const items = [
    { sellerId: 10, itemName: 'Emergency UPS Inverter', quantity: 2, unitPrice: 30000, taxRate: 18 } // 70,800
  ];
  const validCert = {
    certifierName: 'Dr. R. Sharma',
    designation: 'Procurement Officer',
    reason: 'Emergency server room replacement under GFR Rule 154',
    certifiedDate: '2026-11-08'
  };
  const result = evaluateDirectPurchaseOrder({ items, rule154Certificate: validCert });
  assert.equal(result.allowed, true);
  assert.equal(result.orders[10].allowed, true);
  assert.equal(result.orders[10].requiresCertificate, true);
  assert.equal(result.orders[10].certificateApplied, true);
});

test('T1.DP.05: Multi-item direct purchase calculates aggregate line totals per seller accurately', () => {
  const items = [
    { sellerId: 10, itemName: 'A4 Paper Rims', quantity: 20, unitPrice: 300, taxRate: 12 }, // 20 * 300 * 1.12 = 6,720
    { sellerId: 10, itemName: 'Toner Cartridges', quantity: 4, unitPrice: 4000, taxRate: 18 }, // 4 * 4000 * 1.18 = 18,880
  ]; // Total = 6,720 + 18,880 = 25,600 (> 25,000)
  const result = evaluateDirectPurchaseOrder({ items, rule154Certificate: null });
  assert.equal(result.allowed, false, 'Aggregate spend over ₹25k must be blocked');
  assert.equal(result.orders[10].totalAmount, 25600);
});

// ----------------------------------------------------------------------------
// FEATURE 3: UNAPPROVED BINDING PO PREVENTION
// ----------------------------------------------------------------------------

test('T1.PO.01: Seller invoice submitted with valid existing PO links correctly without creating a new PO', () => {
  const existingPO = { id: 501, sellerId: 88, status: 'accepted', poStatus: 'ACCEPTED' };
  const quotation = { id: 12, sellerUserId: 88 };
  const invoiceBody = { amount: 15000, invoiceNumber: 'INV-2026-001' };

  const result = evaluateSellerInvoiceSubmission({ invoiceBody, existingPO, quotation });
  assert.equal(result.allowed, true);
  assert.equal(result.poId, 501);
});

test('T1.PO.02: Seller invoice submitted without existing PO is strictly rejected with PURCHASE_ORDER_REQUIRED', () => {
  const quotation = { id: 12, sellerUserId: 88 };
  const invoiceBody = { amount: 15000, invoiceNumber: 'INV-2026-002' };

  // Existing PO is null
  const result = evaluateSellerInvoiceSubmission({ invoiceBody, existingPO: null, quotation });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'PURCHASE_ORDER_REQUIRED');
  assert.equal(result.status, 400);
});

test('T1.PO.03: Invoice creation validates that PO sellerId matches quotation sellerUserId', () => {
  const existingPO = { id: 501, sellerId: 99, status: 'accepted', poStatus: 'ACCEPTED' }; // Belongs to seller 99
  const quotation = { id: 12, sellerUserId: 88 }; // Authenticated seller is 88

  const result = evaluateSellerInvoiceSubmission({ invoiceBody: {}, existingPO, quotation });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'FORBIDDEN_PO_SELLER_MISMATCH');
  assert.equal(result.status, 403);
});

test('T1.PO.04: Invoice creation blocks binding PO creation against unissued quotation responses', () => {
  // Quotation response has not been awarded / issued a PO
  const result = evaluateSellerInvoiceSubmission({ invoiceBody: {}, existingPO: null, quotation: { id: 45, sellerUserId: 88 } });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'PURCHASE_ORDER_REQUIRED');
});

test('T1.PO.05: Invoice submission requires PO to be in accepted or in-fulfillment status', () => {
  const draftPO = { id: 502, sellerId: 88, status: 'draft', poStatus: 'DRAFT' };
  const quotation = { id: 12, sellerUserId: 88 };

  const result = evaluateSellerInvoiceSubmission({ invoiceBody: {}, existingPO: draftPO, quotation });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'INVALID_PO_STATUS_FOR_INVOICE');
  assert.equal(result.status, 409);
});

// ----------------------------------------------------------------------------
// FEATURE 4: MULTI-VENDOR L1 EVALUATION ENGINE
// ----------------------------------------------------------------------------

test('T1.L1.01: Engine aggregates multiple line item quotes per vendor to evaluate total vendor cost', () => {
  const quotes = [
    { vendorId: 1, vendorName: 'Vendor A', unitPrice: 100, quantity: 10, compliant: true },
    { vendorId: 1, vendorName: 'Vendor A', unitPrice: 200, quantity: 5, compliant: true }, // Total Vendor A = 1000 + 1000 = 2000
    { vendorId: 2, vendorName: 'Vendor B', unitPrice: 150, quantity: 10, compliant: true },
    { vendorId: 2, vendorName: 'Vendor B', unitPrice: 150, quantity: 5, compliant: true }, // Total Vendor B = 1500 + 750 = 2250
    { vendorId: 3, vendorName: 'Vendor C', unitPrice: 120, quantity: 10, compliant: true },
    { vendorId: 3, vendorName: 'Vendor C', unitPrice: 160, quantity: 5, compliant: true }, // Total Vendor C = 1200 + 800 = 2000
  ];
  const evalResult = evaluateL1Comparison(quotes);
  assert.equal(evalResult.meetsQuorum, true);
  assert.equal(evalResult.rankings.length, 3);
  assert.equal(evalResult.rankings[0].totalPrice, 2000);
});

test('T1.L1.02: Engine strictly validates quorum: requires at least 3 distinct vendor organizations', () => {
  const onlyTwoVendors = [
    { vendorId: 1, vendorName: 'Vendor A', unitPrice: 1000, compliant: true },
    { vendorId: 2, vendorName: 'Vendor B', unitPrice: 1200, compliant: true }
  ];
  const result = evaluateL1Comparison(onlyTwoVendors);
  assert.equal(result.meetsQuorum, false, 'Quorum requires at least 3 distinct vendors');
  assert.equal(result.code, 'INSUFFICIENT_VENDORS_FOR_QUORUM');
  assert.equal(result.l1VendorId, null);
});

test('T1.L1.03: Engine correctly determines vendor with lowest total compliant quote as L1', () => {
  const quotes = [
    { vendorId: 10, vendorName: 'Vendor X', unitPrice: 50000, compliant: true },
    { vendorId: 20, vendorName: 'Vendor Y', unitPrice: 42000, compliant: true }, // Lowest
    { vendorId: 30, vendorName: 'Vendor Z', unitPrice: 47000, compliant: true }
  ];
  const result = evaluateL1Comparison(quotes);
  assert.equal(result.meetsQuorum, true);
  assert.equal(result.l1VendorId, 20);
  assert.equal(result.l1Price, 42000);
  assert.equal(result.rankings[0].rank, 'L1');
  assert.equal(result.rankings[1].rank, 'L2');
  assert.equal(result.rankings[2].rank, 'L3');
});

test('T1.L1.04: Engine filters out non-compliant or technically disqualified vendors prior to ranking', () => {
  const quotes = [
    { vendorId: 1, vendorName: 'Vendor 1', unitPrice: 30000, compliant: false }, // Disqualified
    { vendorId: 2, vendorName: 'Vendor 2', unitPrice: 35000, compliant: true },
    { vendorId: 3, vendorName: 'Vendor 3', unitPrice: 40000, compliant: true },
    { vendorId: 4, vendorName: 'Vendor 4', unitPrice: 45000, compliant: true }
  ];
  const result = evaluateL1Comparison(quotes);
  assert.equal(result.meetsQuorum, true);
  assert.equal(result.compliantVendorsCount, 3);
  assert.equal(result.l1VendorId, 2, 'L1 must be Vendor 2; disqualified Vendor 1 excluded');
  assert.equal(result.l1Price, 35000);
});

test('T1.L1.05: Engine applies deterministic tie-breaking when two vendors offer identical lowest pricing', () => {
  const quotes = [
    { vendorId: 1, vendorName: 'Vendor 1', unitPrice: 50000, compliant: true, submittedAt: '2026-11-08T06:00:00Z' },
    { vendorId: 2, vendorName: 'Vendor 2', unitPrice: 50000, compliant: true, submittedAt: '2026-11-08T05:30:00Z' }, // Earlier
    { vendorId: 3, vendorName: 'Vendor 3', unitPrice: 55000, compliant: true, submittedAt: '2026-11-08T06:10:00Z' }
  ];
  const result = evaluateL1Comparison(quotes);
  assert.equal(result.meetsQuorum, true);
  assert.equal(result.l1VendorId, 2, 'Vendor 2 wins tie due to earlier submission timestamp');
  assert.equal(result.l1Price, 50000);
});

// ----------------------------------------------------------------------------
// FEATURE 5: WEBSOCKET PRICE REDACTION & BID SECRECY
// ----------------------------------------------------------------------------

test('T1.WS.01: QUOTATION_SUBMITTED broadcast redacts offeredPrice prior to financial bid opening', () => {
  const rawPayload = {
    type: 'QUOTATION_SUBMITTED',
    requirementId: 42,
    procurementId: 42,
    responseId: 108,
    offeredPrice: 85000,
    sellerOrgId: 15,
    timestamp: '2026-11-08T07:00:00Z'
  };

  const sanitized = sanitizeWebSocketBroadcast('QUOTATION_SUBMITTED', rawPayload, 'TECHNICAL_EVALUATION');
  assert.equal(sanitized.offeredPrice, undefined, 'offeredPrice must be completely scrubbed from WebSocket broadcast');
  assert.equal(sanitized.priceRedacted, true);
});

test('T1.WS.02: QUOTATION_SUBMITTED broadcast redacts sellerOrgId to prevent bidder identity leakage', () => {
  const rawPayload = {
    type: 'QUOTATION_SUBMITTED',
    requirementId: 42,
    sellerOrgId: 15,
    offeredPrice: 85000
  };

  const sanitized = sanitizeWebSocketBroadcast('QUOTATION_SUBMITTED', rawPayload, 'TECHNICAL_EVALUATION');
  assert.equal(sanitized.sellerOrgId, undefined, 'sellerOrgId must be scrubbed to prevent competitor collusion');
});

test('T1.WS.03: QUOTATION_SUBMITTED broadcast preserves non-sensitive notification metadata', () => {
  const rawPayload = {
    type: 'QUOTATION_SUBMITTED',
    requirementId: 42,
    procurementId: 42,
    responseId: 108,
    timestamp: '2026-11-08T07:00:00Z',
    offeredPrice: 90000
  };

  const sanitized = sanitizeWebSocketBroadcast('QUOTATION_SUBMITTED', rawPayload, 'TECHNICAL_EVALUATION');
  assert.equal(sanitized.requirementId, 42);
  assert.equal(sanitized.procurementId, 42);
  assert.equal(sanitized.responseId, 108);
  assert.equal(sanitized.timestamp, '2026-11-08T07:00:00Z');
});

test('T1.WS.04: Broadcast payload retains price redaction across both Single-Packet and Two-Packet tenders', () => {
  const rawPayload = { type: 'QUOTATION_SUBMITTED', offeredPrice: 120000, sellerOrgId: 22 };

  // Single-packet before award
  const singlePacketSanitized = sanitizeWebSocketBroadcast('QUOTATION_SUBMITTED', rawPayload, 'BID_SUBMISSION');
  assert.equal(singlePacketSanitized.offeredPrice, undefined);

  // Two-packet in stage 1
  const twoPacketSanitized = sanitizeWebSocketBroadcast('QUOTATION_SUBMITTED', rawPayload, 'TECHNICAL_EVALUATION');
  assert.equal(twoPacketSanitized.offeredPrice, undefined);
});

test('T1.WS.05: WebSocket event payload reveals prices ONLY after financial opening stage', () => {
  const rawPayload = { type: 'QUOTATION_SUBMITTED', offeredPrice: 75000, sellerOrgId: 18 };

  // Post financial opening
  const revealed = sanitizeWebSocketBroadcast('QUOTATION_SUBMITTED', rawPayload, 'FINANCIAL_EVALUATION');
  assert.equal(revealed.offeredPrice, 75000, 'Price may be broadcast once financial opening has officially begun');
  assert.equal(revealed.sellerOrgId, 18);
});

// ----------------------------------------------------------------------------
// FEATURE 6: BILATERAL PO TRANSITIONS & FINANCIAL DRAWDOWNS
// ----------------------------------------------------------------------------

test('T1.WF.01: Status transition rejects direct unilateral transition from accepted to cancelled', () => {
  const result = evaluatePOTransition('accepted', 'cancelled', false);
  assert.equal(result.allowed, false, 'Unilateral accepted -> cancelled must be forbidden');
  assert.equal(result.code, 'BILATERAL_CANCELLATION_REQUIRED');
  assert.equal(result.status, 409);
});

test('T1.WF.02: Status transition rejects direct unilateral transition from in_fulfillment to cancelled', () => {
  const result = evaluatePOTransition('in_fulfillment', 'cancelled', false);
  assert.equal(result.allowed, false, 'Unilateral in_fulfillment -> cancelled must be forbidden');
  assert.equal(result.code, 'BILATERAL_CANCELLATION_REQUIRED');
});

test('T1.WF.03: Status transition permits initiation of accepted to cancellation_requested', () => {
  const result = evaluatePOTransition('accepted', 'cancellation_requested');
  assert.equal(result.allowed, true);
  assert.equal(result.to, 'cancellation_requested');
});

test('T1.WF.04: Counterparty approval transitions cancellation_requested to cancelled', () => {
  // 1. Without counterparty approval: blocked
  const unapproved = evaluatePOTransition('cancellation_requested', 'cancelled', false);
  assert.equal(unapproved.allowed, false);
  assert.equal(unapproved.code, 'COUNTERPARTY_APPROVAL_REQUIRED');

  // 2. With counterparty approval: allowed
  const approved = evaluatePOTransition('cancellation_requested', 'cancelled', true);
  assert.equal(approved.allowed, true);
  assert.equal(approved.to, 'cancelled');
});

test('T1.WF.05: Rate Contract call-off validates cumulative spend against totalContractValue', () => {
  const contractTotalValue = 1000000; // ₹10,00,000
  const existingOrders = [
    { id: 1, totalValue: 600000, status: 'delivered' },
    { id: 2, totalValue: 300000, status: 'in_fulfillment' }
  ]; // Total utilized = ₹9,00,000. Remaining = ₹1,00,000

  // Order A: ₹80,000 (Fits within remaining ₹1,00,000)
  const orderA = evaluateRateContractCallOff(contractTotalValue, existingOrders, [
    { quantity: 80, unitPrice: 1000, taxRate: 0 }
  ]);
  assert.equal(orderA.allowed, true);
  assert.equal(orderA.remainingValueAfterOrder, 20000);

  // Order B: ₹150,000 (Exceeds remaining ₹1,00,000)
  const orderB = evaluateRateContractCallOff(contractTotalValue, existingOrders, [
    { quantity: 150, unitPrice: 1000, taxRate: 0 }
  ]);
  assert.equal(orderB.allowed, false);
  assert.equal(orderB.code, 'RATE_CONTRACT_CAP_EXCEEDED');
});

test('T1.WF.06: PBG invocation service method transitions active PBG to INVOKED on vendor default', () => {
  const activePbg = { id: 77, buyerId: 10, status: 'VERIFIED_ACTIVE', amount: 50000 };
  const buyerActor = { id: 10, role: 'buyer' };
  const reason = 'Vendor abandoned project site; total failure to execute contractual delivery terms.';

  const result = evaluatePbgInvocation(activePbg, buyerActor, reason);
  assert.equal(result.allowed, true);
  assert.equal(result.newStatus, 'INVOKED');
  assert.equal(result.forfeitedAmount, 50000);
});
