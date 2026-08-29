import { Router } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/authenticate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { apiResponse } from '../utils/apiResponse.js';
import { auditLog } from '../modules/audit/audit.service.js';
import { ACCOUNT_TYPE_IDS, DEFAULT_DYNAMIC_ROLE_TEMPLATES, RBAC_PERMISSION_CATALOG } from '../constants/dynamic-rbac.js';
import { assertCanAssignRole, assertCanManageRole, ensureAssignablePermissions, getActivePermissionCodes, isMasterAdmin, userHasPermission, type RbacScope } from '../services/rbac.service.js';
import { hashPassword } from '../services/password.service.js';
import { generateAlphanumericUserId } from '../utils/userId.js';
import { sendTeamInvitationCredentialsEmail } from '../services/mail.service.js';
import { toLocalIndianMobile } from '../services/sms.service.js';

const router = Router();
router.use(authenticate);

const roleScopeSchema = z.enum(['PLATFORM', 'DISTRICT', 'ORGANIZATION']);
const roleStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
const idParamSchema = z.object({ id: z.coerce.number().int().positive() });
const userIdParamSchema = z.object({ userId: z.coerce.number().int().positive() });

const roleBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  scopeType: roleScopeSchema,
  scopeId: z.union([z.string(), z.number()]).optional().nullable(),
  status: roleStatusSchema.optional().default('ACTIVE'),
  permissionCodes: z.array(z.string().trim().min(1)).optional(),
  permissionIds: z.array(z.coerce.number().int().positive()).optional(),
  isDefault: z.boolean().optional()
});

const permissionUpdateSchema = z.object({
  permissionCodes: z.array(z.string().trim().min(1)).optional(),
  permissionIds: z.array(z.coerce.number().int().positive()).optional()
});

const assignmentBodySchema = z.object({
  roleId: z.coerce.number().int().positive(),
  scopeType: roleScopeSchema,
  scopeId: z.union([z.string(), z.number()]).optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable()
});

const assignmentStatusSchema = z.object({
  isActive: z.boolean()
});

const inviteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  mobile: z.string().trim().max(20).optional(),
  roleIds: z.array(z.coerce.number().int().positive()).min(1).max(10)
});

const scopeIdForWrite = (scopeType: string, scopeId: string | number | null | undefined, req: any) => {
  if (scopeType === 'PLATFORM') return null;
  if (scopeType === 'DISTRICT') {
    return scopeId == null
      ? (req.user?.activeScope?.scopeType === 'DISTRICT' ? req.user.activeScope.scopeId : req.user?.districtId || null)
      : String(scopeId);
  }
  return scopeId == null ? (req.user?.organizationId ? String(req.user.organizationId) : null) : String(scopeId);
};

const assertCanManageScope = async (req: any, scope: RbacScope) => {
  return assertCanManageRole(req.user, String(scope.scopeType), scope.scopeId);
};

const assertHasAnyPermission = async (req: any, permissionCodes: string[]) => {
  if (isMasterAdmin(req.user)) return;
  const allowed = await Promise.all(permissionCodes.map(code => userHasPermission(req.user, code, req.user.activeScope)));
  if (!allowed.some(Boolean)) {
    const error = new Error(`Missing permission: ${permissionCodes.join(' or ')}`);
    (error as any).statusCode = 403;
    (error as any).code = 'PERMISSION_DENIED';
    throw error;
  }
};

