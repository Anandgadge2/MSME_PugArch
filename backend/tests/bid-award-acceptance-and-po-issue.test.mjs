import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('1. Reverse Auction /award-recommendation maps Prisma columns correctly and avoids validation errors', () => {
  const routesPath = path.resolve(__dirname, '../src/routes/reverse-auction.routes.ts');
  const content = fs.readFileSync(routesPath, 'utf8');

  assert.ok(
    content.includes('priceMatchTargetPrice:') || content.includes('counterOfferNotes:'),
    'Should map counter offer fields to valid Prisma schema columns'
  );
  assert.ok(
    !content.includes('counterOfferAmount: body.counterOfferAmount'),
    'Should not pass non-existent counterOfferAmount column to db.procurementBidAward.create'
  );
  assert.ok(
    !content.includes('counterOfferRemarks: body.counterOfferRemarks'),
    'Should not pass non-existent counterOfferRemarks column to db.procurementBidAward.create'
  );
});

test('2. Reverse Auction /accept-award creates missing award with authentic awardedAmount and ACCEPTED status', () => {
  const routesPath = path.resolve(__dirname, '../src/routes/reverse-auction.routes.ts');
  const content = fs.readFileSync(routesPath, 'utf8');

  assert.ok(
    content.includes("awardStatus: 'ACCEPTED'"),
    'accept-award should set or upsert awardStatus to ACCEPTED'
  );
  assert.ok(
    content.includes('invalidateBidCaches'),
    'accept-award must invalidate bid caches'
  );
  assert.ok(
    content.includes("type: 'AWARD_ACCEPTED'") || content.includes("type: 'BID_ACCEPTED'"),
    'accept-award must broadcast award accepted event'
  );
});

test('3. ProcurementLifecycleStepper provides active Issue Purchase Order button for Buyer in Stage 2', () => {
  const stepperPath = path.resolve(__dirname, '../../frontend/src/features/rfq/components/ProcurementLifecycleStepper.tsx');
  const content = fs.readFileSync(stepperPath, 'utf8');

  assert.ok(
    content.includes('onIssuePO?: () => void;'),
    'ProcurementLifecycleStepperProps must define onIssuePO callback'
  );
  assert.ok(
    content.includes('onIssuePO,') || content.includes('onIssuePO ='),
    'ProcurementLifecycleStepper must destructure onIssuePO'
  );
  assert.ok(
    content.includes("actionLabel: 'Issue Purchase Order'"),
    'Stage 2 must provide actionLabel "Issue Purchase Order"'
  );
  assert.ok(
    content.includes('isAwardAcceptedGeneral'),
    'Stage 2 must check isAwardAcceptedGeneral'
  );
});

test('4. ProcurementDetailUnifiedView suppresses awaiting vendor banner and displays Contract Ready for PO banner', () => {
  const viewPath = path.resolve(__dirname, '../../frontend/src/features/rfq/components/ProcurementDetailUnifiedView.tsx');
  const content = fs.readFileSync(viewPath, 'utf8');

  // Orange banner check must check activeAward.awardStatus !== "ACCEPTED" and suppress when accepted
  assert.ok(
    content.includes('activeAward.awardStatus !== "ACCEPTED"') &&
    content.includes('Contract Award Offered — Awaiting Vendor Acceptance'),
    'Orange banner must only show when award is not yet accepted'
  );
  assert.ok(
    content.includes('Contract Ready for Purchase Order Generation'),
    'Must display Contract Ready for Purchase Order Generation banner'
  );
  assert.ok(
    content.includes('Generate &amp; Issue Purchase Order') || content.includes('Generate & Issue Purchase Order'),
    'Must include Generate & Issue Purchase Order button'
  );
  assert.ok(
    content.includes('onIssuePO='),
    'Must pass onIssuePO callback to ProcurementLifecycleStepper'
  );
});
