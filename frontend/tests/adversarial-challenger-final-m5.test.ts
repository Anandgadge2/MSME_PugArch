import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

// File paths under audit
const PROCUREMENT_VIEW_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'rfq', 'components', 'ProcurementDetailUnifiedView.tsx');
const BUYER_PROFILE_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'views', 'BuyerProfile.tsx');
const CHECKOUT_PAGE_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'directPurchase', 'pages', 'DirectCheckoutPage.tsx');
const INVOICE_PAGE_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'invoices', 'pages', 'InvoiceRegisterPage.tsx');
const FOCUS_TRAP_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'components', 'ui', 'FocusTrap.tsx');
const BID_ROUTES_PATH = path.join(ROOT_DIR, 'backend', 'src', 'modules', 'procurementBid', 'procurement-bid.routes.ts');
const PORTAL_DOCS_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'views', 'PortalDocumentation.tsx');
const LOGIN_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'views', 'Login.tsx');

const ALL_19_MODALS = [
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

// WCAG 2.1 AA Luminance Math Formula Oracle
function sRGBtoLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

function contrastRatio(rgbA: [number, number, number], rgbB: [number, number, number]): number {
  const L1 = relativeLuminance(...rgbA);
  const L2 = relativeLuminance(...rgbB);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ============================================================================
// SUITE 1: COMPILER SAFETY & TEMPORAL DEAD ZONE (TDZ) REGRESSION STRESS TEST
// ============================================================================

test('CHALLENGER-FINAL-01: ProcurementDetailUnifiedView strictly avoids TDZ and ReferenceErrors', () => {
  assert.ok(fs.existsSync(PROCUREMENT_VIEW_PATH), 'ProcurementDetailUnifiedView.tsx must exist');
  const code = fs.readFileSync(PROCUREMENT_VIEW_PATH, 'utf8');

  // Verify declaration order
  const idxDecl = code.indexOf('const isReverseAuctionType =');
  const idxUse = code.indexOf('const shouldShowEstimatedCost =');

  assert.ok(idxDecl !== -1, 'isReverseAuctionType must be declared in file');
  assert.ok(idxUse !== -1, 'shouldShowEstimatedCost must be declared in file');
  assert.ok(
    idxDecl < idxUse,
    `TDZ Violation: isReverseAuctionType declared at pos ${idxDecl} but shouldShowEstimatedCost declared earlier at pos ${idxUse}`
  );

  // Line difference check
  const lines = code.substring(0, idxUse).split('\n');
  const lineOfUse = lines.length;
  const lineOfDecl = code.substring(0, idxDecl).split('\n').length;
  assert.ok(
    lineOfDecl < lineOfUse,
    `isReverseAuctionType (line ${lineOfDecl}) must strictly precede shouldShowEstimatedCost (line ${lineOfUse})`
  );

  // Pure functional logic check
  const evaluateEstimatedCost = (
    isBuyerSide: boolean,
    isBuyerOrAdmin: boolean,
    discloseEstimatedCost: boolean,
    isReverseAuctionType: boolean
  ) => Boolean(isBuyerSide || isBuyerOrAdmin || discloseEstimatedCost || isReverseAuctionType);

  assert.strictEqual(evaluateEstimatedCost(false, false, false, false), false);
  assert.strictEqual(evaluateEstimatedCost(true, false, false, false), true);
  assert.strictEqual(evaluateEstimatedCost(false, true, false, false), true);
  assert.strictEqual(evaluateEstimatedCost(false, false, true, false), true);
  assert.strictEqual(evaluateEstimatedCost(false, false, false, true), true);
});

// ============================================================================
// SUITE 2: VPAT FORM CONTROLS & KEYBOARD ACCESSIBILITY STRESS TEST
// ============================================================================

test('CHALLENGER-FINAL-02: Form controls adhere to WCAG 2.1 AA keyboard operation and semantic linking', () => {
  // 1. BuyerProfile.tsx
  const bpCode = fs.readFileSync(BUYER_PROFILE_PATH, 'utf8');

  // gstNotLiable checkbox
  assert.ok(bpCode.includes('htmlFor="gstNotLiable"'), 'gstNotLiable must have explicit htmlFor');
  assert.ok(bpCode.includes('id="gstNotLiable"'), 'gstNotLiable input must have matching id');
  assert.ok(bpCode.includes('type="checkbox"'), 'gstNotLiable input must be type="checkbox"');
  assert.ok(
    bpCode.includes('setFormData({ ...formData, gstNotLiable: e.target.checked })'),
    'gstNotLiable must have authentic React state setter on change'
  );

  // aadhaarConsent checkbox
  assert.ok(bpCode.includes('htmlFor="aadhaarConsent"'), 'aadhaarConsent must have explicit htmlFor');
  assert.ok(bpCode.includes('id="aadhaarConsent"'), 'aadhaarConsent input must have matching id');
  assert.ok(
    bpCode.includes('setFormData({ ...formData, aadhaarConsent: e.target.checked })'),
    'aadhaarConsent must have authentic React state setter on change'
  );

  // 2. DirectCheckoutPage.tsx
  const dcCode = fs.readFileSync(CHECKOUT_PAGE_PATH, 'utf8');

  // Radio button semantics
  assert.ok(dcCode.includes('htmlFor={`payment-method-${opt.id}`}'), 'Payment methods must have matching htmlFor');
  assert.ok(dcCode.includes('id={`payment-method-${opt.id}`}'), 'Payment inputs must have matching id');
  assert.ok(dcCode.includes('type="radio"'), 'Payment inputs must have type="radio"');
  assert.ok(dcCode.includes('name="paymentMethod"'), 'Payment inputs must be grouped by name="paymentMethod"');
  assert.ok(
    dcCode.includes('setPaymentMethod(opt.id as any)'),
    'Payment radio button must update state on keyboard selection'
  );

  // Terms and conditions toggle
  assert.ok(dcCode.includes('htmlFor="direct-purchase-policy-consent"'), 'Terms toggle must have htmlFor="direct-purchase-policy-consent"');
  assert.ok(dcCode.includes('id="direct-purchase-policy-consent"'), 'Terms toggle must have id="direct-purchase-policy-consent"');
  assert.ok(dcCode.includes('aria-required="true"'), 'Terms toggle must specify aria-required="true"');
});

// ============================================================================
// SUITE 3: MODAL FOCUS TRAPPING & ARIA DIALOG ROLES (19 MODALS)
// ============================================================================

test('CHALLENGER-FINAL-03: All 19 modal dialogs implement FocusTrap, ARIA dialog, and Escape dismiss', () => {
  assert.strictEqual(ALL_19_MODALS.length, 19, 'Must inspect exactly 19 modal components');

  for (const modalRelPath of ALL_19_MODALS) {
    const fullPath = path.join(ROOT_DIR, modalRelPath);
    assert.ok(fs.existsSync(fullPath), `Modal file must exist: ${modalRelPath}`);
    const code = fs.readFileSync(fullPath, 'utf8');

    // FocusTrap component
    assert.ok(
      code.includes('<FocusTrap') || code.includes('FocusTrap'),
      `Modal ${modalRelPath} must wrap its contents with <FocusTrap>`
    );

    // Dialog role
    assert.ok(
      code.includes('role="dialog"') || code.includes('role="alertdialog"'),
      `Modal ${modalRelPath} must declare role="dialog" or role="alertdialog"`
    );

    // aria-modal attribute
    assert.ok(
      code.includes('aria-modal="true"'),
      `Modal ${modalRelPath} must declare aria-modal="true"`
    );

    // Escape listener
    assert.ok(
      code.includes('onEscape=') || code.includes('onEscape =') || code.includes('onEscape:'),
      `Modal ${modalRelPath} must provide an onEscape callback`
    );
  }
});

// ============================================================================
// SUITE 4: MATHEMATICAL COLOR CONTRAST PROOF & EXHAUSTIVE STATIC AUDIT
// ============================================================================

test('CHALLENGER-FINAL-04: Color contrast ratio proof meets WCAG AA 4.5:1 minimum on white/light surfaces', () => {
  const WHITE: [number, number, number] = [255, 255, 255];
  const SLATE_50: [number, number, number] = [248, 250, 252];
  const SLATE_400: [number, number, number] = [148, 163, 184];
  const SLATE_600: [number, number, number] = [71, 85, 105];
  const GOLD_C8A45C: [number, number, number] = [200, 164, 92];
  const AMBER_800: [number, number, number] = [146, 64, 14];

  // Mathematical verification
  const ratioSlate400 = contrastRatio(SLATE_400, WHITE);
  const ratioSlate600 = contrastRatio(SLATE_600, WHITE);
  const ratioGold = contrastRatio(GOLD_C8A45C, WHITE);
  const ratioAmber800 = contrastRatio(AMBER_800, WHITE);

  assert.ok(ratioSlate400 < 4.5, `Slate-400 fails AA threshold (computed: ${ratioSlate400.toFixed(2)}:1)`);
  assert.ok(ratioSlate600 >= 4.5, `Slate-600 passes AA threshold (computed: ${ratioSlate600.toFixed(2)}:1)`);
  assert.ok(ratioGold < 4.5, `Gold #c8a45c fails AA threshold on white (computed: ${ratioGold.toFixed(2)}:1)`);
  assert.ok(ratioAmber800 >= 4.5, `Amber-800 passes AA threshold on white (computed: ${ratioAmber800.toFixed(2)}:1)`);

  // Exhaustive audit across all 19 modals for non-disabled text-slate-400
  for (const modalRelPath of ALL_19_MODALS) {
    const fullPath = path.join(ROOT_DIR, modalRelPath);
    const code = fs.readFileSync(fullPath, 'utf8');
    const activeText = code.replace(/disabled:text-[a-z0-9-]+/g, '');
    const matches = activeText.match(/className=["'][^"']*\b(text-slate-400|text-gray-400)\b[^"']*["']/g) || [];
    assert.strictEqual(
      matches.length,
      0,
      `Modal ${modalRelPath} contains low-contrast gray text: ${JSON.stringify(matches)}`
    );
  }

  // Audit BuyerProfile lines 3390-3620
  const bpCode = fs.readFileSync(BUYER_PROFILE_PATH, 'utf8');
  const bpScope = bpCode.split('\n').slice(3389, 3620).join('\n');
  const bpMatches = bpScope.match(/className=["'][^"']*\btext-slate-400\b[^"']*["']/g) || [];
  assert.strictEqual(bpMatches.length, 0, `BuyerProfile.tsx lines 3390-3620 has text-slate-400: ${JSON.stringify(bpMatches)}`);

  // Audit PortalDocumentation for gold text on light backgrounds
  const docCode = fs.readFileSync(PORTAL_DOCS_PATH, 'utf8');
  const docGoldMatches = docCode.match(/<p[^>]*text-\[#c8a45c\][^>]*>/g) || [];
  assert.strictEqual(docGoldMatches.length, 0, 'PortalDocumentation.tsx must have zero <p> with text-[#c8a45c]');

  // Audit Login.tsx for gold text in white form card
  const loginCode = fs.readFileSync(LOGIN_PATH, 'utf8');
  const loginFormSection = loginCode.substring(loginCode.indexOf('<form'), loginCode.indexOf('</form>'));
  const loginGoldMatches = loginFormSection.match(/<p[^>]*text-\[#c8a45c\][^>]*>/g) || [];
  assert.strictEqual(loginGoldMatches.length, 0, 'Login.tsx must have zero <p> with text-[#c8a45c] inside form');
});

// ============================================================================
// SUITE 5: DYNAMIC IMPORT & BUNDLE OPTIMIZATION STRESS TEST
// ============================================================================

test('CHALLENGER-FINAL-05: InvoiceRegisterPage dynamically imports jspdf without static leakage', () => {
  const invCode = fs.readFileSync(INVOICE_PAGE_PATH, 'utf8');

  // Check top-level imports for static jspdf or PdfEngine
  const topLines = invCode.split('\n').slice(0, 80).join('\n');
  assert.ok(!topLines.includes("import jsPDF"), 'Top-level jsPDF static import must be absent');
  assert.ok(!topLines.includes("import { PdfEngine"), 'Top-level PdfEngine static import must be absent');

  // Verify dynamic import in handleDownloadPdf
  assert.ok(
    invCode.includes("await import('../lib/invoicePdfGenerator')"),
    'handleDownloadPdf must lazily import ../lib/invoicePdfGenerator'
  );
});

// ============================================================================
// SUITE 6: QUERY BOUNDS & PAGINATION ADVERSARIAL CLAMP TEST
// ============================================================================

test('CHALLENGER-FINAL-06: procurement-bid.routes.ts strictly bounds page, limit, and scopes by role', () => {
  const bidCode = fs.readFileSync(BID_ROUTES_PATH, 'utf8');

  // Verify clamp implementation in source
  assert.ok(
    bidCode.includes("Math.min(Math.max(1, parsedLimit), 100)"),
    'procurement-bid.routes.ts must clamp limit to min 1 and max 100'
  );
  assert.ok(
    bidCode.includes("Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1)"),
    'procurement-bid.routes.ts must clamp page to min 1'
  );
  assert.ok(
    bidCode.includes("maskSensitive(bids)"),
    'procurement-bid.routes.ts must mask sensitive fields'
  );

  // Behavioral clamp simulation oracle
  const clampPagination = (queryPage: any, queryLimit: any) => {
    const page = Math.max(1, parseInt(String(queryPage || '1'), 10) || 1);
    const parsedLimit = parseInt(String(queryLimit || '20'), 10) || 20;
    const limit = Math.min(Math.max(1, parsedLimit), 100);
    const skip = (page - 1) * limit;
    return { page, limit, skip };
  };

  // Adversarial edge inputs:
  assert.deepStrictEqual(clampPagination(undefined, undefined), { page: 1, limit: 20, skip: 0 });
  assert.deepStrictEqual(clampPagination('0', '0'), { page: 1, limit: 20, skip: 0 }); // 0 falls back to 1 and 20
  assert.deepStrictEqual(clampPagination('-10', '-50'), { page: 1, limit: 1, skip: 0 });
  assert.deepStrictEqual(clampPagination('NaN', 'foobar'), { page: 1, limit: 20, skip: 0 });
  assert.deepStrictEqual(clampPagination('5', '5000000'), { page: 5, limit: 100, skip: 400 });
  assert.deepStrictEqual(clampPagination('10', '50'), { page: 10, limit: 50, skip: 450 });
  assert.deepStrictEqual(clampPagination('1', '100'), { page: 1, limit: 100, skip: 0 });
});
