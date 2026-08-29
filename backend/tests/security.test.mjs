import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('bearer query parameters are restricted to the notification SSE endpoint', () => {
  const source = read('src/middleware/authenticate.ts');
  assert.match(source, /getNotificationStreamToken/);
  assert.doesNotMatch(source, /:\s*\(req\.query\.token[^]*?\?\s*req\.query\.token/);
});

test('production cannot invoke payment-success simulation', () => {
  const source = read('src/modules/payments/payment.routes.ts');
  assert.match(source, /env\.NODE_ENV !== 'development' && env\.NODE_ENV !== 'test'/);
  assert.match(source, /PAYMENT_ENDPOINT_NOT_FOUND/);
});

test('milestone release is state and amount constrained', () => {
  const source = read('src/modules/payments/payment.service.ts');
  assert.match(source, /MILESTONE_AMOUNT_EXCEEDS_ESCROW/);
  assert.match(source, /MILESTONE_NOT_COMPLETED/);
  assert.match(source, /MILESTONE_ALREADY_RELEASED/);
  assert.match(source, /MILESTONE_INVALID_STATUS/);
});

test('payment webhook comparison uses constant-time equality', () => {
  const source = read('src/modules/payments/bandhan.provider.ts');
  assert.match(source, /crypto\.timingSafeEqual/);
  assert.doesNotMatch(source, /signature\s*===\s*expected/);
});

test('factoring responses do not expose counterparty email fields', () => {
  const source = read('src/routes/factoring.routes.ts');
  assert.doesNotMatch(source, /select:\s*\{\s*id:\s*true,\s*name:\s*true,\s*email:\s*true\s*\}/);
  assert.match(source, /REQUESTED_AMOUNT_EXCEEDS_INVOICE/);
  assert.match(source, /OFFER_ALREADY_OWNED/);
});

test('public registration cannot create an administrator account', () => {
  const validation = read('src/modules/auth/auth.validation.ts');
  const controller = read('src/modules/auth/auth.controller.ts');
  assert.match(validation, /role:\s*z\.enum\(\['buyer',\s*'seller'\]\)/);
  assert.doesNotMatch(validation, /role:\s*z\.enum\([^\n]*'admin'/);
  assert.match(controller, /ADMIN_INVITE_REQUIRED/);
  assert.match(controller, /ADMIN_SCOPE_REQUIRED/);
});

test('existing admin sessions require an active district assignment', () => {
  const source = read('src/middleware/authenticate.ts');
  assert.match(source, /userDb\.role === 'admin'/);
  assert.match(source, /scopeType:\s*'DISTRICT'/);
  assert.match(source, /if \(userDb\.role === 'admin' && !districtAssignment\?\.scopeId\)/);
});

test('legacy admins do not receive cross-district organization access', () => {
  const source = read('src/middleware/authorize.ts');
  assert.doesNotMatch(source, /return req\.user\.role === 'admin';/);
  assert.match(source, /scopeType:\s*'DISTRICT'/);
  assert.match(source, /scopeId:\s*organization\.district/);
});

test('ordinary admins do not receive wildcard permissions by legacy role', () => {
  const source = read('src/services/rbac.service.ts');
  assert.doesNotMatch(source, /user\.role === 'admin' \|\| user\.role === 'master_admin'[^]*?defaults\.push\('\*'\)/);
  assert.match(source, /user\.role === 'master_admin'[^]*?defaults\.push\('\*'\)/);
});

test('admin registration and admin bid pages are not public client routes', () => {
  const source = read('../frontend/src/App.tsx');
  assert.doesNotMatch(source, /<Register type="admin"/);
  assert.doesNotMatch(source, /route\.startsWith\('\/admin\/bids'\)/);
  assert.match(source, /pathname\.startsWith\('\/admin'\) && user\.role !== 'admin'/);
});

test('anonymous marketplace visits do not enter the refresh and logout loop', () => {
  const source = read('../frontend/src/hooks/useAuth.tsx');
  assert.match(source, /if \(!hasCachedUser && !hasSessionMarker && !hasStoredSession\)/);
  assert.match(source, /if \(!getCookieValue\('csrfToken'\)\)[^]*?clearLocalSession\(\)/);
  assert.doesNotMatch(source, /if \(!refreshRes\.ok\) \{\s*logout\(\)/);
});

test('master-admin user deletion is atomic, bounded, and does not expose Prisma errors', () => {
  const source = read('src/routes/master-admin.routes.ts');
  const deletionStart = source.indexOf('export const permanentlyDeleteUser');
  const deletionEnd = source.indexOf('const companyPayload', deletionStart);
  const deletion = source.slice(deletionStart, deletionEnd);
  assert.ok(deletionStart >= 0 && deletionEnd > deletionStart);
  assert.doesNotMatch(deletion, /SAVEPOINT|ROLLBACK TO SAVEPOINT|RELEASE SAVEPOINT/);
  assert.match(deletion, /USER_DELETE_ATOMIC_FAILURE/);
  assert.match(deletion, /timeout:\s*180_000,\s*maxWait:\s*30_000/);
  assert.match(source, /USER_DELETE_FAILED/);
  assert.doesNotMatch(source, /jsonError\(res, 400, err\.message \|\| 'Failed to delete user\.'/);
  assert.doesNotMatch(source, /SAVEPOINT|ROLLBACK TO SAVEPOINT|RELEASE SAVEPOINT/);
  assert.match(source, /ORGANIZATION_DELETE_ATOMIC_FAILURE/);
});

test('sub-user dashboard APIs stay locked until password and mobile activation complete', () => {
  const schema = read('prisma/schema.prisma');
  const middleware = read('src/middleware/authenticate.ts');
  const authController = read('src/modules/auth/auth.controller.ts');
  assert.match(schema, /mustChangePassword\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /requiresMobileVerification\s+Boolean\s+@default\(false\)/);
  assert.match(middleware, /PASSWORD_CHANGE_REQUIRED/);
  assert.match(middleware, /MOBILE_VERIFICATION_REQUIRED/);
  assert.match(middleware, /activationAllowedPaths/);
  assert.match(authController, /mustChangePassword:\s*false/);
  assert.match(authController, /requiresMobileVerification:\s*false/);
  assert.match(authController, /sub_user_mobile_activation/);
});

test('scoped team invites cannot provision Master Admin and do not return temporary credentials', () => {
  const source = read('src/routes/rbac.routes.ts');
  const rbacService = read('src/services/rbac.service.ts');
  assert.doesNotMatch(source, /accountType:\s*z\.enum\(\[[^\]]*MASTER_ADMIN/);
  assert.match(source, /MASTER_ADMIN_SUB_LOGIN_DENIED/);
  assert.match(source, /hashPassword\(temporaryPassword\)/);
  assert.match(source, /INVITE_EMAIL_FAILED/);
  assert.match(source, /scopedInvitation\.delete/);
  assert.match(source, /assertTargetUserInScope/);
  assert.match(source, /PRIMARY_ADMIN_PROTECTED/);
  assert.doesNotMatch(source, /scopeType:\s*'DISTRICT' as const, scopeId:\s*'0'/);
  assert.match(rbacService, /organizationMembership\.invitedById/);
  assert.doesNotMatch(source, /apiResponse\.created\([^\n]*temporaryPassword/);
});

test('organization role creation enforces the creator permission subset', () => {
  const source = read('src/routes/org.routes.ts');
  const rbacService = read('src/services/rbac.service.ts');
  assert.match(source, /assertAssignableOrgPermissionKeys/);
  assert.match(source, /PERMISSION_ESCALATION_DENIED/);
  assert.match(source, /membership\?\.orgRole === 'ORG_ADMIN' && !membership\.invitedById/);
  assert.match(rbacService, /organizationMembership\.orgRole !== 'ORG_ADMIN'/);
  assert.match(source, /await assertAssignableOrgPermissionKeys\(req, permissions\)/);
  assert.match(source, /await assertAssignableOrgPermissionKeys\(req, body\.permissions\)/);
});

test('SHG registration makes the primary user organization administrator', () => {
  const source = read('src/routes/shg.routes.ts');
  assert.match(source, /tx\.orgMembership\.create/);
  assert.match(source, /orgRole:\s*'ORG_ADMIN'/);
});
