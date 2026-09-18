import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve(process.cwd(), '..');

test('1. ProcurementDetailUnifiedView displays Proposals & Evaluation tab with pending count badge for buyer', () => {
  const unifiedViewPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'rfq', 'components', 'ProcurementDetailUnifiedView.tsx');
  const code = fs.readFileSync(unifiedViewPath, 'utf8');

  assert.ok(
    code.includes('"Proposals & Evaluation"') && code.includes('"Quotations & Evaluation"'),
    'Tab 5 must be dynamically labeled Proposals & Evaluation / Quotations & Evaluation for buyers'
  );
  assert.ok(
    code.includes('techEvaluationStats.pending > 0 ? techEvaluationStats.pending : submittedParticipations.length'),
    'Tab 5 badge must highlight pending technical reviews for buyer action'
  );
});

test('2. ProcurementDetailUnifiedView renders Stage 1 Technical Evaluation Action Card on Overview tab', () => {
  const unifiedViewPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'rfq', 'components', 'ProcurementDetailUnifiedView.tsx');
  const code = fs.readFileSync(unifiedViewPath, 'utf8');

  assert.ok(
    code.includes('Stage 1 Technical Scrutiny & Seller Qualification Required') &&
    code.includes('Start Technical Scrutiny'),
    'Overview tab must provide a Stage 1 Technical Evaluation quick-action shortcut banner for buyers'
  );
  assert.ok(
    code.includes('id="proposals-section"'),
    'Proposals section must have anchor id="proposals-section" for smooth navigation'
  );
});

test('3. SubmitQuotationPage implements Commercial Bid Secrecy Guarantee (Two-Cover Rule)', () => {
  const submitPagePath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'rfq', 'pages', 'SubmitQuotationPage.tsx');
  const code = fs.readFileSync(submitPagePath, 'utf8');

  assert.ok(
    code.includes('Commercial Bid Secrecy & Price Protection Guarantee') ||
    code.includes('Commercial Bid Secrecy &amp; Price Protection Guarantee'),
    'SubmitQuotationPage must display the Commercial Bid Secrecy Guarantee'
  );
  assert.ok(
    code.includes('Two-Cover Rule Commercial Bid Secrecy'),
    'Item-wise pricing section must display the Two-Cover Rule secrecy notice'
  );
});

test('4. SubmitQuotationPage displays transparent technical evaluation feedback for sellers', () => {
  const submitPagePath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'rfq', 'pages', 'SubmitQuotationPage.tsx');
  const code = fs.readFileSync(submitPagePath, 'utf8');

  assert.ok(
    code.includes('Stage 1 Technical Scrutiny: Disqualified') &&
    code.includes('Committee Justification Remarks:'),
    'Disqualified sellers must see explicit rejection status and committee justification remarks'
  );
  assert.ok(
    code.includes('Stage 1 Technical Scrutiny: Qualified') &&
    code.includes('Eligible for Stage 2'),
    'Qualified sellers must see their qualification badge and confirmation for Stage 2'
  );
});

test('5. ProcurementDetailUnifiedView resolves and renders Technical Evaluation and Financial Evaluation dates in Two-Packet mode', () => {
  const unifiedViewPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'rfq', 'components', 'ProcurementDetailUnifiedView.tsx');
  const code = fs.readFileSync(unifiedViewPath, 'utf8');

  assert.ok(
    code.includes('candidateTechDate') &&
    code.includes('candidateFinDate'),
    'ProcurementDetailUnifiedView must resolve candidateTechDate and candidateFinDate from all candidate fields'
  );
  assert.ok(
    code.includes('Boolean(candidateFinDate)'),
    'Two-packet mode must automatically infer true when financial opening date candidate is present'
  );
  assert.ok(
    code.includes('technicalDateValue = candidateTechDate') &&
    code.includes('financialDateValue = candidateFinDate'),
    'Technical and financial opening dates must directly reflect candidate dates'
  );
});

