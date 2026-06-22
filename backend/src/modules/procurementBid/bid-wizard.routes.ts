import { Router, type Response } from 'express';
import { authenticate, authorize, type AuthRequest } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { apiResponse } from '../../utils/apiResponse.js';
import {
  createDraftSchema,
  submitDraftSchema,
  updateDraftSchema,
  validateStepRequestSchema
} from './bid-wizard.validation.js';
import * as service from './bid-wizard.service.js';

const router = Router();

const MAHARASHTRA_DISTRICTS = [
  'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad / Chhatrapati Sambhajinagar',
  'Beed', 'Bhandara', 'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli',
  'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kolhapur', 'Latur',
  'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar',
  'Nashik', 'Osmanabad / Dharashiv', 'Palghar', 'Parbhani', 'Pune',
  'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur',
  'Thane', 'Wardha', 'Washim', 'Yavatmal'
];

const FALLBACK_TALUKAS = ['Central', 'North', 'South', 'East', 'West', 'Urban', 'Rural', 'Other'];
const FALLBACK_VILLAGES = ['City / Ward', 'Village', 'Industrial Area', 'Project Site', 'Other'];

const filterOptions = (items: string[], query: unknown) => {
  const q = String(query || '').trim().toLowerCase();
  const filtered = q ? items.filter(item => item.toLowerCase().includes(q)) : items;
  return filtered.slice(0, 50).map(name => ({ label: name, value: name }));
};

const asyncRoute = (handler: (req: AuthRequest, res: Response) => Promise<unknown>) =>
  async (req: AuthRequest, res: Response) => {
    try {
      await handler(req, res);
    } catch (err: any) {
      return apiResponse.error(
        res,
        err?.statusCode || 500,
        err?.statusCode && err.statusCode < 500 ? err.message : 'Unable to complete bid wizard request',
        err?.code || 'REQUEST_FAILED',
        err?.details
      );
    }
  };

router.use(authenticate, authorize('buyer'));

router.get('/master-data/districts', asyncRoute(async (req, res) => {
  return apiResponse.success(res, filterOptions(MAHARASHTRA_DISTRICTS, req.query.q), 200, 'Districts fetched');
}));

router.get('/master-data/talukas', asyncRoute(async (req, res) => {
  return apiResponse.success(res, filterOptions(FALLBACK_TALUKAS, req.query.q), 200, 'Talukas fetched');
}));

router.get('/master-data/villages', asyncRoute(async (req, res) => {
  return apiResponse.success(res, filterOptions(FALLBACK_VILLAGES, req.query.q), 200, 'Villages fetched');
}));

router.post('/draft', validate({ body: createDraftSchema }), asyncRoute(async (req, res) => {
  const draft = await service.createDraft(req.user!.id, req.body.bidType, req.body.initialData || {});
  return apiResponse.created(res, draft, 'Bid wizard draft created');
}));

router.get('/draft/:id', asyncRoute(async (req, res) => {
  const draft = await service.getDraft(Number(req.params.id), req.user!.id);
  return apiResponse.success(res, draft, 200, 'Bid wizard draft fetched');
}));

router.put('/draft/:id', validate({ body: updateDraftSchema }), asyncRoute(async (req, res) => {
  const draft = await service.updateDraft(
    Number(req.params.id),
    req.user!.id,
    req.body.currentStep || req.body.step,
    req.body.formData || {},
    req.body.validationState,
    req.body.completedSteps
  );
  return apiResponse.success(res, draft, 200, 'Bid wizard draft saved');
}));

router.post('/validate-step', validate({ body: validateStepRequestSchema }), asyncRoute(async (req, res) => {
  const result = service.validateStep(req.body.step, req.body.formData || {}, req.body.bidType, req.body.packetType);
  return apiResponse.success(res, result, 200, result.valid ? 'Step is valid' : 'Step has validation errors');
}));

router.get('/preview/:id', asyncRoute(async (req, res) => {
  const preview = await service.compilePreview(Number(req.params.id), req.user!.id);
  return apiResponse.success(res, preview, 200, 'Bid wizard preview compiled');
}));

router.post('/submit', validate({ body: submitDraftSchema }), asyncRoute(async (req, res) => {
  const result = await service.submitBid(req, Number(req.body.draftId), req.body.submitForApproval !== false);
  return apiResponse.success(res, result, 200, 'Bid submitted from wizard');
}));

router.delete('/draft/:id', asyncRoute(async (req, res) => {
  const draft = await service.deleteDraft(Number(req.params.id), req.user!.id);
  return apiResponse.success(res, draft, 200, 'Bid wizard draft deleted');
}));

export default router;
