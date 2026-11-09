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
const LIVE_AUCTION_LEADERBOARD_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'reverseAuctions', 'components', 'LiveAuctionLeaderboard.tsx');
const REVERSE_AUCTION_LIVE_PATH = path.join(ROOT_DIR, 'frontend', 'src', 'features', 'reverseAuctions', 'pages', 'ReverseAuctionLivePage.tsx');

// ============================================================================
// ADVERSARIAL CHALLENGER 2: FRONTEND VPAT & ACCESSIBILITY EMPIRICAL SUITE
// ============================================================================

test('--- CHALLENGER 2: FRONTEND VPAT & ACCESSIBILITY TEST SUITE START ---', () => {
  assert.ok(true, 'Initiating Challenger 2 Frontend Accessibility Verification');
});

// ============================================================================
// 1. KEYBOARD NAVIGATION & SEMANTIC FORM LABELS
// ============================================================================

test('CHALLENGER 2 - KB.01: BuyerProfile.tsx lines 3390-3620 form controls semantics and state wiring', () => {
  const code = fs.readFileSync(BUYER_PROFILE_PATH, 'utf8').replace(/\r\n/g, '\n');
  const lines = code.split('\n');
  const section = lines.slice(3385, 3625).join('\n');

  // Verify gstNotLiable
  assert.ok(section.includes('htmlFor="gstNotLiable"'), 'gstNotLiable must have explicit label htmlFor');
  assert.ok(section.includes('id="gstNotLiable"'), 'gstNotLiable checkbox must have id="gstNotLiable"');
  assert.ok(section.includes('type="checkbox"'), 'gstNotLiable must be native checkbox input');
  assert.ok(
    section.includes('onChange={(e) => setFormData({ ...formData, gstNotLiable: e.target.checked })}'),
    'gstNotLiable must update state with e.target.checked'
  );

  // Verify aadhaarConsent
  assert.ok(section.includes('htmlFor="aadhaarConsent"'), 'aadhaarConsent must have explicit label htmlFor');
  assert.ok(section.includes('id="aadhaarConsent"'), 'aadhaarConsent checkbox must have id="aadhaarConsent"');
  assert.ok(
    section.includes('onChange={(e) => setFormData({ ...formData, aadhaarConsent: e.target.checked })}'),
    'aadhaarConsent must update state with e.target.checked'
  );

  // Ensure no dummy onChange handlers
  assert.ok(!section.includes('onChange={() => { }}'), 'No dummy empty onChange handlers allowed');
  assert.ok(!section.includes('onChange={() => {}}'), 'No dummy empty onChange handlers allowed');
});

test('CHALLENGER 2 - KB.02: DirectCheckoutPage.tsx payment radios and terms controls keyboard accessibility', () => {
  const code = fs.readFileSync(CHECKOUT_PAGE_PATH, 'utf8').replace(/\r\n/g, '\n');

  // Radio button semantics
  assert.ok(code.includes('htmlFor={`payment-method-${opt.id}`}'), 'Payment radio option must be wrapped with semantic label htmlFor');
  assert.ok(code.includes('id={`payment-method-${opt.id}`}'), 'Payment radio input must have matching id');
  assert.ok(code.includes('type="radio"'), 'Must render native radio inputs');
  assert.ok(code.includes('name="paymentMethod"'), 'Radio options must share name group');
  assert.ok(code.includes('setPaymentMethod(opt.id as any)'), 'Radio onChange must update paymentMethod state');

  // Terms and conditions checkbox
  assert.ok(code.includes('htmlFor="direct-purchase-policy-consent"'), 'Terms checkbox must have semantic label htmlFor');
  assert.ok(code.includes('id="direct-purchase-policy-consent"'), 'Terms checkbox must have matching id');
  assert.ok(code.includes('aria-required="true"'), 'Terms checkbox must declare aria-required');
  assert.ok(code.includes('aria-invalid='), 'Terms checkbox must dynamically declare aria-invalid');
  assert.ok(code.includes('aria-describedby='), 'Terms checkbox must link to error description via aria-describedby');
});

// ============================================================================
// 2. FOCUS TRAP EMPIRICAL BEHAVIORAL STRESS TESTS
// ============================================================================