const assertCanInviteScope = async (req: any, scope: RbacScope) => {
  const user = req.user;
  if (isMasterAdmin(user)) {
    const error = new Error('Master Admin is platform-owned and cannot create organization sub-logins.');
    (error as any).statusCode = 403;
    (error as any).code = 'MASTER_ADMIN_SUB_LOGIN_DENIED';
    throw error;
  }
  const scopeType = String(scope.scopeType);
  const scopeId = scope.scopeId == null ? null : String(scope.scopeId);
  if (scopeType === 'PLATFORM') {
    const error = new Error('Only Master Admin can invite platform users.');
    (error as any).statusCode = 403;
    (error as any).code = 'PLATFORM_SCOPE_DENIED';
    throw error;
  }

  if (scopeType === 'ORGANIZATION' && (!scopeId || !user.organizationId || scopeId !== String(user.organizationId))) {
    const error = new Error('Cannot invite users outside your organization scope.');
    (error as any).statusCode = 403;
    (error as any).code = 'CROSS_SCOPE_DENIED';
    throw error;
  }
  if (scopeType === 'DISTRICT') {
    const actorDistrict = user.activeScope?.scopeType === 'DISTRICT'
      ? user.activeScope.scopeId
      : user.districtId;
    if (!scopeId || !actorDistrict || String(scopeId) !== String(actorDistrict)) {
      const error = new Error('Cannot invite users outside your district scope.');
      (error as any).statusCode = 403;
      (error as any).code = 'CROSS_SCOPE_DENIED';
      throw error;
    }
  }
  if (!(await userHasPermission(user, 'team.member.invite', scope))) {
    const error = new Error('Missing permission: team.member.invite');
    (error as any).statusCode = 403;
    (error as any).code = 'PERMISSION_DENIED';
    throw error;
  }
};

const roleWhereForUser = (req: any) => {
  if (isMasterAdmin(req.user)) return {};
  if (req.user?.role === 'admin' || req.user?.accountType === 'SUPERADMIN') {
    const districtId = req.user?.activeScope?.scopeType === 'DISTRICT'
      ? req.user.activeScope.scopeId
      : req.user?.districtId;
    return districtId ? { scopeType: 'DISTRICT', scopeId: String(districtId) } : { id: -1 };
  }
  if (req.user?.organizationId) {
    return { scopeType: 'ORGANIZATION', scopeId: String(req.user.organizationId) };
  }
  return { id: -1 };
};

const actorScope = (req: any): RbacScope => {
  const user = req.user;
  if (user?.organizationId) {
    return { scopeType: 'ORGANIZATION', scopeId: String(user.organizationId) };
  }
  const districtId = user?.activeScope?.scopeType === 'DISTRICT'
    ? user.activeScope.scopeId
    : user?.districtId;
  return { scopeType: 'DISTRICT', scopeId: districtId ? String(districtId) : null };
};

const assertTargetUserInScope = async (req: any, targetUserId: number, scope: RbacScope) => {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      organizationId: true,
      roles: {
        where: {
          isActive: true,
          scopeType: scope.scopeType,
          scopeId: scope.scopeId == null ? null : String(scope.scopeId)
        },
        select: { id: true },
        take: 1
      }
    }
  });
  if (!target) {
    const error = new Error('User not found.');
    (error as any).statusCode = 404;
    (error as any).code = 'USER_NOT_FOUND';
    throw error;
  }
  if (isMasterAdmin(req.user)) return target;

  const inOrganization = scope.scopeType === 'ORGANIZATION'
    && scope.scopeId != null
    && String(target.organizationId || '') === String(scope.scopeId);
  const inDistrict = scope.scopeType === 'DISTRICT'
    && scope.scopeId != null
    && target.roles.length > 0;
  if (!inOrganization && !inDistrict) {
    const error = new Error('Cannot manage a user outside your workspace.');
    (error as any).statusCode = 403;
    (error as any).code = 'CROSS_SCOPE_DENIED';
    throw error;
  }
  return target;
};

const generateTemporaryPassword = () => `${randomBytes(10).toString('base64url')}Aa1!`;

const getPermissionIds = async (body: { permissionIds?: number[]; permissionCodes?: string[] }) => {
  if (body.permissionIds?.length) {
    const rows = await prisma.permission.findMany({ where: { id: { in: body.permissionIds } }, select: { id: true, code: true } });
    return { ids: rows.map(p => p.id), codes: rows.map(p => p.code) };
  }
  const codes = body.permissionCodes || [];
  const rows = await prisma.permission.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  return { ids: rows.map(p => p.id), codes: rows.map(p => p.code) };
};

const writeAudit = (req: any, action: string, entityType: string, entityId?: number, metadata?: Record<string, unknown>) =>
  auditLog({
    actorUserId: req.user?.id,
    actorRole: req.user?.role,
    action,
    entityType,
    entityId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    metadata
  });

