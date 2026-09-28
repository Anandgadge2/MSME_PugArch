import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readBackend = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const readFrontend = relativePath => readFileSync(new URL(`../../frontend/${relativePath}`, import.meta.url), 'utf8');

test('MSME Usability Overhaul & First-Time User Experience Test Suite', async (t) => {
  await t.test('1. Backend /api/dashboard/summary computes authentic onboardingChecklist without mock data', () => {
    const orgRoutes = readBackend('src/routes/org.routes.ts');
    assert.match(orgRoutes, /onboardingChecklist = \{/);
    assert.match(orgRoutes, /isProfileComplete/);
    assert.match(orgRoutes, /isBankAdded/);
    assert.match(orgRoutes, /hasCatalogueItem/);
    assert.match(orgRoutes, /hasSubmittedBid/);
    assert.match(orgRoutes, /completionPercentage:\s*Math\.round\(\(completedCount \/ 4\) \* 100\)/);
  });

  await t.test('2. Backend computes priority-based nextBestAction for sellers and buyers', () => {
    const orgRoutes = readBackend('src/routes/org.routes.ts');
    assert.match(orgRoutes, /type:\s*'PURCHASE_ORDER'/);
    assert.match(orgRoutes, /urgency:\s*'HIGH'/);
    assert.match(orgRoutes, /type:\s*'REVERSE_AUCTION'/);
    assert.match(orgRoutes, /type:\s*'DIRECT_RFQ'/);
    assert.match(orgRoutes, /type:\s*'ONBOARDING'/);
  });

  await t.test('3. Procurement Glossary dictionary contains English and Hindi plain-language hints', () => {
    const glossary = readFrontend('src/components/common/ProcurementGlossaryTooltip.tsx');
    assert.match(glossary, /export const GLOSSARY_DICTIONARY/);
    assert.match(glossary, /RFQ:/);
    assert.match(glossary, /RFP:/);
    assert.match(glossary, /OPEN_TENDER:/);
    assert.match(glossary, /REVERSE_AUCTION:/);
    assert.match(glossary, /RATE_CONTRACT:/);
    assert.match(glossary, /BOQ:/);
    assert.match(glossary, /GRN:/);
    assert.match(glossary, /L1:/);
    assert.match(glossary, /PAC:/);
    assert.match(glossary, /TREDS:/);
    assert.match(glossary, /hindiHint/);
    assert.match(glossary, /whoDoesWhat/);
  });

  await t.test('4. Universal Command Palette (Ctrl+K) provides dialog accessibility and glossary lookup', () => {
    const palette = readFrontend('src/components/common/GlobalCommandPalette.tsx');
    assert.match(palette, /role="dialog"/);
    assert.match(palette, /aria-modal="true"/);
    assert.match(palette, /aria-label="Universal Command Palette"/);
    assert.match(palette, /GLOSSARY_DICTIONARY/);
    assert.match(palette, /ArrowDown/);
    assert.match(palette, /ArrowUp/);
    assert.match(palette, /Enter/);
    assert.match(palette, /Escape/);
  });

  await t.test('5. Navbar mounts Quick Search button and listens for Ctrl+K global keyboard shortcut', () => {
    const navbar = readFrontend('src/components/layout/Navbar.tsx');
    assert.match(navbar, /GlobalCommandPalette/);
    assert.match(navbar, /isCommandPaletteOpen/);
    assert.match(navbar, /handleGlobalKeyDown/);
    assert.match(navbar, /Ctrl K/);
    assert.match(navbar, /<GlobalCommandPalette/);
  });

  await t.test('6. Dashboard renders NextBestActionBanner and FirstTimeUserOnboardingCard', () => {
    const dashboard = readFrontend('src/views/Dashboard.tsx');
    assert.match(dashboard, /NextBestActionBanner/);
    assert.match(dashboard, /FirstTimeUserOnboardingCard/);
    assert.match(dashboard, /<NextBestActionBanner action=\{summaryData\?\.nextBestAction\} \/>/);
    assert.match(dashboard, /<FirstTimeUserOnboardingCard checklist=\{summaryData\?\.onboardingChecklist\} role=\{user\?\.role\} \/>/);
  });

  await t.test('7. Procurement Wizard includes Help Me Choose Advisor and Method Glossary Tooltips', () => {
    const wizardPage = readFrontend('src/features/procurementWizard/pages/CreateProcurementPage.tsx');
    const advisorModal = readFrontend('src/features/procurementWizard/components/ProcurementAdvisorModal.tsx');
    const sourcingCards = readFrontend('src/features/procurementWizard/components/SourcingWizardComponents.tsx');

    assert.match(wizardPage, /ProcurementAdvisorModal/);
    assert.match(wizardPage, /Help Me Choose/);
    assert.match(wizardPage, /termKey=\{method\.id\}/);
    assert.match(advisorModal, /Help Me Choose the Right Sourcing Method/);
    assert.match(advisorModal, /computeRecommendation/);
    assert.match(sourcingCards, /ProcurementGlossaryTooltip/);
    assert.match(sourcingCards, /termKey/);
  });
});
