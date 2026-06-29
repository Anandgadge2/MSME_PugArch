import '../src/config/env.js';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { MASTER_FEATURES } from '../src/constants/permissions.js';
import { ACCOUNT_TYPE_IDS, DEFAULT_DYNAMIC_ROLE_TEMPLATES, RBAC_PERMISSION_CATALOG, legacyRoleToAccountType } from '../src/constants/dynamic-rbac.js';

const prisma = new PrismaClient();

const roles = [
  ['MASTER_ADMIN', 'Master Admin', 'Super owner for all companies, features, content, and permissions'],
  ['SUPER_ADMIN', 'Super Admin', 'Full platform administration'],
  ['ADMIN', 'Admin', 'Operational platform administration'],
  ['VERIFICATION_OFFICER', 'Verification Officer', 'KYC/KYB verification review'],
  ['BUYER', 'Buyer', 'Buyer organization user'],
  ['SELLER', 'Seller', 'Seller organization user'],
  ['FINANCE_OFFICER', 'Finance Officer', 'Invoice, payment, and escrow operations'],
  ['AUDITOR', 'Auditor', 'Read-only audit and compliance review'],
  ['SUPPORT_AGENT', 'Support Agent', 'Support, grievance, and dispute triage'],
  ['FINANCIER', 'Financier', 'Financing partner for invoice factoring / bill discounting']
] as const;

const permissions = [
  ['user.view', 'user', 'View users'],
  ['user.create', 'user', 'Create platform users'],
  ['user.update', 'user', 'Update users'],
  ['user.delete', 'user', 'Delete or deactivate users'],
  ['role.assign', 'role', 'Assign roles to users'],
  ['permission.manage', 'permission', 'Manage permission matrix'],
  ['buyer.approve', 'buyer', 'Approve buyer onboarding'],
  ['seller.verify', 'seller', 'Verify seller onboarding'],
  ['report.export', 'reports', 'Export reports'],
  ['feature.toggle', 'features', 'Enable or disable company features'],
  ['company.manage', 'company', 'Manage companies and districts'],
  ['content.update', 'content', 'Update CMS content'],
  ['branding.update', 'branding', 'Update branding settings'],
  ['organization.manage', 'organization', 'Manage organizations'],
  ['override', 'system', 'Override normal portal restrictions'],
  ['user.block', 'user', 'Block or suspend users'],
  ['onboarding.review', 'onboarding', 'Review onboarding submissions'],
  ['seller.catalogue.create', 'catalogue', 'Create seller catalogue entries'],
  ['requirement.create', 'requirements', 'Create procurement requirements'],
  ['tender.create', 'tenders', 'Create tenders'],
  ['tender.publish', 'tenders', 'Publish tenders'],
  ['bid.submit', 'bids', 'Submit bids'],
  ['bid.evaluate', 'bids', 'Evaluate bids'],
  ['po.generate', 'purchase-orders', 'Generate purchase orders'],
  ['delivery.update', 'delivery', 'Update delivery status'],
  ['inspection.create', 'inspection', 'Create inspection records'],
  ['invoice.submit', 'invoices', 'Submit invoices'],
  ['invoice.verify', 'invoices', 'Verify invoices'],
  ['payment.initiate', 'payments', 'Initiate payments'],
  ['escrow.release', 'escrow', 'Release escrow funds'],
  ['dispute.manage', 'disputes', 'Manage disputes'],
  ['audit.view', 'audit', 'View audit logs'],
  ['admin.reports.view', 'admin', 'View admin reports'],
  ['compliance.review', 'compliance', 'Review compliance flags'],
  ['fraud.review', 'fraud', 'Review fraud alerts']
] as const;

const permissionSeedRows = [
  ...permissions.map(([code, module, description]) => {
    const action = code.includes('.') ? code.split('.').pop() : code.includes(':') ? code.split(':').pop() : null;
    const resource = code.includes('.') ? code.split('.')[0] : code.includes(':') ? code.split(':')[0] : module;
    return [code, module, action, resource, description] as const;
  }),
  ...RBAC_PERMISSION_CATALOG
] as const;

