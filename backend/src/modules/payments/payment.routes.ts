import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireAccountType, requirePermission } from '../../middleware/auth.js';
import type { AuthRequest } from '../../middleware/auth.js';
import { maskSensitive } from '../../utils/maskSensitive.js';
import { ApiError } from '../../utils/ApiError.js';
import { idempotencyKeyFromRequest, withIdempotency } from '../../services/idempotency.service.js';
import {
  initiatePayment,
  processPaymentWebhook,
  reconcilePayment,
  markPaymentConfirmedFromGateway
} from './payment.service.js';
import { initiatePaymentSchema } from './payment.validation.js';
import prisma from '../../lib/prisma.js';
import { safeRouteMessage } from '../../utils/routeHelpers.js';
import { randomToken } from '../../utils/crypto.js';
import { auditLog } from '../audit/audit.service.js';
import { env } from '../../config/env.js';

const router = Router();

const orgScope = {
  scopeType: 'ORGANIZATION' as const,
  getScopeId: (req: AuthRequest) => req.user?.organizationId
};

const isPlatformFinanceUser = (req: AuthRequest) =>
  req.user?.role === 'admin' ||
  req.user?.role === 'master_admin' ||
  req.user?.accountTypeId === 0 ||
  req.user?.accountTypeId === 1 ||
  req.user?.accountType === 'MASTER_ADMIN' ||
  req.user?.accountType === 'SUPERADMIN';

const getListWindow = (query: Record<string, unknown>) => {
  const take = Math.min(100, Math.max(1, Number(query.take ?? query.pageSize ?? 50)));
  const skip = query.page ? (Math.max(1, Number(query.page)) - 1) * take : Math.max(0, Number(query.skip ?? 0));
  return { skip, take };
};

const actorFrom = (req: AuthRequest) => ({
  id: Number(req.user?.id),
  role: String(req.user?.role),
  ipAddress: req.ip,
  userAgent: req.headers['user-agent']
});

const offlineProofSchema = z.object({
  method: z.enum(['NEFT', 'RTGS', 'IMPS', 'UPI', 'CHEQUE', 'BANK_TRANSFER', 'DEMAND_DRAFT', 'OTHER']),
  transactionReference: z.string().trim().min(3, 'Transaction reference must be at least 3 characters').max(120),
  paymentDate: z.coerce.date(),
  amount: z.coerce.number().positive('Payment amount must be greater than zero'),
  payerBankName: z.string().trim().min(2, 'Bank name must be at least 2 characters').max(160),
  payerAccountLast4: z.string().trim().regex(/^\d{4}$/, 'Account last 4 digits must be exactly 4 digits').optional().or(z.literal('')),
  beneficiaryBankName: z.string().trim().max(160).optional().or(z.literal('')),
  receiptFileId: z.coerce.number().int().positive().optional(),
  receiptFileUrl: z.string().trim().max(1000).optional().refine(
    val => !val || val === '' || /^\//.test(val) || /^https?:\/\/.+/.test(val),
    { message: 'receiptFileUrl must be a valid absolute URL, relative path, or empty' }
  ),
  remarks: z.string().trim().max(1000).optional().or(z.literal(''))
}).refine(value => {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return value.paymentDate <= tomorrow;
}, {
  message: 'Payment date cannot be in the future',
  path: ['paymentDate']
}).refine(value => Boolean(value.receiptFileId || value.receiptFileUrl), {
  message: 'Receipt proof upload is required',
  path: ['receiptFileId']
});

const rejectProofSchema = z.object({ reason: z.string().trim().min(5).max(500) });

const auditPayment = (req: AuthRequest, action: string, entityType: string, entityId?: number, metadata?: Record<string, unknown>) =>
  auditLog({
    actorUserId: req.user?.id,
    actorRole: req.user?.role,
    action,
    entityType,
    entityId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    metadata: maskSensitive(metadata || {})
  });

const paymentReference = () => `PAY-${new Date().getFullYear()}-${randomToken(6).toUpperCase()}`;

const handleError = (res: any, err: any) => {
  if (err instanceof z.ZodError) {
    const firstIssue = err.issues?.[0] || (err as any).errors?.[0];
    return res.status(400).json({
      success: false,
      message: firstIssue?.message || 'Invalid payment proof details submitted',
      code: 'VALIDATION_ERROR',
      details: (err as any).issues || (err as any).errors
    });
  }
  if (err?.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: 'A payment proof with this transaction reference / UTR has already been submitted for your organization. Each payment transfer requires a unique bank reference.',
      code: 'DUPLICATE_PAYMENT_REFERENCE'
    });
  }
  const statusCode = err?.statusCode || (err instanceof ApiError ? err.statusCode : 500);
  return res.status(statusCode).json({
    success: false,
    message: statusCode < 500 ? err.message : safeRouteMessage(err, 'Payment operation failed'),
    code: err?.code || 'PAYMENT_OPERATION_FAILED'
  });
};