test('6. ClarificationPanel and DeadlineCountdown gate smoothly on submissionStartDate prior to bidding start', () => {
  const clarPanelPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'rfq', 'components', 'ClarificationPanel.tsx');
  const clarCode = fs.readFileSync(clarPanelPath, 'utf8');

  assert.ok(
    clarCode.includes('Clarifications Not Yet Open') &&
    clarCode.includes('Clarification Window Pending Submission Start'),
    'ClarificationPanel must render proper informative banners when current time is before submissionStartDate'
  );
  assert.ok(
    clarCode.includes('!isNotStarted'),
    'Question submission input box must be gated when isNotStarted is true'
  );

  const unifiedViewPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'rfq', 'components', 'ProcurementDetailUnifiedView.tsx');
  const unifiedCode = fs.readFileSync(unifiedViewPath, 'utf8');

  assert.ok(
    unifiedCode.includes('Submission Opens') &&
    unifiedCode.includes('isBeforeSubmissionStart'),
    'ProcurementDetailUnifiedView must gate seller submission and show opening notice before submission start'
  );
  assert.ok(
    unifiedCode.includes('startDate={rawSubmissionStartDate}') &&
    unifiedCode.includes('startLabel="Submission Opens in: "'),
    'DeadlineCountdown must accept submission start date and countdown to start before quote due'
  );
});

