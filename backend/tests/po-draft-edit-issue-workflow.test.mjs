import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('1. Backend generatePOForBid supports asDraft option and sets DRAFT status without premature notification', () => {
  const servicePath = path.resolve(__dirname, '../src/modules/procurementBid/procurement-bid.service.ts');
  const content = fs.readFileSync(servicePath, 'utf8');

  assert.ok(
    content.includes("status: 'draft'") && content.includes("poStatus: 'DRAFT'") && content.includes("isDraft: true"),
    'Must support setting PO status to draft / DRAFT with isDraft: true'
  );
  assert.ok(
    content.includes("shouldIssueImmediately"),
    'Must evaluate shouldIssueImmediately based on asDraft / issueImmediately parameters'
  );
});

test('2. Backend procurement-bid routes validate asDraft and issueImmediately parameters', () => {
  const routesPath = path.resolve(__dirname, '../src/modules/procurementBid/procurement-bid.routes.ts');
  const content = fs.readFileSync(routesPath, 'utf8');

  assert.ok(
    content.includes('asDraft: z.boolean().optional()') && content.includes('issueImmediately: z.boolean().optional()'),
    'Route schema must validate optional asDraft and issueImmediately boolean flags'
  );
});

test('3. Backend phase4 routes provide draft update, issue, and recall endpoints', () => {
  const routesPath = path.resolve(__dirname, '../src/routes/phase4.routes.ts');
  const content = fs.readFileSync(routesPath, 'utf8');

  assert.ok(
    content.includes("router.put('/purchase-orders/:id/draft'"),
    'Must provide draft editing endpoint'
  );
  assert.ok(
    content.includes("router.post('/purchase-orders/:id/issue'"),
    'Must provide official issue endpoint'
  );
  assert.ok(
    content.includes("router.post('/purchase-orders/:id/recall'"),
    'Must provide recall endpoint for pre-acceptance modification'
  );
});

test('4. ProcurementDetailUnifiedView integrates EditPurchaseOrderModal and provides Draft, Edit, and Recall actions', () => {
  const viewPath = path.resolve(__dirname, '../../frontend/src/features/rfq/components/ProcurementDetailUnifiedView.tsx');
  const content = fs.readFileSync(viewPath, 'utf8');

  assert.ok(
    content.includes('EditPurchaseOrderModal'),
    'Must dynamically import and render EditPurchaseOrderModal'
  );
  assert.ok(
    content.includes('Generate &amp; Edit PO Draft') || content.includes('Generate & Edit PO Draft'),
    'Must offer Generate & Edit PO Draft action on award accepted banner'
  );
  assert.ok(
    content.includes('isPODraft'),
    'Must define and handle isPODraft state'
  );
  assert.ok(
    content.includes('Edit PO Draft'),
    'Must offer Edit PO Draft action when in draft phase'
  );
  assert.ok(
    content.includes('Issue PO to Supplier'),
    'Must provide Issue PO to Supplier action when draft is ready'
  );
  assert.ok(
    content.includes('Edit / Recall PO'),
    'Must provide Edit / Recall PO action when PO is issued but pending acceptance'
  );
});

test('5. ProcurementLifecycleStepper provides Review & Issue PO action for Draft POs in Stage 2', () => {
  const stepperPath = path.resolve(__dirname, '../../frontend/src/features/rfq/components/ProcurementLifecycleStepper.tsx');
  const content = fs.readFileSync(stepperPath, 'utf8');

  assert.ok(
    content.includes('isDraftPo'),
    'Must check if the PO is in draft state'
  );
  assert.ok(
    content.includes('Review & Issue PO'),
    'Stage 2 must provide actionLabel "Review & Issue PO" for buyer when in draft'
  );
});