router.get('/rbac/roles', asyncHandler(async (req, res) => {
  await assertHasAnyPermission(req, ['team.role.view', 'team.role.manage']);
  const roles = await (prisma as any).rbacRole.findMany({
    where: roleWhereForUser(req),
    include: { permissions: { where: { allowed: true }, include: { permission: true } }, _count: { select: { users: true } } },
    orderBy: [{ scopeType: 'asc' }, { name: 'asc' }]
  });
  return apiResponse.success(res, roles);
}));

router.post('/rbac/roles', asyncHandler(async (req, res) => {
  const body = roleBodySchema.parse(req.body);
  const scopeId = scopeIdForWrite(body.scopeType, body.scopeId, req);
  const scope = { scopeType: body.scopeType, scopeId };
  await assertCanManageScope(req, scope);

  const { ids, codes } = await getPermissionIds(body);
  await ensureAssignablePermissions((req as any).user, codes, scope);
  const role = await (prisma as any).rbacRole.create({
    data: {
      code: `${body.scopeType}_${scopeId || 'ROOT'}_${body.name}`.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 180),
      name: body.name,
      description: body.description || null,
      scopeType: body.scopeType,
      scope: body.scopeType,
      scopeId,
      status: body.status,
      isSystemRole: false,
      isDefault: body.isDefault || false,
      
      createdById: (req as any).user?.id,
      permissions: { create: ids.map(permissionId => ({ permissionId, allowed: true })) }
    },
    include: { permissions: { include: { permission: true } } }
  });
  await writeAudit(req, 'rbac.role.created', 'rbacRole', role.id, { scope });
  return apiResponse.created(res, role, 'Role created');
}));

router.get('/rbac/roles/:id', asyncHandler(async (req, res) => {
  await assertHasAnyPermission(req, ['team.role.view', 'team.role.manage']);
  const { id } = idParamSchema.parse(req.params);
  const role = await (prisma as any).rbacRole.findFirst({
    where: { id, ...roleWhereForUser(req) },
    include: { permissions: { include: { permission: true } }, users: { include: { user: { select: { id: true, name: true, email: true, role: true, accountType: true } } } } }
  });
  if (!role) return apiResponse.error(res, 404, 'Role not found', 'ROLE_NOT_FOUND');
  return apiResponse.success(res, role);
}));

router.put('/rbac/roles/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = roleBodySchema.partial().parse(req.body);
  const role = await (prisma as any).rbacRole.findUnique({ where: { id }, include: { permissions: { include: { permission: true } } } });
  if (!role) return apiResponse.error(res, 404, 'Role not found', 'ROLE_NOT_FOUND');
  const scope = { scopeType: body.scopeType || role.scopeType, scopeId: scopeIdForWrite(body.scopeType || role.scopeType, body.scopeId ?? role.scopeId, req) };
  await assertCanManageScope(req, scope);
  if (body.permissionCodes || body.permissionIds) {
    const { ids, codes } = await getPermissionIds(body);
    await ensureAssignablePermissions((req as any).user, codes, scope);
    await (prisma as any).rolePermission.deleteMany({ where: { roleId: id } });
    if (ids.length) await (prisma as any).rolePermission.createMany({ data: ids.map(permissionId => ({ roleId: id, permissionId, allowed: true })) });
  }
  const updated = await (prisma as any).rbacRole.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description || null } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...(body.scopeType ? { scopeType: body.scopeType, scope: body.scopeType } : {}),
      ...(scope.scopeId !== role.scopeId ? { scopeId: scope.scopeId } : {})
    },
    include: { permissions: { include: { permission: true } } }
  });
  await writeAudit(req, 'rbac.role.updated', 'rbacRole', id, { scope, permissionsChanged: Boolean(body.permissionCodes || body.permissionIds) });
  return apiResponse.success(res, updated);
}));

router.delete('/rbac/roles/:id', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const role = await (prisma as any).rbacRole.findUnique({ where: { id } });
  if (!role) return apiResponse.error(res, 404, 'Role not found', 'ROLE_NOT_FOUND');
  await assertCanManageScope(req, { scopeType: role.scopeType, scopeId: role.scopeId });
  const updated = await (prisma as any).rbacRole.update({ where: { id }, data: { status: 'ARCHIVED' } });
  await writeAudit(req, 'rbac.role.archived', 'rbacRole', id);
  return apiResponse.success(res, updated);
}));

