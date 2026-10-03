import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const BACKEND_DIR = process.cwd();
const ROOT_DIR = path.resolve(BACKEND_DIR, '..');

test('1. Prisma schema declares ProcurementCategoryType and ProcurementPricingFormat enums', () => {
  const schemaPath = path.join(BACKEND_DIR, 'prisma', 'schema.prisma');
  const code = fs.readFileSync(schemaPath, 'utf8');

  assert.ok(code.includes('enum ProcurementCategoryType'), 'Must declare ProcurementCategoryType enum');
  assert.ok(code.includes('GOODS') && code.includes('SERVICES') && code.includes('WORKS'), 'Must include GOODS, SERVICES, WORKS in ProcurementCategoryType');

  assert.ok(code.includes('enum ProcurementPricingFormat'), 'Must declare ProcurementPricingFormat enum');
  assert.ok(code.includes('SINGLE_ITEM') && code.includes('BOQ') && code.includes('SOR'), 'Must include SINGLE_ITEM, BOQ, SOR in ProcurementPricingFormat');

  assert.ok(code.includes('categoryType          ProcurementCategoryType?'), 'ProcurementBid must have categoryType field');
  assert.ok(code.includes('pricingFormat         ProcurementPricingFormat?'), 'ProcurementBid must have pricingFormat field');
  assert.ok(code.includes('@@index([categoryType, pricingFormat])'), 'ProcurementBid must have composite index on categoryType and pricingFormat');
});

test('2. Backend phase4.routes.ts normalizes two-tier category and pricing format in validateProcurementSubmission', () => {
  const routesPath = path.join(BACKEND_DIR, 'src', 'routes', 'phase4.routes.ts');
  const code = fs.readFileSync(routesPath, 'utf8');

  assert.ok(code.includes("const categoryType: 'GOODS' | 'SERVICES' | 'WORKS'"), 'Must normalize categoryType');
  assert.ok(code.includes("const pricingFormat: 'SINGLE_ITEM' | 'BOQ' | 'SOR'"), 'Must normalize pricingFormat');
  assert.ok(code.includes('PROCUREMENT_SERVICE_TITLE_REQUIRED'), 'Must enforce service title for SERVICES category');
  assert.ok(code.includes('PROCUREMENT_SERVICE_SOW_REQUIRED'), 'Must enforce SOW for SERVICES category');
  assert.ok(code.includes('PROCUREMENT_BOQ_EMPTY'), 'Must enforce non-empty BOQ table for BOQ/SOR pricing formats');
  assert.ok(code.includes('categoryType: ('), 'Must set categoryType in ProcurementBid creation');
  assert.ok(code.includes('pricingFormat: ('), 'Must set pricingFormat in ProcurementBid creation');
});

test('3. Frontend CreateProcurementPage.tsx defines CATEGORIES_BY_METHOD and FORMATS_BY_METHOD matrices', () => {
  const wizardPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'procurementWizard', 'pages', 'CreateProcurementPage.tsx');
  const code = fs.readFileSync(wizardPath, 'utf8');

  assert.ok(code.includes('export const CATEGORIES_BY_METHOD: Record<ProcurementMethodId'), 'Must define CATEGORIES_BY_METHOD matrix');
  assert.ok(code.includes('export const FORMATS_BY_METHOD: Record<ProcurementMethodId'), 'Must define FORMATS_BY_METHOD matrix');
  assert.ok(code.includes('procurement-category-select'), 'Basics form must render accessible procurement-category-select');
  assert.ok(code.includes('pricing-format-select'), 'Basics form must render accessible pricing-format-select');
  assert.ok(code.includes('Primary category of what is being procured'), 'Must provide clear helper text for Category');
  assert.ok(code.includes('Pricing structure: Direct Item quote'), 'Must provide clear helper text for Format');
});

test('4. Frontend CreateProcurementPage.tsx provides context-aware template generation for Goods, Services, Works, BOQ, and SOR', () => {
  const wizardPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'procurementWizard', 'pages', 'CreateProcurementPage.tsx');
  const code = fs.readFileSync(wizardPath, 'utf8');

  assert.ok(code.includes('procurement_sor_rate_schedule_template'), 'Must generate SOR rate schedule template');
  assert.ok(code.includes('procurement_works_boq_template'), 'Must generate Works BOQ template');
  assert.ok(code.includes('procurement_services_template'), 'Must generate Services SOW template');
  assert.ok(code.includes('procurement_goods_template'), 'Must generate Goods item template');
});

test('5. Zero legacy category code: whatAreYouBuying and BUYING_OPTIONS_BY_METHOD are completely purged', () => {
  const wizardPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'procurementWizard', 'pages', 'CreateProcurementPage.tsx');
  const wizardCode = fs.readFileSync(wizardPath, 'utf8');
  assert.ok(!wizardCode.includes('whatAreYouBuying'), 'CreateProcurementPage must not contain whatAreYouBuying');
  assert.ok(!wizardCode.includes('BUYING_OPTIONS_BY_METHOD'), 'CreateProcurementPage must not contain BUYING_OPTIONS_BY_METHOD');

  const phase4Path = path.join(BACKEND_DIR, 'src', 'routes', 'phase4.routes.ts');
  const phase4Code = fs.readFileSync(phase4Path, 'utf8');
  assert.ok(!phase4Code.includes('whatAreYouBuying'), 'phase4.routes.ts must not contain whatAreYouBuying');

  const bidRoutesPath = path.join(BACKEND_DIR, 'src', 'modules', 'procurementBid', 'procurement-bid.routes.ts');
  const bidRoutesCode = fs.readFileSync(bidRoutesPath, 'utf8');
  assert.ok(!bidRoutesCode.includes('whatAreYouBuying'), 'procurement-bid.routes.ts must not contain whatAreYouBuying');
});
