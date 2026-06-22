import { Router, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { ApiError } from '../../utils/ApiError.js';
import { apiResponse } from '../../utils/apiResponse.js';
import type { AuthRequest } from '../../middleware/authenticate.js';
import { confirmProcurementMethod } from '../procurementMode/procurement-mode.service.js';
import {
  convertCartToBidDraft,
  finalizeDirectPurchaseFromCheckout,
  getProcurementRequestForOrg,
  saveProcurementCheckoutDraft,
  submitProcurementRequestForApproval,
} from './procurement-checkout.service.js';

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

const checkoutInitSchema = z.object({
  cartId: z.number().int().positive(),
  selectedMethod: z.string().min(1),
  justification: z.string().optional(),
  l1ComparisonId: z.number().int().positive().optional(),
  pacJustification: z.record(z.string(), z.unknown()).optional(),
  demandSplittingConfirmation: z.boolean().optional(),
  buyerDetails: z.record(z.string(), z.unknown()).optional(),
  consigneeDetails: z.record(z.string(), z.unknown()).optional(),
  deliveryDetails: z.record(z.string(), z.unknown()).optional(),
  budgetSanction: z.record(z.string(), z.unknown()).optional(),
  paymentAuthority: z.record(z.string(), z.unknown()).optional(),
  priceReasonability: z.record(z.string(), z.unknown()).optional(),
  termsDocuments: z.record(z.string(), z.unknown()).optional(),
  declarations: z.record(z.string(), z.unknown()).optional(),
});

router.post(
  '/procurement-checkout/init',
  asyncRoute(async (req, res) => {
    const orgId = ensureOrg(req);
    const body = checkoutInitSchema.parse(req.body);
    const confirmed = await confirmProcurementMethod({
      cartId: body.cartId,
      organizationId: orgId,
      buyerId: req.user!.id,
      selectedMethod: body.selectedMethod,
      justification: body.justification,
      l1ComparisonId: body.l1ComparisonId,
      pacJustification: body.pacJustification,
      demandSplittingConfirmation: body.demandSplittingConfirmation,
    });

    const updated = await saveProcurementCheckoutDraft(confirmed.procurementRequestId, orgId, req.user!.id, {
      buyerDetails: body.buyerDetails,
      consigneeDetails: body.consigneeDetails,
      deliveryDetails: body.deliveryDetails,
      budgetSanction: body.budgetSanction,
      paymentAuthority: body.paymentAuthority,
      priceReasonability: body.priceReasonability,
      termsDocuments: body.termsDocuments,
      declarations: body.declarations,
      selectedMethod: body.selectedMethod,
    });

    return res.status(201).json({ success: true, data: { ...confirmed, request: updated } });
  })
);

router.get(
  '/procurement-checkout/:id',
  asyncRoute(async (req, res) => {
    const orgId = ensureOrg(req);
    const id = parseInt(req.params.id, 10);
    const request = await getProcurementRequestForOrg(id, orgId, req.user!.id);
    return res.json({ success: true, data: request });
  })
);

router.put(
  '/procurement-checkout/:id',
  asyncRoute(async (req, res) => {
    const orgId = ensureOrg(req);
    const id = parseInt(req.params.id, 10);
    const patch = z.object({
      buyerDetails: z.record(z.string(), z.unknown()).optional(),
      consigneeDetails: z.record(z.string(), z.unknown()).optional(),
      deliveryDetails: z.record(z.string(), z.unknown()).optional(),
      budgetSanction: z.record(z.string(), z.unknown()).optional(),
      paymentAuthority: z.record(z.string(), z.unknown()).optional(),
      priceReasonability: z.record(z.string(), z.unknown()).optional(),
      termsDocuments: z.record(z.string(), z.unknown()).optional(),
      declarations: z.record(z.string(), z.unknown()).optional(),
      selectedMethod: z.string().optional(),
    }).parse(req.body);

    const updated = await saveProcurementCheckoutDraft(id, orgId, req.user!.id, patch);
    return res.json({ success: true, data: updated });
  })
);

router.post(
  '/procurement-checkout/:id/submit',
  asyncRoute(async (req, res) => {
    const orgId = ensureOrg(req);
    const id = parseInt(req.params.id, 10);
    const updated = await submitProcurementRequestForApproval(id, orgId, req.user!.id);
    return res.json({ success: true, data: updated });
  })
);

router.post(
  '/procurement-checkout/:id/finalize-direct-purchase',
  asyncRoute(async (req, res) => {
    const orgId = ensureOrg(req);
    const id = parseInt(req.params.id, 10);
    const result = await finalizeDirectPurchaseFromCheckout(id, orgId, req.user!.id);
    return res.status(201).json({ success: true, data: result });
  })
);

router.post(
  '/procurement-checkout/:id/convert-to-bid',
  asyncRoute(async (req, res) => {
    const orgId = ensureOrg(req);
    const id = parseInt(req.params.id, 10);
    const result = await convertCartToBidDraft(id, orgId, req.user!.id);
    return res.json({ success: true, data: result });
  })
);

export default router;