const enrichProofsWithFileMetadata = async (proofsList: any[]) => {
  if (!Array.isArray(proofsList) || proofsList.length === 0) return proofsList;
  const fileIds = proofsList
    .map(p => {
      if (p?.receiptFileId) return Number(p.receiptFileId);
      const match = String(p?.receiptFileUrl || '').match(/\/api\/(?:public\/)?files\/(\d+)/);
      return match ? Number(match[1]) : null;
    })
    .filter((id): id is number => typeof id === 'number' && Number.isFinite(id) && id > 0);

  if (fileIds.length === 0) return proofsList;

  const files = await prisma.fileAsset.findMany({
    where: { id: { in: fileIds } },
    select: { id: true, originalName: true, mimeType: true, size: true }
  }).catch(() => []);

  const fileMap = new Map<number, any>();
  files.forEach((f: any) => fileMap.set(f.id, f));
  return proofsList.map(p => {
    const fid = p?.receiptFileId || (() => {
      const match = String(p?.receiptFileUrl || '').match(/\/api\/(?:public\/)?files\/(\d+)/);
      return match ? Number(match[1]) : null;
    })();
    const fa = fid ? fileMap.get(fid) : null;
    return {
      ...p,
      receiptFileName: fa?.originalName || (p.receiptFileUrl && !p.receiptFileUrl.startsWith('/api/files/') ? p.receiptFileUrl.split('/').pop() : null),
      receiptFileMimeType: fa?.mimeType || null,
      receiptFileSize: fa?.size || null
    };
  });
};

const listPaymentsForActor = async (where: Record<string, unknown>, window: { skip: number; take: number }) => {
  try {
    const [payments, total] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where,
        select: {
          id: true,
          referenceId: true,
          invoiceId: true,
          purchaseOrderId: true,
          payerId: true,
          payeeId: true,
          amount: true,
          currency: true,
          status: true,
          gateway: true,
          method: true,
          metadata: true,
          createdAt: true,
          completedAt: true,
          invoice: { select: { id: true, invoiceNumber: true, status: true, taxableAmount: true, totalTaxAmount: true, tdsAmount: true } },
          purchaseOrder: { select: { id: true, poNumber: true, title: true, status: true } },
          payer: { select: { id: true, name: true, email: true, role: true } },
          payee: { select: { id: true, name: true, email: true, role: true } },
          escrowAccount: { select: { id: true, status: true, amount: true, fundedAt: true, releasedAt: true } },
          ledgerEntries: {
            orderBy: { createdAt: 'asc' },
            take: 20,
            select: { id: true, debitAccount: true, creditAccount: true, entryType: true, amount: true, createdAt: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: window.skip,
        take: window.take
      }),
      prisma.paymentTransaction.count({ where })
    ]);
    return {
      payments,
      total,
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Unknown field') && !message.includes('does not exist') && !message.includes('relation') && !message.includes('column')) {
      throw error;
    }

    const [payments, total] = await Promise.all([
      prisma.paymentTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: window.skip,
        take: window.take
      }),
      prisma.paymentTransaction.count({ where })
    ]);
    return {
      payments,
      total,
      warning: 'Payment records were loaded without newer ledger/escrow relation details. Run the latest Prisma migrations to enable the full finance view.'
    };
  }
};

const webhookHandler = async (req: any, res: any) => {
  try {
    const gateway = String(req.params.gateway || '');
    if (!['bandhan', 'bank_transfer'].includes(gateway)) {
      throw new ApiError(400, 'Unsupported payment gateway', 'PAYMENT_GATEWAY_INVALID');
    }
    const rawBody = Buffer.isBuffer((req as any).rawBody)
      ? (req as any).rawBody
      : Buffer.from(JSON.stringify(req.body || {}));
    const result = await processPaymentWebhook(gateway as any, rawBody, req.headers);
    if ((result as any)?.duplicate) {
      return res.status(409).json({ success: false, message: 'Webhook replay blocked', code: 'PAYMENT_WEBHOOK_REPLAY_BLOCKED' });
    }
    res.json({ success: true, ...maskSensitive(result) });
  } catch (err: any) {
    return handleError(res, err);
  }
};

router.post('/webhook/:gateway', webhookHandler);
router.post('/webhooks/:gateway', webhookHandler);

router.use(authenticate);

