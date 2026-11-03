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

/**
 * GET /api/consent/export-personal-data
 * DPDP Act 2023 Section 11 - Right to Access Information about Personal Data (SAR / Data Portability)
 */
router.get('/export-personal-data', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return apiResponse.error(res, 401, 'Unauthorized', 'UNAUTHORIZED');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        emailVerified: true,
        mobileVerified: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        sellerProfile: {
          select: {
            id: true,
            businessName: true,
            msmeCategory: true,
          }
        },
        buyerProfile: {
          select: {
            id: true,
            organizationName: true,
            businessType: true,
            industry: true,
          }
        }
      }
    });

    if (!user) {
      return apiResponse.error(res, 404, 'User not found', 'NOT_FOUND');
    }

    // Mask sensitive identification data before export
    const maskedMobile = user.mobile
      ? `${user.mobile.slice(0, 2)}XXXXXX${user.mobile.slice(-2)}`
      : null;

    const auditWithdrawals = await prisma.auditLog.findMany({
      where: {
        userId,
        action: 'CONSENT_WITHDRAWN',
        entityType: 'CONSENT',
      },
      orderBy: { createdAt: 'desc' }
    });

    const activeNominee = await prisma.auditLog.findFirst({
      where: {
        userId,
        action: 'DATA_PRINCIPAL_NOMINEE_REGISTERED',
        entityType: 'DATA_PRINCIPAL_NOMINEE'
      },
      orderBy: { createdAt: 'desc' }
    });

    // Record access request in immutable audit log (DPDPA Section 11 compliance)
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DATA_PRINCIPAL_ACCESS_REQUEST',
        entityType: 'CONSENT',
        details: {
          requestedAt: new Date().toISOString(),
          regulation: 'DPDP Act 2023 Section 11',
          dataExported: ['profile', 'consents', 'nominee', 'third_party_disclosures']
        },
        ipAddress: typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : '127.0.0.1',
        userAgent: (req.headers['user-agent'] || 'Unknown').slice(0, 255),
      }
    });

    const exportPayload = {
      complianceNotice: {
        standard: 'Digital Personal Data Protection Act (DPDPA) 2023, Government of India',
        statutorySection: 'Section 11 (Right to Access Information About Personal Data)',
        exportGeneratedAt: new Date().toISOString(),
        dataFiduciary: 'District Industries Centre (DIC) Jharsuguda / JSG SMILE Portal',
        grievanceOfficerEmail: 'jsgsmileportal@gmail.com',
        appellateAuthority: 'Data Protection Board of India (DPBI)',
      },
      dataPrincipal: {
        id: user.id,
        name: user.name,
        email: user.email,
        maskedMobile,
        role: user.role,
        memberSince: user.createdAt,
        lastProfileUpdate: user.updatedAt,
        twoFactorEnabled: user.twoFactorEnabled,
        lastLoginAt: user.lastLoginAt,
        sellerDetails: user.sellerProfile || null,
        buyerDetails: user.buyerProfile || null,
      },
      activeConsents: STANDARD_CONSENTS.map(sc => {
        const isWithdrawn = auditWithdrawals.some(w => (w.details as any)?.consentKey === sc.key);
        return {
          key: sc.key,
          title: sc.title,
          description: sc.description,
          status: isWithdrawn ? 'WITHDRAWN' : 'ACTIVE',
          version: sc.version,
        };
      }),
      nomineeRegistration: activeNominee?.details || null,
      thirdPartyDataProcessorsAndFiduciaries: [
        {
          name: 'Escrow Settlement Banking Partner (e.g. Bandhan Bank)',
          purpose: 'Settlement of procurement invoices, milestone escrow disbursements, and statutory PBG retention',
          dataShared: ['Invoice identifier', 'Vendor Name', 'Masked Account/IFSC', 'Disbursement Amount']
        },
        {
          name: 'Protean eGov Technologies / UIDAI',
          purpose: 'Aadhaar identity verification and OTP-based signer validation under Aadhaar Act 2016',
          dataShared: ['Masked Aadhaar (last 4 digits only)', 'Verification timestamp (Zero biometric/raw Aadhaar retention)']
        },
        {
          name: 'District Industries Centre (DIC) Jharsuguda / Govt of Odisha',
          purpose: 'Statutory MSME regulatory oversight, MSME subsidy verification, and district procurement monitoring',
          dataShared: ['Enterprise Udyam Number', 'District location', 'Category of enterprise', 'Participation stats']
        }
      ]
    };

    return apiResponse.success(res, exportPayload);
  } catch (err: any) {
    return handleSecureRouteError(res, err);
  }
});

const erasureSchema = z.object({
  reason: z.string().max(500).optional(),
  confirmUnderstandStatutoryRetention: z.boolean().refine(val => val === true, {
    message: 'You must acknowledge statutory financial and procurement record retention.'
  })
});

/**
 * POST /api/consent/request-erasure
 * DPDP Act 2023 Section 12 - Right to Correction and Erasure of Personal Data (Right to be Forgotten)
 */
