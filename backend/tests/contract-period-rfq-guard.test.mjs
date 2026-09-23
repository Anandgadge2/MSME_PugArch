import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = path.resolve(process.cwd(), '..');

test('1. ProcurementDetailUnifiedView gates Contract Period display strictly away from RFQs', () => {
  const unifiedViewPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'rfq', 'components', 'ProcurementDetailUnifiedView.tsx');
  const code = fs.readFileSync(unifiedViewPath, 'utf8');

  // Contract period must be gated by !isRfqType && (isRateContractType || isServices)
  assert.ok(
    code.includes('!isRfqType &&') && code.includes('(isRateContractType || isServices)'),
    'Contract Period must be gated by !isRfqType && (isRateContractType || isServices)'
  );

  // Contract period must not show if periodVal is falsy, "—", "N/A", or "Not Specified"
  assert.ok(
    code.includes('periodVal === "—"') &&
    code.includes('periodVal === "N/A"') &&
    code.includes('periodVal === "Not Specified"'),
    'Contract Period must suppress rendering for empty, placeholder or N/A values'
  );
});

test('2. ProcurementDetailUnifiedView gates projectDuration away from RFQs', () => {
  const unifiedViewPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'rfq', 'components', 'ProcurementDetailUnifiedView.tsx');
  const code = fs.readFileSync(unifiedViewPath, 'utf8');

  assert.ok(
    code.includes('const projectDuration = (!isRfqType && (isServices || isRateContractType))'),
    'projectDuration computation must ignore RFQs and goods'
  );
});

test('3. CreateProcurementPage INITIAL_WIZARD_DATA contains zero dummy / mock values for serviceDetails', () => {
  const wizardPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'procurementWizard', 'pages', 'CreateProcurementPage.tsx');
  const code = fs.readFileSync(wizardPath, 'utf8');

  // Must not have hardcoded duration '1 Year' or sla '4 hours' or fake milestones
  assert.ok(!code.includes("duration: '1 Year'"), 'INITIAL_WIZARD_DATA must not contain dummy "1 Year" duration');
  assert.ok(!code.includes("slaResponseTime: '4 hours'"), 'INITIAL_WIZARD_DATA must not contain dummy "4 hours" SLA');
  assert.ok(!code.includes("penaltyClause: '0.5% per week delay up to max 10%'"), 'INITIAL_WIZARD_DATA must not contain dummy penaltyClause');
  assert.ok(code.includes("duration: ''"), 'INITIAL_WIZARD_DATA must initialize duration as empty string');
  assert.ok(code.includes("slaResponseTime: ''"), 'INITIAL_WIZARD_DATA must initialize slaResponseTime as empty string');
  assert.ok(code.includes("milestones: []"), 'INITIAL_WIZARD_DATA must initialize milestones as empty array');
});

test('4. CreateProcurementPage payloadJson attaches serviceDetails strictly for Services procurements', () => {
  const wizardPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'procurementWizard', 'pages', 'CreateProcurementPage.tsx');
  const code = fs.readFileSync(wizardPath, 'utf8');

  assert.ok(
    code.includes("serviceDetails: draft.basics.whatAreYouBuying === 'Services'"),
    'payloadJson must strictly gate serviceDetails to Services purchases and set null for goods/BOQ'
  );
});