router.get('/', requirePermission('payment.view'), async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.user?.id);
    const role = String(req.user?.role);
    const where = isPlatformFinanceUser(req)
      ? {}
      : role === 'buyer'
        ? { payerId: userId }
        : { payeeId: userId };
    const query = req.query as Record<string, unknown>;
    if (query.status) {
      const statuses = String(query.status).toLowerCase().split(',');
      const expandedStatuses = [...statuses, ...statuses.map(s => s.toUpperCase())];
      if (statuses.includes('success')) {
        expandedStatuses.push(
          'completed', 'COMPLETED', 
          'escrow_released', 'ESCROW_RELEASED', 
          'offline_proof_verified', 'OFFLINE_PROOF_VERIFIED'
        );
      }
      (where as any).status = { in: expandedStatuses };
    }
    if (query.gateway) {
      const g = String(query.gateway);
      (where as any).AND = [
        ...((where as any).AND || []),
        { OR: [
          { gateway: { equals: g, mode: 'insensitive' } },
          { method: { equals: g, mode: 'insensitive' } }
        ]}
      ];
    }
    if (query.escrow) {
      if (query.escrow === 'funded') {
        (where as any).escrowAccount = { isNot: null };
      } else if (query.escrow === 'not_funded') {
        (where as any).escrowAccount = { is: null };
      }
    }
    if (query.q) {
      (where as any).AND = [
        ...((where as any).AND || []),
        { OR: [
          { referenceId: { contains: String(query.q), mode: 'insensitive' } },
          { invoice: { invoiceNumber: { contains: String(query.q), mode: 'insensitive' } } },
          { purchaseOrder: { poNumber: { contains: String(query.q), mode: 'insensitive' } } },
          { payer: { email: { contains: String(query.q), mode: 'insensitive' } } },
          { payee: { email: { contains: String(query.q), mode: 'insensitive' } } }
        ]}
      ];
    }

    const window = getListWindow(query);
    const result = await listPaymentsForActor(where, window);
    res.json({ success: true, payments: maskSensitive(result.payments), records: maskSensitive(result.payments), total: result.total, ...window, filters: query, warning: result.warning });
  } catch (err: any) {
    return handleError(res, err);
  }
});

router.post('/initiate', requirePermission('payment.initiate', orgScope), async (req: AuthRequest, res) => {
  try {
    const parsed = initiatePaymentSchema.parse(req.body);
    const key = parsed.idempotencyKey || idempotencyKeyFromRequest(req, `payment-initiate:${parsed.invoiceId}:${req.user?.id}`);
    const result = await withIdempotency({
      req,
      userId: Number(req.user?.id),
      route: 'POST /api/payments/initiate',
      key,
      handler: async () => {
        const payment = await initiatePayment(actorFrom(req), { ...parsed, idempotencyKey: key });
        return { success: true, ...maskSensitive(payment) };
      }
    });
    res.status(201).json(result);
  } catch (err: any) {
    return handleError(res, err);
  }
});

router.post('/offline-proof/:proofId/verify', async (req: AuthRequest, res) => {
  try {
    const proofId = Number(req.params.proofId);
    if (!Number.isInteger(proofId) || proofId <= 0) throw new ApiError(400, 'Invalid proof id', 'PAYMENT_PROOF_ID_INVALID');

    const existingProof = await (prisma as any).offlinePaymentProof.findUnique({
      where: { id: proofId },
      include: {
        paymentTransaction: true,
        purchaseOrder: true
      }
    });
    if (!existingProof) throw new ApiError(404, 'Offline payment proof not found', 'PAYMENT_PROOF_NOT_FOUND');

    const isPlatformAdmin = isPlatformFinanceUser(req);
    const isSellerPayee = (existingProof.sellerOrgId && (req.user as any)?.organizationId === existingProof.sellerOrgId) ||
      (existingProof.paymentTransaction && existingProof.paymentTransaction.payeeId === req.user?.id) ||
      (existingProof.purchaseOrder && existingProof.purchaseOrder.sellerId === req.user?.id);

    if (!isPlatformAdmin && !isSellerPayee && req.user?.role !== 'admin' && req.user?.role !== 'seller') {
      throw new ApiError(403, 'Permission denied to verify this payment proof', 'PERMISSION_DENIED');
    }

    const proof = await (prisma as any).offlinePaymentProof.update({
      where: { id: proofId },
      data: { status: 'VERIFIED', verifiedByUserId: req.user?.id, verifiedAt: new Date(), rejectionReason: null }
    });

    let paymentTransactionId = proof.paymentTransactionId || existingProof.paymentTransaction?.id;
    if (!paymentTransactionId && proof.purchaseOrderId) {
      const tx = await prisma.paymentTransaction.findFirst({
        where: { purchaseOrderId: proof.purchaseOrderId },
        orderBy: { createdAt: 'desc' }
      });
      if (tx) {
        paymentTransactionId = tx.id;
        await (prisma as any).offlinePaymentProof.update({
          where: { id: proof.id },
          data: { paymentTransactionId: tx.id }
        }).catch(() => undefined);
      }
    }
    if (!paymentTransactionId && proof.invoiceId) {
      const tx = await prisma.paymentTransaction.findFirst({
        where: { invoiceId: proof.invoiceId },
        orderBy: { createdAt: 'desc' }
      });
      if (tx) {
        paymentTransactionId = tx.id;
        await (prisma as any).offlinePaymentProof.update({
          where: { id: proof.id },
          data: { paymentTransactionId: tx.id }
        }).catch(() => undefined);
      }
    }

    let updatedTx: any = null;
    if (paymentTransactionId) {
      const existingTx = await prisma.paymentTransaction.findUnique({ where: { id: paymentTransactionId } });
      updatedTx = await prisma.paymentTransaction.update({
        where: { id: paymentTransactionId },
        data: {
          status: 'OFFLINE_PROOF_VERIFIED',
          paymentStatus: 'OFFLINE_PROOF_VERIFIED' as any,
          completedAt: new Date(),
          paidAt: proof.paymentDate || new Date(),
          version: { increment: 1 },
          metadata: {
            ...((existingTx?.metadata as any) || {}),
            offlineProofId: proof.id,
            method: proof.method
          }
        }
      }).catch(() => null);

      if (updatedTx?.invoiceId) {
        await prisma.invoice.update({
          where: { id: updatedTx.invoiceId },
          data: { status: 'paid', invoiceStatus: 'PAID' as any }
        }).catch(() => undefined);
      }
    }
    if (proof.purchaseOrderId) {
      await prisma.purchaseOrder.update({
        where: { id: proof.purchaseOrderId },
        data: { status: 'paid_offline_verified', version: { increment: 1 } }
      }).catch(() => undefined);
    }
    await auditPayment(req, 'payment.offline_proof_verified', 'offlinePaymentProof', proof.id, { purchaseOrderId: proof.purchaseOrderId, paymentTransactionId });
    res.json({ success: true, proof: maskSensitive(proof), payment: maskSensitive(updatedTx) });
  } catch (err: any) {
    return handleError(res, err);
  }
});

