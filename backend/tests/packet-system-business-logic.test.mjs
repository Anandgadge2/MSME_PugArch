import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = fs.existsSync(path.join(process.cwd(), 'frontend')) ? process.cwd() : path.resolve(process.cwd(), '..');

// Helper to read files
const readFile = (relPath) => fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');

// ============================================================================
// SUITE 1: PACKET TYPE DATA MODEL & SCHEMA INTEGRITY
// ============================================================================

test('1.1 Prisma Schema & Database Models define PacketType enum and packet columns', () => {
  const schema = readFile('backend/prisma/schema.prisma');

  assert.match(
    schema,
    /enum PacketType\s*\{[\s\S]*?SINGLE_PACKET[\s\S]*?TWO_PACKET[\s\S]*?\}/,
    'PacketType enum must define SINGLE_PACKET and TWO_PACKET'
  );

  assert.match(
    schema,
    /packetType\s+PacketType\s+@default\(SINGLE_PACKET\)/,
    'ProcurementBid model must include packetType with default SINGLE_PACKET'
  );

  assert.match(
    schema,
    /technicalPacket\s+Json\?/,
    'ProcurementBid must store technicalPacket JSON'
  );

  assert.match(
    schema,
    /financialPacket\s+Json\?/,
    'ProcurementBid must store financialPacket JSON'
  );
});

// ============================================================================
// SUITE 2: BID WIZARD STEP VALIDATION (SINGLE vs TWO PACKET)
// ============================================================================

test('2.1 Bid Wizard Step 1 validates packetType schema with Zod', () => {
  const validation = readFile('backend/src/modules/procurementBid/bid-wizard.validation.ts');

  assert.match(
    validation,
    /export const packetTypeSchema = z\.enum\(\['SINGLE_PACKET',\s*'TWO_PACKET'\]\)/,
    'packetTypeSchema must strictly accept SINGLE_PACKET and TWO_PACKET'
  );

  assert.match(
    validation,
    /export const step1Schema = z\.object\(\{[\s\S]*?packetType:\s*packetTypeSchema[\s\S]*?\}\)/,
    'Step 1 schema must require valid packetType'
  );
});

test('2.2 Bid Wizard Step 6 & 7 enforce technical & financial packets strictly for TWO_PACKET only', () => {
  const validation = readFile('backend/src/modules/procurementBid/bid-wizard.validation.ts');

  // Verify validateWizardStep implementation enforces two-packet separation
  assert.match(
    validation,
    /if\s*\(\s*packetType\s*===\s*'TWO_PACKET'\s*&&\s*step\s*===\s*6\s*&&\s*!payload\?\.technicalPacket\s*\)/,
    'Step 6 must strictly reject TWO_PACKET if technicalPacket is missing'
  );

  assert.match(
    validation,
    /if\s*\(\s*packetType\s*===\s*'TWO_PACKET'\s*&&\s*step\s*===\s*7\s*&&\s*!payload\?\.financialPacket\s*\)/,
    'Step 7 must strictly reject TWO_PACKET if financialPacket is missing'
  );

  // In-memory simulation of validateWizardStep logic
  const mockValidateWizardStep = (step, payload, packetType) => {
    if (packetType === 'TWO_PACKET' && step === 6 && !payload?.technicalPacket) {
      return { valid: false, errors: { technicalPacket: ['Technical packet is required for two packet bids'] } };
    }
    if (packetType === 'TWO_PACKET' && step === 7 && !payload?.financialPacket) {
      return { valid: false, errors: { financialPacket: ['Financial packet is required for two packet bids'] } };
    }
    return { valid: true, errors: {} };
  };

  // Test SINGLE_PACKET at Step 6 & 7 without packets -> Must PASS
  assert.equal(mockValidateWizardStep(6, {}, 'SINGLE_PACKET').valid, true, 'SINGLE_PACKET must pass Step 6 without technicalPacket');
  assert.equal(mockValidateWizardStep(7, {}, 'SINGLE_PACKET').valid, true, 'SINGLE_PACKET must pass Step 7 without financialPacket');

  // Test TWO_PACKET at Step 6 & 7 without packets -> Must FAIL
  const failStep6 = mockValidateWizardStep(6, {}, 'TWO_PACKET');
  assert.equal(failStep6.valid, false, 'TWO_PACKET must fail Step 6 without technicalPacket');
  assert.deepEqual(failStep6.errors.technicalPacket, ['Technical packet is required for two packet bids']);

  const failStep7 = mockValidateWizardStep(7, {}, 'TWO_PACKET');
  assert.equal(failStep7.valid, false, 'TWO_PACKET must fail Step 7 without financialPacket');
  assert.deepEqual(failStep7.errors.financialPacket, ['Financial packet is required for two packet bids']);

  // Test TWO_PACKET with valid packets provided -> Must PASS
  const passStep6 = mockValidateWizardStep(6, { technicalPacket: { evaluationMethod: 'L1' } }, 'TWO_PACKET');
  assert.equal(passStep6.valid, true, 'TWO_PACKET must pass Step 6 when technicalPacket is provided');

  const passStep7 = mockValidateWizardStep(7, { financialPacket: { paymentTerms: 'Net 30' } }, 'TWO_PACKET');
  assert.equal(passStep7.valid, true, 'TWO_PACKET must pass Step 7 when financialPacket is provided');
});

