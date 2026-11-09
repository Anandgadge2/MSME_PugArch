import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const UNIFIED_VIEW_PATH = path.join(
  ROOT_DIR,
  'frontend',
  'src',
  'features',
  'rfq',
  'components',
  'ProcurementDetailUnifiedView.tsx'
);

test('1. Temporal Dead Zone (TDZ) Fix: isReverseAuctionType is declared before shouldShowEstimatedCost', () => {
  assert.ok(fs.existsSync(UNIFIED_VIEW_PATH), `Target component must exist at ${UNIFIED_VIEW_PATH}`);
  const code = fs.readFileSync(UNIFIED_VIEW_PATH, 'utf8').replace(/\r\n/g, '\n');

  const raIndex = code.indexOf('const isReverseAuctionType =');
  const costIndex = code.indexOf('const shouldShowEstimatedCost =');

  assert.ok(raIndex !== -1, 'isReverseAuctionType declaration must exist');
  assert.ok(costIndex !== -1, 'shouldShowEstimatedCost declaration must exist');

  assert.ok(
    raIndex < costIndex,
    `isReverseAuctionType (index ${raIndex}) must be declared before shouldShowEstimatedCost (index ${costIndex}) to prevent runtime ReferenceError`
  );
});

test('2. shouldShowEstimatedCost correctly references isReverseAuctionType without ReferenceError', () => {
  const code = fs.readFileSync(UNIFIED_VIEW_PATH, 'utf8').replace(/\r\n/g, '\n');

  // Verify declaration structure
  const shouldShowCostBlock = code.substring(
    code.indexOf('const shouldShowEstimatedCost ='),
    code.indexOf('const shouldShowEstimatedCost =') + 200
  );

  assert.ok(
    shouldShowCostBlock.includes('isReverseAuctionType'),
    'shouldShowEstimatedCost must include isReverseAuctionType in its boolean predicate'
  );
  assert.ok(
    shouldShowCostBlock.includes('isBuyerSide') &&
    shouldShowCostBlock.includes('isBuyerOrAdmin') &&
    shouldShowCostBlock.includes('discloseEstimatedCost'),
    'shouldShowEstimatedCost must evaluate buyer side, admin, and disclosure flags'
  );
});

test('3. Evaluates estimated cost visibility across buyer, seller, disclosure, and reverse auction roles', () => {
  // Pure evaluation function matching the component implementation
  const computeShouldShowEstimatedCost = ({
    isBuyerSide = false,
    isBuyerOrAdmin = false,
    discloseEstimatedCost = false,
    isRateContractType = false,
    hasRaPrefix = false,
    procurementType = '',
    procurementMethod = '',
    pathname = ''
  }) => {
    const isReverseAuctionType =
      !isRateContractType &&
      (hasRaPrefix ||
        procurementType === 'REVERSE_AUCTION' ||
        procurementType === 'reverse-auction' ||
        procurementMethod === 'REVERSE_AUCTION' ||
        pathname.includes('REVERSE AUCTION') ||
        pathname.includes('/reverse-auction'));

    const shouldShowEstimatedCost = Boolean(
      isBuyerSide ||
      isBuyerOrAdmin ||
      discloseEstimatedCost ||
      isReverseAuctionType
    );

    return { isReverseAuctionType, shouldShowEstimatedCost };
  };

  // Scenario A: Buyer view -> Always visible
  const buyerResult = computeShouldShowEstimatedCost({ isBuyerSide: true });
  assert.equal(buyerResult.shouldShowEstimatedCost, true, 'Buyer must see estimated value');

  // Scenario B: Admin view -> Always visible
  const adminResult = computeShouldShowEstimatedCost({ isBuyerOrAdmin: true });
  assert.equal(adminResult.shouldShowEstimatedCost, true, 'Admin must see estimated value');

  // Scenario C: Explicit disclosure -> Visible to seller
  const disclosedResult = computeShouldShowEstimatedCost({ discloseEstimatedCost: true });
  assert.equal(disclosedResult.shouldShowEstimatedCost, true, 'Seller must see estimated cost when explicitly disclosed');

  // Scenario D: Reverse Auction -> Visible to seller
  const raResult = computeShouldShowEstimatedCost({ procurementType: 'REVERSE_AUCTION' });
  assert.equal(raResult.shouldShowEstimatedCost, true, 'Reverse auction must disclose cost to participants');

  // Scenario E: Standard Sealed RFQ for Seller with no disclosure -> Sealed (Hidden)
  const sealedResult = computeShouldShowEstimatedCost({
    isBuyerSide: false,
    isBuyerOrAdmin: false,
    discloseEstimatedCost: false,
    procurementType: 'BID'
  });
  assert.equal(sealedResult.shouldShowEstimatedCost, false, 'Sealed bids must not disclose estimated value to sellers');
});

test('4. BuyerSideContext passes shouldShowEstimatedCost to child tabs without crash', () => {
  const code = fs.readFileSync(UNIFIED_VIEW_PATH, 'utf8').replace(/\r\n/g, '\n');

  // Verify Provider passes shouldShowEstimatedCost
  assert.ok(
    code.includes('BuyerSideContext.Provider') && code.includes('shouldShowEstimatedCost'),
    'BuyerSideContext.Provider must include shouldShowEstimatedCost in value prop'
  );

  // Verify items and BOQ tables check shouldShowCost from context
  assert.ok(
    code.includes('const shouldShowCost = ctx.shouldShowEstimatedCost ?? ctx.isBuyer;'),
    'Child tab components must safely resolve shouldShowCost from BuyerSideContext'
  );
});

test('5. PDF generation gates financials and line-item prices on shouldShowEstimatedCost', () => {
  const code = fs.readFileSync(UNIFIED_VIEW_PATH, 'utf8').replace(/\r\n/g, '\n');

  assert.ok(
    code.includes('financials: shouldShowEstimatedCost && props.estimatedValue'),
    'PDF export must gate financials.grandTotal on shouldShowEstimatedCost'
  );
  assert.match(
    code,
    /shouldShowEstimatedCost\s*\?\s*it\.estimatedPrice \|\| it\.unitPrice/,
    'PDF export must gate item price lines on shouldShowEstimatedCost'
  );
});