router.post('/offline-proof/:proofId/reject', async (req: AuthRequest, res) => {
  try {
    const proofId = Number(req.params.proofId);
    const parsed = rejectProofSchema.parse(req.body);
    if (!Number.isInteger(proofId) || proofId <= 0) throw new ApiError(400, 'Invalid proof id', 'PAYMENT_PROOF_ID_INVALID');

    const existingProof = await (prisma as any).offlinePaymentProof.findUnique({
      where: { id: proofId },
      include: {
        paymentTransaction: true,
        purchaseOrder: true
      }
    });
    if (!existingProof) throw new ApiError(404, 'Offline payment proof not found', 'PAYMENT_PROOF_NOT_FOUND');

    const isPlatformAdmin = isPlatformFinanceUser(req);
    const isSellerPayee = (existingProof.sellerOrgId && (req.user as any)?.organizationId === existingProof.sellerOrgId) ||
      (existingProof.paymentTransaction && existingProof.paymentTransaction.payeeId === req.user?.id) ||
      (existingProof.purchaseOrder && existingProof.purchaseOrder.sellerId === req.user?.id);

    if (!isPlatformAdmin && !isSellerPayee && req.user?.role !== 'admin' && req.user?.role !== 'seller') {
      throw new ApiError(403, 'Permission denied to reject this payment proof', 'PERMISSION_DENIED');
    }

    const proof = await (prisma as any).offlinePaymentProof.update({
      where: { id: proofId },
      data: { status: 'REJECTED', rejectedByUserId: req.user?.id, rejectedAt: new Date(), rejectionReason: parsed.reason }
    });

    let paymentTransactionId = proof.paymentTransactionId || existingProof.paymentTransaction?.id;
    if (!paymentTransactionId && proof.purchaseOrderId) {
      const tx = await prisma.paymentTransaction.findFirst({
        where: { purchaseOrderId: proof.purchaseOrderId },
        orderBy: { createdAt: 'desc' }
      });
      if (tx) {
        paymentTransactionId = tx.id;
        await (prisma as any).offlinePaymentProof.update({
          where: { id: proof.id },
          data: { paymentTransactionId: tx.id }
        }).catch(() => undefined);
      }
    }
    if (!paymentTransactionId && proof.invoiceId) {
      const tx = await prisma.paymentTransaction.findFirst({
        where: { invoiceId: proof.invoiceId },
        orderBy: { createdAt: 'desc' }
      });
      if (tx) {
        paymentTransactionId = tx.id;
        await (prisma as any).offlinePaymentProof.update({
          where: { id: proof.id },
          data: { paymentTransactionId: tx.id }
        }).catch(() => undefined);
      }
    }

    let updatedTx: any = null;
    if (paymentTransactionId) {
      const existingTx = await prisma.paymentTransaction.findUnique({ where: { id: paymentTransactionId } });
      updatedTx = await prisma.paymentTransaction.update({
        where: { id: paymentTransactionId },
        data: {
          status: 'OFFLINE_PROOF_REJECTED',
          paymentStatus: 'OFFLINE_PROOF_REJECTED' as any,
          version: { increment: 1 },
          metadata: {
            ...((existingTx?.metadata as any) || {}),
            rejectionReason: parsed.reason
          }
        }
      }).catch(() => null);

      if (updatedTx?.invoiceId) {
        await prisma.invoice.update({
          where: { id: updatedTx.invoiceId },
          data: { status: 'approved', invoiceStatus: 'APPROVED' as any }
        }).catch(() => undefined);
      }
    }
    await auditPayment(req, 'payment.offline_proof_rejected', 'offlinePaymentProof', proof.id, { reason: parsed.reason, paymentTransactionId });
    res.json({ success: true, proof: maskSensitive(proof), payment: maskSensitive(updatedTx) });
  } catch (err: any) {
    return handleError(res, err);
  }
});