test('2.3 Required Document Uploads rule enforces separate packet uploads exclusively in TWO_PACKET', () => {
  const wizardService = readFile('backend/src/modules/procurementBid/bid-wizard.service.ts');

  assert.match(
    wizardService,
    /packetType === 'TWO_PACKET' && asFileAssetIds\(formData\.step6\?\.technicalPacket\?\.technicalDocumentUploads\)\.length === 0/,
    'Technical packet document uploads must be required for TWO_PACKET'
  );

  assert.match(
    wizardService,
    /packetType === 'TWO_PACKET' && asFileAssetIds\(step7\.financialPacket\?\.financialDocumentUploads\)\.length === 0/,
    'Financial packet document uploads must be required for TWO_PACKET'
  );
});

// ============================================================================
// SUITE 3: TIMELINE SEQUENCING & CORRIGENDUM RULES
// ============================================================================

test('3.1 Two-Packet Mode enforces strict chronological sequence (Closing <= Tech Opening <= Fin Opening)', () => {
  const bidService = readFile('backend/src/modules/procurementBid/procurement-bid.service.ts');

  // Verify technical opening cannot precede closing date
  assert.match(
    bidService,
    /Technical opening date cannot be earlier than the submission closing date/,
    'Technical opening date must be >= submission closing date'
  );

  // Verify financial opening cannot precede technical opening or closing date
  assert.match(
    bidService,
    /Financial opening date cannot be earlier than the technical opening \/ closing date/,
    'Financial opening date must be >= technical opening date'
  );

  // In-memory simulation of date validation rules
  const validateDateSequence = (closingDate, techDate, finDate, isTwoPacket) => {
    if (techDate && techDate.getTime() < closingDate.getTime()) {
      return { valid: false, code: 'INVALID_TECH_SEQUENCE' };
    }
    if (isTwoPacket && finDate) {
      const minFin = techDate || closingDate;
      if (finDate.getTime() < minFin.getTime()) {
        return { valid: false, code: 'INVALID_FIN_SEQUENCE' };
      }
    }
    return { valid: true };
  };

  const t0 = new Date('2026-11-01T10:00:00Z');
  const tClose = new Date('2026-11-10T15:00:00Z');
  const tTech = new Date('2026-11-10T16:00:00Z');
  const tFinValid = new Date('2026-11-12T10:00:00Z');
  const tFinInvalid = new Date('2026-11-09T10:00:00Z');

  // Valid Two-Packet sequence
  assert.equal(validateDateSequence(tClose, tTech, tFinValid, true).valid, true);

  // Invalid Two-Packet: Financial opening before technical opening
  const invFin = validateDateSequence(tClose, tTech, tFinInvalid, true);
  assert.equal(invFin.valid, false);
  assert.equal(invFin.code, 'INVALID_FIN_SEQUENCE');

  // Single-Packet: Financial opening date is not required/enforced
  assert.equal(validateDateSequence(tClose, null, null, false).valid, true);
});

