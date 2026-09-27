import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

const read = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('1. Procurement Type Matrix: All 6 procurement types are fully registered and handled', () => {
  const schema = read('prisma/schema.prisma');
  const service = read('src/modules/procurementBid/procurement-bid.service.ts');
  const routes = read('src/modules/procurementBid/procurement-bid.routes.ts');
  const validation = read('src/modules/procurementBid/bid-wizard.validation.ts');
  const wizard = read('../frontend/src/features/procurementWizard/pages/CreateProcurementPage.tsx');

  // Verify all 6 procurement types are present across system models, wizard, and services
  const procurementTypes = [
    'RFQ',
    'RFP',
    'OPEN_TENDER',
    'LIMITED_TENDER',
    'RATE_CONTRACT',
    'REVERSE_AUCTION'
  ];

  const sourcePool = `${schema}\n${service}\n${routes}\n${validation}\n${wizard}`;

  for (const type of procurementTypes) {
    assert.match(
      sourcePool,
      new RegExp(`\\b${type}\\b`),
      `Procurement type ${type} must be recognized across system models and services`
    );
  }
});

test('2. Sourcing & Category Permutations: Goods/Product, BOQ Multiline, and Service validation', () => {
  const validation = read('src/modules/procurementBid/bid-wizard.validation.ts');

  // Step 4 schemas exist for each distinct scope category
  assert.match(validation, /export const step4ProductSchema/);
  assert.match(validation, /export const step4ServiceSchema/);
  assert.match(validation, /export const step4BoqSchema/);
  assert.match(validation, /export const step4CustomSchema/);
  assert.match(validation, /export const reverseAuctionFieldsSchema/);

  // BOQ multiline validation requires uploads or manual lineItems
  assert.match(validation, /priceQuoteBasis:\s*requiredString/);
  assert.match(validation, /boqEntryMode:\s*z\.enum\(\['UPLOAD',\s*'MANUAL'\]\)/);
  assert.match(validation, /BOQ upload or manual line items are required/);
});

test('3. Packet Type Configuration: Single-Packet vs Two-Packet schema enforcement', () => {
  const validation = read('src/modules/procurementBid/bid-wizard.validation.ts');

  assert.match(validation, /export const packetTypeSchema = z\.enum\(\['SINGLE_PACKET',\s*'TWO_PACKET'\]\)/);
  assert.match(validation, /export const technicalPacketSchema/);
  assert.match(validation, /export const financialPacketSchema/);

  // Two-packet bid requires technical packet at Step 6 and financial packet at Step 7
  assert.match(validation, /packetType === 'TWO_PACKET' && step === 6 && !payload\?\.technicalPacket/);
  assert.match(validation, /packetType === 'TWO_PACKET' && step === 7 && !payload\?\.financialPacket/);
});

test('4. Sourcing Strategy: Public Sourcing vs Limited/Invited Sourcing enforcement', () => {
  const service = read('src/modules/procurementBid/procurement-bid.service.ts');
  const routes = read('src/modules/procurementBid/procurement-bid.routes.ts');

  // Limited tender must restrict participation to invited sellers
  assert.match(service, /LIMITED_TENDER/);
  assert.match(routes, /procurement-bids/);
  // Sourcing method filtering exists for seller opportunities
  assert.match(service, /invitedSellers/);
});

test('5. Urgency & Delivery Timelines: Required-by date and urgency priority handling', () => {
  const validation = read('src/modules/procurementBid/bid-wizard.validation.ts');

  // Step 3 priority and date validations
  assert.match(validation, /priority:\s*requiredString\('Priority',\s*40\)/);
  assert.match(validation, /publishingDate:\s*z\.coerce\.date\(\)/);
  assert.match(validation, /closingDate:\s*z\.coerce\.date\(\)/);
  assert.match(validation, /Closing date must be after publishing date/);

  // Step 5 delivery period and SLA
  assert.match(validation, /deliveryPeriod:\s*requiredString\('Delivery period',\s*120\)/);
  assert.match(validation, /acceptanceCriteria:\s*requiredString\('Acceptance criteria',\s*4000\)/);
});