const rolePermissionCodes: Record<string, string[]> = {
  MASTER_ADMIN: permissionSeedRows.map(([code]) => code),
  SUPER_ADMIN: permissionSeedRows.map(([code]) => code),
  ADMIN: permissionSeedRows.map(([code]) => code).filter((code) => code !== 'escrow.release'),
  VERIFICATION_OFFICER: ['onboarding.review', 'compliance.review', 'fraud.review', 'audit.view'],
  BUYER: ['requirement.create', 'tender.create', 'tender.publish', 'po.generate', 'inspection.create', 'payment.initiate', 'dispute.manage'],
  SELLER: ['seller.catalogue.create', 'bid.submit', 'delivery.update', 'invoice.submit', 'dispute.manage'],
  FINANCE_OFFICER: ['invoice.verify', 'payment.initiate', 'escrow.release', 'audit.view'],
  AUDITOR: ['audit.view', 'admin.reports.view', 'compliance.review', 'fraud.review'],
  SUPPORT_AGENT: ['dispute.manage', 'compliance.review'],
  FINANCIER: []
};

const complianceRules = [
  ['MISSING_REQUIRED_DOCUMENT', 'Missing required document', 'A mandatory onboarding or verification document is missing.', 'HIGH'],
  ['EXPIRED_CERTIFICATE', 'Expired certificate', 'A certificate or statutory document is expired.', 'MEDIUM'],
  ['DUPLICATE_IDENTIFIER', 'Duplicate identifier', 'A PAN, GST, bank, or Aadhaar hash appears on multiple unrelated profiles.', 'HIGH'],
  ['INVALID_GST', 'Invalid GST', 'GST verification failed or returned inconsistent data.', 'HIGH'],
  ['INVALID_PAN', 'Invalid PAN', 'PAN verification failed or returned inconsistent data.', 'HIGH'],
  ['INVALID_BANK', 'Invalid bank details', 'Bank account verification failed or returned inconsistent data.', 'HIGH'],
  ['SUSPICIOUS_REGISTRATION', 'Suspicious registration', 'Registration pattern requires manual compliance review.', 'CRITICAL'],
  ['POLICY_VIOLATION', 'Policy violation', 'A platform policy or procurement control was violated.', 'HIGH']
] as const;

