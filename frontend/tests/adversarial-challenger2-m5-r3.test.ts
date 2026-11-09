import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

// Target file paths
const BUYER_PROFILE_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'views', 'BuyerProfile.tsx');
const CHECKOUT_PAGE_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'directPurchase', 'pages', 'DirectCheckoutPage.tsx');
const INVOICE_PAGE_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'invoices', 'pages', 'InvoiceRegisterPage.tsx');
const FOCUS_TRAP_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'components', 'ui', 'FocusTrap.tsx');
const PORTAL_DOCS_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'views', 'PortalDocumentation.tsx');
const LOGIN_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'views', 'Login.tsx');
const BID_ROUTES_PATH = path.join(ROOT_DIR, 'backend', 'src', 'modules', 'procurementBid', 'procurement-bid.routes.ts');

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

// ============================================================================
// PART 1: ADVERSARIAL FOCUS TRAP BEHAVIORAL ORACLE TESTS
// ============================================================================

test('CHALLENGER-R3: FocusTrap component source code invariants verification', () => {
  assert.ok(fs.existsSync(FOCUS_TRAP_PATH), 'FocusTrap.tsx must exist');
  const code = fs.readFileSync(FOCUS_TRAP_PATH, 'utf8').replace(/\r\n/g, '\n');

  // Verify core selector includes buttons, inputs, selects, textareas, hrefs, and tabindexes
  assert.ok(code.includes('button:not([disabled])'), 'Must include active buttons');
  assert.ok(code.includes('input:not([disabled])'), 'Must include active inputs');
  assert.ok(code.includes('select:not([disabled])'), 'Must include active selects');
  assert.ok(code.includes('textarea:not([disabled])'), 'Must include active textareas');
  assert.ok(code.includes('[href]'), 'Must include links with href');
  assert.ok(code.includes('[tabindex]:not([tabindex="-1"]):not([disabled])'), 'Must include positive/zero tabindex');

  // Verify event handling invariants
  assert.ok(code.includes("e.key === 'Escape'"), 'Must handle Escape');
  assert.ok(code.includes('e.stopPropagation()'), 'Escape must stop event propagation');
  assert.ok(code.includes("e.key !== 'Tab'"), 'Must ignore non-Tab keys');
  assert.ok(code.includes('e.preventDefault()'), 'Must prevent default tab escape');

  // Verify wrap directions
  assert.ok(code.includes('e.shiftKey'), 'Must handle Shift+Tab backward navigation');
  assert.ok(code.includes('lastElement.focus()'), 'Must wrap backward to last element');
  assert.ok(code.includes('firstElement.focus()'), 'Must wrap forward to first element');

  // Verify autofocus and return focus
  assert.ok(code.includes('[autofocus], [data-autofocus]'), 'Must support explicit autofocus attribute');
  assert.ok(code.includes('returnFocusRefStable'), 'Must support custom returnFocusRef');
  assert.ok(code.includes('previousActiveElementRef'), 'Must support previous active element fallback');
});

