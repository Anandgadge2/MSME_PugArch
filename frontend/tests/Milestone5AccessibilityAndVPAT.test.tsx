import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const BUYER_PROFILE_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'views', 'BuyerProfile.tsx');
const CHECKOUT_PAGE_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'directPurchase', 'pages', 'DirectCheckoutPage.tsx');
const INVOICE_PAGE_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'invoices', 'pages', 'InvoiceRegisterPage.tsx');
const FOCUS_TRAP_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'components', 'ui', 'FocusTrap.tsx');
const BID_ROUTES_PATH = path.join(ROOT_DIR, 'backend', 'src', 'modules', 'procurementBid', 'procurement-bid.routes.ts');

test('1. F5.1: BuyerProfile.tsx has authentic checkbox state setters and semantic label associations', () => {
  assert.ok(fs.existsSync(BUYER_PROFILE_PATH), `BuyerProfile.tsx must exist`);
  const code = fs.readFileSync(BUYER_PROFILE_PATH, 'utf8').replace(/\r\n/g, '\n');

  // Verify gstNotLiable checkbox
  assert.ok(code.includes('htmlFor="gstNotLiable"'), 'gstNotLiable must have explicit linked label htmlFor');
  assert.ok(code.includes('id="gstNotLiable"'), 'gstNotLiable checkbox input must have matching id');
  assert.ok(
    code.includes('onChange={(e) => setFormData({ ...formData, gstNotLiable: e.target.checked })}'),
    'gstNotLiable must have authentic React state setter receiving event target checked state'
  );

  // Verify aadhaarConsent checkbox
  assert.ok(code.includes('htmlFor="aadhaarConsent"'), 'aadhaarConsent must have explicit linked label htmlFor');
  assert.ok(code.includes('id="aadhaarConsent"'), 'aadhaarConsent checkbox input must have matching id');
  assert.ok(
    code.includes('onChange={(e) => setFormData({ ...formData, aadhaarConsent: e.target.checked })}'),
    'aadhaarConsent must have authentic React state setter receiving event target checked state'
  );

  // Verify no dummy onChange exists in this section
  const kycSection = code.substring(code.indexOf('id="gstNotLiable"'), code.indexOf('id="aadhaarConsent"') + 400);
  assert.ok(!kycSection.includes('onChange={() => { }}'), 'No dummy empty onChange handlers allowed in KYC checkboxes');
});

test('2. F5.1 & F5.4: DirectCheckoutPage.tsx implements keyboard operable radio buttons & live regions', () => {
  assert.ok(fs.existsSync(CHECKOUT_PAGE_PATH), `DirectCheckoutPage.tsx must exist`);
  const code = fs.readFileSync(CHECKOUT_PAGE_PATH, 'utf8').replace(/\r\n/g, '\n');

  // Payment radio buttons
  assert.ok(code.includes('htmlFor={`payment-method-${opt.id}`'), 'Payment radio options must have linked label htmlFor');
  assert.ok(code.includes('id={`payment-method-${opt.id}`}'), 'Payment radio input must have matching id');
  assert.ok(
    code.includes('onChange={(e) => {') && code.includes('setPaymentMethod(opt.id as any);'),
    'Payment radio button must have authentic React state setter on change'
  );

  // Screen reader live regions
  assert.ok(
    code.includes('aria-live="polite"') && code.includes('role="status"'),
    'DirectCheckoutPage must include aria-live="polite" and role="status" for dynamic announcements'
  );
  assert.ok(code.includes('terms-error-text') && code.includes('role="status"'), 'Terms error must be announced to assistive tech');
});

