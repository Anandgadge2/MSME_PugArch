import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const BACKEND_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const ROOT_DIR = path.resolve(BACKEND_DIR, '..');

test('1. Direct Reverse Auction (Option A) locks packet configuration to Single and hides packet selector', () => {
  const wizardPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'procurementWizard', 'pages', 'CreateProcurementPage.tsx');
  const code = fs.readFileSync(wizardPath, 'utf8');

  // Verify packetType is set to 'Single' in syncAuctionDefaults
  assert.ok(code.includes("packetType: 'Single'"), 'syncAuctionDefaults must force packetType to Single for Direct RA');
  assert.ok(code.includes("isTechnicalEvaluationNeeded: false"), 'syncAuctionDefaults must set isTechnicalEvaluationNeeded to false for Direct RA');

  // Verify Direct RA banner replaces the packet selector
  assert.ok(code.includes('Direct Reverse Auction: Single-Stage Live Floor'), 'Must render Direct Reverse Auction banner');
  assert.ok(code.includes('isReverseAuctionMethod(draft.type) ?'), 'Must branch on isReverseAuctionMethod for packet selector');
});

test('2. Direct Reverse Auction does not require technicalOpeningDate or financialOpeningDate', () => {
  const wizardPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'procurementWizard', 'pages', 'CreateProcurementPage.tsx');
  const code = fs.readFileSync(wizardPath, 'utf8');

  // Verify validations guard against Direct RA
  assert.ok(code.includes("!isReverseAuctionMethod(d.type) && (d.basics.isTechnicalEvaluationNeeded || d.schedule.packetType === 'Two')"), 'Technical opening validation must exclude Direct RA');
  assert.ok(code.includes("!isReverseAuctionMethod(d.type) && d.schedule.packetType === 'Two'"), 'Financial opening validation must exclude Direct RA');

  // Verify UI input fields guard against Direct RA
  assert.ok(code.includes("!isReverseAuctionMethod(draft.type) && (draft.basics.isTechnicalEvaluationNeeded || isTwoPacket)"), 'Technical opening date picker must be hidden for Direct RA');
  assert.ok(code.includes("!isReverseAuctionMethod(draft.type) && isTwoPacket"), 'Financial opening date picker must be hidden for Direct RA');
});

test('3. Direct Reverse Auction synchronizes auction window with submission window', () => {
  const wizardPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'procurementWizard', 'pages', 'CreateProcurementPage.tsx');
  const code = fs.readFileSync(wizardPath, 'utf8');

  assert.ok(code.includes("submissionStartDate: nextConfig.startDateTime || c.schedule.submissionStartDate"), 'Must sync auction start to submissionStartDate');
  assert.ok(code.includes("submissionDate: nextConfig.endDateTime || c.schedule.submissionDate"), 'Must sync auction end to submissionDate');
});

test('4. Backend reverse-auction.routes.ts qualifies invited sellers immediately for Direct RA', () => {
  const routesPath = path.join(BACKEND_DIR, 'src', 'routes', 'reverse-auction.routes.ts');
  const code = fs.readFileSync(routesPath, 'utf8');

  // POST /reverse-auctions immediately qualifies invited vendors
  assert.ok(code.includes("status: 'TECHNICALLY_QUALIFIED',\n          qualificationStatus: 'QUALIFIED'"), 'Must mark invited vendors as TECHNICALLY_QUALIFIED on auction creation');

  // POST /reverse-auctions/:id/invite-sellers immediately qualifies newly invited sellers for Direct RA
  assert.ok(code.includes("const isDirectRA = auction.procurementMethod === 'REVERSE_AUCTION';"), 'Must identify Direct RA in invite-sellers');

  // POST /reverse-auctions/:id/join immediately qualifies self-joining sellers for Direct RA
  assert.ok(code.includes("status: isDirectRA ? 'TECHNICALLY_QUALIFIED' : 'INVITED'"), 'Must qualify self-joining sellers for Direct RA');

  // POST /reverse-auctions/:id/qualification/submit bypasses mandatory document check for Direct RA
  assert.ok(code.includes("if (!isDirectRA && !docCount) throw new ApiError(400, 'Upload at least one mandatory document before submitting.'"), 'Must bypass mandatory document check for Direct RA');
});

test('5. Backend phase4.routes.ts sets TECHNICALLY_QUALIFIED status on Direct RA creation from wizard', () => {
  const routesPath = path.join(BACKEND_DIR, 'src', 'routes', 'phase4.routes.ts');
  const code = fs.readFileSync(routesPath, 'utf8');

  assert.ok(code.includes("status: 'TECHNICALLY_QUALIFIED',\n      qualificationStatus: 'QUALIFIED'"), 'phase4 submission must assign TECHNICALLY_QUALIFIED to qualifiedVendors');
});
