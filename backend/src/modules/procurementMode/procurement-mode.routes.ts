import { Router, type Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { ApiError } from '../../utils/ApiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import type { AuthRequest } from '../../middleware/authenticate.js';
import { auditLog } from '../audit/audit.service.js';
import {
  confirmProcurementMethod,
  evaluateCartProcurementMode,
  getProcurementModeSettings,
  toSettingsDto,
  upsertProcurementModeSettings,
} from './procurement-mode.service.js';
import { confirmMethodSchema, evaluateCartSchema, updateSettingsSchema } from './procurement-mode.validation.js';

const router = Router();
router.use(authenticate);

const asyncRoute = (handler: (req: AuthRequest, res: Response) => Promise<unknown>) =>
  async (req: AuthRequest, res: Response) => {
    try {
      await handler(req, res);
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string; code?: string };
      const status = e?.statusCode || 500;
      return apiResponse.error(res, status, status < 500 ? e.message || 'Request failed' : 'Unable to complete request', e?.code || 'REQUEST_FAILED');
    }
  };

const ensureOrg = (req: AuthRequest) => {
  if (!req.user?.organizationId) {
    throw new ApiError(400, 'Organisation membership required.', 'ORG_REQUIRED');
  }
  return req.user.organizationId;
};

router.post(
  '/procurement-mode/evaluate-cart',
  asyncRoute(async (req, res) => {
    const orgId = ensureOrg(req);
    const body = evaluateCartSchema.parse(req.body);
    const result = await evaluateCartProcurementMode({
      cartId: body.cartId,
      organizationId: orgId,
      buyerId: req.user!.id,
      selectedMethod: body.selectedMethod,
      proprietary: body.proprietary,
      buyerJustification: body.buyerJustification,
    });
    return res.json({ success: true, data: result });
  })
);

router.post(
  '/procurement-mode/confirm',
  asyncRoute(async (req, res) => {
    const orgId = ensureOrg(req);
    const body = confirmMethodSchema.parse(req.body);
    const result = await confirmProcurementMethod({
      cartId: body.cartId,
      organizationId: orgId,
      buyerId: req.user!.id,
      selectedMethod: body.selectedMethod,
      justification: body.justification,
      l1ComparisonId: body.l1ComparisonId,
      pacJustification: body.pacJustification,
      demandSplittingConfirmation: body.demandSplittingConfirmation,
    });
    await auditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'procurement.method.confirmed',
      entityType: 'procurement_request',
      entityId: result.procurementRequestId,
    });
    return res.status(201).json({ success: true, data: result });
  })
);

router.get(
  '/procurement-mode/settings',
  asyncRoute(async (req, res) => {
    const orgId = req.user?.organizationId ?? null;
    const settings = await getProcurementModeSettings(orgId);
    return res.json({ success: true, data: settings });
  })
);

router.put(
  '/procurement-mode/settings',
  asyncRoute(async (req, res) => {
    if (!['admin', 'master_admin'].includes(req.user!.role)) {
      throw new ApiError(403, 'Admin access required to update procurement settings.', 'FORBIDDEN');
    }
    const body = updateSettingsSchema.parse(req.body);
    const orgId = typeof req.body.organizationId === 'number' ? req.body.organizationId : null;
    const updated = await upsertProcurementModeSettings(orgId, body);
    await auditLog({
      actorUserId: req.user!.id,
      actorRole: req.user!.role,
      action: 'procurement.settings.updated',
      entityType: 'procurement_mode_setting',
      entityId: updated.id,
      metadata: body as Record<string, unknown>,
    });
    return res.json({ success: true, data: toSettingsDto(updated) });
  })
);

export default router;
