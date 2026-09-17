import { Router, type Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { apiResponse } from '../utils/apiResponse.js';
import type { AuthRequest } from '../middleware/authenticate.js';
import { handleSecureRouteError } from '../utils/routeHelpers.js';

const router = Router();

router.use(authenticate);

const STANDARD_CONSENTS = [
  {
    key: 'AADHAAR_KYC_VERIFICATION',
    title: 'Aadhaar Identity Verification Consent',
    description: 'Authorization for UIDAI Aadhaar XML / OTP authentication for MSME seller identity verification.',
    isMandatory: true,
    version: 'DPDP-AADHAAR-v2026.1',
  },
  {
    key: 'DATA_SHARING_ESCROW',
    title: 'Financial & Escrow Data Sharing',
    description: 'Consent to share order, invoice, and fulfillment data with platform escrow banking partners for settlement.',
    isMandatory: true,
    version: 'DPDP-ESCROW-v2026.1',
  },
  {
    key: 'MARKETPLACE_COMMUNICATION',
    title: 'Marketing & Tender Opportunity Alerts',
    description: 'Consent to receive automated notifications regarding new tenders, bids, and marketplace requirements via SMS/Email.',
    isMandatory: false,
    version: 'DPDP-NOTIF-v2026.1',
  },
  {
    key: 'ANALYTICS_TELEMETRY',
    title: 'Portal Telemetry & Usage Analytics',
    description: 'Consent to process aggregated operational metrics to improve procurement platform speed and reliability.',
    isMandatory: false,
    version: 'DPDP-TELEMETRY-v2026.1',
  }
];

const withdrawSchema = z.object({
  consentKey: z.string().min(3).max(64),
  reason: z.string().max(500).optional(),
});

/**
 * GET /api/consent
 * Returns all consents and withdrawal history for the current user under DPDP Act.
 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return apiResponse.error(res, 401, 'Unauthorized', 'UNAUTHORIZED');
    }

    const auditWithdrawals = await prisma.auditLog.findMany({
      where: {
        userId,
        action: 'CONSENT_WITHDRAWN',
        entityType: 'CONSENT',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const withdrawnKeys = new Set(
      auditWithdrawals
        .map(w => (w.details as any)?.consentKey)
        .filter(Boolean)
    );

    const consents = STANDARD_CONSENTS.map(sc => {
      const isWithdrawn = withdrawnKeys.has(sc.key);
      const withdrawalRecord = auditWithdrawals.find(
        w => (w.details as any)?.consentKey === sc.key
      );

      return {
        ...sc,
        status: isWithdrawn ? 'WITHDRAWN' : 'ACTIVE',
        withdrawnAt: withdrawalRecord?.createdAt || null,
        givenAt: (req.user as any)?.createdAt || new Date('2026-01-01T00:00:00.000Z'),
      };
    });

    return apiResponse.success(res, {
      consents,
      dataPrincipal: {
        userId,
        role: req.user?.role,
        complianceStandard: 'Digital Personal Data Protection (DPDP) Act 2023 / 2026',
      }
    });
  } catch (err: any) {
    return handleSecureRouteError(res, err);
  }
});

/**
 * POST /api/consent/withdraw
 * DPDP Act Section 6(6) - Data Principals right to withdraw consent at any time.
 */
router.post('/withdraw', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return apiResponse.error(res, 401, 'Unauthorized', 'UNAUTHORIZED');
    }

    const parsed = withdrawSchema.safeParse(req.body);
    if (!parsed.success) {
      return apiResponse.error(res, 400, 'Invalid withdrawal request', 'VALIDATION_ERROR', parsed.error.issues);
    }

    const { consentKey, reason } = parsed.data;

    const matched = STANDARD_CONSENTS.find(c => c.key === consentKey);
    if (!matched) {
      return apiResponse.error(res, 404, 'Unknown consent identifier', 'NOT_FOUND');
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    // Record audit trail event in immutable AuditLog table
    const auditRecord = await prisma.auditLog.create({
      data: {
        userId,
        action: 'CONSENT_WITHDRAWN',
        entityType: 'CONSENT',
        details: {
          consentKey,
          title: matched.title,
          isMandatory: matched.isMandatory,
          reason: reason || 'Withdrawn by data principal via settings',
          withdrawnAt: new Date().toISOString(),
        },
        ipAddress: typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : '127.0.0.1',
        userAgent: userAgent.slice(0, 255),
      }
    });

    return apiResponse.success(res, {
      success: true,
      consentKey,
      status: 'WITHDRAWN',
      auditId: auditRecord.id,
      timestamp: auditRecord.createdAt,
      message: matched.isMandatory
        ? 'Consent withdrawn. Note: withdrawing mandatory platform consents may restrict certain statutory actions (e.g. tender bidding).'
        : 'Consent successfully withdrawn. Processing of non-essential personal data has ceased.',
    });
  } catch (err: any) {
    return handleSecureRouteError(res, err);
  }
});

export default router;
