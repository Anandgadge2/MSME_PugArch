import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { PbgService } from './pbg.service.js';
import { handleSecureRouteError } from '../../utils/routeHelpers.js';

const router = Router();

const submitPbgSchema = z.object({
  type: z.enum(['BANK_GUARANTEE', 'FDR_PLEDGE', 'RETENTION_DEDUCTION', 'INSURANCE_BOND']),
  amount: z.number().positive().optional(),
  percentage: z.number().min(0.5).max(10).optional(),
  bankName: z.string().trim().max(100).optional(),
  bgNumber: z.string().trim().max(100).optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  documentFileId: z.number().int().positive().optional()
});

const makerReviewSchema = z.object({
  approved: z.boolean(),
  remarks: z.string().trim().max(500).optional()
});

const checkerApproveSchema = z.object({
  approved: z.boolean(),
  remarks: z.string().trim().max(500).optional(),
  twoFactorVerified: z.boolean().default(true)
});

/**
 * GET /api/pbg/purchase-orders/:poId
 */
router.get('/purchase-orders/:poId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const poId = parseInt(req.params.poId, 10);
    const actor = { id: req.user!.id, role: req.user!.role };
    const result = await PbgService.getByPurchaseOrder(poId, actor);
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleSecureRouteError(err, res, 'pbg.getByPurchaseOrder');
  }
});

/**
 * POST /api/pbg/purchase-orders/:poId/submit
 */
router.post('/purchase-orders/:poId/submit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const poId = parseInt(req.params.poId, 10);
    const body = submitPbgSchema.parse(req.body);
    const actor = { id: req.user!.id, role: req.user!.role };
    const pbg = await PbgService.submitPbg(poId, actor, body);
    return res.status(201).json({ success: true, data: pbg });
  } catch (err) {
    return handleSecureRouteError(err, res, 'pbg.submit');
  }
});

/**
 * POST /api/pbg/:pbgId/maker-review
 */
router.post('/:pbgId/maker-review', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const pbgId = parseInt(req.params.pbgId, 10);
    const body = makerReviewSchema.parse(req.body);
    const actor = { id: req.user!.id, role: req.user!.role };
    const pbg = await PbgService.makerReview(pbgId, actor, body);
    return res.json({ success: true, data: pbg });
  } catch (err) {
    return handleSecureRouteError(err, res, 'pbg.makerReview');
  }
});

/**
 * POST /api/pbg/:pbgId/checker-approve
 */
router.post('/:pbgId/checker-approve', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const pbgId = parseInt(req.params.pbgId, 10);
    const body = checkerApproveSchema.parse(req.body);
    const actor = { id: req.user!.id, role: req.user!.role };
    const pbg = await PbgService.checkerApprove(pbgId, actor, body);
    return res.json({ success: true, data: pbg });
  } catch (err) {
    return handleSecureRouteError(err, res, 'pbg.checkerApprove');
  }
});

/**
 * POST /api/pbg/:pbgId/release
 */
router.post('/:pbgId/release', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const pbgId = parseInt(req.params.pbgId, 10);
    const remarks = typeof req.body.remarks === 'string' ? req.body.remarks : undefined;
    const actor = { id: req.user!.id, role: req.user!.role };
    const pbg = await PbgService.releasePbg(pbgId, actor, remarks);
    return res.json({ success: true, data: pbg });
  } catch (err) {
    return handleSecureRouteError(err, res, 'pbg.release');
  }
});

export default router;