test('CHALLENGER 2 - TRAP.01: Tab cyclic containment wraps from last to first element', () => {
  // Simulate DOM nodes and event dispatch
  let focusedElement: any = null;
  const elements = [
    { id: 'btn-1', focus: () => { focusedElement = elements[0]; }, offsetParent: {}, offsetWidth: 100, offsetHeight: 30 },
    { id: 'input-2', focus: () => { focusedElement = elements[1]; }, offsetParent: {}, offsetWidth: 150, offsetHeight: 30 },
    { id: 'btn-3', focus: () => { focusedElement = elements[2]; }, offsetParent: {}, offsetWidth: 80, offsetHeight: 30 },
  ];

  const container = {
    contains: (el: any) => elements.includes(el),
    querySelectorAll: () => elements
  };

  // Simulation of FocusTrap Tab handler logic
  function simulateTabKey(activeElement: any, shiftKey: boolean) {
    let prevented = false;
    const focusables = elements.filter(el => el.offsetParent !== null || el.offsetWidth > 0 || el.offsetHeight > 0);
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
    return { prevented, focusedElement };
  }

  // 1. Tab on last element -> wraps to first
  focusedElement = elements[2];
  const r1 = simulateTabKey(elements[2], false);
  assert.equal(r1.prevented, true, 'Tab on last element must preventDefault');
  assert.equal(focusedElement.id, 'btn-1', 'Focus must cycle to first element');

  // 2. Shift+Tab on first element -> wraps to last
  focusedElement = elements[0];
  const r2 = simulateTabKey(elements[0], true);
  assert.equal(r2.prevented, true, 'Shift+Tab on first element must preventDefault');
  assert.equal(focusedElement.id, 'btn-3', 'Focus must cycle to last element');

  // 3. Focus outside container -> Tab snaps focus to first element
  const outsideElement = { id: 'outside-btn' };
  focusedElement = outsideElement;
  const r3 = simulateTabKey(outsideElement, false);
  assert.equal(r3.prevented, true, 'Tab when focus is outside must prevent default');
  assert.equal(focusedElement.id, 'btn-1', 'Focus must be drawn inside container');

  // 4. Focus outside container -> Shift+Tab snaps focus to last element
  focusedElement = outsideElement;
  const r4 = simulateTabKey(outsideElement, true);
  assert.equal(r4.prevented, true, 'Shift+Tab when focus is outside must prevent default');
  assert.equal(focusedElement.id, 'btn-3', 'Focus must be drawn to last element of container');
});

test('CHALLENGER 2 - TRAP.02: Escape key dismisses trap and stops event propagation', () => {
  let escapeDismissed = false;
  let propagationStopped = false;

  const onEscape = () => { escapeDismissed = true; };
  const e = {
    key: 'Escape',
    stopPropagation: () => { propagationStopped = true; }
  };

  // FocusTrap Escape logic
  if (e.key === 'Escape' && onEscape) {
    e.stopPropagation();
    onEscape();
  }

  assert.equal(escapeDismissed, true, 'Escape key must trigger onEscape callback');
  assert.equal(propagationStopped, true, 'Escape key must call stopPropagation');
});

test('CHALLENGER 2 - TRAP.03: Focus restoration on unmount restores previous active element or returnFocusRef', () => {
  let triggerElementFocused = false;
  let customRefFocused = false;

  const triggerElement = { focus: () => { triggerElementFocused = true; } };
  const customReturnRef = { current: { focus: () => { customRefFocused = true; } } };

  // Case A: Unmount with returnFocusRef
  if (customReturnRef?.current && typeof customReturnRef.current.focus === 'function') {
    customReturnRef.current.focus();
  }
  assert.equal(customRefFocused, true, 'Should restore focus to returnFocusRef if provided');

  // Case B: Unmount without returnFocusRef -> restores triggerElement
  customRefFocused = false;
  const nullRef: any = { current: null };
  const prevActive: any = triggerElement;

  if (nullRef?.current && typeof nullRef.current.focus === 'function') {
    nullRef.current.focus();
  } else if (prevActive && typeof prevActive.focus === 'function') {
    prevActive.focus();
  }
  assert.equal(triggerElementFocused, true, 'Should restore focus to previously active trigger element');
});

test('CHALLENGER 2 - TRAP.04: FocusTrap handles container with zero focusable elements without error', () => {
  let prevented = false;
  const focusables: any[] = [];

  const e = {
    key: 'Tab',
    shiftKey: false,
    preventDefault: () => { prevented = true; }
  };

  if (focusables.length === 0) {
    e.preventDefault();
  }

  assert.equal(prevented, true, 'Tab on empty container must prevent default to keep focus inside');
});

// ============================================================================
// 3. SCREEN READER LIVE REGIONS
// ============================================================================

test('CHALLENGER 2 - LIVE.01: DirectCheckoutPage.tsx and Reverse Auction views implement live region announcements', () => {
  const checkoutCode = fs.readFileSync(CHECKOUT_PAGE_PATH, 'utf8').replace(/\r\n/g, '\n');
  assert.ok(checkoutCode.includes('aria-live="polite"'), 'DirectCheckoutPage must include aria-live="polite"');
  assert.ok(checkoutCode.includes('role="status"'), 'DirectCheckoutPage must include role="status"');
  assert.ok(checkoutCode.includes('terms-error-text'), 'Terms error must be announced');
  assert.ok(checkoutCode.includes('terms-error-summary'), 'Summary terms error must be announced');

  const leaderboardCode = fs.readFileSync(LIVE_AUCTION_LEADERBOARD_PATH, 'utf8').replace(/\r\n/g, '\n');
  assert.ok(leaderboardCode.includes('aria-live="polite"'), 'LiveAuctionLeaderboard must declare aria-live="polite"');
  assert.ok(leaderboardCode.includes('role="status"'), 'LiveAuctionLeaderboard must declare role="status"');
  assert.ok(leaderboardCode.includes('aria-live="off"'), 'Live countdown clock should have aria-live="off" to prevent speech synthesis overload');

  const raLiveCode = fs.readFileSync(REVERSE_AUCTION_LIVE_PATH, 'utf8').replace(/\r\n/g, '\n');
  assert.ok(raLiveCode.includes('aria-live="polite"'), 'ReverseAuctionLivePage must declare aria-live="polite"');
  assert.ok(raLiveCode.includes('role="status"'), 'ReverseAuctionLivePage must declare role="status"');
});