router.patch('/rbac/roles/:id/archive', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const role = await (prisma as any).rbacRole.findUnique({ where: { id } });
  if (!role) return apiResponse.error(res, 404, 'Role not found', 'ROLE_NOT_FOUND');
  await assertCanManageScope(req, { scopeType: role.scopeType, scopeId: role.scopeId });
  const updated = await (prisma as any).rbacRole.update({ where: { id }, data: { status: 'ARCHIVED' } });
  await writeAudit(req, 'rbac.role.archived', 'rbacRole', id);
  return apiResponse.success(res, updated);
}));

router.get('/rbac/roles/:id/permissions', asyncHandler(async (req, res) => {
  await assertHasAnyPermission(req, ['team.role.view', 'team.role.manage']);
  const { id } = idParamSchema.parse(req.params);
  const role = await (prisma as any).rbacRole.findFirst({ where: { id, ...roleWhereForUser(req) }, include: { permissions: { include: { permission: true } } } });
  if (!role) return apiResponse.error(res, 404, 'Role not found', 'ROLE_NOT_FOUND');
  return apiResponse.success(res, role.permissions);
}));

router.post('/rbac/roles/:id/permissions', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const body = permissionUpdateSchema.parse(req.body);
  const role = await (prisma as any).rbacRole.findUnique({ where: { id } });
  if (!role) return apiResponse.error(res, 404, 'Role not found', 'ROLE_NOT_FOUND');
  const scope = { scopeType: role.scopeType, scopeId: role.scopeId };
  await assertCanManageScope(req, scope);
  const { ids, codes } = await getPermissionIds(body);
  await ensureAssignablePermissions((req as any).user, codes, scope);
  await (prisma as any).rolePermission.deleteMany({ where: { roleId: id } });
  if (ids.length) await (prisma as any).rolePermission.createMany({ data: ids.map(permissionId => ({ roleId: id, permissionId, allowed: true })) });
  const updated = await (prisma as any).rbacRole.findUnique({ where: { id }, include: { permissions: { include: { permission: true } } } });
  await writeAudit(req, 'rbac.role.permissions_updated', 'rbacRole', id, { count: ids.length });
  return apiResponse.success(res, updated);
}));

router.get('/rbac/permissions', asyncHandler(async (req, res) => {
  await assertHasAnyPermission(req, ['team.role.manage']);
  const user = (req as any).user;
  const allowedCodes = isMasterAdmin(user) ? null : await getActivePermissionCodes(user.id, user.activeScope);
  const permissions = await prisma.permission.findMany({
    where: allowedCodes?.includes('*') ? {} : { code: { in: allowedCodes || [] } },
    orderBy: [{ module: 'asc' }, { code: 'asc' }]
  });
  return apiResponse.success(res, permissions);
}));

router.get('/rbac/permissions/grouped', asyncHandler(async (req, res) => {
  await assertHasAnyPermission(req, ['team.role.manage']);
  const user = (req as any).user;
  const allowedCodes = isMasterAdmin(user) ? null : await getActivePermissionCodes(user.id, user.activeScope);
  const permissions = await prisma.permission.findMany({
    where: allowedCodes?.includes('*') ? {} : { code: { in: allowedCodes || [] } },
    orderBy: [{ module: 'asc' }, { code: 'asc' }]
  });
  const grouped = permissions.reduce((acc: Record<string, typeof permissions>, permission) => {
    const module = permission.module || 'Other';
    acc[module] = acc[module] || [];
    acc[module].push(permission);
    return acc;
  }, {});
  return apiResponse.success(res, grouped);
}));

router.get('/rbac/users/:userId/roles', asyncHandler(async (req, res) => {
  const { userId } = userIdParamSchema.parse(req.params);
  await assertHasAnyPermission(req, ['team.member.view', 'team.role.assign', 'team.role.manage']);
  const scope = actorScope(req);
  await assertTargetUserInScope(req, userId, scope);
  const assignments = await (prisma as any).userRole.findMany({
    where: isMasterAdmin((req as any).user)
      ? { userId }
      : { userId, scopeType: scope.scopeType, scopeId: scope.scopeId == null ? null : String(scope.scopeId) },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
    orderBy: { assignedAt: 'desc' }
  });
  return apiResponse.success(res, assignments);
}));