const marketplaceCategories = [
  { name: 'Electrical & Electronics', type: 'BOTH', displayOrder: 10 },
  { name: 'Mechanical & Engineering', type: 'BOTH', displayOrder: 20 },
  { name: 'Construction & Building Materials', type: 'PRODUCT', displayOrder: 30 },
  { name: 'Industrial Chemicals', type: 'PRODUCT', displayOrder: 40 },
  { name: 'Refractories', type: 'PRODUCT', displayOrder: 50 },
  { name: 'Automobile Parts & Services', type: 'BOTH', displayOrder: 60 },
  { name: 'Tyres & Rubber Products', type: 'PRODUCT', displayOrder: 70 },
  { name: 'IT & Computer Equipment', type: 'PRODUCT', displayOrder: 80 },
  { name: 'Office Equipment & Stationery', type: 'PRODUCT', displayOrder: 90 },
  { name: 'Medical & Healthcare Supplies', type: 'PRODUCT', displayOrder: 100 },
  { name: 'Agriculture & Nursery', type: 'BOTH', displayOrder: 110 },
  { name: 'Safety Equipment & Industrial Safety', type: 'PRODUCT', displayOrder: 120 },
  { name: 'Fuel, Oil & Gas', type: 'PRODUCT', displayOrder: 130 },
  { name: 'Hydraulics & Pneumatics', type: 'PRODUCT', displayOrder: 140 },
  { name: 'Steel & Metal Products', type: 'PRODUCT', displayOrder: 150 },
  { name: 'Cement & Concrete Products', type: 'PRODUCT', displayOrder: 160 },
  { name: 'Pipes, Tiles & Hardware', type: 'PRODUCT', displayOrder: 170 },
  { name: 'Industrial Machinery & Spare Parts', type: 'PRODUCT', displayOrder: 180 },
  { name: 'Automation & Robotics', type: 'BOTH', displayOrder: 190 },
  { name: 'Fabrication & Welding Services', type: 'SERVICE', displayOrder: 200 },
  { name: 'Bearings & Mechanical Components', type: 'PRODUCT', displayOrder: 210 },
  { name: 'Electrical Cables & Power Equipment', type: 'PRODUCT', displayOrder: 220 },
  { name: 'Industrial Consumables', type: 'PRODUCT', displayOrder: 230 },
  { name: 'Packaging & Printing', type: 'BOTH', displayOrder: 240 },
  { name: 'Polymer & Plastic Products', type: 'PRODUCT', displayOrder: 250 },
  { name: 'Trading & Distribution', type: 'SERVICE', displayOrder: 260 },
  { name: 'Logistics & Supply Services', type: 'SERVICE', displayOrder: 270 },
  { name: 'Tools & Industrial Hardware', type: 'PRODUCT', displayOrder: 280 },
  { name: 'Laboratory Equipment & Chemicals', type: 'PRODUCT', displayOrder: 290 },
  { name: 'Engineering Consultancy Services', type: 'SERVICE', displayOrder: 300 },
  { name: 'Industrial Maintenance Services', type: 'SERVICE', displayOrder: 310 },
  { name: 'Construction & Civil Work Services', type: 'SERVICE', displayOrder: 320 },
  { name: 'Environmental & Waste Management', type: 'SERVICE', displayOrder: 330 },
  { name: 'Telecom & Communication Equipment', type: 'PRODUCT', displayOrder: 340 },
  { name: 'Furniture & Interior Supplies', type: 'PRODUCT', displayOrder: 350 },
  { name: 'General Industrial Supplier', type: 'BOTH', displayOrder: 360 },
  { name: 'Mining & Coal Equipment', type: 'PRODUCT', displayOrder: 370 },
  { name: 'Power & Energy Equipment', type: 'PRODUCT', displayOrder: 380 },
  { name: 'Gas Equipment & Cylinders', type: 'PRODUCT', displayOrder: 390 },
  { name: 'Conveyor & Material Handling Equipment', type: 'PRODUCT', displayOrder: 400 },
  { name: 'Pumps, Motors & Hydraulics', type: 'PRODUCT', displayOrder: 410 },
  { name: 'Industrial Seals & Gaskets', type: 'PRODUCT', displayOrder: 420 },
  { name: 'Welding & Cutting Equipment', type: 'PRODUCT', displayOrder: 430 },
  { name: 'Industrial Fasteners & Components', type: 'PRODUCT', displayOrder: 440 },
  { name: 'Retail & Commercial Supply', type: 'BOTH', displayOrder: 450 },
  { name: 'FMCG & Daily Utility Supply', type: 'PRODUCT', displayOrder: 460 },
  { name: 'Textile & Garments Supply', type: 'PRODUCT', displayOrder: 470 },
  { name: 'OEM / Manufacturing Vendor', type: 'BOTH', displayOrder: 480 },
  { name: 'Repair & Service Provider', type: 'SERVICE', displayOrder: 490 },
  { name: 'Multi-category Industrial Vendor', type: 'BOTH', displayOrder: 500 }
] as const;

