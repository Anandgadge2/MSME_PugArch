import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate, type AuthRequest } from '../../middleware/auth.js';
import { NegotiationService } from './negotiation.service.js';
import { handleSecureRouteError } from '../../utils/routeHelpers.js';

const router = Router();

const initiateNegotiationSchema = z.object({
  targetAmount: z.number().positive(),
  buyerJustification: z.string().trim().min(5).max(1000)
});

const respondNegotiationSchema = z.object({
  action: z.enum(['ACCEPT', 'COUNTER', 'REJECT']),
  counterAmount: z.number().positive().optional(),
  sellerRemarks: z.string().trim().max(1000).optional()
});

const decideCounterSchema = z.object({
  accept: z.boolean(),
  remarks: z.string().trim().max(1000).optional()
});

/**
 * GET /api/negotiations/purchase-orders/:poId
 */
router.get('/purchase-orders/:poId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const poId = parseInt(req.params.poId, 10);
    const actor = { id: req.user!.id, role: req.user!.role };
    const result = await NegotiationService.getByPurchaseOrder(poId, actor);
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleSecureRouteError(err, res, 'negotiation.getByPurchaseOrder');
  }
});

/**
 * POST /api/negotiations/purchase-orders/:poId/initiate
 */
router.post('/purchase-orders/:poId/initiate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const poId = parseInt(req.params.poId, 10);
    const body = initiateNegotiationSchema.parse(req.body);
    const actor = { id: req.user!.id, role: req.user!.role };
    const result = await NegotiationService.initiate(poId, actor, body);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return handleSecureRouteError(err, res, 'negotiation.initiate');
  }
});

/**
 * POST /api/negotiations/:id/respond
 */
router.post('/:id/respond', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const negId = parseInt(req.params.id, 10);
    const body = respondNegotiationSchema.parse(req.body);
    const actor = { id: req.user!.id, role: req.user!.role };
    const result = await NegotiationService.respond(negId, actor, body);
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleSecureRouteError(err, res, 'negotiation.respond');
  }
});

/**
 * POST /api/negotiations/:id/decide-counter
 */
router.post('/:id/decide-counter', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const negId = parseInt(req.params.id, 10);
    const body = decideCounterSchema.parse(req.body);
    const actor = { id: req.user!.id, role: req.user!.role };
    const result = await NegotiationService.decideCounter(negId, actor, body);
    return res.json({ success: true, data: result });
  } catch (err) {
    return handleSecureRouteError(err, res, 'negotiation.decideCounter');
  }
});

export default router;