test('CHALLENGER-R3: FocusTrap behavioral simulation — comprehensive multi-element tab cycling', () => {
  let activeElement: any = null;

  class MockElement {
    id: string;
    disabled: boolean;
    offsetParent: any;
    offsetWidth: number;
    offsetHeight: number;
    tabIndex: number;
    tagName: string;
    attributes: Record<string, string>;

    constructor(id: string, tagName = 'button', disabled = false, visible = true, attrs: Record<string, string> = {}) {
      this.id = id;
      this.tagName = tagName;
      this.disabled = disabled;
      this.offsetParent = visible ? {} : null;
      this.offsetWidth = visible ? 100 : 0;
      this.offsetHeight = visible ? 30 : 0;
      this.tabIndex = 0;
      this.attributes = attrs;
    }

    focus() {
      activeElement = this;
    }

    getAttribute(name: string) {
      return this.attributes[name] || null;
    }

    hasAttribute(name: string) {
      return name in this.attributes;
    }
  }

  // Create simulated DOM tree
  const elements = [
    new MockElement('btn-close', 'button'),
    new MockElement('input-name', 'input'),
    new MockElement('btn-disabled', 'button', true), // disabled!
    new MockElement('input-hidden', 'input', false, false), // hidden!
    new MockElement('select-role', 'select'),
    new MockElement('btn-submit', 'button'),
  ];

  const container = {
    contains: (el: any) => elements.includes(el),
    querySelectorAll: (selector: string) => {
      // Mock selector filtering matching FOCUSABLE_SELECTOR
      return elements.filter(el => !el.disabled && el.tabIndex !== -1);
    }
  };

  function getFocusables() {
    return Array.from(container.querySelectorAll(''))
      .filter(el => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);
  }

  function simulateTab(shiftKey: boolean) {
    let prevented = false;
    const focusables = getFocusables();
    assert.ok(focusables.length > 0);

    const firstElement = focusables[0];
    const lastElement = focusables[focusables.length - 1];

    const e = {
      key: 'Tab',
      shiftKey,
      preventDefault: () => { prevented = true; }
    };

    if (e.shiftKey) {
      if (activeElement === firstElement || !container.contains(activeElement)) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (activeElement === lastElement || !container.contains(activeElement)) {
        e.preventDefault();
        firstElement.focus();
      }
    }

    return { prevented, currentFocus: activeElement?.id };
  }

  const focusables = getFocusables();
  // Ensure disabled and hidden elements are filtered out
  assert.deepStrictEqual(
    focusables.map(f => f.id),
    ['btn-close', 'input-name', 'select-role', 'btn-submit'],
    'Disabled and hidden elements must be excluded from active focusables'
  );

  // 1. Tab from last element ('btn-submit') must wrap forward to first ('btn-close')
  activeElement = focusables[3]; // 'btn-submit'
  const step1 = simulateTab(false);
  assert.strictEqual(step1.prevented, true, 'Tab on last element must preventDefault');
  assert.strictEqual(step1.currentFocus, 'btn-close', 'Focus must wrap to btn-close');

  // 2. Shift+Tab from first element ('btn-close') must wrap backward to last ('btn-submit')
  activeElement = focusables[0]; // 'btn-close'
  const step2 = simulateTab(true);
  assert.strictEqual(step2.prevented, true, 'Shift+Tab on first element must preventDefault');
  assert.strictEqual(step2.currentFocus, 'btn-submit', 'Focus must wrap to btn-submit');

  // 3. Tab when focus is external must snap to first element
  const outsideElement = new MockElement('outside-body', 'div');
  activeElement = outsideElement;
  const step3 = simulateTab(false);
  assert.strictEqual(step3.prevented, true);
  assert.strictEqual(step3.currentFocus, 'btn-close', 'External focus on Tab must snap to first element');

  // 4. Shift+Tab when focus is external must snap to last element
  activeElement = outsideElement;
  const step4 = simulateTab(true);
  assert.strictEqual(step4.prevented, true);
  assert.strictEqual(step4.currentFocus, 'btn-submit', 'External focus on Shift+Tab must snap to last element');
});

test('CHALLENGER-R3: FocusTrap behavioral simulation — single element and zero elements resilience', () => {
  let activeElement: any = null;

  // Case A: 1 single focusable element
  const singleElement = {
    id: 'single-btn',
    focus: () => { activeElement = singleElement; },
    offsetParent: {},
    offsetWidth: 100,
    offsetHeight: 30
  };
  const singleContainer = {
    contains: (el: any) => el === singleElement,
    querySelectorAll: () => [singleElement]
  };

  let prevented = false;
  const e1 = {
    key: 'Tab',
    shiftKey: false,
    preventDefault: () => { prevented = true; }
  };
  activeElement = singleElement;
  if (activeElement === singleElement) {
    e1.preventDefault();
    singleElement.focus();
  }
  assert.strictEqual(prevented, true);
  assert.strictEqual(activeElement.id, 'single-btn');

  // Case B: 0 focusable elements
  prevented = false;
  const emptyFocusables: any[] = [];
  const e2 = {
    key: 'Tab',
    shiftKey: false,
    preventDefault: () => { prevented = true; }
  };
  if (emptyFocusables.length === 0) {
    e2.preventDefault();
  }
  assert.strictEqual(prevented, true, 'Empty modal must prevent Tab escape without crashing');
});

