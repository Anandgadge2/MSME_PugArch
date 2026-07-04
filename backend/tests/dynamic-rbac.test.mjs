import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('dynamic RBAC routes protect mutations with permission and scope checks', () => {
  const routes = read('src/routes/rbac.routes.ts');
  assert.match(routes, /ensureAssignablePermissions/);
  assert.match(routes, /assertCanManageScope/);
  assert.match(routes, /scopedInvitation\.create/);
  assert.match(routes, /SELF_ESCALATION_DENIED/);
  assert.doesNotMatch(routes, /PROCUREMENT_OFFICER|FINANCE_OFFICER|TECHNICAL_OFFICER/);
});

test('organization permission middleware authorizes with dynamic permissions', () => {
  const middleware = read('src/middleware/requireOrgPermission.ts');
  assert.match(middleware, /requirePermission/);
  assert.match(middleware, /scopeType: 'ORGANIZATION'/);
  assert.match(middleware, /team\.role\.manage/);
  assert.match(middleware, /bid\.technical\.evaluate/);
  assert.doesNotMatch(middleware, /FALLBACK_ORG_ROLE_PERMISSIONS/);
  assert.doesNotMatch(middleware, /ORG_ADMIN|PROCUREMENT_OFFICER|FINANCE_OFFICER|TECHNICAL_OFFICER/);
  assert.doesNotMatch(middleware, /permissions\.includes\('\*'\)/);
});