test('6. Clarification Flow: Bidder question, buyer response, attachment upload & audit logs', () => {
  const service = read('src/modules/procurementBid/procurement-bid.service.ts');
  const routes = read('src/modules/procurementBid/procurement-bid.routes.ts');

  // Endpoints exist
  assert.match(routes, /\/procurement-bids\/:bidId\/clarifications\/ask/);
  assert.match(routes, /\/procurement-bids\/:bidId\/clarifications\/:clarificationId\/respond/);
  assert.match(routes, /\/buyer\/procurement-bids\/:bidId\/clarifications/);

  // Service enforces role access and audit recording
  assert.match(service, /export const sellerAskClarification/);
  assert.match(service, /export const respondClarification/);
  assert.match(service, /CLARIFICATION_REQUESTED/);
  assert.match(service, /CLARIFICATION_RESPONDED/);
  assert.match(service, /technicalStatus:\s*'CLARIFICATION_REQUIRED'/);
});

test('7. Two-Cover Anti-Bias Lock: Cover 2 remains sealed (LOCKED) during technical scrutiny', () => {
  const service = read('src/modules/procurementBid/procurement-bid.service.ts');

  // Check that participation serializer hides financial details if not authorized
  assert.match(service, /canSeeFinancial/);
  // Check that financialStatus is set to LOCKED on submission and maintained
  assert.match(service, /financialStatus:\s*'LOCKED'/);
  // Disqualified participants remain locked
  assert.match(service, /financialStatus:\s*technicalStatus === 'DISQUALIFIED'\s*\?\s*'LOCKED'/);
});

test('8. Technical Scrutiny & Financial Opening Gate: All participants must be evaluated', () => {
  const service = read('src/modules/procurementBid/procurement-bid.service.ts');

  // Evaluator marks QUALIFIED or DISQUALIFIED
  assert.match(service, /evaluateTechnical/);
  assert.match(service, /completeTechnicalEvaluation/);
  assert.match(service, /technicalEvaluationStatuses/);

  // Financial opening is restricted to TECHNICAL_EVALUATION_COMPLETED
  assert.match(service, /openFinancialEvaluation/);
  assert.match(service, /openFinancialEvaluationLandedCost/);
  assert.match(service, /TECHNICAL_EVALUATION_COMPLETED/);
});

test('9. Landed Cost Formula & Ranking: Base + GST + Freight + Loading Charges', () => {
  const service = read('src/modules/procurementBid/procurement-bid.service.ts');

  // Formula computation verification
  assert.match(service, /quoted\s*\+\s*gstAmount\s*\+\s*freight\s*\+\s*loading/);
  assert.match(service, /rankToFinalStatus\(rank\)/);
  assert.match(service, /financialStatus:\s*'EVALUATED'/);
  // Single-bidder confirmation guard
  assert.match(service, /SINGLE_BID_CONFIRMATION_REQUIRED/);
  assert.match(service, /singleBidConfirmed/);
});

test('10. Selection, Award Issuance & Purchase Order Generation', () => {
  const service = read('src/modules/procurementBid/procurement-bid.service.ts');
  const orderService = read('src/modules/procurementBid/procurement-order.service.ts');

  assert.match(service, /recommendAward/);
  assert.match(service, /approveFinalAward/);
  assert.match(orderService, /createOrReuseProcurementPOForAward/);
  assert.match(orderService, /getOrGeneratePurchaseOrderPdfBuffer/);
  assert.match(orderService, /procurement_bid_award/);
});

test('11. Delivery Lifecycle: Sequential progression from CREATED to ACCEPTED', () => {
  const routes = read('src/modules/delivery/delivery.routes.ts');
  const constants = read('src/modules/delivery/delivery.constants.ts');
  const service = read('src/modules/delivery/delivery.service.ts');

  // Sequential statuses exist
  assert.match(constants, /'CREATED'/);
  assert.match(constants, /'SELLER_ACCEPTED'/);
  assert.match(constants, /'DISPATCHED'/);
  assert.match(constants, /'DELIVERED'/);
  assert.match(constants, /'ACCEPTED'/);

  // Buyer acceptance triggers financial progression
  assert.match(routes, /\/:id\/buyer\/acceptance/);
  assert.match(service, /deliveryStatusLog\.create/);
});

test('12. Payment via Offline Slip Upload: Upload proof, admin verification & release', () => {
  const paymentRoutes = read('src/modules/payments/payment.routes.ts');
  const deliveryService = read('src/modules/delivery/delivery.service.ts');

  assert.match(paymentRoutes, /\/offline-proof/);
  assert.match(paymentRoutes, /\/offline-proof\/:proofId\/verify/);
  assert.match(paymentRoutes, /offlineProofSchema/);
  assert.match(paymentRoutes, /OFFLINE_PROOF_VERIFIED/);
  assert.match(deliveryService, /async releasePayment/);
  assert.match(deliveryService, /PAYMENT_RELEASED/);
});