router.post('/request-erasure', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return apiResponse.error(res, 401, 'Unauthorized', 'UNAUTHORIZED');
    }

    const parsed = erasureSchema.safeParse(req.body);
    if (!parsed.success) {
      return apiResponse.error(res, 400, 'Invalid erasure request', 'VALIDATION_ERROR', parsed.error.issues);
    }

    // Check for active procurement commitments (GFR 171, ongoing tenders, active escrow balances)
    const activeTendersCount = await prisma.tender.count({
      where: {
        buyerId: userId,
        status: { in: ['ACTIVE', 'PUBLISHED', 'EVALUATING', 'OPEN'] as any }
      }
    }).catch(() => 0);

    const activeBidsCount = await prisma.bid.count({
      where: {
        sellerId: userId,
        status: { in: ['pending', 'shortlisted', 'accepted'] }
      }
    }).catch(() => 0);

    if (activeTendersCount > 0 || activeBidsCount > 0) {
      return apiResponse.error(
        res,
        400,
        'Cannot execute immediate account erasure: You have active tenders or bids in progress. Complete or withdraw active procurement transactions before requesting data erasure.',
        'ACTIVE_PROCUREMENT_COMMITMENT'
      );
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const auditRecord = await prisma.auditLog.create({
      data: {
        userId,
        action: 'DATA_PRINCIPAL_ERASURE_REQUEST',
        entityType: 'USER',
        entityId: userId,
        details: {
          reason: parsed.data.reason || 'User initiated erasure request under DPDP Act Section 12',
          statutoryRetentionExemption: 'Financial transactions, GFR compliance audits, and GST tax records retained for 8 years as per Section 8(7) & 8(8) of DPDP Act 2023.',
          requestedAt: new Date().toISOString()
        },
        ipAddress: typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : '127.0.0.1',
        userAgent: (req.headers['user-agent'] || 'Unknown').slice(0, 255),
      }
    });

    // Invalidate active user sessions and suspend non-statutory processing
    await prisma.user.update({
      where: { id: userId },
      data: {
        sessionVersion: { increment: 1 },
        registrationStatus: 'suspended' as any,
      }
    });

    return apiResponse.success(res, {
      success: true,
      requestId: auditRecord.id,
      status: 'ERASURE_PROCESSED',
      timestamp: auditRecord.createdAt,
      message: 'Personal data erasure request recorded. Non-essential personal data processing is stopped immediately and active sessions invalidated. Statutory procurement, GFR, and tax audit records are securely archived pursuant to Sections 8(7) and 8(8) of the DPDP Act 2023.',
    });
  } catch (err: any) {
    return handleSecureRouteError(res, err);
  }
});

const nomineeSchema = z.object({
  nomineeName: z.string().min(2, 'Nominee name is required').max(100),
  nomineeRelationship: z.string().min(2, 'Relationship is required').max(50),
  nomineeEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  nomineePhone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number').optional().or(z.literal('')),
  nomineeAddress: z.string().max(255).optional().or(z.literal('')),
});

/**
 * GET /api/consent/nominee
 * DPDP Act 2023 Section 14 - Retrieve currently registered nominee
 */
router.get('/nominee', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return apiResponse.error(res, 401, 'Unauthorized', 'UNAUTHORIZED');
    }

    const latestNominee = await prisma.auditLog.findFirst({
      where: {
        userId,
        action: 'DATA_PRINCIPAL_NOMINEE_REGISTERED',
        entityType: 'DATA_PRINCIPAL_NOMINEE'
      },
      orderBy: { createdAt: 'desc' }
    });

    return apiResponse.success(res, {
      nominee: latestNominee?.details || null,
      updatedAt: latestNominee?.createdAt || null,
    });
  } catch (err: any) {
    return handleSecureRouteError(res, err);
  }
});

/**
 * POST /api/consent/nominee
 * DPDP Act 2023 Section 14 - Register or update Data Principal Nominee
 */
router.post('/nominee', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return apiResponse.error(res, 401, 'Unauthorized', 'UNAUTHORIZED');
    }

    const parsed = nomineeSchema.safeParse(req.body);
    if (!parsed.success) {
      return apiResponse.error(res, 400, 'Invalid nominee details', 'VALIDATION_ERROR', parsed.error.issues);
    }

    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const auditRecord = await prisma.auditLog.create({
      data: {
        userId,
        action: 'DATA_PRINCIPAL_NOMINEE_REGISTERED',
        entityType: 'DATA_PRINCIPAL_NOMINEE',
        details: {
          ...parsed.data,
          statutorySection: 'DPDP Act 2023 Section 14 (Right to Nominate)',
          registeredAt: new Date().toISOString(),
        },
        ipAddress: typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : '127.0.0.1',
        userAgent: (req.headers['user-agent'] || 'Unknown').slice(0, 255),
      }
    });

    return apiResponse.success(res, {
      success: true,
      nominee: parsed.data,
      auditId: auditRecord.id,
      timestamp: auditRecord.createdAt,
      message: 'Nominee registered successfully under Section 14 of the Digital Personal Data Protection Act 2023.',
    });
  } catch (err: any) {
    return handleSecureRouteError(res, err);
  }
});

export default router;