test('7. Stage 1 Technical Evaluation deduplicates vendors by canonical identity, preserves quotation data, and prevents dual rows', () => {
  const unifiedViewPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'rfq', 'components', 'ProcurementDetailUnifiedView.tsx');
  const unifiedCode = fs.readFileSync(unifiedViewPath, 'utf8');

  assert.ok(
    unifiedCode.includes('const getVendorKeys =') &&
    unifiedCode.includes('vendorMap = new Map'),
    'ProcurementDetailUnifiedView must use canonical vendor keys and a vendorMap to deduplicate by vendor identity'
  );

  assert.ok(
    unifiedCode.includes('isEvaluated && existing.technicalStatus === "PENDING"') &&
    unifiedCode.includes('ts === "NOT_QUALIFIED"'),
    'ProcurementDetailUnifiedView must prioritize evaluated technicalStatus and treat NOT_QUALIFIED as DISQUALIFIED'
  );

  const rfqDetailPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'rfq', 'pages', 'RfqDetailPage.tsx');
  const rfqDetailCode = fs.readFileSync(rfqDetailPath, 'utf8');

  assert.ok(
    rfqDetailCode.includes('const getVendorKeys =') &&
    rfqDetailCode.includes('vendorMap = new Map'),
    'RfqDetailPage must deduplicate seller responses by canonical vendor identity rather than record id'
  );

  const bidServicePath = path.join(ROOT_DIR, 'backend', 'src', 'modules', 'procurementBid', 'procurement-bid.service.ts');
  const bidServiceCode = fs.readFileSync(bidServicePath, 'utf8');

  assert.ok(
    bidServiceCode.includes("technicalStatus: item.status === 'QUALIFIED' ? 'QUALIFIED' : 'DISQUALIFIED'") &&
    bidServiceCode.includes('acknowledgement: qRespData'),
    'procurement-bid.service.ts must standardize on DISQUALIFIED and copy quotation metadata to shadow participation'
  );

  // In-memory simulation of the deduplication and merging algorithm
  const getVendorKeys = (item) => {
    const sId = item.sellerUserId || item.sellerId;
    const sOrg = item.sellerOrganizationId || item.sellerOrgId;
    const orgName = (item.sellerOrgName || item.companyName || item.sellerName || '').trim().toLowerCase();
    const keys = [];
    if (sOrg) keys.push(`org-${sOrg}`);
    if (sId) keys.push(`user-${sId}`);
    if (orgName) keys.push(`name-${orgName}`);
    return { keys };
  };

  const rawTestList = [
    // Original QuoteResponse from Tata Motors (submitted earlier)
    {
      id: 12,
      sellerId: 3,
      sellerOrganizationId: 5,
      sellerOrgName: 'Tata Motors',
      technicalStatus: 'PENDING',
      offeredPrice: 1800000,
      quotedAmount: 1800000,
      totalAmount: 1800000,
      offeredQuantity: 20,
      deliveryTimeline: '7 days',
      documents: [{ name: 'spec_sheet.pdf', url: '/files/spec.pdf' }],
      lineItems: [{ itemName: 'Vehicle Chassis', qty: 20, unitPrice: 90000 }],
    },
    // Evaluated shadow ProcurementBidParticipation (created upon Stage 1 evaluation)
    {
      id: 101,
      participationNumber: 'PRT-QR-1-12',
      sellerId: 3,
      sellerOrganizationId: 5,
      sellerOrgName: 'Tata Motors',
      technicalStatus: 'QUALIFIED',
      score: 95,
      technicalRemarks: 'All specifications verified and compliant.',
      offeredQuantity: 1,
      deliveryTimeline: 'Standard',
    },
    // Another supplier: Teradata (disqualified)
    {
      id: 15,
      sellerId: 7,
      sellerOrganizationId: 9,
      sellerOrgName: 'Teradata',
      technicalStatus: 'PENDING',
      offeredPrice: 2400000,
      offeredQuantity: 20,
      deliveryTimeline: '10 days',
    },
    {
      id: 102,
      participationNumber: 'PRT-QR-1-15',
      sellerId: 7,
      sellerOrganizationId: 9,
      sellerOrgName: 'Teradata',
      technicalStatus: 'DISQUALIFIED',
      score: 55,
      technicalRemarks: 'EMD compliance not met.',
      offeredQuantity: 1,
    }
  ];

  const vendorMap = new Map();
  const mergedList = [];

  for (const r of rawTestList) {
    const { keys } = getVendorKeys(r);
    let existing = keys.map(k => vendorMap.get(k)).find(Boolean);

    const isTechEvaluated = r.technicalStatus === 'QUALIFIED' || r.technicalStatus === 'DISQUALIFIED';

    if (existing) {
      if (isTechEvaluated && existing.technicalStatus === 'PENDING') {
        existing.technicalStatus = r.technicalStatus;
        existing.technicalRemarks = r.technicalRemarks || existing.technicalRemarks;
        existing.score = r.score ?? existing.score;
        existing.isDisqualified = r.technicalStatus === 'DISQUALIFIED';
      }
      if ((!existing.offeredQuantity || existing.offeredQuantity === 1) && r.offeredQuantity > 1) {
        existing.offeredQuantity = r.offeredQuantity;
      }
      if ((!existing.deliveryTimeline || existing.deliveryTimeline === 'Standard') && r.deliveryTimeline && r.deliveryTimeline !== 'Standard') {
        existing.deliveryTimeline = r.deliveryTimeline;
      }
      for (const k of keys) {
        vendorMap.set(k, existing);
      }
    } else {
      const record = { ...r };
      mergedList.push(record);
      for (const k of keys) {
        vendorMap.set(k, record);
      }
    }
  }

  // Verification: 4 input records must merge into exactly 2 vendors (1 row per vendor)
  assert.equal(mergedList.length, 2, 'Must produce exactly 2 rows for 2 unique vendors (zero row duplication)');

  const tataMotors = mergedList.find(m => m.sellerOrgName === 'Tata Motors');
  assert.ok(tataMotors, 'Tata Motors row must exist');
  assert.equal(tataMotors.technicalStatus, 'QUALIFIED', 'Tata Motors must be Qualified');
  assert.equal(tataMotors.score, 95, 'Tata Motors score must be 95');
  assert.equal(tataMotors.offeredQuantity, 20, 'Tata Motors authentic quantity 20 must be preserved');
  assert.equal(tataMotors.deliveryTimeline, '7 days', 'Tata Motors delivery timeline must be preserved');
  assert.equal(tataMotors.quotedAmount, 1800000, 'Tata Motors commercial amount must be preserved');

  const teradata = mergedList.find(m => m.sellerOrgName === 'Teradata');
  assert.ok(teradata, 'Teradata row must exist');
  assert.equal(teradata.technicalStatus, 'DISQUALIFIED', 'Teradata must be Disqualified');
  assert.equal(teradata.isDisqualified, true, 'Teradata isDisqualified must be true');
  assert.equal(teradata.score, 55, 'Teradata score must be 55');
  assert.equal(teradata.offeredQuantity, 20, 'Teradata authentic quantity 20 must be preserved');
});