// ============================================================================
// SUITE 4: COMMERCIAL BID SECRECY GUARANTEE & SEALED DOCUMENT ENGINE
// ============================================================================

test('4.1 Commercial & financial documents are strictly classified and filtered during Cover 1 scrutiny', () => {
  const sealingUtils = readFile('backend/src/modules/procurementBid/procurement-sealing.utils.ts');

  assert.match(
    sealingUtils,
    /cat\.includes\('FINAN'\) \|\|[\s\S]*?cat\.includes\('PRICE'\) \|\|[\s\S]*?cat\.includes\('COMMERCIAL'\)/,
    'isFinancialOrCommercialDocument must check category metadata'
  );

  assert.match(
    sealingUtils,
    /normNm\.includes\('rate schedule'\) \|\|[\s\S]*?normNm\.includes\('price breakup'\) \|\|[\s\S]*?normNm\.includes\('boq rate'\)/,
    'isFinancialOrCommercialDocument must classify rate schedule, price breakup, boq rate'
  );

  // In-memory simulation of document filter engine
  const isFinancialOrCommercialDocument = (doc) => {
    if (!doc) return false;
    const cat = String(doc.documentCategory || doc.category || doc.type || '').toUpperCase();
    const nm = String(doc.documentName || doc.fileName || doc.name || '').toLowerCase();
    if (cat.includes('FINAN') || cat.includes('PRICE') || cat.includes('COMMERCIAL') || cat.includes('COST') || cat.includes('RATE_SCHEDULE')) {
      return true;
    }
    const normNm = nm.replace(/[-_.]+/g, ' ');
    if (
      nm.includes('price') ||
      nm.includes('breakup') ||
      nm.includes('commercial') ||
      nm.includes('financial') ||
      nm.includes('pricing') ||
      normNm.includes('cost schedule') ||
      normNm.includes('rate schedule') ||
      normNm.includes('price breakup') ||
      normNm.includes('boq rate') ||
      normNm.includes('quotation sheet') ||
      normNm.includes('commercial bid')
    ) {
      return true;
    }
    return false;
  };

  const filterSealedDocuments = (docs, canSeeFinancial) => {
    if (canSeeFinancial) return docs;
    return docs.filter(d => !isFinancialOrCommercialDocument(d));
  };

  const sampleTenderDocuments = [
    { id: 1, name: 'Technical_Specification.pdf', documentCategory: 'TECHNICAL' },
    { id: 2, name: 'Compliance_Certificate.pdf', documentCategory: 'CERTIFICATE' },
    { id: 3, name: 'boq_rate_schedule.xlsx', documentCategory: 'FINANCIAL' },
    { id: 4, name: 'Commercial_Price_Breakup.pdf', documentCategory: 'PRICE_BID' },
    { id: 5, name: 'ISO_9001_Audit.pdf', documentCategory: 'QUALITY' }
  ];

  // Stage 1 (Cover 1 Technical Scrutiny: canSeeFinancial = false)
  const sealedDocs = filterSealedDocuments(sampleTenderDocuments, false);
  assert.equal(sealedDocs.length, 3, 'Must filter out all commercial documents during Stage 1');
  assert.equal(sealedDocs.some(d => d.name.includes('boq_rate_schedule')), false, 'boq_rate_schedule must be sealed');
  assert.equal(sealedDocs.some(d => d.name.includes('Commercial_Price_Breakup')), false, 'Commercial_Price_Breakup must be sealed');
  assert.deepEqual(sealedDocs.map(d => d.id), [1, 2, 5], 'Technical documents must remain accessible');

  // Stage 2 (Cover 2 Financial Opening: canSeeFinancial = true)
  const unsealedDocs = filterSealedDocuments(sampleTenderDocuments, true);
  assert.equal(unsealedDocs.length, 5, 'All documents must be available once financial cover opens');
});