router.post('/invoice/:invoiceId/offline-proof', requirePermission('payment.initiate', orgScope), async (req: AuthRequest, res) => {
  try {
    const invoiceId = Number(req.params.invoiceId);
    const parsed = offlineProofSchema.parse(req.body);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) throw new ApiError(400, 'Invalid invoice id', 'INVOICE_ID_INVALID');
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        buyer: { select: { id: true, organizationId: true } },
        seller: { select: { id: true, organizationId: true } },
        purchaseOrder: { select: { id: true, amount: true, buyerId: true, sellerId: true, metadata: true } }
      }
    });
    if (!invoice) throw new ApiError(404, 'Invoice not found', 'INVOICE_NOT_FOUND');

    const isBuyerUser = invoice.buyerId === req.user?.id || invoice.purchaseOrder?.buyerId === req.user?.id;
    const isBuyerOrg = Boolean(invoice.buyer?.organizationId && req.user?.organizationId && invoice.buyer.organizationId === req.user.organizationId);
    if (!isPlatformFinanceUser(req) && !isBuyerUser && !isBuyerOrg) {
      throw new ApiError(403, 'Access denied to this invoice', 'INVOICE_ACCESS_DENIED');
    }

    const payableAmount = Number(invoice.amount ?? 0);
    if (parsed.amount <= 0 || (payableAmount > 0 && parsed.amount > payableAmount + 0.05)) {
      throw new ApiError(400, 'Offline proof amount cannot exceed the payable invoice amount', 'PAYMENT_AMOUNT_MISMATCH');
    }

    const buyerOrgId = invoice.buyer?.organizationId || req.user?.organizationId || null;
    if (buyerOrgId) {
      const existingProof = await (prisma as any).offlinePaymentProof.findFirst({
        where: {
          buyerOrgId,
          transactionReference: parsed.transactionReference
        }
      });
      if (existingProof) {
        throw new ApiError(
          409,
          `Transaction reference '${parsed.transactionReference}' has already been submitted for your organization (linked to ${existingProof.purchaseOrderId ? `PO #${existingProof.purchaseOrderId}` : `Proof #${existingProof.id}`}). Each bank transfer requires a unique reference or UTR.`,
          'PAYMENT_REFERENCE_EXISTS'
        );
      }
    }

    const effectivePaymentMethod = (parsed.method === 'DEMAND_DRAFT' ? 'OTHER' : parsed.method) as any;

    const { payment, proof } = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.paymentTransaction.create({
        data: {
          referenceId: paymentReference(),
          invoiceId: invoice.id,
          purchaseOrderId: invoice.purchaseOrderId || undefined,
          payerId: invoice.buyerId,
          payeeId: invoice.sellerId,
          amount: parsed.amount,
          currency: invoice.currency || 'INR',
          gateway: 'offline',
          gatewayEnum: 'MANUAL' as any,
          method: parsed.method,
          methodEnum: effectivePaymentMethod,
          status: 'OFFLINE_PROOF_UPLOADED',
          paymentStatus: 'OFFLINE_PROOF_UPLOADED' as any,
          metadata: {
            source: 'offline_payment_proof',
            invoiceId: invoice.id,
            transactionReference: parsed.transactionReference,
            receiptFileUrl: parsed.receiptFileUrl,
            receiptFileId: parsed.receiptFileId
          }
        }
      });

      const newProof = await (tx as any).offlinePaymentProof.create({
        data: {
          paymentTransactionId: newPayment.id,
          purchaseOrderId: invoice.purchaseOrderId || null,
          buyerOrgId,
          sellerOrgId: invoice.seller?.organizationId || null,
          amount: parsed.amount,
          method: effectivePaymentMethod,
          transactionReference: parsed.transactionReference,
          paymentDate: parsed.paymentDate,
          payerBankName: parsed.payerBankName,
          payerAccountLast4: parsed.payerAccountLast4 || null,
          beneficiaryBankName: parsed.beneficiaryBankName || null,
          receiptFileId: parsed.receiptFileId || null,
          receiptFileUrl: parsed.receiptFileUrl || null,
          remarks: parsed.remarks || null,
          status: 'UNDER_REVIEW',
          uploadedByUserId: req.user?.id
        }
      });

      return { payment: newPayment, proof: newProof };
    });

    const effectiveFileId = parsed.receiptFileId || (() => {
      const match = String(parsed.receiptFileUrl || '').match(/\/api\/(?:public\/)?files\/(\d+)/);
      return match ? Number(match[1]) : null;
    })();
    if (effectiveFileId) {
      await prisma.fileAsset.updateMany({
        where: { id: effectiveFileId },
        data: { entityType: 'offline_payment_proof', entityId: proof.id }
      }).catch(() => undefined);
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: 'payment_initiated',
        invoiceStatus: 'PAYMENT_PENDING' as any,
        paymentReference: parsed.transactionReference,
        bankName: parsed.payerBankName,
        paymentDate: parsed.paymentDate,
        paymentSlipFileId: effectiveFileId || undefined
      }
    }).catch(() => undefined);

    await auditPayment(req, 'payment.offline_proof_uploaded', 'offlinePaymentProof', proof.id, { invoiceId: invoice.id, method: parsed.method });
    res.status(201).json({ success: true, proof: maskSensitive(proof), paymentId: payment.id });
  } catch (err: any) {
    return handleError(res, err);
  }
});