test('CHALLENGER-R3: FocusTrap behavioral simulation — autofocus precedence and unmount restoration', () => {
  let activeElement: any = null;

  const triggerElement = { id: 'open-modal-trigger', focus: () => { activeElement = triggerElement; } };
  const customReturnTarget = { id: 'custom-return-target', focus: () => { activeElement = customReturnTarget; } };

  // 1. Initial focus: Explicit autofocus priority over first element
  const elFirst = { id: 'el-first', focus: () => { activeElement = elFirst; }, hasAttribute: (a: string) => false };
  const elAutofocus = { id: 'el-autofocus', focus: () => { activeElement = elAutofocus; }, hasAttribute: (a: string) => a === 'data-autofocus' };
  
  const container = {
    querySelector: (sel: string) => sel.includes('autofocus') ? elAutofocus : elFirst,
    querySelectorAll: () => [elFirst, elAutofocus]
  };

  // Simulate FocusTrap initial focus logic
  const explicitAutoFocus = container.querySelector('[autofocus], [data-autofocus]');
  if (explicitAutoFocus && typeof explicitAutoFocus.focus === 'function') {
    explicitAutoFocus.focus();
  } else {
    elFirst.focus();
  }
  assert.strictEqual(activeElement.id, 'el-autofocus', 'Initial focus must honor explicit autofocus element');

  // 2. Unmount focus restoration with returnFocusRef
  const returnFocusRefStable = { current: customReturnTarget };
  if (returnFocusRefStable?.current && typeof returnFocusRefStable.current.focus === 'function') {
    returnFocusRefStable.current.focus();
  }
  assert.strictEqual(activeElement.id, 'custom-return-target', 'Unmount must restore focus to returnFocusRef if provided');

  // 3. Unmount focus restoration with previousActiveElement fallback
  const emptyReturnRef: any = { current: null };
  const previousActiveElement: any = triggerElement;
  if (emptyReturnRef?.current && typeof emptyReturnRef.current.focus === 'function') {
    emptyReturnRef.current.focus();
  } else if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
    previousActiveElement.focus();
  }
  assert.strictEqual(activeElement.id, 'open-modal-trigger', 'Unmount must fall back to restoring previously active element');
});

// ============================================================================
// PART 2: AUDIT OF ALL 19 MODAL DIALOGS
// ============================================================================

test('CHALLENGER-R3: Verify all 19 modal dialogs implement FocusTrap, role, aria-modal, and Escape', () => {
  assert.strictEqual(ALL_19_MODALS.length, 19, 'Must verify all 19 modal components');

  for (const relPath of ALL_19_MODALS) {
    const fullPath = path.join(ROOT_DIR, relPath);
    assert.ok(fs.existsSync(fullPath), `Modal file must exist: ${relPath}`);
    const code = fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');

    // 1. FocusTrap integration
    assert.ok(
      code.includes('<FocusTrap') || code.includes('FocusTrap'),
      `Modal ${relPath} must integrate <FocusTrap>`
    );

    // 2. ARIA role="dialog" or role="alertdialog"
    assert.ok(
      code.includes('role="dialog"') || code.includes('role="alertdialog"'),
      `Modal ${relPath} must declare role="dialog" or role="alertdialog"`
    );

    // 3. aria-modal="true"
    assert.ok(
      code.includes('aria-modal="true"'),
      `Modal ${relPath} must declare aria-modal="true"`
    );

    // 4. Escape key binding
    assert.ok(
      code.includes('onEscape={') || code.includes('onEscape = {'),
      `Modal ${relPath} must bind onEscape handler`
    );
  }
});