router.post('/rbac/users/:userId/roles', asyncHandler(async (req, res) => {
  const { userId } = userIdParamSchema.parse(req.params);
  const body = assignmentBodySchema.parse(req.body);
  const scope = { scopeType: body.scopeType, scopeId: scopeIdForWrite(body.scopeType, body.scopeId, req) };
  await assertTargetUserInScope(req, userId, scope);
  await assertCanAssignRole((req as any).user, userId, body.roleId, body.scopeType, scope.scopeId);
  const assignmentData = {
      userId,
      roleId: body.roleId,
      scopeType: body.scopeType,
      scopeId: scope.scopeId,
      
      organizationId: body.scopeType === 'ORGANIZATION' && scope.scopeId ? Number(scope.scopeId) : null,
      assignedById: (req as any).user?.id,
      expiresAt: body.expiresAt || null,
      isActive: true
    };
  const existing = await (prisma as any).userRole.findFirst({
    where: { userId, roleId: body.roleId, scopeType: body.scopeType, scopeId: scope.scopeId }
  });
  const assignment = existing
    ? await (prisma as any).userRole.update({ where: { id: existing.id }, data: assignmentData, include: { role: true } })
    : await (prisma as any).userRole.create({ data: assignmentData, include: { role: true } });
  await writeAudit(req, 'rbac.user_role.assigned', 'userRole', assignment.id, { userId, roleId: body.roleId, scope });
  return apiResponse.created(res, assignment, 'Role assigned');
}));

router.delete('/rbac/users/:userId/roles/:assignmentId', asyncHandler(async (req, res) => {
  const { userId } = userIdParamSchema.parse(req.params);
  const assignmentId = z.coerce.number().int().positive().parse(req.params.assignmentId);
  if (userId === (req as any).user?.id && !isMasterAdmin((req as any).user)) {
    return apiResponse.error(res, 403, 'You cannot change your own role assignments.', 'SELF_ESCALATION_DENIED');
  }
  const assignment = await (prisma as any).userRole.findUnique({ where: { id: assignmentId } });
  if (!assignment || assignment.userId !== userId) return apiResponse.error(res, 404, 'Assignment not found', 'ASSIGNMENT_NOT_FOUND');
  await assertTargetUserInScope(req, userId, { scopeType: assignment.scopeType, scopeId: assignment.scopeId });
  await assertCanManageScope(req, { scopeType: assignment.scopeType, scopeId: assignment.scopeId });
  await (prisma as any).userRole.delete({ where: { id: assignmentId } });
  await writeAudit(req, 'rbac.user_role.removed', 'userRole', assignmentId, { userId });
  return apiResponse.success(res, { id: assignmentId });
}));

router.patch('/rbac/users/:userId/roles/:assignmentId/status', asyncHandler(async (req, res) => {
  const { userId } = userIdParamSchema.parse(req.params);
  const assignmentId = z.coerce.number().int().positive().parse(req.params.assignmentId);
  const body = assignmentStatusSchema.parse(req.body);
  if (userId === (req as any).user?.id && !isMasterAdmin((req as any).user)) {
    return apiResponse.error(res, 403, 'You cannot change your own role assignments.', 'SELF_ESCALATION_DENIED');
  }
  const assignment = await (prisma as any).userRole.findUnique({ where: { id: assignmentId } });
  if (!assignment || assignment.userId !== userId) return apiResponse.error(res, 404, 'Assignment not found', 'ASSIGNMENT_NOT_FOUND');
  await assertTargetUserInScope(req, userId, { scopeType: assignment.scopeType, scopeId: assignment.scopeId });
  await assertCanManageScope(req, { scopeType: assignment.scopeType, scopeId: assignment.scopeId });
  const updated = await (prisma as any).userRole.update({ where: { id: assignmentId }, data: { isActive: body.isActive } });
  await writeAudit(req, 'rbac.user_role.status_updated', 'userRole', assignmentId, { userId, isActive: body.isActive });
  return apiResponse.success(res, updated);
}));