const slugFor = (name: string) =>
  name.trim().toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function main() {
  const roleRecords = new Map<string, { id: number }>();
  const permissionRecords = new Map<string, { id: number }>();

  const accountTypes = [
    [ACCOUNT_TYPE_IDS.MASTER_ADMIN, 'MASTER_ADMIN', 'Master Admin', 'Platform master administrator'],
    [ACCOUNT_TYPE_IDS.SUPERADMIN, 'SUPERADMIN', 'Superadmin / Collector', 'District or collector administrator'],
    [ACCOUNT_TYPE_IDS.SELLER, 'SELLER', 'Seller', 'Seller organization account'],
    [ACCOUNT_TYPE_IDS.BUYER, 'BUYER', 'Buyer', 'Buyer organization account'],
    [ACCOUNT_TYPE_IDS.SHG, 'SHG', 'SHG', 'Self-help group account'],
    [ACCOUNT_TYPE_IDS.FINANCIER, 'FINANCIER', 'Financier', 'Financing partner account']
  ] as const;

  for (const [id, code, name, description] of accountTypes) {
    await (prisma as any).accountType.upsert({
      where: { id },
      update: { code, name, description, isActive: true },
      create: { id, code, name, description, isActive: true }
    });
  }

  for (const [code, name, description] of roles) {
    const role = await prisma.rbacRole.upsert({
      where: { code },
      update: { name, description, isSystemRole: true, scope: 'GLOBAL', scopeType: 'PLATFORM', status: 'ACTIVE' },
      create: { code, name, description, isSystemRole: true, scope: 'GLOBAL', scopeType: 'PLATFORM', status: 'ACTIVE' },
      select: { id: true }
    });
    roleRecords.set(code, role);
  }

  for (const [code, module, action, resource, description] of permissionSeedRows) {
    const permission = await prisma.permission.upsert({
      where: { code },
      update: { module, description, action, resource, isSystem: true },
      create: { code, module, description, action, resource, isSystem: true },
      select: { id: true }
    });
    permissionRecords.set(code, permission);
  }

  const masterEmail = process.env.MASTER_ADMIN_EMAIL;
  const masterPassword = process.env.MASTER_ADMIN_PASSWORD;
  if (masterEmail && masterPassword) {
    const passwordHash = await bcrypt.hash(masterPassword, 12);
    const account = legacyRoleToAccountType('master_admin');
    const masterUser = await prisma.user.upsert({
      where: { email: masterEmail },
      update: {
        name: process.env.MASTER_ADMIN_NAME || 'Master Admin',
        password: passwordHash,
        role: 'master_admin' as any,
        registrationStatus: 'completed',
        onboardingStatus: 'approved_for_procurement',
        accountStatus: 'ACTIVE',
        accountTypeId: account.accountTypeId,
        companyId: null
      },
      create: {
        name: process.env.MASTER_ADMIN_NAME || 'Master Admin',
        email: masterEmail,
        userId: 'MASTER_ADMIN',
        password: passwordHash,
        role: 'master_admin' as any,
        registrationStatus: 'completed',
        onboardingStatus: 'approved_for_procurement',
        accountStatus: 'ACTIVE',
        accountTypeId: account.accountTypeId,
        companyId: null
      },
      select: { id: true }
    });
    const masterRole = roleRecords.get('MASTER_ADMIN');
    if (masterRole) {
      const existingAssignment = await (prisma as any).userRole.findFirst({
        where: { userId: masterUser.id, roleId: masterRole.id, companyId: null, organizationId: null },
        select: { id: true }
      });
      if (existingAssignment) {
        await (prisma as any).userRole.update({ where: { id: existingAssignment.id }, data: { isActive: true } });
      } else {
        await (prisma as any).userRole.create({ data: { userId: masterUser.id, roleId: masterRole.id, isActive: true } });
      }
    }
  }

  const rolePermissionRows: Array<{ roleId: number; permissionId: number }> = [];
  for (const [roleCode, permissionCodes] of Object.entries(rolePermissionCodes)) {
    const role = roleRecords.get(roleCode);
    if (!role) continue;

    for (const permissionCode of permissionCodes) {
      const permission = permissionRecords.get(permissionCode);
      if (!permission) continue;
      rolePermissionRows.push({ roleId: role.id, permissionId: permission.id });
    }
  }
  await prisma.rolePermission.createMany({
    data: rolePermissionRows.map(row => ({ ...row, allowed: true })),
    skipDuplicates: true
  });

  const templateRoleRecords = new Map<string, { id: number }>();
  for (const template of DEFAULT_DYNAMIC_ROLE_TEMPLATES) {
    const role = await prisma.rbacRole.upsert({
      where: { code: template.code },
      update: {
        name: template.name,
        description: template.description,
        isSystemRole: true,
        isDefault: true,
        scope: 'PLATFORM',
        scopeType: 'PLATFORM',
        status: 'ACTIVE'
      },
      create: {
        code: template.code,
        name: template.name,
        description: template.description,
        isSystemRole: true,
        isDefault: true,
        scope: 'PLATFORM',
        scopeType: 'PLATFORM',
        status: 'ACTIVE'
      },
      select: { id: true }
    });
    templateRoleRecords.set(template.code, role);
    const rows = template.permissionCodes
      .map(permissionCode => permissionRecords.get(permissionCode))
      .filter(Boolean)
      .map(permission => ({ roleId: role.id, permissionId: permission!.id, allowed: true }));
    if (rows.length > 0) {
      await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
    }
  }

  const ensureRolePermissions = async (roleId: number, permissionCodes: readonly string[]) => {
    const rows = permissionCodes
      .map(permissionCode => permissionRecords.get(permissionCode))
      .filter(Boolean)
      .map(permission => ({ roleId, permissionId: permission!.id, allowed: true }));
    if (rows.length > 0) {
      await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
    }
  };

  const allPermissionCodes = RBAC_PERMISSION_CATALOG.map(([code]) => code);
  const orgAdminTemplate = DEFAULT_DYNAMIC_ROLE_TEMPLATES.find(template => template.code === 'ORGANIZATION_ADMINISTRATOR');
  const collectorTemplate = DEFAULT_DYNAMIC_ROLE_TEMPLATES.find(template => template.code === 'COLLECTOR_ADMINISTRATOR');

  const adminUsers = await prisma.user.findMany({
    where: { role: 'admin' as any, companyId: { not: null } },
    select: { id: true, companyId: true }
  });
  const districtIds = Array.from(new Set(adminUsers.map(user => user.companyId).filter(Boolean))) as number[];
  const districtRoleByCompany = new Map<number, { id: number }>();
  for (const companyId of districtIds) {
    const role = await prisma.rbacRole.upsert({
      where: { code: `DISTRICT_${companyId}_ADMINISTRATOR` },
      update: {
        name: 'Collector Administrator',
        description: 'Dynamic district administrator role.',
        scope: 'DISTRICT',
        scopeType: 'DISTRICT',
        scopeId: String(companyId),
        companyId,
        status: 'ACTIVE',
        isDefault: true,
        isSystemRole: true
      },
      create: {
        code: `DISTRICT_${companyId}_ADMINISTRATOR`,
        name: 'Collector Administrator',
        description: 'Dynamic district administrator role.',
        scope: 'DISTRICT',
        scopeType: 'DISTRICT',
        scopeId: String(companyId),
        companyId,
        status: 'ACTIVE',
        isDefault: true,
        isSystemRole: true
      },
      select: { id: true }
    });
    districtRoleByCompany.set(companyId, role);
    await ensureRolePermissions(role.id, collectorTemplate?.permissionCodes || allPermissionCodes);
  }
  for (const user of adminUsers) {
    if (!user.companyId) continue;
    const role = districtRoleByCompany.get(user.companyId);
    if (!role) continue;
    const existing = await (prisma as any).userRole.findFirst({
      where: { userId: user.id, roleId: role.id, scopeType: 'DISTRICT', scopeId: String(user.companyId) },
      select: { id: true }
    });
    const data = { userId: user.id, roleId: role.id, companyId: user.companyId, scopeType: 'DISTRICT', scopeId: String(user.companyId), isActive: true };
    if (existing) await (prisma as any).userRole.update({ where: { id: existing.id }, data });
    else await (prisma as any).userRole.create({ data });
  }

  const orgAdmins = await (prisma as any).orgMembership.findMany({
    where: { orgRole: 'ORG_ADMIN', isActive: true },
    select: { userId: true, organizationId: true }
  }).catch(() => []);
  const organizationIds = Array.from(new Set(orgAdmins.map((row: any) => row.organizationId).filter(Boolean))) as number[];
  const roleByOrganization = new Map<number, { id: number }>();
  for (const organizationId of organizationIds) {
    const role = await prisma.rbacRole.upsert({
      where: { code: `ORGANIZATION_${organizationId}_ADMINISTRATOR` },
      update: {
        name: 'Organization Administrator',
        description: 'Dynamic organization administrator role.',
        scope: 'ORGANIZATION',
        scopeType: 'ORGANIZATION',
        scopeId: String(organizationId),
        status: 'ACTIVE',
        isDefault: true,
        isSystemRole: true
      },
      create: {
        code: `ORGANIZATION_${organizationId}_ADMINISTRATOR`,
        name: 'Organization Administrator',
        description: 'Dynamic organization administrator role.',
        scope: 'ORGANIZATION',
        scopeType: 'ORGANIZATION',
        scopeId: String(organizationId),
        status: 'ACTIVE',
        isDefault: true,
        isSystemRole: true
      },
      select: { id: true }
    });
    roleByOrganization.set(organizationId, role);
    await ensureRolePermissions(role.id, orgAdminTemplate?.permissionCodes || allPermissionCodes);
  }
  for (const membership of orgAdmins) {
    const role = roleByOrganization.get(membership.organizationId);
    if (!role) continue;
    const existing = await (prisma as any).userRole.findFirst({
      where: { userId: membership.userId, roleId: role.id, scopeType: 'ORGANIZATION', scopeId: String(membership.organizationId) },
      select: { id: true }
    });
    const data = { userId: membership.userId, roleId: role.id, organizationId: membership.organizationId, scopeType: 'ORGANIZATION', scopeId: String(membership.organizationId), isActive: true };
    if (existing) await (prisma as any).userRole.update({ where: { id: existing.id }, data });
    else await (prisma as any).userRole.create({ data });
  }

  for (const [code, title, description, severity] of complianceRules) {
    await prisma.complianceRule.upsert({
      where: { code },
      update: { title, description, severity, isActive: true },
      create: { code, title, description, severity, isActive: true }
    });
  }

  for (const [code, name, module] of MASTER_FEATURES) {
    await prisma.feature.upsert({
      where: { code },
      update: { name, module, isSystem: true },
      create: { code, name, module, isSystem: true }
    });
  }

  const companies = await prisma.company.findMany({ select: { id: true } });
  const allFeatures = await prisma.feature.findMany({ select: { id: true } });
  if (companies.length > 0 && allFeatures.length > 0) {
    const companyFeatureData = [];
    for (const company of companies) {
      for (const feature of allFeatures) {
        companyFeatureData.push({
          companyId: company.id,
          featureId: feature.id,
          enabled: true
        });
      }
    }
    await prisma.companyFeature.createMany({
      data: companyFeatureData,
      skipDuplicates: true
    });
  }

  for (const category of marketplaceCategories) {
    await prisma.category.upsert({
      where: { slug: slugFor(category.name) },
      update: {
        name: category.name,
        type: category.type,
        displayOrder: category.displayOrder,
        isActive: true
      },
      create: {
        name: category.name,
        slug: slugFor(category.name),
        type: category.type,
        displayOrder: category.displayOrder,
        isActive: true
      }
    });
  }

  const newSlugs = marketplaceCategories.map(c => slugFor(c.name));
  await prisma.category.updateMany({
    where: { slug: { notIn: newSlugs } },
    data: { isActive: false }
  });

  const preservedPlatformUsers = await prisma.user.findMany({
    where: { role: { in: ['admin', 'master_admin'] as any } },
    select: { id: true, role: true }
  });

  for (const user of preservedPlatformUsers) {
    const account = legacyRoleToAccountType(user.role);
    await prisma.user.update({
      where: { id: user.id },
      data: { accountTypeId: account.accountTypeId }
    });
    const roleCode = String(user.role).toUpperCase();
    const role = roleRecords.get(roleCode);
    if (!role) continue;
    const existingAssignment = await (prisma as any).userRole.findFirst({
      where: { userId: user.id, roleId: role.id, companyId: null, organizationId: null },
      select: { id: true }
    });
    if (existingAssignment) {
      await (prisma as any).userRole.update({ where: { id: existingAssignment.id }, data: { isActive: true } });
    } else {
      await (prisma as any).userRole.create({ data: { userId: user.id, roleId: role.id, isActive: true } });
    }
  }

  const counts = await Promise.all([
    prisma.rbacRole.count(),
    prisma.permission.count(),
    prisma.rolePermission.count(),
    (prisma as any).userRole.count(),
    prisma.complianceRule.count(),
    prisma.feature.count(),
    prisma.category.count()
  ]);

  console.log(JSON.stringify({
    roles: counts[0],
    permissions: counts[1],
    rolePermissions: counts[2],
    userRoles: counts[3],
    complianceRules: counts[4],
    features: counts[5],
    categories: counts[6]
  }, null, 2));
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