test('tender evaluation no longer authorizes by fixed officer role names', () => {
  const routes = read('src/routes/tender-evaluation.routes.ts');
  assert.match(routes, /requireScopedPermission\('bid\.technical\.evaluate'\)/);
  assert.match(routes, /requireScopedPermission\('bid\.financial\.evaluate'\)/);
  assert.match(routes, /requireScopedPermission\('award\.recommend'\)/);
  assert.doesNotMatch(routes, /authorize\(/);
  assert.doesNotMatch(routes, /requireOrgRole\(/);
});

test('payment write routes use dynamic payment permissions', () => {
  const routes = read('src/modules/payments/payment.routes.ts');
  assert.match(routes, /requirePermission\('payment\.initiate'/);
  assert.match(routes, /requirePermission\('payment\.verify'/);
  assert.match(routes, /offline-proof', requirePermission\('payment\.initiate'/);
  assert.doesNotMatch(routes, /authorize\('buyer', 'admin'\)/);
});

test('approval, cart, grn, and reverse auction routes use scoped permissions for business actions', () => {
  const approvals = read('src/routes/approvals.routes.ts');
  const cart = read('src/routes/cart.routes.ts');
  const grn = read('src/routes/grn.routes.ts');
  const reverseAuction = read('src/routes/reverse-auction.routes.ts');

  assert.match(approvals, /requirePermission\('approval\.view', orgScope\)/);
  assert.match(approvals, /requirePermission\('approval\.approve', orgScope\)/);
  assert.match(approvals, /requirePermission\('approval\.reject', orgScope\)/);
  assert.match(approvals, /requirePermission\('approval\.clarification\.request', orgScope\)/);
  assert.match(approvals, /requirePermission\('approval\.submit', orgScope\)/);

  assert.match(cart, /requirePermission\('cart\.view', orgScope\)/);
  assert.match(cart, /requirePermission\('cart\.add', orgScope\)/);
  assert.match(cart, /requirePermission\('cart\.submit_for_approval', orgScope\)/);
  assert.match(cart, /requirePermission\('checkout\.approve', orgScope\)/);
  assert.match(cart, /requirePermission\('inspection\.view', orgScope\)/);
  assert.match(cart, /requirePermission\('inspection\.approve', orgScope\)/);
  assert.match(cart, /requirePermission\('approval\.submit', orgScope\)/);
  assert.doesNotMatch(cart, /requireOrgRole\(/);
  assert.doesNotMatch(cart, /authorize\('buyer', 'seller'\)/);

  assert.match(grn, /requirePermission\('grn\.view', orgScope\)/);
  assert.match(grn, /requirePermission\('grn\.create', orgScope\)/);
  assert.match(grn, /requirePermission\('grn\.approve', orgScope\)/);
  assert.doesNotMatch(grn, /requireOrgRole\(/);
  assert.doesNotMatch(grn, /authorize\('buyer', 'seller'\)/);

  assert.match(reverseAuction, /requirePermission\('reverse_auction\.create', orgScope\)/);
  assert.match(reverseAuction, /requirePermission\('reverse_auction\.view', orgScope\)/);
  assert.match(reverseAuction, /requirePermission\('reverse_auction\.update', orgScope\)/);
  assert.match(reverseAuction, /requirePermission\('reverse_auction\.publish', orgScope\)/);
  assert.match(reverseAuction, /requirePermission\('reverse_auction\.bid\.submit', orgScope\)/);
  assert.match(reverseAuction, /requirePermission\('reverse_auction\.award', orgScope\)/);
  assert.doesNotMatch(reverseAuction, /authorize\(/);
});

test('phase4 tender and fulfillment business actions use explicit permissions', () => {
  const routes = read('src/routes/phase4.routes.ts');

  assert.match(routes, /\/seller\/products', authenticate, requirePermission\('catalogue\.product\.create', orgScope\)/);
  assert.match(routes, /\/seller\/products\/:id', authenticate, requirePermission\('catalogue\.product\.update', orgScope\)/);
  assert.match(routes, /\/seller\/services', authenticate, requirePermission\('catalogue\.service\.create', orgScope\)/);
  assert.match(routes, /\/tenders', authenticate, requirePermission\('tender\.create', orgScope\)/);
  assert.match(routes, /\/tenders\/:id', authenticate, requirePermission\('tender\.update', orgScope\)/);
  assert.match(routes, /requirePermission\('tender\.publish', orgScope\)/);
  assert.match(routes, /\/tenders\/:id\/bids', authenticate, requirePermission\('bid\.submit', orgScope\)/);
  assert.match(routes, /\/bids\/:id\(\\\\d\+\)\/technical-evaluation', authenticate, requirePermission\('bid\.technical\.evaluate', orgScope\)/);
  assert.match(routes, /\/bids\/:id\(\\\\d\+\)\/financial-evaluation', authenticate, requirePermission\('bid\.financial\.evaluate', orgScope\)/);
  assert.match(routes, /\/purchase-orders\/generate', authenticate, requirePermission\('purchase_order\.create', orgScope\)/);
  assert.match(routes, /\/purchase-orders\/:id\/delivery', authenticate, requirePermission\('delivery\.create', orgScope\)/);
  assert.match(routes, /\/delivery\/:id\/events', authenticate, requirePermission\('delivery\.update', orgScope\)/);
  assert.match(routes, /\/purchase-orders\/:id\/inspection', authenticate, requirePermission\('inspection\.create', orgScope\)/);
  assert.match(routes, /requirePermission\('inspection\.approve', orgScope\)/);

  assert.doesNotMatch(routes, /\/tenders', authenticate, authorize\('buyer'/);
  assert.doesNotMatch(routes, /\/purchase-orders\/generate', authenticate, authorize\('buyer', 'admin'\)/);
  assert.doesNotMatch(routes, /\/purchase-orders\/:id\/delivery', authenticate, authorize\('seller', 'admin'\)/);
});

test('procurement bid routes do not grant evaluation, publish, or award actions by account type alone', () => {
  const routes = read('src/modules/procurementBid/procurement-bid.routes.ts');

  assert.match(routes, /requirePermission\('tender\.publish'\)/);
  assert.match(routes, /requirePermission\('bid\.technical\.evaluate'\)/);
  assert.match(routes, /requirePermission\('bid\.financial\.evaluate'\)/);
  assert.match(routes, /requirePermission\('award\.recommend'\)/);
  assert.match(routes, /requirePermission\('purchase_order\.create'\)/);
  assert.match(routes, /requirePermission\('report\.view'\)/);

  assert.doesNotMatch(routes, /authorize\('buyer', 'admin'\), requirePermission\('bid\.technical\.evaluate'/);
  assert.doesNotMatch(routes, /authorize\('admin'\), checkFeatureEnabled\('admin-bid-approval'\), validate/);
});

test('frontend evaluation and team access are permission driven', () => {
  const evaluationPage = read('../frontend/src/features/tenderEval/pages/TenderEvaluationPage.tsx');
  const teamPage = read('../frontend/src/features/orgTeam/pages/TeamManagementPage.tsx');
  const hook = read('../frontend/src/hooks/useOrgRole.ts');
  assert.match(evaluationPage, /hasPermission\('bid\.technical\.evaluate'\)/);
  assert.match(evaluationPage, /hasPermission\('bid\.financial\.evaluate'\)/);
  assert.match(evaluationPage, /hasPermission\('award\.recommend'\)/);
  assert.match(teamPage, /hasPermission\('team\.role\.manage'\)/);
  assert.match(teamPage, /hasPermission\('team\.member\.invite'\)/);
  assert.doesNotMatch(`${evaluationPage}\n${teamPage}\n${hook}`, /ORG_ADMIN|PROCUREMENT_OFFICER|FINANCE_OFFICER|TECHNICAL_OFFICER/);
});

test('frontend approval, cart, grn, and dashboard views read explicit permissions', () => {
  const approvalsPage = read('../frontend/src/features/approvals/pages/ApprovalQueuePage.tsx');
  const cartPage = read('../frontend/src/features/cart/pages/CartPage.tsx');
  const cartApprovalPage = read('../frontend/src/features/cart/pages/CartApprovalPage.tsx');
  const technicalReviewPage = read('../frontend/src/features/cart/pages/TechnicalReviewPage.tsx');
  const grnListPage = read('../frontend/src/features/grn/pages/GrnListPage.tsx');
  const grnDetailPage = read('../frontend/src/features/grn/pages/GrnDetailPage.tsx');
  const dashboard = read('../frontend/src/features/dashboard/components/RoleAwareActionCards.tsx');

  assert.match(approvalsPage, /hasPermission\('approval\.view'\)/);
  assert.match(approvalsPage, /hasPermission\('approval\.approve'\)/);
  assert.match(approvalsPage, /hasPermission\('approval\.reject'\)/);
  assert.match(approvalsPage, /hasPermission\('approval\.clarification\.request'\)/);

  assert.match(cartPage, /hasPermission\('cart\.view'\)/);
  assert.match(cartPage, /hasPermission\('cart\.add'\)/);
  assert.match(cartPage, /hasPermission\('cart\.submit_for_approval'\)/);
  assert.match(cartPage, /hasPermission\('checkout\.approve'\)/);
  assert.match(cartPage, /hasPermission\('approval\.submit'\)/);

  assert.match(cartApprovalPage, /hasPermission\('checkout\.approve'\)/);
  assert.match(technicalReviewPage, /hasPermission\('inspection\.view'\)/);
  assert.match(technicalReviewPage, /hasPermission\('inspection\.approve'\)/);
  assert.match(grnListPage, /hasPermission\('grn\.view'\)/);
  assert.match(grnListPage, /hasPermission\('grn\.create'\)/);
  assert.match(grnDetailPage, /hasPermission\('grn\.view'\)/);
  assert.match(grnDetailPage, /hasPermission\('grn\.create'\)/);
  assert.match(grnDetailPage, /hasPermission\('grn\.approve'\)/);
  assert.match(dashboard, /hasPermission\('approval\.view'\)/);
  assert.match(dashboard, /hasPermission\('checkout\.approve'\)/);
  assert.match(dashboard, /hasPermission\('inspection\.view'\)/);
});

test('account type is a fixed lookup table, not a dynamic role id range', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/20260626120000_dynamic_rbac/migration.sql');
  assert.match(schema, /model AccountType/);
  assert.match(schema, /model RbacRole/);
  assert.match(migration, /\(0, 'MASTER_ADMIN'/);
  assert.match(migration, /\(1, 'SUPERADMIN'/);
  assert.match(migration, /\(2, 'SELLER'/);
  assert.match(migration, /\(3, 'BUYER'/);
  assert.match(migration, /\(4, 'SHG'/);
});

test('permission service verifies active database assignments only', () => {
  const service = read('src/services/rbac.service.ts');
  assert.match(service, /expiresAt: \{ gt: now \}/);
  assert.match(service, /role\.status !== 'ACTIVE'/);
  assert.match(service, /where: \{ allowed: true \}/);
  assert.doesNotMatch(service, /user\.permissions/);
});