router.get('/auth/me/permissions', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const permissions = isMasterAdmin(user) ? ['*'] : await getActivePermissionCodes(user.id, user.activeScope);
  return apiResponse.success(res, { permissions, activeScope: user.activeScope, accountType: user.accountType, accountTypeId: user.accountTypeId });
}));

router.get('/team/members', asyncHandler(async (req, res) => {
  await assertHasAnyPermission(req, ['team.member.view']);
  const user = (req as any).user;
  const districtId = user.activeScope?.scopeType === 'DISTRICT' ? user.activeScope.scopeId : user.districtId;
  const where = isMasterAdmin(user)
    ? {}
    : user.organizationId
      ? { organizationId: user.organizationId }
      : districtId
        ? { roles: { some: { scopeType: 'DISTRICT', scopeId: String(districtId), isActive: true } } }
        : { id: -1 };
  const members = await (prisma as any).user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      role: true,
      accountType: true,
      accountTypeId: true,
      accountStatus: true,
      organizationId: true,
      mustChangePassword: true,
      requiresMobileVerification: true,
      mobileVerified: true,
      roles: {
        where: user.organizationId
          ? { scopeType: 'ORGANIZATION', scopeId: String(user.organizationId) }
          : districtId
            ? { scopeType: 'DISTRICT', scopeId: String(districtId) }
            : undefined,
        include: { role: true }
      },
      orgMemberships: user.organizationId
        ? { where: { organizationId: user.organizationId }, select: { orgRole: true, invitedById: true, acceptedAt: true, isActive: true } }
        : false
    },
    orderBy: { name: 'asc' },
    take: 500
  });
  return apiResponse.success(res, members.map((member: any) => ({
    ...member,
    accountType: member.accountType?.code || null
  })));
}));

router.get('/team/invitations', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  if (isMasterAdmin(user)) return apiResponse.success(res, []);
  const scope = user.organizationId
    ? { scopeType: 'ORGANIZATION', scopeId: String(user.organizationId) }
    : { scopeType: 'DISTRICT', scopeId: String(user.activeScope?.scopeId || user.districtId || '') };
  await assertHasAnyPermission(req, ['team.member.view', 'team.member.invite']);
  const invitations = await (prisma as any).scopedInvitation.findMany({
    where: { scopeType: scope.scopeType, scopeId: scope.scopeId },
    select: {
      id: true,
      email: true,
      name: true,
      mobile: true,
      roleIds: true,
      status: true,
      expiresAt: true,
      acceptedAt: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' },
    take: 200
  });
  return apiResponse.success(res, invitations);
}));