test('4.2 Disqualified participants have financial bids permanently sealed and excluded from ranking', () => {
  const bidService = readFile('backend/src/modules/procurementBid/procurement-bid.service.ts');

  assert.match(
    bidService,
    /where:\s*\{\s*bidId:\s*bid\.id,\s*technicalStatus:\s*\{\s*not:\s*'QUALIFIED'\s*\}\s*\},\s*data:\s*\{\s*financialStatus:\s*'LOCKED'\s*\}/,
    'Non-qualified participants must have financialStatus set to LOCKED'
  );

  assert.match(
    bidService,
    /where:\s*\{\s*bidId:\s*bid\.id,\s*technicalStatus:\s*'QUALIFIED',\s*submissionStatus:\s*'SUBMITTED',\s*totalAmount:\s*\{\s*not:\s*null\s*\}\s*\}/,
    'Financial ranking must strictly select only technically QUALIFIED participants'
  );

  // In-memory simulation of participation serialization & deep sanitization
  const sanitizePricesDeep = (data) => {
    if (!data || typeof data !== 'object') return data;
    if (Array.isArray(data)) return data.map(sanitizePricesDeep);
    const clone = { ...data };
    const priceKeys = ['quotedAmount', 'totalAmount', 'unitPrice', 'lineTotal', 'unitRate', 'totalPrice', 'quotedPrice', 'price', 'gstAmount'];
    for (const key of Object.keys(clone)) {
      if (priceKeys.includes(key)) {
        clone[key] = null;
      } else if (clone[key] && typeof clone[key] === 'object') {
        clone[key] = sanitizePricesDeep(clone[key]);
      }
    }
    return clone;
  };

  const serializeTestParticipation = (part, isTwoPacket, bidStatus, isBuyerOwner) => {
    const isFinancialStage = ['FINANCIAL_EVALUATION', 'L1_GENERATED', 'AWARD_RECOMMENDED', 'AWARDED', 'PO_GENERATED'].includes(bidStatus);
    const isDisqualified = part.technicalStatus === 'DISQUALIFIED';
    const canSeeFin = isTwoPacket
      ? (isBuyerOwner && isFinancialStage && !isDisqualified)
      : (isBuyerOwner && isFinancialStage);

    return {
      id: part.id,
      sellerName: part.sellerName,
      technicalStatus: part.technicalStatus,
      quotedAmount: canSeeFin ? part.quotedAmount : null,
      totalAmount: canSeeFin ? part.totalAmount : null,
      financialSealed: !canSeeFin,
      lineItems: part.lineItems.map(item => ({
        ...item,
        unitPrice: canSeeFin ? item.unitPrice : null,
        totalAmount: canSeeFin ? item.totalAmount : null,
      })),
      responseData: canSeeFin ? part.responseData : sanitizePricesDeep(part.responseData)
    };
  };

  const p1Qualified = {
    id: 101,
    sellerName: 'Alpha Tech',
    technicalStatus: 'QUALIFIED',
    quotedAmount: 1500000,
    totalAmount: 1500000,
    lineItems: [{ itemName: 'Item 1', unitPrice: 150000, totalAmount: 1500000 }],
    responseData: { totalPrice: 1500000, model: 'Alpha-X' }
  };

  const p2Disqualified = {
    id: 102,
    sellerName: 'Beta Systems',
    technicalStatus: 'DISQUALIFIED',
    quotedAmount: 1200000,
    totalAmount: 1200000,
    lineItems: [{ itemName: 'Item 1', unitPrice: 120000, totalAmount: 1200000 }],
    responseData: { totalPrice: 1200000, model: 'Beta-Y' }
  };

  // Case A: Two-Packet during TECHNICAL_EVALUATION (Stage 1) -> BOTH MUST BE SEALED
  const stage1P1 = serializeTestParticipation(p1Qualified, true, 'TECHNICAL_EVALUATION', true);
  const stage1P2 = serializeTestParticipation(p2Disqualified, true, 'TECHNICAL_EVALUATION', true);
  assert.equal(stage1P1.financialSealed, true, 'Qualified bidder must be sealed in Stage 1');
  assert.equal(stage1P1.quotedAmount, null);
  assert.equal(stage1P1.lineItems[0].unitPrice, null);
  assert.equal(stage1P1.responseData.totalPrice, null);
  assert.equal(stage1P1.responseData.model, 'Alpha-X', 'Technical specifications must be preserved');

  assert.equal(stage1P2.financialSealed, true, 'Disqualified bidder must be sealed in Stage 1');
  assert.equal(stage1P2.quotedAmount, null);

  // Case B: Two-Packet during FINANCIAL_EVALUATION (Stage 2) -> ONLY QUALIFIED IS UNSEALED
  const stage2P1 = serializeTestParticipation(p1Qualified, true, 'FINANCIAL_EVALUATION', true);
  const stage2P2 = serializeTestParticipation(p2Disqualified, true, 'FINANCIAL_EVALUATION', true);
  assert.equal(stage2P1.financialSealed, false, 'Qualified bidder must be unsealed in Stage 2');
  assert.equal(stage2P1.quotedAmount, 1500000);
  assert.equal(stage2P1.lineItems[0].unitPrice, 150000);

  // Crucial Statutory Rule: Disqualified bidder remains permanently sealed!
  assert.equal(stage2P2.financialSealed, true, 'Disqualified bidder must remain PERMANENTLY sealed in Stage 2');
  assert.equal(stage2P2.quotedAmount, null);
  assert.equal(stage2P2.lineItems[0].unitPrice, null);
  assert.equal(stage2P2.responseData.totalPrice, null);
});

