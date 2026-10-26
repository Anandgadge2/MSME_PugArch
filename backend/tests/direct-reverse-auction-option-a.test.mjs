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

test('6. Frontend ReverseAuctionLivePage and DetailPage authorize sellers and display proper Direct RA notices', () => {
  const livePagePath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'reverseAuctions', 'pages', 'ReverseAuctionLivePage.tsx');
  const liveCode = fs.readFileSync(livePagePath, 'utf8');

  assert.ok(liveCode.includes("(isDirectRA && pStatus === 'INVITED')"), 'LivePage must authorize invited participants for Direct RA');
  assert.ok(liveCode.includes("(!evalPending || isDirectRA)"), 'LivePage must not block bidding on pending eval for Direct RA');
  assert.ok(liveCode.includes('This is a private/invited reverse auction. Dynamic counter-bidding is restricted to invited participating suppliers.'), 'LivePage must render accurate observer notice for Direct RA');

  const detailPagePath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'reverseAuctions', 'pages', 'ReverseAuctionDetailPage.tsx');
  const detailCode = fs.readFileSync(detailPagePath, 'utf8');

  assert.ok(detailCode.includes('Direct Reverse Auction (Invited Suppliers Only)'), 'DetailPage must display Direct Reverse Auction title for non-joined observers');
  assert.ok(detailCode.includes('Dynamic bidding in this reverse auction is restricted to invited participating suppliers.'), 'DetailPage must display accurate observer body for Direct RA');
});

test('7. Step 6 hides generic Submission Start and End dates for Direct Reverse Auction', () => {
  const wizardPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'procurementWizard', 'pages', 'CreateProcurementPage.tsx');
  const wizardCode = fs.readFileSync(wizardPath, 'utf8');

  assert.ok(
    wizardCode.includes("{!isReverseAuctionMethod(draft.type) && (\n          <>\n            <Field label=\"Submission Start Date\""),
    'CreateProcurementPage must hide generic Submission Start Date for Direct Reverse Auction'
  );
  assert.ok(
    wizardCode.includes("id=\"submission-end-datetime\""),
    'Submission End Date field exists'
  );
  assert.ok(
    wizardCode.includes("if (!isReverseAuctionMethod(d.type)) {\n      list.push({ label: 'Submission deadline date is required'"),
    'Validation must not require generic submission deadline when isReverseAuctionMethod is true'
  );
});

test('8. Seller Action Engine and Unified View direct sellers to Live Auction Room instead of quotation packet form', () => {
  const actionEnginePath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'rfq', 'components', 'procurementActionEngine.ts');
  const engineCode = fs.readFileSync(actionEnginePath, 'utf8');

  assert.ok(engineCode.includes("'SELLER_JOIN_AUCTION'"), 'Must declare SELLER_JOIN_AUCTION action type');
  assert.ok(engineCode.includes("'SELLER_ENTER_AUCTION'"), 'Must declare SELLER_ENTER_AUCTION action type');
  assert.ok(engineCode.includes("label: 'Enter Live Bidding Floor →'"), 'Must provide live floor button for participated seller in reverse auction');
  assert.ok(engineCode.includes("label: 'Enter Live Reverse Auction →'"), 'Must provide live reverse auction button for active reverse auction');

  const unifiedViewPath = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'rfq', 'components', 'ProcurementDetailUnifiedView.tsx');
  const unifiedCode = fs.readFileSync(unifiedViewPath, 'utf8');

  assert.ok(
    unifiedCode.includes("if (isDirectReverseAuction || isReverseAuctionType || linkedAuction) {\n            const auctionCode = (linkedAuction as any)?.auctionCode || linkedAuction?.id || cleanId;\n            router.push(`/seller/procurement/reverse-auction/${encodeURIComponent(String(auctionCode))}`);"),
    'ProcurementDetailUnifiedView handleActionSubmit must route reverse auctions to reverse auction room instead of /participate packet form'
  );
  assert.ok(
    unifiedCode.includes("primaryHighwayAction.type === 'SELLER_ENTER_AUCTION'"),
    'ProcurementDetailUnifiedView must handle SELLER_ENTER_AUCTION highway button'
  );
  assert.ok(
    unifiedCode.includes("primaryHighwayAction.type === 'SELLER_JOIN_AUCTION'"),
    'ProcurementDetailUnifiedView must handle SELLER_JOIN_AUCTION highway button'
  );
});