router.post('/team/invite', asyncHandler(async (req, res) => {
  const body = inviteSchema.parse(req.body);
  const user = (req as any).user;
  const scope = user.organizationId
    ? { scopeType: 'ORGANIZATION' as const, scopeId: String(user.organizationId) }
    : {
        scopeType: 'DISTRICT' as const,
        scopeId: String(user.activeScope?.scopeId || user.districtId || '')
      };
  await assertCanInviteScope(req, scope);
  await assertCanManageScope(req, scope);

  const email = body.email.toLowerCase();
  const mobile = body.mobile ? toLocalIndianMobile(body.mobile) : null;
  if (body.mobile && !mobile) {
    return apiResponse.error(res, 400, 'Enter a valid Indian mobile number.', 'INVALID_MOBILE');
  }
  const duplicate = await prisma.user.findFirst({
    where: { OR: [{ email }, ...(mobile ? [{ mobile }] : [])] },
    select: { id: true, email: true, mobile: true }
  });
  if (duplicate) {
    return apiResponse.error(
      res,
      409,
      duplicate.email === email ? 'A user with this email already exists.' : 'This mobile number is already in use.',
      duplicate.email === email ? 'EMAIL_EXISTS' : 'MOBILE_EXISTS'
    );
  }
  const pendingInvite = await (prisma as any).scopedInvitation.findFirst({
    where: { email, scopeType: scope.scopeType, scopeId: scope.scopeId, status: { in: ['PENDING', 'SENT'] } },
    select: { id: true }
  });
  if (pendingInvite) {
    return apiResponse.error(res, 409, 'An active invitation already exists for this email.', 'INVITE_EXISTS');
  }

  const selectedRoles = await (prisma as any).rbacRole.findMany({
    where: { id: { in: body.roleIds }, scopeType: scope.scopeType, scopeId: scope.scopeId, status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      permissions: {
        where: { allowed: true },
        select: { permission: { select: { code: true } } }
      }
    }
  });
  if (selectedRoles.length !== body.roleIds.length) {
    return apiResponse.error(res, 400, 'One or more selected roles are unavailable in this workspace.', 'INVALID_ROLE_SELECTION');
  }
  const selectedPermissionCodes = Array.from(new Set<string>(selectedRoles.flatMap(
    (role: any) => role.permissions.map((row: any) => String(row.permission.code))
  )));
  await ensureAssignablePermissions(user, selectedPermissionCodes, scope);
  if (!selectedPermissionCodes.includes('dashboard.view')) {
    return apiResponse.error(res, 400, 'At least one selected role must include dashboard.view.', 'DASHBOARD_PERMISSION_REQUIRED');
  }

  const token = randomBytes(32).toString('hex');
  const temporaryPassword = generateTemporaryPassword();
  const password = await hashPassword(temporaryPassword);
  const generatedUserId = await generateAlphanumericUserId();
  const accountTypeId = user.organizationId
    ? (user.accountTypeId || ACCOUNT_TYPE_IDS[user.accountType as keyof typeof ACCOUNT_TYPE_IDS] || ACCOUNT_TYPE_IDS.BUYER)
    : ACCOUNT_TYPE_IDS.SUPERADMIN;
  const portalRole = user.organizationId
    ? (['buyer', 'seller', 'shg'].includes(user.role) ? user.role : 'buyer')
    : 'admin';
  const inviter = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, organization: { select: { organizationName: true } } }
  });
  const workspaceName = inviter?.organization?.organizationName || (scope.scopeType === 'DISTRICT' ? `District workspace ${scope.scopeId}` : 'JSG SMILE workspace');

  const created = await prisma.$transaction(async tx => {
    const invitation = await (tx as any).scopedInvitation.create({
      data: {
        name: body.name,
        email,
        mobile,
        accountTypeId,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        roleIds: body.roleIds,
        token,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        invitedById: user.id
      }
    });
    const subUser = await (tx as any).user.create({
      data: {
        name: body.name,
        email,
        mobile,
        password,
        userId: generatedUserId,
        role: portalRole,
        accountTypeId,
        organizationId: user.organizationId || null,
        emailVerified: true,
        mobileVerified: false,
        mustChangePassword: true,
        requiresMobileVerification: true,
        registrationStatus: 'completed',
        onboardingStatus: 'approved_for_procurement',
        accountStatus: 'ACTIVE'
      }
    });
    if (scope.scopeType === 'ORGANIZATION') {
      await (tx as any).orgMembership.create({
        data: {
          userId: subUser.id,
          organizationId: Number(scope.scopeId),
          orgRole: 'VIEWER',
          isActive: true,
          invitedById: user.id,
          invitedAt: new Date()
        }
      });
    }
    await (tx as any).userRole.createMany({
      data: body.roleIds.map(roleId => ({
        userId: subUser.id,
        roleId,
        organizationId: scope.scopeType === 'ORGANIZATION' ? Number(scope.scopeId) : null,
        assignedById: user.id,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
        isActive: true
      }))
    });
    return { invitation, subUser };
  });

  const emailSent = await sendTeamInvitationCredentialsEmail({
    email,
    name: body.name,
    temporaryPassword,
    roleNames: selectedRoles.map((role: any) => role.name),
    inviterName: inviter?.name || 'Your workspace administrator',
    workspaceName,
    organizationId: user.organizationId || null
  });
  if (!emailSent) {
    await prisma.$transaction([
      (prisma as any).user.delete({ where: { id: created.subUser.id } }),
      (prisma as any).scopedInvitation.delete({ where: { id: created.invitation.id } })
    ]).catch(() => undefined);
    return apiResponse.error(res, 502, 'The invitation email could not be delivered. No sub-login was created; check email settings and try again.', 'INVITE_EMAIL_FAILED');
  }

  const invitation = await (prisma as any).scopedInvitation.update({
    where: { id: created.invitation.id },
    data: { status: 'SENT' },
    select: { id: true, email: true, name: true, mobile: true, roleIds: true, status: true, expiresAt: true, createdAt: true }
  });
  await writeAudit(req, 'team.invite.credentials_sent', 'scopedInvitation', invitation.id, { email, roleIds: body.roleIds, scope, invitedUserId: created.subUser.id });
  return apiResponse.created(res, { invitation, userId: created.subUser.id, emailSent: true }, 'Invitation email sent and sub-login created');
}));