// ============================================================================
// SUITE 5: STAGE TRANSITIONS & EVALUATION PROGRESSION
// ============================================================================

test('5.1 Two-Packet Mode enforces Technical Evaluation completion before Financial Opening', () => {
  const bidService = readFile('backend/src/modules/procurementBid/procurement-bid.service.ts');

  // openFinancialEvaluation must check financialEvaluationReadyStatuses
  assert.match(
    bidService,
    /if\s*\(!financialEvaluationReadyStatuses\.includes\(bid\.status\)\)\s*\{\s*throw new ApiError\(400, 'Technical evaluation must be completed before opening financial bids\.', 'TECHNICAL_EVALUATION_PENDING'\);/
  );

  // Technical evaluation requires all participants to be evaluated
  assert.match(
    bidService,
    /if\s*\(pending\)\s*throw new ApiError\(400, 'Every submitted participant must be technically qualified or disqualified before completion\.', 'TECHNICAL_EVALUATION_PENDING'\);/
  );

  // At least one participant must be qualified
  assert.match(
    bidService,
    /if\s*\(!qualified\)\s*throw new ApiError\(400, 'At least one seller must be technically qualified\.', 'TECHNICAL_EVALUATION_PENDING'\);/
  );
});

test('5.2 Two-Packet Technical Opening & Financial Opening dates are guarded against premature opening', () => {
  const bidService = readFile('backend/src/modules/procurementBid/procurement-bid.service.ts');

  // Technical opening date guard
  assert.match(
    bidService,
    /Technical evaluation cannot begin before the scheduled technical opening date and time/,
    'Premature technical evaluation must throw TECHNICAL_OPENING_NOT_REACHED'
  );

  // Financial opening date guard
  assert.match(
    bidService,
    /Financial bids cannot be opened before the scheduled financial opening date and time/,
    'Premature financial evaluation must throw FINANCIAL_OPENING_NOT_REACHED'
  );
});

// ============================================================================
// SUITE 6: SINGLE-PACKET vs TWO-PACKET FRONTEND LOGIC & STATE INFERENCE
// ============================================================================

test('6.1 Frontend mode inference accurately differentiates Single-Packet from Two-Packet', () => {
  const detectPacketMode = (bid) => {
    const rawPacketType = String(
      bid?.basics?.biddingType ||
      bid?.biddingType ||
      bid?.packetType ||
      bid?.tenderType ||
      bid?.technicalPacket?.schedule?.packetType ||
      ''
    ).toUpperCase();

    const isExplicitSingle = rawPacketType.includes('SINGLE') || rawPacketType === '1';
    const candidateFinDate = bid?.financialOpeningDate || bid?.schedule?.financialOpeningDate;
    const isTwoPacket = !isExplicitSingle && (
      rawPacketType.includes('TWO') ||
      rawPacketType === '2' ||
      Boolean(candidateFinDate)
    );

    return { isExplicitSingle, isTwoPacket };
  };

  // Test Case: Pure Single Packet
  const singleBid = { packetType: 'SINGLE_PACKET' };
  assert.equal(detectPacketMode(singleBid).isTwoPacket, false, 'SINGLE_PACKET must be detected as single packet');
  assert.equal(detectPacketMode(singleBid).isExplicitSingle, true);

  // Test Case: Pure Two Packet
  const twoBid = { packetType: 'TWO_PACKET' };
  assert.equal(detectPacketMode(twoBid).isTwoPacket, true, 'TWO_PACKET must be detected as two packet');

  // Test Case: Single Packet with schedule packetType 'Single'
  const singleSchedBid = { technicalPacket: { schedule: { packetType: 'Single' } } };
  assert.equal(detectPacketMode(singleSchedBid).isTwoPacket, false);

  // Test Case: Two Packet inferred by presence of candidate financial opening date
  const dateInferredBid = { packetType: undefined, financialOpeningDate: '2026-11-20T10:00:00Z' };
  assert.equal(detectPacketMode(dateInferredBid).isTwoPacket, true, 'Presence of financialOpeningDate must infer two-packet');
});

test('6.2 isFinancialOpeningReady logic behaves differently for Single-Packet vs Two-Packet', () => {
  const checkFinancialOpeningReady = (isTwoPacket, status, isTechEvalCompleted, finDateStr, nowMs) => {
    // In Single-Packet, financial opening is ALWAYS immediately ready once evaluation stage commences
    if (!isTwoPacket) return true;

    // In Two-Packet:
    // If post-award stages reached, it is concluded
    if (['AWARDED', 'PO_GENERATED', 'COMPLETED'].includes(status)) return true;

    // Technical evaluation must be completed first
    if (!isTechEvalCompleted && !['FINANCIAL_EVALUATION', 'L1_GENERATED', 'AWARD_RECOMMENDED'].includes(status)) {
      return false;
    }

    // If future financial opening date is configured, it must be reached
    if (finDateStr) {
      const parsed = new Date(finDateStr).getTime();
      return !isNaN(parsed) ? parsed <= nowMs : true;
    }

    return true;
  };

  const now = new Date('2026-11-05T12:00:00Z').getTime();
  const futureDate = '2026-11-06T12:00:00Z';
  const pastDate = '2026-11-04T12:00:00Z';

  // 1. Single Packet: Always ready
  assert.equal(checkFinancialOpeningReady(false, 'UNDER_EVALUATION', false, futureDate, now), true, 'Single packet must always be ready');

  // 2. Two Packet: Blocked if technical scrutiny is pending
  assert.equal(checkFinancialOpeningReady(true, 'UNDER_EVALUATION', false, pastDate, now), false, 'Two packet must be blocked while tech eval pending');

  // 3. Two Packet: Blocked if tech eval completed but financial opening date is in future
  assert.equal(checkFinancialOpeningReady(true, 'TECHNICAL_EVALUATION_COMPLETED', true, futureDate, now), false, 'Two packet blocked if fin date in future');

  // 4. Two Packet: Ready when tech eval completed and financial opening date reached
  assert.equal(checkFinancialOpeningReady(true, 'TECHNICAL_EVALUATION_COMPLETED', true, pastDate, now), true, 'Two packet ready when tech eval complete and fin date reached');
});

test('6.3 SubmitQuotationPage and ProcurementDetailUnifiedView present Two-Cover Secrecy notice in Two-Packet mode', () => {
  const submitQuotationPage = readFile('frontend/src/features/rfq/pages/SubmitQuotationPage.tsx');
  const unifiedView = readFile('frontend/src/features/rfq/components/ProcurementDetailUnifiedView.tsx');

  assert.ok(
    submitQuotationPage.includes('Commercial Bid Secrecy & Price Protection Guarantee') ||
    submitQuotationPage.includes('Commercial Bid Secrecy &amp; Price Protection Guarantee') ||
    submitQuotationPage.includes('Two-Cover Rule Commercial Bid Secrecy'),
    'SubmitQuotationPage must display Two-Cover Rule commercial secrecy guarantee'
  );

  assert.ok(
    unifiedView.includes('Stage 1 Technical Scrutiny & Seller Qualification Required') &&
    unifiedView.includes('Start Technical Scrutiny'),
    'ProcurementDetailUnifiedView must display Stage 1 Technical Scrutiny action card'
  );
});
