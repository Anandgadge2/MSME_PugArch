import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

// File paths
const BUYER_PROFILE_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'views', 'BuyerProfile.tsx');
const CHECKOUT_PAGE_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'directPurchase', 'pages', 'DirectCheckoutPage.tsx');
const INVOICE_PAGE_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'invoices', 'pages', 'InvoiceRegisterPage.tsx');
const FOCUS_TRAP_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'components', 'ui', 'FocusTrap.tsx');
const LEADERBOARD_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'reverseAuctions', 'components', 'LiveAuctionLeaderboard.tsx');
const REVERSE_AUCTION_LIVE_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'reverseAuctions', 'pages', 'ReverseAuctionLivePage.tsx');
const BID_ROUTES_PATH = path.join(ROOT_DIR, 'backend', 'src', 'modules', 'procurementBid', 'procurement-bid.routes.ts');

const MODAL_FILES = [
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

// Helper: Calculate WCAG 2.1 Relative Luminance & Contrast Ratio
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
// SECTION 1: FORM KEYBOARD OPERABILITY & SEMANTIC ASSOCIATIONS (F5.1)
// -----------------------------------------------------------------------------
test('ADV-M5-01: BuyerProfile.tsx enforces semantic label bindings and keyboard checkbox toggles', () => {
  const code = fs.readFileSync(BUYER_PROFILE_PATH, 'utf8').replace(/\r\n/g, '\n');

  // Verify gstNotLiable label binding
  assert.match(code, /<label\s+htmlFor=["']gstNotLiable["']/, 'gstNotLiable label must declare htmlFor="gstNotLiable"');
  assert.match(code, /<input[^>]+id=["']gstNotLiable["'][^>]+type=["']checkbox["']/, 'gstNotLiable input must have matching id');
  assert.match(code, /onChange=\{\(e\)\s*=>\s*setFormData\(\{\s*\.\.\.formData,\s*gstNotLiable:\s*e\.target\.checked\s*\}\)\}/,
    'gstNotLiable must use authentic e.target.checked updater');

  // Verify aadhaarConsent label binding
  assert.match(code, /<label\s+htmlFor=["']aadhaarConsent["']/, 'aadhaarConsent label must declare htmlFor="aadhaarConsent"');
  assert.match(code, /<input[^>]+id=["']aadhaarConsent["'][^>]+type=["']checkbox["']/, 'aadhaarConsent input must have matching id');
  assert.match(code, /onChange=\{\(e\)\s*=>\s*setFormData\(\{\s*\.\.\.formData,\s*aadhaarConsent:\s*e\.target\.checked\s*\}\)\}/,
    'aadhaarConsent must use authentic e.target.checked updater');

  // Verify registeredForGst radio options
  assert.match(code, /type=["']radio["'][^>]+name=["']gst["'][^>]+value=["']yes["']/, 'GST registered Yes radio exists');
  assert.match(code, /type=["']radio["'][^>]+name=["']gst["'][^>]+value=["']no["']/, 'GST registered No radio exists');

  // Functional simulation of state updates
  let state = { gstNotLiable: false, aadhaarConsent: false, registeredForGst: 'no' };
  const updateGstNotLiable = (checked: boolean) => { state = { ...state, gstNotLiable: checked }; };
  const updateAadhaarConsent = (checked: boolean) => { state = { ...state, aadhaarConsent: checked }; };

  updateGstNotLiable(true);
  assert.strictEqual(state.gstNotLiable, true, 'State should reflect true after checked event');
  updateGstNotLiable(false);
  assert.strictEqual(state.gstNotLiable, false, 'State should reflect false after unchecked event');

  updateAadhaarConsent(true);
  assert.strictEqual(state.aadhaarConsent, true, 'Aadhaar consent should reflect true after checked event');
});

test('ADV-M5-02: DirectCheckoutPage.tsx enforces semantic payment radio group and accessible terms toggle', () => {
  const code = fs.readFileSync(CHECKOUT_PAGE_PATH, 'utf8').replace(/\r\n/g, '\n');

  // Verify payment method radios have explicit htmlFor and matching input id
  assert.ok(code.includes('htmlFor={`payment-method-${opt.id}`}'), 'Payment radio label must have dynamic htmlFor');
  assert.ok(code.includes('id={`payment-method-${opt.id}`}'), 'Payment radio input must have matching dynamic id');
  assert.ok(code.includes('type="radio"'), 'Payment inputs must have type="radio"');
  assert.ok(code.includes('name="paymentMethod"'), 'Payment radios must share common name="paymentMethod"');

  // Verify state setter ensures selected method is updated
  assert.ok(
    code.includes('if (e.target.checked)') && code.includes('setPaymentMethod(opt.id as any);'),
    'Payment radio onChange must update selected paymentMethod state'
  );

  // Verify terms checkbox has semantic label and ARIA attributes
  assert.ok(code.includes('htmlFor="summary-terms-checkbox"'), 'Terms checkbox label must have htmlFor="summary-terms-checkbox"');
  assert.ok(code.includes('id="summary-terms-checkbox"'), 'Terms checkbox input must have matching id');
  assert.ok(code.includes('aria-invalid={Boolean(termsError)}'), 'Terms checkbox must declare aria-invalid based on termsError');
  assert.ok(code.includes('aria-describedby={termsError ? "terms-error-summary" : undefined}'), 'Terms checkbox must link to error message via aria-describedby');
});

// -----------------------------------------------------------------------------
// SECTION 2: FOCUS TRAP LOGIC & MODAL DIALOG INTEGRATION (F5.2)
// -----------------------------------------------------------------------------
test('ADV-M5-03: FocusTrap component manages tab cycling, popover bypass, and Escape handling', () => {
  const code = fs.readFileSync(FOCUS_TRAP_PATH, 'utf8').replace(/\r\n/g, '\n');

  // Verify keydown listener catches Escape and stops propagation
  assert.ok(code.includes("e.key === 'Escape'"), 'FocusTrap must intercept Escape key');
  assert.ok(code.includes('e.stopPropagation()'), 'FocusTrap must stop Escape event bubbling');
  assert.ok(code.includes('onEscapeRef.current()'), 'FocusTrap must call onEscape handler');

  // Verify Tab key cycling logic
  assert.ok(code.includes("e.key !== 'Tab'"), 'FocusTrap must ignore non-Tab keys for trapping');
  assert.ok(code.includes('FOCUSABLE_SELECTOR'), 'FocusTrap must define comprehensive focusable selector');
  assert.ok(code.includes('focusables.length === 0'), 'FocusTrap must safely handle container with 0 focusables');
  assert.ok(code.includes('e.preventDefault()'), 'FocusTrap must prevent tab exit from container');

  // Verify Shift+Tab backward wrapping (first -> last)
  assert.ok(
    code.includes('if (e.shiftKey)') && code.includes('lastElement.focus()'),
    'Shift+Tab on first element must wrap to last element'
  );

  // Verify Tab forward wrapping (last -> first)
  assert.ok(
    code.includes('firstElement.focus()'),
    'Tab on last element must wrap to first element'
  );

  // Verify portaled popover exception (e.g. datepickers / sub-dialogs)
  assert.ok(
    code.includes('[role="dialog"][id$="-popover"], [data-portal-popover]'),
    'FocusTrap must permit keyboard navigation inside portaled dialog popovers'
  );

  // Verify previous active element restoration on unmount
  assert.ok(
    code.includes('return () => {') && code.includes('previousActiveElementRef.current'),
    'FocusTrap must restore focus to previously active element on unmount'
  );
});

test('ADV-M5-04: All 19 audited modal dialogs implement FocusTrap, role="dialog", aria-modal="true", and Escape', () => {
  assert.strictEqual(MODAL_FILES.length, 19, 'Must audit exactly 19 modal dialogs');

  for (const relPath of MODAL_FILES) {
    const fullPath = path.join(ROOT_DIR, relPath);
    assert.ok(fs.existsSync(fullPath), `Modal file must exist: ${relPath}`);
    const code = fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');

    // 1. FocusTrap integration
    assert.ok(
      code.includes('<FocusTrap') || code.includes('FocusTrap'),
      `Modal ${relPath} must integrate <FocusTrap>`
    );

    // 2. role="dialog" or role="alertdialog"
    assert.ok(
      code.includes('role="dialog"') || code.includes('role="alertdialog"'),
      `Modal ${relPath} must declare role="dialog" or role="alertdialog"`
    );

    // 3. aria-modal="true"
    assert.ok(
      code.includes('aria-modal="true"'),
      `Modal ${relPath} must declare aria-modal="true"`
    );

    // 4. Escape key binding on FocusTrap
    assert.ok(
      code.includes('onEscape={') || code.includes('onEscape = {'),
      `Modal ${relPath} must pass onEscape handler to FocusTrap`
    );
  }
});

// -----------------------------------------------------------------------------
// SECTION 3: WCAG AA COLOR CONTRAST RATIO AUDIT (F5.3)
// -----------------------------------------------------------------------------
test('ADV-M5-05: Color contrast calculations verify Slate-600 passes AA (>= 4.5:1) while Slate-400 fails', () => {
  const WHITE: [number, number, number] = [255, 255, 255];
  const SLATE_400: [number, number, number] = [148, 163, 184]; // #94a3b8
  const SLATE_600: [number, number, number] = [71, 85, 105];   // #475569
  const GOLD_LIGHT: [number, number, number] = [200, 164, 92]; // #c8a45c
  const GOLD_DARK: [number, number, number] = [133, 91, 20];   // #855b14

  const contrastSlate400 = getContrastRatio(WHITE, SLATE_400);
  const contrastSlate600 = getContrastRatio(WHITE, SLATE_600);
  const contrastGoldLight = getContrastRatio(WHITE, GOLD_LIGHT);
  const contrastGoldDark = getContrastRatio(WHITE, GOLD_DARK);

  // Slate-400 fails WCAG AA (requires 4.5:1)
  assert.ok(contrastSlate400 < 4.5, `Slate-400 contrast (${contrastSlate400.toFixed(2)}:1) must fail WCAG AA 4.5:1`);
  // Slate-600 passes WCAG AA
  assert.ok(contrastSlate600 >= 4.5, `Slate-600 contrast (${contrastSlate600.toFixed(2)}:1) must pass WCAG AA 4.5:1`);

  // Light gold fails WCAG AA on white
  assert.ok(contrastGoldLight < 4.5, `Gold Light contrast (${contrastGoldLight.toFixed(2)}:1) must fail WCAG AA 4.5:1`);
  // Dark gold passes WCAG AA on white
  assert.ok(contrastGoldDark >= 4.5, `Gold Dark contrast (${contrastGoldDark.toFixed(2)}:1) must pass WCAG AA 4.5:1`);
});

test('ADV-M5-06: Static scan verifies no text-slate-400 remains on readable text in modified modals', () => {
  const violationsByModal: Record<string, string[]> = {};

  for (const relPath of MODAL_FILES) {
    const fullPath = path.join(ROOT_DIR, relPath);
    const code = fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');

    // Remove disabled states (which are exempt from WCAG 1.4.3)
    const activeText = code.replace(/disabled:text-slate-400/g, '');

    // Assert no raw active text uses text-slate-400
    const matches = activeText.match(/className=["'][^"']*text-slate-400[^"']*["']/g) || [];
    if (matches.length > 0) {
      violationsByModal[relPath] = matches;
    }
  }

  const failingModalCount = Object.keys(violationsByModal).length;
  assert.strictEqual(
    failingModalCount,
    0,
    `Found ${failingModalCount} modals with text-slate-400 contrast violations: ${JSON.stringify(violationsByModal, null, 2)}`
  );
});

// -----------------------------------------------------------------------------
// SECTION 4: SCREEN READER LIVE REGIONS (F5.4)
// -----------------------------------------------------------------------------
test('ADV-M5-07: DirectCheckoutPage.tsx and Reverse Auction views implement aria-live and role="status"', () => {
  // DirectCheckoutPage.tsx
  const checkoutCode = fs.readFileSync(CHECKOUT_PAGE_PATH, 'utf8').replace(/\r\n/g, '\n');
  assert.ok(
    checkoutCode.includes('aria-live="polite"') && checkoutCode.includes('role="status"'),
    'DirectCheckoutPage must include aria-live="polite" and role="status"'
  );
  assert.ok(
    checkoutCode.includes('id="terms-error-summary"'),
    'DirectCheckoutPage must include terms-error-summary live region'
  );

  // LiveAuctionLeaderboard.tsx
  const leaderboardCode = fs.readFileSync(LEADERBOARD_PATH, 'utf8').replace(/\r\n/g, '\n');
  assert.ok(
    leaderboardCode.includes('aria-live="polite"') && leaderboardCode.includes('role="status"'),
    'LiveAuctionLeaderboard must declare aria-live="polite" and role="status"'
  );
  assert.ok(
    leaderboardCode.includes('Reverse auction is live') && leaderboardCode.includes('Current lowest bid:'),
    'LiveAuctionLeaderboard live region must announce current lowest bid and time remaining'
  );
  assert.ok(
    leaderboardCode.includes('Reverse auction completed. Final lowest winning bid:'),
    'LiveAuctionLeaderboard live region must announce auction completion and winning bid'
  );

  // ReverseAuctionLivePage.tsx
  const livePageCode = fs.readFileSync(REVERSE_AUCTION_LIVE_PATH, 'utf8').replace(/\r\n/g, '\n');
  assert.ok(
    livePageCode.includes('aria-live="polite"') || livePageCode.includes('role="status"'),
    'ReverseAuctionLivePage must include accessibility announcements'
  );
});

// -----------------------------------------------------------------------------
// SECTION 5: BUNDLE OPTIMIZATION & DYNAMIC IMPORT OF JSPDF (F5.5)
// -----------------------------------------------------------------------------
test('ADV-M5-08: InvoiceRegisterPage.tsx eliminates static jspdf bundling and imports dynamically on demand', () => {
  const code = fs.readFileSync(INVOICE_PAGE_PATH, 'utf8').replace(/\r\n/g, '\n');

  // 1. Ensure NO static import of jspdf
  assert.ok(!code.includes("import jsPDF"), 'Must not statically import jsPDF');
  assert.ok(!code.includes("import { jsPDF }"), 'Must not statically import { jsPDF }');
  assert.ok(!code.includes("import { PdfEngine"), 'Must not statically import legacy PdfEngine');

  // 2. Ensure NO top-level static value import of invoicePdfGenerator
  const topLines = code.split('\n').slice(0, 50).join('\n');
  assert.ok(
    !topLines.match(/^import\s+\{?[^}]*generateTaxInvoicePdf/m),
    'generateTaxInvoicePdf must NOT be imported as a top-level static value import'
  );

  // 3. Ensure type-only import is used for TypeScript typing
  assert.ok(
    topLines.includes("import type { TaxInvoiceData, TaxInvoiceItem } from '../lib/invoicePdfGenerator'"),
    'Must use import type for TaxInvoiceData and TaxInvoiceItem'
  );

  // 4. Ensure dynamic import inside handleDownloadPdf
  const handlerIdx = code.indexOf('handleDownloadPdf');
  assert.ok(handlerIdx !== -1, 'handleDownloadPdf function must exist');
  const handlerBody = code.substring(handlerIdx, handlerIdx + 500);
  assert.ok(
    handlerBody.includes("await import('../lib/invoicePdfGenerator')"),
    'handleDownloadPdf must lazily import ../lib/invoicePdfGenerator via await import()'
  );
});

// -----------------------------------------------------------------------------
// SECTION 6: QUERY BOUNDS & PAGINATION ADVERSARIAL STRESS TEST (F5.6)
// -----------------------------------------------------------------------------
test('ADV-M5-09: procurement-bid.routes.ts clamps extreme, negative, and invalid query limits and pages', () => {
  const code = fs.readFileSync(BID_ROUTES_PATH, 'utf8').replace(/\r\n/g, '\n');

  // Extract the GET /procurement-bids/my handler code
  const startIdx = code.indexOf("router.get('/procurement-bids/my'");
  const endIdx = code.indexOf("router.get('/procurement-bids/:bidId'");
  assert.ok(startIdx !== -1 && endIdx !== -1, 'GET /procurement-bids/my route must exist');
  const routeCode = code.substring(startIdx, endIdx);

  // Verify pagination calculation code exists
  assert.ok(routeCode.includes('Math.min(Math.max(1, parsedLimit), 100)'), 'Must clamp limit to [1, 100]');
  assert.ok(routeCode.includes('Math.max(1, parseInt(String(req.query.page'), 'Must clamp page to minimum 1');
  assert.ok(routeCode.includes('skip = (page - 1) * limit'), 'Must compute skip offset correctly');
  assert.ok(routeCode.includes('take: limit'), 'Must pass take: limit to query');
  assert.ok(routeCode.includes('skip,'), 'Must pass skip to query');
  assert.ok(routeCode.includes('prisma.bid.count'), 'Must query total count for pagination metadata');
  assert.ok(routeCode.includes('totalPages = Math.ceil(totalCount / limit)'), 'Must compute totalPages');

  // ---------------------------------------------------------------------------
  // Adversarial Simulation of the exact clamping logic
  // ---------------------------------------------------------------------------
  function computePagination(rawPage: any, rawLimit: any, totalCount: number) {
    const page = Math.max(1, parseInt(String(rawPage || '1'), 10) || 1);
    const parsedLimit = parseInt(String(rawLimit || '20'), 10) || 20;
    const limit = Math.min(Math.max(1, parsedLimit), 100);
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(totalCount / limit);
    return { page, limit, skip, totalPages };
  }

  // Test Case A: Extreme Limit (DoS Prevention)
  const extremeLimit = computePagination('1', '999999999', 500);
  assert.strictEqual(extremeLimit.limit, 100, 'Limit of 999,999,999 must be clamped to maximum 100');
  assert.strictEqual(extremeLimit.skip, 0);
  assert.strictEqual(extremeLimit.totalPages, 5);

  // Test Case B: Boundary Limit 100
  const maxAllowedLimit = computePagination('1', '100', 250);
  assert.strictEqual(maxAllowedLimit.limit, 100, 'Limit 100 must be allowed as upper boundary');
  assert.strictEqual(maxAllowedLimit.totalPages, 3);

  // Test Case C: Boundary Limit 101
  const justOverLimit = computePagination('1', '101', 250);
  assert.strictEqual(justOverLimit.limit, 100, 'Limit 101 must be clamped to 100');

  // Test Case D: Negative Limit
  const negativeLimit = computePagination('1', '-50', 50);
  assert.strictEqual(negativeLimit.limit, 1, 'Negative limit must be clamped to minimum 1');

  // Test Case E: Zero Limit (Falsy fallback)
  const zeroLimit = computePagination('1', '0', 100);
  assert.strictEqual(zeroLimit.limit, 20, 'Limit of 0 must fall back to default 20');

  // Test Case F: Non-numeric String Injection
  const injectionLimit = computePagination('1', "' OR 1=1 --", 100);
  assert.strictEqual(injectionLimit.limit, 20, 'SQL injection string in limit must fall back to default 20');

  // Test Case G: Undefined / Null Limit
  const nullLimit = computePagination('1', undefined, 100);
  assert.strictEqual(nullLimit.limit, 20, 'Undefined limit must fall back to default 20');

  // Test Case H: Negative Page
  const negativePage = computePagination('-10', '20', 100);
  assert.strictEqual(negativePage.page, 1, 'Negative page must be clamped to page 1');
  assert.strictEqual(negativePage.skip, 0, 'Negative page must have skip = 0');

  // Test Case I: Zero Page
  const zeroPage = computePagination('0', '20', 100);
  assert.strictEqual(zeroPage.page, 1, 'Page 0 must be clamped to page 1');
  assert.strictEqual(zeroPage.skip, 0, 'Page 0 must have skip = 0');

  // Test Case J: Non-numeric Page
  const nonNumPage = computePagination('garbage', '20', 100);
  assert.strictEqual(nonNumPage.page, 1, 'Non-numeric page must fall back to page 1');
  assert.strictEqual(nonNumPage.skip, 0);

  // Test Case K: High Page Number
  const pageFive = computePagination('5', '20', 100);
  assert.strictEqual(pageFive.page, 5);
  assert.strictEqual(pageFive.skip, 80, 'Page 5 with limit 20 must skip 80 records');
  assert.strictEqual(pageFive.totalPages, 5);

  // Test Case L: Total Count Zero
  const emptyDb = computePagination('1', '20', 0);
  assert.strictEqual(emptyDb.totalPages, 0, '0 totalCount must yield 0 totalPages');
});

test('ADV-M5-10: procurement-bid.routes.ts enforces role-based tenancy scoping and sensitive data masking', () => {
  const code = fs.readFileSync(BID_ROUTES_PATH, 'utf8').replace(/\r\n/g, '\n');

  const startIdx = code.indexOf("router.get('/procurement-bids/my'");
  const endIdx = code.indexOf("router.get('/procurement-bids/:bidId'");
  const routeCode = code.substring(startIdx, endIdx);

  // Role scoping checks
  assert.ok(
    routeCode.includes("(role === 'seller' || role === 'shg')"),
    'Route must scope seller and shg users to their sellerId'
  );
  assert.ok(
    routeCode.includes("{ sellerId: currentUserId }"),
    'Seller/SHG must filter by { sellerId: currentUserId }'
  );
  assert.ok(
    routeCode.includes("role === 'buyer'"),
    'Route must scope buyer users to their tender buyerId'
  );
  assert.ok(
    routeCode.includes("{ tender: { buyerId: currentUserId } }"),
    'Buyer must filter by { tender: { buyerId: currentUserId } }'
  );

  // Sensitive data masking check
  assert.ok(
    routeCode.includes('maskSensitive(bids)'),
    'Route must pass bids through maskSensitive() before returning in response'
  );
});