router.get('/invoice/:invoiceId/offline-proof', requirePermission('payment.view', orgScope), async (req: AuthRequest, res) => {
  try {
    const invoiceId = Number(req.params.invoiceId);
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) throw new ApiError(400, 'Invalid invoice id', 'INVOICE_ID_INVALID');
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        buyer: { select: { id: true, organizationId: true } },
        purchaseOrder: { select: { id: true, buyerId: true, sellerId: true } }
      }
    });
    if (!invoice) throw new ApiError(404, 'Invoice not found', 'INVOICE_NOT_FOUND');
    const allowed = isPlatformFinanceUser(req) ||
      invoice.buyerId === req.user?.id ||
      invoice.sellerId === req.user?.id ||
      invoice.purchaseOrder?.buyerId === req.user?.id ||
      invoice.purchaseOrder?.sellerId === req.user?.id ||
      (Boolean(invoice.buyer?.organizationId) && invoice.buyer?.organizationId === req.user?.organizationId);
    if (!allowed) throw new ApiError(403, 'Access denied', 'INVOICE_ACCESS_DENIED');

    const payment = await prisma.paymentTransaction.findFirst({
      where: { invoiceId },
      orderBy: { createdAt: 'desc' }
    });

    const proof = payment
      ? await (prisma as any).offlinePaymentProof.findFirst({
          where: { paymentTransactionId: payment.id },
          orderBy: { createdAt: 'desc' }
        })
      : null;

    const enriched = await enrichProofsWithFileMetadata(proof ? [proof] : []);
    res.json({ success: true, proof: maskSensitive(enriched[0] || null) });
  } catch (err: any) {
    return handleError(res, err);
  }
});

router.get('/offline-proofs', requirePermission('payment.view', orgScope), async (req: AuthRequest, res) => {
  try {
    const where: any = {};
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.buyerOrgId) where.buyerOrgId = Number(req.query.buyerOrgId);
    if (req.query.sellerOrgId) where.sellerOrgId = Number(req.query.sellerOrgId);
    if (req.query.paymentId) where.paymentTransactionId = Number(req.query.paymentId);
    if (req.query.orderId) where.purchaseOrderId = Number(req.query.orderId);
    if (req.query.dateFrom || req.query.dateTo) {
      where.paymentDate = {
        ...(req.query.dateFrom ? { gte: new Date(String(req.query.dateFrom)) } : {}),
        ...(req.query.dateTo ? { lte: new Date(String(req.query.dateTo)) } : {})
      };
    }
    const proofs = await (prisma as any).offlinePaymentProof.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, Math.max(1, Number(req.query.take || req.query.pageSize || 50)))
    });
    const enriched = await enrichProofsWithFileMetadata(proofs);
    res.json({ success: true, proofs: maskSensitive(enriched), records: maskSensitive(enriched) });
  } catch (err: any) {
    return handleError(res, err);
  }
});

router.post('/:orderId/pay-through-portal', requirePermission('payment.initiate', orgScope), async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) throw new ApiError(400, 'Invalid order id', 'ORDER_ID_INVALID');
    const po = await prisma.purchaseOrder.findUnique({ where: { id: orderId } });
    if (!po) throw new ApiError(404, 'Purchase order not found', 'PO_NOT_FOUND');
    if (!isPlatformFinanceUser(req) && po.buyerId !== req.user?.id) throw new ApiError(404, 'Purchase order not found', 'PO_NOT_FOUND');
    const payment = await prisma.paymentTransaction.upsert({
      where: { referenceId: String((po.metadata as any)?.paymentReference || `PO-${po.id}-PORTAL`) },
      update: {
        status: 'PORTAL_PAYMENT_INITIATED',
        paymentStatus: 'PORTAL_PAYMENT_INITIATED' as any,
        method: 'PORTAL',
        methodEnum: 'BANK_TRANSFER' as any,
        version: { increment: 1 }
      },
      create: {
        referenceId: String((po.metadata as any)?.paymentReference || `PO-${po.id}-PORTAL`),
        purchaseOrderId: po.id,
        payerId: po.buyerId,
        payeeId: po.sellerId,
        amount: po.amount,
        currency: po.currency,
        gateway: 'portal',
        gatewayEnum: 'MANUAL' as any,
        method: 'PORTAL',
        methodEnum: 'BANK_TRANSFER' as any,
        status: 'PORTAL_PAYMENT_INITIATED',
        paymentStatus: 'PORTAL_PAYMENT_INITIATED' as any,
        metadata: { source: 'pay_through_portal', purchaseOrderId: po.id }
      }
    });
    await auditPayment(req, 'payment.portal_initiated', 'paymentTransaction', payment.id, { purchaseOrderId: po.id });
    res.status(201).json({ success: true, payment: maskSensitive(payment), nextAction: 'CONTINUE_EXISTING_PORTAL_PAYMENT_FLOW' });
  } catch (err: any) {
    return handleError(res, err);
  }
});