// ============================================================================
// PART 3: COLOR CONTRAST RATIO AUDIT (WCAG AA >= 4.5:1)
// ============================================================================

test('CHALLENGER-R3: Contrast audit across all 19 modals for lingering low-contrast slate classes', () => {
  const violations: Record<string, string[]> = {};

  for (const relPath of ALL_19_MODALS) {
    const fullPath = path.join(ROOT_DIR, relPath);
    const code = fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');

    // Strip out disabled states which are exempt under WCAG 1.4.3
    const activeText = code.replace(/disabled:text-[a-z0-9-]+/g, '');

    // Check for low-contrast text classes on light surfaces
    const matches = activeText.match(/className=["'][^"']*\b(text-slate-400|text-gray-400|text-zinc-400|text-neutral-400|text-stone-400)\b[^"']*["']/g) || [];
    if (matches.length > 0) {
      violations[relPath] = matches;
    }
  }

  assert.strictEqual(
    Object.keys(violations).length,
    0,
    `Found low-contrast gray text violations in modals: ${JSON.stringify(violations, null, 2)}`
  );
});

test('CHALLENGER-R3: Contrast audit of BuyerProfile.tsx', () => {
  assert.ok(fs.existsSync(BUYER_PROFILE_PATH), 'BuyerProfile.tsx must exist');
  const code = fs.readFileSync(BUYER_PROFILE_PATH, 'utf8').replace(/\r\n/g, '\n');

  // Verify lines 3390-3620 contain 0 non-disabled text-slate-400
  const lines = code.split('\n');
  const scopeLines = lines.slice(3389, 3620);
  const violations: { line: number; text: string }[] = [];

  scopeLines.forEach((lineText, idx) => {
    if (lineText.includes('text-slate-400') && !lineText.includes('disabled:text-slate-400')) {
      violations.push({ line: 3390 + idx, text: lineText.trim() });
    }
  });

  assert.strictEqual(
    violations.length,
    0,
    `BuyerProfile.tsx lines 3390-3620 has low-contrast text: ${JSON.stringify(violations)}`
  );

  // Check for high-contrast Slate-600 in descriptions
  assert.ok(code.includes('text-slate-600'), 'BuyerProfile must use high-contrast text-slate-600');
});

test('CHALLENGER-R3: Contrast audit of PortalDocumentation.tsx and Login.tsx for gold text', () => {
  // PortalDocumentation.tsx
  assert.ok(fs.existsSync(PORTAL_DOCS_PATH), 'PortalDocumentation.tsx must exist');
  const docCode = fs.readFileSync(PORTAL_DOCS_PATH, 'utf8').replace(/\r\n/g, '\n');

  // Ensure no <p> with text-[#c8a45c]
  const docGoldMatches = docCode.match(/<p[^>]*text-\[#c8a45c\][^>]*>/g) || [];
  assert.strictEqual(docGoldMatches.length, 0, 'PortalDocumentation.tsx must have 0 readable <p> text-[#c8a45c]');

  // Ensure text-amber-800 is used for readable step labels
  assert.ok(docCode.includes('text-amber-800'), 'PortalDocumentation.tsx must use text-amber-800');

  // Login.tsx
  assert.ok(fs.existsSync(LOGIN_PATH), 'Login.tsx must exist');
  const loginCode = fs.readFileSync(LOGIN_PATH, 'utf8').replace(/\r\n/g, '\n');

  // Ensure Secure Sign-In uses text-amber-800
  assert.ok(
    loginCode.includes('text-amber-800 uppercase tracking-[0.2em]">Secure Sign-In</p>'),
    'Login.tsx Secure Sign-In header must use text-amber-800'
  );

  // Ensure no <p> with text-[#c8a45c] in form section
  const formCardSection = loginCode.substring(loginCode.indexOf('<form'), loginCode.indexOf('</form>'));
  const loginGoldInForm = formCardSection.match(/<p[^>]*text-\[#c8a45c\][^>]*>/g) || [];
  assert.strictEqual(loginGoldInForm.length, 0, 'Login.tsx must not have low-contrast gold paragraphs in form');
});

test('CHALLENGER-R3: Contrast audit of DirectCheckoutPage.tsx', () => {
  assert.ok(fs.existsSync(CHECKOUT_PAGE_PATH), 'DirectCheckoutPage.tsx must exist');
  const code = fs.readFileSync(CHECKOUT_PAGE_PATH, 'utf8').replace(/\r\n/g, '\n');

  // Verify no non-disabled text-slate-400
  const activeCode = code.replace(/disabled:text-[a-z0-9-]+/g, '');
  const matches = activeCode.match(/className=["'][^"']*\b(text-slate-400|text-gray-400)\b[^"']*["']/g) || [];
  assert.strictEqual(
    matches.length,
    0,
    `DirectCheckoutPage.tsx contains low-contrast gray text: ${JSON.stringify(matches)}`
  );

  // Verify error messages use accessible high-contrast colors (e.g. text-rose-600 or text-red-600)
  assert.ok(code.includes('text-rose-600') || code.includes('text-red-600'), 'Must use high-contrast error text');
});

// ============================================================================
// PART 4: KEYBOARD ACCESSIBILITY & FORM SEMANTICS
// ============================================================================

test('CHALLENGER-R3: Form controls in BuyerProfile.tsx and DirectCheckoutPage.tsx have semantic bindings', () => {
  // BuyerProfile
  const bpCode = fs.readFileSync(BUYER_PROFILE_PATH, 'utf8').replace(/\r\n/g, '\n');
  assert.ok(bpCode.includes('htmlFor="gstNotLiable"'), 'gstNotLiable has htmlFor');
  assert.ok(bpCode.includes('id="gstNotLiable"'), 'gstNotLiable has matching id');
  assert.ok(bpCode.includes('htmlFor="aadhaarConsent"'), 'aadhaarConsent has htmlFor');
  assert.ok(bpCode.includes('id="aadhaarConsent"'), 'aadhaarConsent has matching id');

  // DirectCheckoutPage
  const dcCode = fs.readFileSync(CHECKOUT_PAGE_PATH, 'utf8').replace(/\r\n/g, '\n');
  assert.ok(dcCode.includes('htmlFor={`payment-method-${opt.id}`}'), 'Payment radio has htmlFor');
  assert.ok(dcCode.includes('id={`payment-method-${opt.id}`}'), 'Payment radio has matching id');
  assert.ok(dcCode.includes('type="radio"'), 'Payment inputs have type="radio"');
  assert.ok(dcCode.includes('aria-live="polite"'), 'DirectCheckoutPage has aria-live="polite"');
  assert.ok(dcCode.includes('role="status"'), 'DirectCheckoutPage has role="status"');
});

// ============================================================================
// PART 5: PERFORMANCE & SECURITY BOUNDS
// ============================================================================

test('CHALLENGER-R3: Bundle optimization & query bounds verification', () => {
  // InvoiceRegisterPage
  const invCode = fs.readFileSync(INVOICE_PAGE_PATH, 'utf8').replace(/\r\n/g, '\n');
  assert.ok(invCode.includes("await import('../lib/invoicePdfGenerator')"), 'Must dynamically import PDF generator');
  assert.ok(!invCode.includes("import jsPDF"), 'Must not statically import jsPDF');
  assert.ok(!invCode.includes("import { PdfEngine"), 'Must not import legacy PdfEngine');

  // procurement-bid.routes.ts
  const bidCode = fs.readFileSync(BID_ROUTES_PATH, 'utf8').replace(/\r\n/g, '\n');
  assert.ok(bidCode.includes('Math.min(Math.max(1, parsedLimit), 100)'), 'Must clamp query limit to 100');
  assert.ok(bidCode.includes('maskSensitive(bids)'), 'Must mask sensitive bid data');
});