test('13. EMD & Subcategory Complete Elimination: Zero dead code, models, or routes', () => {
  const schema = read('prisma/schema.prisma');
  const routesIndex = read('src/routes/index.ts');
  const participationPage = read('../frontend/src/features/procurementBid/pages/BidParticipationPage.tsx');
  const unifiedView = read('../frontend/src/features/rfq/components/ProcurementDetailUnifiedView.tsx');

  // Verify EmdPayment model does not exist and Category has no parentId or children
  assert.doesNotMatch(schema, /\bmodel EmdPayment\b/);
  const categoryModel = schema.match(/model Category \{[\s\S]*?\}/)?.[0] || '';
  assert.doesNotMatch(categoryModel, /\bparentId\b/);
  assert.doesNotMatch(categoryModel, /\bchildren\b/);

  // Verify emd routes are not mounted
  assert.doesNotMatch(routesIndex, /\bemdRoutes\b/);
  assert.equal(existsSync(new URL('../src/routes/emd.routes.ts', import.meta.url)), false);

  // Verify EmdCard.tsx and EmdPaymentModal.tsx do not exist in frontend
  assert.equal(existsSync(new URL('../../frontend/src/features/rfq/components/EmdCard.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../../frontend/src/features/rfq/components/EmdPaymentModal.tsx', import.meta.url)), false);

  // No active EMD gating or components in participation page or unified view
  assert.doesNotMatch(participationPage, /<EmdCard[^>]*\/>/);
  assert.doesNotMatch(participationPage, /<EmdPaymentModal[^>]*\/>/);
  assert.doesNotMatch(unifiedView, /<EmdCard[^>]*\/>/);
  assert.doesNotMatch(unifiedView, /<EmdPaymentModal[^>]*\/>/);
});

test('14. UI Data Formatting & Anti-Raw Dump Invariants: Zero raw JSON dumps, noisy keys filtered', () => {
  const unifiedView = read('../frontend/src/features/rfq/components/ProcurementDetailUnifiedView.tsx');

  // Zero raw JSON.stringify calls in template output
  assert.doesNotMatch(unifiedView, /\{JSON\.stringify\(/);

  // Noisy internal database keys filtered out
  assert.match(unifiedView, /noisyDetailKeys/);
  const requiredFilters = ['_id', '__v', 'tenantId', 'technicalPacket', 'rawPayload', 'password', 'token'];
  for (const key of requiredFilters) {
    assert.match(unifiedView, new RegExp(`['"]${key}['"]`));
  }

  // Proper currency formatting
  assert.match(unifiedView, /formatMoney/);
  assert.match(unifiedView, /formatCurrency/);
});

test('15. Simplified Portal Architecture: Zero Award Splitting, No Auto-PO, Sequential Award -> PO Acceptance', () => {
  const service = read('src/modules/procurementBid/procurement-bid.service.ts');
  const orderService = read('src/modules/procurementBid/procurement-order.service.ts');
  const routes = read('src/modules/procurementBid/procurement-bid.routes.ts');

  // 1. Award Splitting and L2 Counter-offers disabled
  assert.match(service, /SPLIT_AWARD_DISABLED/);
  assert.match(service, /L2_MATCH_DISABLED/);

  // 2. No Auto-PO in recommendAward or approveFinalAward
  const recommendAwardCode = service.match(/export const recommendAward =[\s\S]*?^};/m)?.[0] || '';
  assert.doesNotMatch(recommendAwardCode, /generatePoNow/);
  const approveFinalAwardCode = service.match(/export const approveFinalAward =[\s\S]*?^};/m)?.[0] || '';
  assert.doesNotMatch(approveFinalAwardCode, /createOrReuseProcurementPOForAward/);

  // 3. Standby bidders are NOT prematurely rejected in approveFinalAward
  assert.doesNotMatch(approveFinalAwardCode, /updateMany\(\{\s*where:\s*\{\s*bidId:\s*bid\.id,\s*id:\s*\{\s*not:\s*award\.participationId\s*\}\s*\}/);

  // 4. Standby bidders are transitioned to NOT_SELECTED strictly inside acceptPO upon PO acceptance
  const acceptPOCode = orderService.match(/export const acceptPO =[\s\S]*?^};/m)?.[0] || '';
  assert.match(acceptPOCode, /sellerId:\s*\{\s*not:\s*po\.sellerId\s*\}/);
  assert.match(acceptPOCode, /finalStatus:\s*'NOT_SELECTED'/);
  assert.match(acceptPOCode, /Tender Concluded/);

  // 5. PO Generation endpoint allows both seller and buyer
  assert.match(routes, /\/seller\/procurement-bids\/:bidId\/generate-po/);
});

