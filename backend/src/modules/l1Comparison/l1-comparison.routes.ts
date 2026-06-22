import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { ApiError } from '../../utils/ApiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import type { AuthRequest } from '../../middleware/authenticate.js';
import {
  buildL1ComparisonPdfPayload,
  createL1ComparisonFromCart,
  getL1Comparison,
  selectL1Seller,
} from './l1-comparison.service.js';

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
  if (!req.user?.organizationId) throw new ApiError(400, 'Organisation membership required.', 'ORG_REQUIRED');
  return req.user.organizationId;
};

router.post(
  '/l1-comparisons/from-cart',
  asyncRoute(async (req, res) => {
    const orgId = ensureOrg(req);
    const body = z.object({ cartId: z.number().int().positive() }).parse(req.body);
    const result = await createL1ComparisonFromCart({ cartId: body.cartId, organizationId: orgId, buyerId: req.user!.id });
    return res.status(201).json({ success: true, data: result });
  })
);

router.get(
  '/l1-comparisons/:id',
  asyncRoute(async (req, res) => {
    const orgId = ensureOrg(req);
    const id = parseInt(req.params.id, 10);
    const comparison = await getL1Comparison(id, orgId);
    return res.json({ success: true, data: comparison });
  })
);

router.post(
  '/l1-comparisons/:id/select',
  asyncRoute(async (req, res) => {
    const orgId = ensureOrg(req);
    const id = parseInt(req.params.id, 10);
    const body = z.object({
      selectedSellerId: z.number().int().positive(),
      nonL1Justification: z.string().max(2000).optional(),
    }).parse(req.body);
    const updated = await selectL1Seller({
      id,
      organizationId: orgId,
      buyerId: req.user!.id,
      selectedSellerId: body.selectedSellerId,
      nonL1Justification: body.nonL1Justification,
    });
    return res.json({ success: true, data: updated });
  })
);

router.get(
  '/l1-comparisons/:id/pdf',
  asyncRoute(async (req, res) => {
    const orgId = ensureOrg(req);
    const id = parseInt(req.params.id, 10);
    const payload = await buildL1ComparisonPdfPayload(id, orgId);
    return res.json({ success: true, data: payload });
  })
);

export default router;