router.post('/:orderId/offline-proof', requirePermission('payment.initiate', orgScope), async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.orderId);
    const parsed = offlineProofSchema.parse(req.body);
    if (!Number.isInteger(orderId) || orderId <= 0) throw new ApiError(400, 'Invalid order id', 'ORDER_ID_INVALID');
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { organizationId: true } },
        seller: { select: { organizationId: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 }
      }
    });
    if (!po) throw new ApiError(404, 'Purchase order not found', 'PO_NOT_FOUND');
    const isPoBuyerUser = po.buyerId === req.user?.id;
    const isPoBuyerOrg = Boolean(po.buyer?.organizationId && req.user?.organizationId && po.buyer.organizationId === req.user.organizationId);
    if (!isPlatformFinanceUser(req) && !isPoBuyerUser && !isPoBuyerOrg) {
      throw new ApiError(403, 'Access denied to this purchase order', 'PO_ACCESS_DENIED');
    }
    const payableAmount = Number(po.amount ?? po.totalValue ?? 0);
    if (parsed.amount <= 0 || (payableAmount > 0 && parsed.amount > payableAmount + 0.05)) {
      throw new ApiError(400, 'Offline proof amount cannot exceed the payable amount', 'PAYMENT_AMOUNT_MISMATCH');
    }
    const buyerOrgId = po.buyer?.organizationId || req.user?.organizationId || null;
    if (buyerOrgId) {
      const existingProof = await (prisma as any).offlinePaymentProof.findFirst({
        where: { buyerOrgId, transactionReference: parsed.transactionReference }
      });
      if (existingProof) {
        throw new ApiError(
          409,
          `Transaction reference '${parsed.transactionReference}' has already been submitted for your organization (linked to ${existingProof.purchaseOrderId ? `PO #${existingProof.purchaseOrderId}` : `Proof #${existingProof.id}`}). Each bank transfer requires a unique reference or UTR.`,
          'PAYMENT_REFERENCE_EXISTS'
        );
      }
    }

    const effectivePaymentMethod = (parsed.method === 'DEMAND_DRAFT' ? 'OTHER' : parsed.method) as any;

    const { payment, proof } = await prisma.$transaction(async (tx) => {
      const targetPayment = po.payments?.[0] || await tx.paymentTransaction.create({
        data: {
          referenceId: paymentReference(),
          purchaseOrderId: po.id,
          payerId: po.buyerId,
          payeeId: po.sellerId,
          amount: parsed.amount,
          currency: po.currency,
          gateway: 'offline',
          gatewayEnum: 'MANUAL' as any,
          method: parsed.method,
          methodEnum: effectivePaymentMethod,
          status: 'OFFLINE_PROOF_UPLOADED',
          paymentStatus: 'OFFLINE_PROOF_UPLOADED' as any,
          metadata: { source: 'offline_payment_proof' }
        }
      });
      if (po.payments?.[0]) {
        await tx.paymentTransaction.update({
          where: { id: targetPayment.id },
          data: {
            status: 'OFFLINE_PROOF_UPLOADED',
            paymentStatus: 'OFFLINE_PROOF_UPLOADED' as any,
            method: parsed.method,
            methodEnum: effectivePaymentMethod,
            version: { increment: 1 }
          }
        });
      }
      const newProof = await (tx as any).offlinePaymentProof.create({
        data: {
          paymentTransactionId: targetPayment.id,
          purchaseOrderId: po.id,
          buyerOrgId,
          sellerOrgId: po.seller?.organizationId || null,
          amount: parsed.amount,
          method: effectivePaymentMethod,
          transactionReference: parsed.transactionReference,
          paymentDate: parsed.paymentDate,
          payerBankName: parsed.payerBankName,
          payerAccountLast4: parsed.payerAccountLast4 || null,
          beneficiaryBankName: parsed.beneficiaryBankName || null,
          receiptFileId: parsed.receiptFileId || null,
          receiptFileUrl: parsed.receiptFileUrl || null,
          remarks: parsed.remarks || null,
          status: 'UNDER_REVIEW',
          uploadedByUserId: req.user?.id
        }
      });

      return { payment: targetPayment, proof: newProof };
    });
    const poEffectiveFileId = parsed.receiptFileId || (() => {
      const match = String(parsed.receiptFileUrl || '').match(/\/api\/(?:public\/)?files\/(\d+)/);
      return match ? Number(match[1]) : null;
    })();
    if (poEffectiveFileId) {
      await prisma.fileAsset.updateMany({
        where: { id: poEffectiveFileId },
        data: { entityType: 'offline_payment_proof', entityId: proof.id }
      }).catch(() => undefined);
    }

    await auditPayment(req, 'payment.offline_proof_uploaded', 'offlinePaymentProof', proof.id, { purchaseOrderId: po.id, method: parsed.method });
    res.status(201).json({ success: true, proof: maskSensitive(proof), paymentId: payment.id });
  } catch (err: any) {
    return handleError(res, err);
  }
});

router.get('/:orderId/offline-proof', requirePermission('payment.view', orgScope), async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) throw new ApiError(400, 'Invalid order id', 'ORDER_ID_INVALID');
    const po = await prisma.purchaseOrder.findUnique({ where: { id: orderId } });
    if (!po) throw new ApiError(404, 'Purchase order not found', 'PO_NOT_FOUND');
    const allowed = isPlatformFinanceUser(req) || po.buyerId === req.user?.id || po.sellerId === req.user?.id;
    if (!allowed) throw new ApiError(404, 'Purchase order not found', 'PO_NOT_FOUND');
    const proofs = await (prisma as any).offlinePaymentProof.findMany({ where: { purchaseOrderId: orderId }, orderBy: { createdAt: 'desc' } });
    const enriched = await enrichProofsWithFileMetadata(proofs);
    res.json({ success: true, proofs: maskSensitive(enriched), proof: maskSensitive(enriched[0] || null) });
  } catch (err: any) {
    return handleError(res, err);
  }
});

