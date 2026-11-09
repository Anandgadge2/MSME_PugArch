import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const AUDITED_MODAL_FILES = [
  'frontend/src/features/grn/components/GrnCreateModal.tsx',
  'frontend/src/features/invoices/components/CreateInvoiceModal.tsx',
  'frontend/src/features/messages/components/ForwardMessageModal.tsx',
  'frontend/src/features/orgTeam/components/CreateOrganizationModal.tsx',
  'frontend/src/components/common/Transaction2FAModal.tsx',
  'frontend/src/features/catalogue/components/CatalogueImportModal.tsx',
  'frontend/src/features/delivery/components/DispatchDetailsModal.tsx',
  'frontend/src/features/delivery/components/PackedOrderDialog.tsx',
  'frontend/src/features/invoices/components/TaxInvoiceRegistryModal.tsx',
  'frontend/src/features/marketplace/components/BidDetailModal.tsx',
  'frontend/src/features/marketplace/components/SingleSellerConflictModal.tsx',
  'frontend/src/features/payments/components/PaymentReceiptViewModal.tsx',
  'frontend/src/features/procurement/components/CancelProcurementModal.tsx',
  'frontend/src/features/procurementBid/components/SupplierQuotationDetailModal.tsx',
  'frontend/src/features/procurementWizard/components/ProcurementAdvisorModal.tsx',
  'frontend/src/features/reverseAuctions/components/PlaceLowerBidModal.tsx',
  'frontend/src/features/reverseAuctions/components/StartReverseAuctionModal.tsx',
  'frontend/src/features/shared/EntityDetailModal.tsx',
  'frontend/src/features/shared/RequestGstUpdateModal.tsx',
];

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = getLuminance(...rgb1);
  const l2 = getLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// -----------------------------------------------------------------------------
// Test 1: Mathematical Luminance Proof
// -----------------------------------------------------------------------------
test('DEEP-01: Mathematical proof of WCAG 2.1 AA luminance contrast compliance', () => {
  const WHITE: [number, number, number] = [255, 255, 255];
  const SLATE_400: [number, number, number] = [148, 163, 184]; // #94a3b8
  const SLATE_500: [number, number, number] = [100, 116, 139]; // #64748b
  const SLATE_600: [number, number, number] = [71, 85, 105];   // #475569
  const GOLD_LIGHT: [number, number, number] = [200, 164, 92]; // #c8a45c
  const AMBER_800: [number, number, number] = [146, 64, 14];   // #92400e
  const SLATE_950: [number, number, number] = [2, 6, 23];      // #020617

  const crSlate400White = getContrastRatio(WHITE, SLATE_400);
  const crSlate500White = getContrastRatio(WHITE, SLATE_500);
  const crSlate600White = getContrastRatio(WHITE, SLATE_600);
  const crGoldWhite = getContrastRatio(WHITE, GOLD_LIGHT);
  const crAmberWhite = getContrastRatio(WHITE, AMBER_800);
  const crGoldDark = getContrastRatio(SLATE_950, GOLD_LIGHT);

  assert.ok(crSlate400White < 4.5, `Slate-400 on white (${crSlate400White.toFixed(2)}:1) fails AA`);
  assert.ok(crGoldWhite < 4.5, `Gold on white (${crGoldWhite.toFixed(2)}:1) fails AA`);

  assert.ok(crSlate500White >= 4.5, `Slate-500 on white (${crSlate500White.toFixed(2)}:1) passes AA`);
  assert.ok(crSlate600White >= 4.5, `Slate-600 on white (${crSlate600White.toFixed(2)}:1) passes AA`);
  assert.ok(crAmberWhite >= 4.5, `Amber-800 on white (${crAmberWhite.toFixed(2)}:1) passes AA`);
  assert.ok(crGoldDark >= 4.5, `Gold on dark slate-950 (${crGoldDark.toFixed(2)}:1) passes AA`);
});

