import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  RBAC_PERMISSION_CATALOG,
  DEFAULT_DYNAMIC_ROLE_TEMPLATES
} from '../src/constants/dynamic-rbac.js';
import {
  isShgBusinessType,
  isShgUserBackend
} from '../src/routes/phase4.routes.js';
import {
  userHasPermission,
  isMasterAdmin
} from '../src/services/rbac.service.js';

describe('Dynamic Multi-Role Verification & Procurement View-Only Audit Suite', () => {

  test('1. RBAC Permission Catalog includes MSME, SHG, Buyer verification & Procurement Audit View', () => {
    const catalogMap = new Map(RBAC_PERMISSION_CATALOG.map(([code, module, action, resource, desc]) => [code, { module, action, resource, desc }]));

    assert.ok(catalogMap.has('org.msme.verify'), 'org.msme.verify must exist in catalog');
    assert.ok(catalogMap.has('org.shg.verify'), 'org.shg.verify must exist in catalog');
    assert.ok(catalogMap.has('org.buyer.verify'), 'org.buyer.verify must exist in catalog');
    assert.ok(catalogMap.has('shg.verify'), 'shg.verify must exist in catalog');
    assert.ok(catalogMap.has('procurement.audit.view'), 'procurement.audit.view must exist in catalog');

    assert.equal(catalogMap.get('org.msme.verify').module, 'Onboarding');
    assert.equal(catalogMap.get('org.shg.verify').module, 'Onboarding');
    assert.equal(catalogMap.get('org.buyer.verify').module, 'Onboarding');
    assert.equal(catalogMap.get('procurement.audit.view').module, 'Procurement');
  });

  test('2. Default dynamic role templates are properly configured with least-privilege scoping', () => {
    const templates = new Map(DEFAULT_DYNAMIC_ROLE_TEMPLATES.map(t => [t.code, t]));

    assert.ok(templates.has('MSME_VERIFICATION_OFFICER'), 'MSME_VERIFICATION_OFFICER template exists');
    assert.ok(templates.has('SHG_VERIFICATION_OFFICER'), 'SHG_VERIFICATION_OFFICER template exists');
    assert.ok(templates.has('BUYER_VERIFICATION_OFFICER'), 'BUYER_VERIFICATION_OFFICER template exists');
    assert.ok(templates.has('PROCUREMENT_AUDIT_OFFICER'), 'PROCUREMENT_AUDIT_OFFICER template exists');

    const msmeRole = templates.get('MSME_VERIFICATION_OFFICER');
    assert.ok(msmeRole.permissionCodes.includes('org.msme.verify'));
    assert.ok(msmeRole.permissionCodes.includes('procurement.audit.view'));
    assert.ok(!msmeRole.permissionCodes.includes('org.shg.verify'), 'MSME officer must NOT have SHG verify permission');
    assert.ok(!msmeRole.permissionCodes.includes('org.buyer.verify'), 'MSME officer must NOT have Buyer approve permission');

    const shgRole = templates.get('SHG_VERIFICATION_OFFICER');
    assert.ok(shgRole.permissionCodes.includes('org.shg.verify'));
    assert.ok(shgRole.permissionCodes.includes('procurement.audit.view'));
    assert.ok(!shgRole.permissionCodes.includes('org.msme.verify'), 'SHG officer must NOT have MSME verify permission');
    assert.ok(!shgRole.permissionCodes.includes('org.buyer.verify'), 'SHG officer must NOT have Buyer approve permission');

    const buyerRole = templates.get('BUYER_VERIFICATION_OFFICER');
    assert.ok(buyerRole.permissionCodes.includes('org.buyer.verify'));
    assert.ok(buyerRole.permissionCodes.includes('procurement.audit.view'));
    assert.ok(!buyerRole.permissionCodes.includes('org.msme.verify'), 'Buyer officer must NOT have MSME verify permission');
    assert.ok(!buyerRole.permissionCodes.includes('org.shg.verify'), 'Buyer officer must NOT have SHG verify permission');
  });

  test('3. SHG vs MSME discrimination functions operate accurately without cross-contamination', () => {
    // SHG detection tests
    assert.equal(isShgBusinessType('shg'), true);
    assert.equal(isShgBusinessType('women_shg'), true);
    assert.equal(isShgBusinessType('self help group'), true);
    assert.equal(isShgBusinessType('farmer_producer_group'), true);
    assert.equal(isShgBusinessType('artisan_handicraft_shg'), true);
    assert.equal(isShgBusinessType('private_limited'), false);
    assert.equal(isShgBusinessType('proprietorship'), false);

    const shgUser1 = { role: 'shg' };
    const shgUser2 = { role: 'seller', sellerProfile: { organizationType: 'SHG' } };
    const shgUser3 = { role: 'seller', registrationDetails: { businessType: 'women_self_help_group' } };
    const msmeSeller = { role: 'seller', sellerProfile: { organizationType: 'PROPRIETORSHIP' }, registrationDetails: { businessType: 'MSME' } };
    const buyerUser = { role: 'buyer', buyerProfile: { organizationType: 'GOVERNMENT' } };

    assert.equal(isShgUserBackend(shgUser1), true);
    assert.equal(isShgUserBackend(shgUser2), true);
    assert.equal(isShgUserBackend(shgUser3), true);
    assert.equal(isShgUserBackend(msmeSeller), false);
    assert.equal(isShgUserBackend(buyerUser), false);
  });

  test('4. Master Admin retains full wildcard access across all entities and permissions', async () => {
    const masterAdminUser = { id: 1, role: 'master_admin' };
    assert.equal(isMasterAdmin(masterAdminUser), true);

    assert.equal(await userHasPermission(masterAdminUser, 'org.msme.verify'), true);
    assert.equal(await userHasPermission(masterAdminUser, 'org.shg.verify'), true);
    assert.equal(await userHasPermission(masterAdminUser, 'org.buyer.verify'), true);
    assert.equal(await userHasPermission(masterAdminUser, 'procurement.audit.view'), true);
    assert.equal(await userHasPermission(masterAdminUser, 'any.custom.action'), true);
  });

  test('5. Unassigned admin retains safe fallback access for backward compatibility', async () => {
    // Simulated admin user with id 999999 (no custom UserRole assignments in DB)
    const unassignedAdmin = { id: 999999, role: 'admin' };
    assert.equal(isMasterAdmin(unassignedAdmin), false);

    assert.equal(await userHasPermission(unassignedAdmin, 'dashboard.view'), true);
    assert.equal(await userHasPermission(unassignedAdmin, 'procurement.audit.view'), true);
    assert.equal(await userHasPermission(unassignedAdmin, 'org.msme.verify'), true);
    assert.equal(await userHasPermission(unassignedAdmin, 'org.shg.verify'), true);
    assert.equal(await userHasPermission(unassignedAdmin, 'org.buyer.verify'), true);
  });

});