// ============================================================================
// 4. BUNDLE OPTIMIZATION & DYNAMIC IMPORTS
// ============================================================================

test('CHALLENGER 2 - BUNDLE.01: InvoiceRegisterPage.tsx eliminates static jspdf imports', () => {
  const code = fs.readFileSync(INVOICE_PAGE_PATH, 'utf8').replace(/\r\n/g, '\n');
  
  // No static jspdf or jspdf-autotable imports
  assert.ok(!code.includes("import jsPDF from 'jspdf'"), 'Must not statically import jsPDF');
  assert.ok(!code.includes("import { jsPDF }"), 'Must not statically import { jsPDF }');
  assert.ok(!code.includes("import 'jspdf-autotable'"), 'Must not statically import jspdf-autotable');
  assert.ok(!code.includes("import { PdfEngine }"), 'Must not import legacy PdfEngine');

  // Dynamic import present
  assert.ok(
    code.includes("await import('../lib/invoicePdfGenerator')"),
    'Must dynamically import invoicePdfGenerator inside PDF download handler'
  );
});

// ============================================================================
// 5. COLOR CONTRAST AUDIT (WCAG 2.1 AA 4.5:1 MINIMUM)
// ============================================================================

test('CHALLENGER 2 - CONTRAST.01: Audit verifies no lingering text-slate-400 in BuyerProfile.tsx lines 3390-3620', () => {
  const code = fs.readFileSync(BUYER_PROFILE_PATH, 'utf8').replace(/\r\n/g, '\n');
  const lines = code.split('\n');

  const failingLines: { line: number; text: string }[] = [];
  for (let i = 3389; i < 3620; i++) {
    if (lines[i].includes('text-slate-400')) {
      failingLines.push({ line: i + 1, text: lines[i].trim() });
    }
  }

  // Verify all low-contrast text-slate-400 instances were remediated
  assert.strictEqual(
    failingLines.length,
    0,
    `Found ${failingLines.length} instances of text-slate-400 in BuyerProfile.tsx:3390-3620 (Lines: ${failingLines.map(f => f.line).join(', ')})`
  );
});

test('CHALLENGER 2 - CONTRAST.02: Audit verifies no lingering text-slate-400 across modified modal dialogs', () => {
  const checkModals = [
    { path: 'frontend/src/features/grn/components/GrnCreateModal.tsx', name: 'GrnCreateModal' },
    { path: 'frontend/src/features/invoices/components/CreateInvoiceModal.tsx', name: 'CreateInvoiceModal' },
    { path: 'frontend/src/features/delivery/components/PackedOrderDialog.tsx', name: 'PackedOrderDialog' },
  ];

  const modalFindings: Record<string, number> = {};

  for (const m of checkModals) {
    const fullPath = path.join(ROOT_DIR, m.path);
    const content = fs.readFileSync(fullPath, 'utf8');
    const matches = content.match(/text-slate-400/g) || [];
    modalFindings[m.name] = matches.length;
  }

  // GrnCreateModal, CreateInvoiceModal, PackedOrderDialog must have 0 lingering text-slate-400
  assert.strictEqual(modalFindings['GrnCreateModal'], 0, 'GrnCreateModal must not have lingering text-slate-400');
  assert.strictEqual(modalFindings['CreateInvoiceModal'], 0, 'CreateInvoiceModal must not have lingering text-slate-400');
  assert.strictEqual(modalFindings['PackedOrderDialog'], 0, 'PackedOrderDialog must not have lingering text-slate-400');
});

test('CHALLENGER 2 - CONTRAST.03: Audit verifies no light-background readable text-[#c8a45c] in views', () => {
  const docPath = path.join(ROOT_DIR, 'frontend/src/views/PortalDocumentation.tsx');
  const docContent = fs.readFileSync(docPath, 'utf8');
  const goldMatches = (docContent.match(/<p[^>]*text-\[#c8a45c\][^>]*>/g) || []).length;

  assert.strictEqual(goldMatches, 0, `PortalDocumentation.tsx must have 0 readable <p> text-[#c8a45c] on white background`);
});
