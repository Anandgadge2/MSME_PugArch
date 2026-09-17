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