test('3. F5.2: FocusTrap component exists and enforces tab cycle and Escape dismissal', () => {
  assert.ok(fs.existsSync(FOCUS_TRAP_PATH), `FocusTrap.tsx must exist`);
  const code = fs.readFileSync(FOCUS_TRAP_PATH, 'utf8').replace(/\r\n/g, '\n');

  assert.ok(code.includes('export function FocusTrap'), 'FocusTrap must export functional component');
  assert.ok(code.includes("e.key === 'Escape'"), 'FocusTrap must listen for Escape key');
  assert.ok(code.includes("e.key !== 'Tab'"), 'FocusTrap must manage Tab key focus trapping');
  assert.ok(code.includes('FOCUSABLE_SELECTOR'), 'FocusTrap must query focusable elements');
});

test('4. F5.2: Modal components integrate FocusTrap, role="dialog", and aria-modal="true"', () => {
  const modalFiles = [
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

  for (const relPath of modalFiles) {
    const fullPath = path.join(ROOT_DIR, relPath);
    assert.ok(fs.existsSync(fullPath), `Modal file must exist: ${relPath}`);
    const code = fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');

    assert.ok(
      code.includes('FocusTrap'),
      `${relPath} must integrate <FocusTrap>`
    );
    assert.ok(
      code.includes('role="dialog"') || code.includes('role="alertdialog"'),
      `${relPath} must declare role="dialog" or role="alertdialog"`
    );
    assert.ok(
      code.includes('aria-modal="true"'),
      `${relPath} must declare aria-modal="true"`
    );
  }
});

test('5. F5.5: InvoiceRegisterPage.tsx dynamically imports generateTaxInvoicePdf and removes unused PdfEngine', () => {
  assert.ok(fs.existsSync(INVOICE_PAGE_PATH), `InvoiceRegisterPage.tsx must exist`);
  const code = fs.readFileSync(INVOICE_PAGE_PATH, 'utf8').replace(/\r\n/g, '\n');

  // Verify dynamic import inside handleDownloadPdf
  assert.ok(
    code.includes("await import('../lib/invoicePdfGenerator')"),
    'InvoiceRegisterPage must dynamically import generateTaxInvoicePdf in handleDownloadPdf'
  );

  // Verify PdfEngine is NOT imported statically
  assert.ok(
    !code.includes("import { PdfEngine"),
    'InvoiceRegisterPage must not statically import unused legacy PdfEngine'
  );
});

test('6. F5.6: procurement-bid.routes.ts enforces query bounds and pagination on GET /procurement-bids/my', () => {
  assert.ok(fs.existsSync(BID_ROUTES_PATH), `procurement-bid.routes.ts must exist`);
  const code = fs.readFileSync(BID_ROUTES_PATH, 'utf8').replace(/\r\n/g, '\n');

  const routeBlock = code.substring(
    code.indexOf("router.get('/procurement-bids/my'"),
    code.indexOf("router.get('/procurement-bids/:bidId'")
  );

  assert.ok(routeBlock.includes('Math.min(Math.max(1, parsedLimit), 100)'), 'Must clamp limit to maximum 100');
  assert.ok(routeBlock.includes('skip = (page - 1) * limit'), 'Must compute skip for pagination');
  assert.ok(routeBlock.includes('skip,'), 'Must pass skip to prisma.bid.findMany');
  assert.ok(routeBlock.includes('take: limit,'), 'Must pass take: limit to prisma.bid.findMany');
  assert.ok(routeBlock.includes('prisma.bid.count'), 'Must count total bids for pagination metadata');
  assert.ok(routeBlock.includes('pagination: {'), 'Must return pagination metadata object');
  assert.ok(routeBlock.includes('totalPages'), 'Must compute and return totalPages');
});

test('7. F5.3: Color contrast calculations verify Slate-600 passes AA (>= 4.5:1) and modals enforce zero contrast violations', () => {
  // 1. Mathematical Relative Luminance & Contrast Verification
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

  const WHITE: [number, number, number] = [255, 255, 255];
  const SLATE_400: [number, number, number] = [148, 163, 184];
  const SLATE_600: [number, number, number] = [71, 85, 105];
  const GOLD_LIGHT: [number, number, number] = [200, 164, 92];
  const AMBER_800: [number, number, number] = [146, 64, 14];

  const contrastSlate400 = getContrastRatio(WHITE, SLATE_400);
  const contrastSlate600 = getContrastRatio(WHITE, SLATE_600);
  const contrastGoldLight = getContrastRatio(WHITE, GOLD_LIGHT);
  const contrastAmber800 = getContrastRatio(WHITE, AMBER_800);

  // Slate-400 fails WCAG AA minimum 4.5:1 (ratio is 2.56:1)
  assert.ok(contrastSlate400 < 4.5, `Slate-400 contrast (${contrastSlate400.toFixed(2)}:1) fails WCAG AA 4.5:1`);
  // Slate-600 passes WCAG AA minimum 4.5:1 (ratio is 5.68:1)
  assert.ok(contrastSlate600 >= 4.5, `Slate-600 contrast (${contrastSlate600.toFixed(2)}:1) passes WCAG AA 4.5:1`);
  // Gold Light fails WCAG AA minimum 4.5:1 (ratio is 2.35:1)
  assert.ok(contrastGoldLight < 4.5, `Gold light contrast (${contrastGoldLight.toFixed(2)}:1) fails WCAG AA 4.5:1`);
  // Amber-800 passes WCAG AA minimum 4.5:1
  assert.ok(contrastAmber800 >= 4.5, `Amber-800 contrast (${contrastAmber800.toFixed(2)}:1) passes WCAG AA 4.5:1`);

  // 2. Automated Static Scan of Modal Dialog Files for non-disabled text-slate-400
  const modalFiles = [
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

  const violations: Record<string, string[]> = {};
  for (const relPath of modalFiles) {
    const fullPath = path.join(ROOT_DIR, relPath);
    const code = fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');
    const activeText = code.replace(/disabled:text-slate-400/g, '');
    const matches = activeText.match(/className=["'][^"']*text-slate-400[^"']*["']/g) || [];
    if (matches.length > 0) {
      violations[relPath] = matches;
    }
  }

  assert.strictEqual(
    Object.keys(violations).length,
    0,
    `Found contrast violations in modals: ${JSON.stringify(violations, null, 2)}`
  );

  // 3. Automated check of BuyerProfile.tsx lines 3390-3620
  const buyerProfileCode = fs.readFileSync(BUYER_PROFILE_PATH, 'utf8').replace(/\r\n/g, '\n');
  const bpLines = buyerProfileCode.split('\n');
  const bpViolations: { line: number; text: string }[] = [];
  for (let i = 3389; i < 3620; i++) {
    if (bpLines[i].includes('text-slate-400') && !bpLines[i].includes('disabled:text-slate-400')) {
      bpViolations.push({ line: i + 1, text: bpLines[i].trim() });
    }
  }
  assert.strictEqual(bpViolations.length, 0, `BuyerProfile.tsx lines 3390-3620 has text-slate-400 violations: ${JSON.stringify(bpViolations)}`);

  // 4. Automated check of PortalDocumentation.tsx and Login.tsx for readable text-[#c8a45c]
  const docPath = path.join(ROOT_DIR, 'frontend', 'src', 'views', 'PortalDocumentation.tsx');
  const docCode = fs.readFileSync(docPath, 'utf8');
  const docGoldReadable = (docCode.match(/<p[^>]*text-\[#c8a45c\][^>]*>/g) || []).length;
  assert.strictEqual(docGoldReadable, 0, `PortalDocumentation.tsx has readable <p> text-[#c8a45c]`);

  const loginPath = path.join(ROOT_DIR, 'frontend', 'src', 'views', 'Login.tsx');
  const loginCode = fs.readFileSync(loginPath, 'utf8');
  const loginGoldReadable = (loginCode.match(/<p[^>]*text-\[#c8a45c\][^>]*>/g) || []).length;
  assert.strictEqual(loginGoldReadable, 0, `Login.tsx has readable <p> text-[#c8a45c]`);
});