router.patch('/team/members/:id/disable', asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  if (id === (req as any).user?.id) return apiResponse.error(res, 403, 'You cannot disable your own account.', 'SELF_DISABLE_DENIED');
  const scope = actorScope(req);
  await assertHasAnyPermission(req, ['team.member.disable']);
  await assertTargetUserInScope(req, id, scope);
  if (scope.scopeType === 'ORGANIZATION' && scope.scopeId) {
    const primaryMembership = await prisma.orgMembership.findUnique({
      where: { userId_organizationId: { userId: id, organizationId: Number(scope.scopeId) } },
      select: { orgRole: true, invitedById: true }
    });
    if (primaryMembership?.orgRole === 'ORG_ADMIN' && !primaryMembership.invitedById) {
      return apiResponse.error(res, 403, 'The primary organization administrator cannot be disabled.', 'PRIMARY_ADMIN_PROTECTED');
    }
  }
  const updated = await prisma.user.update({ where: { id }, data: { accountStatus: 'BLOCKED' as any, sessionVersion: { increment: 1 } } });
  await writeAudit(req, 'team.member.disabled', 'user', id);
  return apiResponse.success(res, updated);
}));

router.patch('/team/members/:id/roles', asyncHandler(async (req, res) => {
  req.params.userId = req.params.id;
  return apiResponse.error(res, 400, 'Use POST /api/rbac/users/:userId/roles or assignment status endpoints for role changes.', 'USE_RBAC_ASSIGNMENT_API');
}));

router.get('/rbac/audit-logs', asyncHandler(async (req, res) => {
  if (!isMasterAdmin((req as any).user) && !(await userHasPermission((req as any).user, 'audit.view', (req as any).user.activeScope))) {
    return apiResponse.error(res, 403, 'Missing permission: audit.view', 'PERMISSION_DENIED');
  }
  const logs = await prisma.auditLog.findMany({
    where: { action: { startsWith: 'rbac.' } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { User: { select: { id: true, name: true, email: true } } }
  });
  return apiResponse.success(res, logs);
}));

router.post('/rbac/seed-defaults', asyncHandler(async (req, res) => {
  if (!isMasterAdmin((req as any).user)) return apiResponse.error(res, 403, 'Only Master Admin can seed RBAC defaults.', 'MASTER_ADMIN_REQUIRED');
  const permissionRecords = new Map<string, { id: number }>();
  for (const [code, module, action, resource, description] of RBAC_PERMISSION_CATALOG) {
    const row = await (prisma as any).permission.upsert({
      where: { code },
      update: { module, action, resource, description, isSystem: true },
      create: { code, module, action, resource, description, isSystem: true },
      select: { id: true, code: true }
    });
    permissionRecords.set(code, row);
  }
  for (const template of DEFAULT_DYNAMIC_ROLE_TEMPLATES) {
    const role = await (prisma as any).rbacRole.upsert({
      where: { code: template.code },
      update: { name: template.name, description: template.description, scopeType: 'PLATFORM', scope: 'PLATFORM', isDefault: true, isSystemRole: true, status: 'ACTIVE' },
      create: { code: template.code, name: template.name, description: template.description, scopeType: 'PLATFORM', scope: 'PLATFORM', isDefault: true, isSystemRole: true, status: 'ACTIVE' },
      select: { id: true }
    });
    const rows = template.permissionCodes
      .map(code => permissionRecords.get(code))
      .filter(Boolean)
      .map(permission => ({ roleId: role.id, permissionId: permission!.id, allowed: true }));
    if (rows.length) await (prisma as any).rolePermission.createMany({ data: rows, skipDuplicates: true });
  }
  return apiResponse.success(res, { permissions: permissionRecords.size, templates: DEFAULT_DYNAMIC_ROLE_TEMPLATES.length });
}));

export default router;