// -----------------------------------------------------------------------------
// Test 2: Modal Contrast Verification
// -----------------------------------------------------------------------------
test('DEEP-02: Zero non-disabled text-slate-400 across all 19 audited modals', () => {
  for (const relPath of AUDITED_MODAL_FILES) {
    const fullPath = path.join(ROOT_DIR, relPath);
    const content = fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');
    const stripped = content.replace(/disabled:text-slate-400/g, '');
    const matches = stripped.match(/className=["'][^"']*text-slate-400[^"']*["']/g) || [];
    assert.strictEqual(
      matches.length,
      0,
      `Modal ${relPath} contains ${matches.length} unexpected text-slate-400 instances: ${JSON.stringify(matches)}`
    );
  }
});

// -----------------------------------------------------------------------------
// Test 3: BuyerProfile.tsx Scope Contrast Verification
// -----------------------------------------------------------------------------
test('DEEP-03: Zero text-slate-400 in BuyerProfile.tsx lines 3390-3620', () => {
  const profilePath = path.join(ROOT_DIR, 'frontend/src/views/BuyerProfile.tsx');
  const content = fs.readFileSync(profilePath, 'utf8').replace(/\r\n/g, '\n');
  const lines = content.split('\n');
  const scopeLines = lines.slice(3389, 3620);
  
  const violations: { line: number; text: string }[] = [];
  scopeLines.forEach((lineText, idx) => {
    if (lineText.includes('text-slate-400')) {
      violations.push({ line: 3390 + idx, text: lineText.trim() });
    }
  });

  assert.strictEqual(
    violations.length,
    0,
    `BuyerProfile.tsx:3390-3620 has ${violations.length} lingering text-slate-400: ${JSON.stringify(violations)}`
  );
});

// -----------------------------------------------------------------------------
// Test 4: PortalDocumentation.tsx Contrast Verification
// -----------------------------------------------------------------------------
test('DEEP-04: PortalDocumentation.tsx replaces low-contrast step labels with text-amber-800', () => {
  const docPath = path.join(ROOT_DIR, 'frontend/src/views/PortalDocumentation.tsx');
  const content = fs.readFileSync(docPath, 'utf8').replace(/\r\n/g, '\n');

  // Verify no <p> with text-[#c8a45c]
  const goldP = content.match(/<p[^>]*text-\[#c8a45c\][^>]*>/g) || [];
  assert.strictEqual(goldP.length, 0, 'No <p> tags with text-[#c8a45c] allowed on white card backgrounds');

  // Verify text-amber-800 is used on step and operation labels
  assert.ok(content.includes('text-amber-800'), 'Must contain text-amber-800 for high-contrast labels');
  const amberMatches = content.match(/text-amber-800/g) || [];
  assert.ok(amberMatches.length >= 5, `Expected at least 5 instances of text-amber-800, found ${amberMatches.length}`);
});

// -----------------------------------------------------------------------------
// Test 5: Login.tsx Contrast Verification
// -----------------------------------------------------------------------------
test('DEEP-05: Login.tsx uses text-amber-800 on white form card', () => {
  const loginPath = path.join(ROOT_DIR, 'frontend/src/views/Login.tsx');
  const content = fs.readFileSync(loginPath, 'utf8').replace(/\r\n/g, '\n');

  // Verify line with Secure Sign-In uses text-amber-800
  assert.ok(
    content.includes('text-amber-800 uppercase tracking-[0.2em]">Secure Sign-In</p>'),
    'Secure Sign-In label on white form card must use text-amber-800'
  );

  // Ensure no <p> with text-[#c8a45c] inside the form card
  const formCardStart = content.indexOf('Luxury Glass Form Card');
  const formCardEnd = content.indexOf('</form>');
  assert.ok(formCardStart !== -1 && formCardEnd !== -1, 'Form card section found');
  const formCardSection = content.substring(formCardStart, formCardEnd);

  const goldTextInForm = formCardSection.match(/<p[^>]*text-\[#c8a45c\][^>]*>/g) || [];
  assert.strictEqual(goldTextInForm.length, 0, 'No low-contrast gold text paragraphs inside white form card');
});