router.get('/:id/status', requirePermission('payment.view', orgScope), async (req: AuthRequest, res) => {
  try {
    const paymentId = Number(req.params.id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) throw new ApiError(400, 'Invalid payment id', 'PAYMENT_ID_INVALID');
    const payment = await prisma.paymentTransaction.findUnique({
      where: { id: paymentId },
      include: { escrowAccount: { include: { milestones: true, transactions: true } }, ledgerEntries: true }
    });
    if (!payment) throw new ApiError(404, 'Payment not found', 'PAYMENT_NOT_FOUND');
    if (!isPlatformFinanceUser(req) && payment.payerId !== req.user?.id && payment.payeeId !== req.user?.id) {
      throw new ApiError(404, 'Payment not found', 'PAYMENT_NOT_FOUND');
    }
    res.json({ success: true, payment: maskSensitive(payment) });
  } catch (err: any) {
    return handleError(res, err);
  }
});

router.get('/:id', requirePermission('payment.view', orgScope), async (req: AuthRequest, res) => {
  try {
    const paymentId = Number(req.params.id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) throw new ApiError(400, 'Invalid payment id', 'PAYMENT_ID_INVALID');
    const payment = await prisma.paymentTransaction.findUnique({
      where: { id: paymentId },
      include: { escrowAccount: { include: { milestones: true, transactions: true } }, ledgerEntries: { orderBy: { createdAt: 'asc' } } }
    });
    if (!payment) throw new ApiError(404, 'Payment not found', 'PAYMENT_NOT_FOUND');
    if (!isPlatformFinanceUser(req) && payment.payerId !== req.user?.id && payment.payeeId !== req.user?.id) {
      throw new ApiError(404, 'Payment not found', 'PAYMENT_NOT_FOUND');
    }
    res.json({ success: true, payment: maskSensitive(payment) });
  } catch (err: any) {
    return handleError(res, err);
  }
});

router.post('/:id/reconcile', requirePermission('payment.verify', orgScope), async (req: AuthRequest, res) => {
  try {
    const paymentId = Number(req.params.id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) throw new ApiError(400, 'Invalid payment id', 'PAYMENT_ID_INVALID');
    const status = String(req.body?.status || '').trim();
    if (!['success', 'failed', 'refunded', 'cancelled'].includes(status)) {
      throw new ApiError(400, 'Invalid reconciliation status', 'PAYMENT_RECONCILE_STATUS_INVALID');
    }
    const key = idempotencyKeyFromRequest(req, `payment-reconcile:${paymentId}:${status}:${req.user?.id}`);
    const result = await withIdempotency({
      req,
      userId: Number(req.user?.id),
      route: 'POST /api/payments/:id/reconcile',
      key,
      handler: async () => ({
        success: true,
        ...maskSensitive(await reconcilePayment(actorFrom(req), paymentId, {
          status: status as any,
          remarks: req.body?.remarks,
          reversalLedgerEntryId: req.body?.reversalLedgerEntryId ? Number(req.body.reversalLedgerEntryId) : undefined
        }))
      })
    });
    res.json(result);
  } catch (err: any) {
    return handleError(res, err);
  }
});

router.post('/:id/simulate-success', requirePermission('payment.initiate', orgScope), async (req: AuthRequest, res) => {
  try {
    if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
      throw new ApiError(404, 'Payment endpoint not found', 'PAYMENT_ENDPOINT_NOT_FOUND');
    }
    const paymentId = Number(req.params.id);
    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      throw new ApiError(400, 'Invalid payment id', 'PAYMENT_ID_INVALID');
    }
    const payment = await prisma.paymentTransaction.findUnique({
      where: { id: paymentId }
    });
    if (!payment) {
      throw new ApiError(404, 'Payment not found', 'PAYMENT_NOT_FOUND');
    }
    if (!isPlatformFinanceUser(req) && payment.payerId !== req.user?.id) {
      throw new ApiError(403, 'Forbidden to simulate payment success for others', 'PAYMENT_FORBIDDEN');
    }
    const result = await markPaymentConfirmedFromGateway(paymentId, {
      gatewayPaymentId: `pay_sim_${randomToken(10)}`,
      gatewayOrderId: payment.gatewayOrderId || `rzp_order_sim_${randomToken(10)}`
    });
    res.json({ success: true, message: 'Payment success simulated successfully', ...maskSensitive(result) });
  } catch (err: any) {
    return handleError(res, err);
  }
});

router.post('/:id/success', requireAccountType('BUYER', 'SUPERADMIN'), async (_req: AuthRequest, res) => {
  res.status(202).json({
    success: false,
    message: 'Payment success must be confirmed by a verified backend webhook. Client-side success was not trusted.',
    code: 'PAYMENT_WEBHOOK_REQUIRED'
  });
});

export default router;
