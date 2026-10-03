import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';
import { apiResponse } from '../utils/apiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { auditLog } from '../modules/audit/audit.service.js';
import { maskSensitive } from '../utils/maskSensitive.js';
import { procurementWorkflow } from '../services/workflow/procurement-workflow.service.js';
import { tenderWorkflow } from '../services/workflow/tender-workflow.service.js';
import type { WorkflowActor } from '../services/workflow/workflow-common.js';

const router = Router();
const db = prisma as any;

const procurementSubmissionSchema = z.object({
  procurementType: z.enum(['RFQ', 'RFP', 'OPEN_TENDER', 'LIMITED_TENDER', 'RATE_CONTRACT']),
  procurementId: z.coerce.number().int().positive(),
  items: z.array(z.object({
    itemId: z.coerce.number().int().positive(),
    basePrice: z.number().positive(),
    gstRate: z.number().nonnegative().default(0),
    freightCharges: z.number().nonnegative().default(0),
    quantity: z.number().positive().optional(),
    uom: z.string().trim().max(60).optional(),
    remarks: z.string().trim().max(500).optional(),
  })).min(1, 'At least one line item is required'),
  documents: z.array(z.object({
    documentType: z.string().trim().max(120),
    fileAssetId: z.coerce.number().int().positive(),
  })).optional(),
  technicalPacket: z.record(z.string(), z.unknown()).optional(),
  financialPacket: z.record(z.string(), z.unknown()).optional(),
  remarks: z.string().trim().max(2000).optional(),
});

router.post(
  '/procurement/submit',
  authenticate,
  validate({ body: procurementSubmissionSchema }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.user) {
        throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
      }

      if (req.user.role !== 'seller') {
        throw new ApiError(403, 'Only sellers can submit quotations and bids', 'SELLER_REQUIRED');
      }

      const sellerOrgId = req.user.organizationId;
      if (!sellerOrgId) {
        throw new ApiError(403, 'User does not belong to an active organization', 'ORGANIZATION_REQUIRED');
      }

      const { procurementType, procurementId, items, documents, technicalPacket, financialPacket, remarks } = req.body;

      const actor: WorkflowActor = {
        id: req.user.id,
        role: req.user.role,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      let result: any = null;

      if (procurementType === 'RFQ' || procurementType === 'RATE_CONTRACT') {
        // Check if a direct QuoteRequest exists
        const qr = await db.quoteRequest.findUnique({ where: { id: procurementId } }).catch(() => null);
        if (qr) {
          result = await procurementWorkflow.createQuoteResponse(actor, procurementId, {
            items,
            documents,
            remarks,
            totalAmount: items.reduce((sum: number, it: any) => sum + (it.basePrice * (it.quantity || 1)), 0),
          });
        } else {
          // Check for Requirement or ProcurementBid
          const reqRecord = await db.buyerRequirement.findUnique({ where: { id: procurementId } }).catch(() => null);
          if (reqRecord) {
            result = await db.buyerRequirementResponse.create({
              data: {
                requirementId: procurementId,
                sellerId: req.user.id,
                organizationId: sellerOrgId,
                status: 'SUBMITTED',
                totalAmount: items.reduce((sum: number, it: any) => sum + (it.basePrice * (it.quantity || 1)), 0),
                responseData: {
                  items,
                  documents,
                  remarks,
                },
              },
            });
          } else {
            // Check ProcurementBidParticipation
            const bid = await db.procurementBid.findUnique({ where: { id: procurementId } }).catch(() => null);
            if (bid) {
              result = await db.procurementBidParticipation.upsert({
                where: {
                  bidId_sellerId: {
                    bidId: procurementId,
                    sellerId: sellerOrgId,
                  },
                },
                update: {
                  submissionStatus: 'SUBMITTED',
                  quotedAmount: items.reduce((sum: number, it: any) => sum + (it.basePrice * (it.quantity || 1)), 0),
                  financialQuote: { items, remarks },
                  technicalDocuments: documents,
                  submittedAt: new Date(),
                },
                create: {
                  bidId: procurementId,
                  sellerId: sellerOrgId,
                  submissionStatus: 'SUBMITTED',
                  quotedAmount: items.reduce((sum: number, it: any) => sum + (it.basePrice * (it.quantity || 1)), 0),
                  financialQuote: { items, remarks },
                  technicalDocuments: documents,
                  submittedAt: new Date(),
                },
              });
            } else {
              throw new ApiError(404, 'Procurement opportunity not found', 'PROCUREMENT_NOT_FOUND');
            }
          }
        }
      } else {
        // RFP, OPEN_TENDER, LIMITED_TENDER
        const tender = await db.tender.findUnique({ where: { id: procurementId } }).catch(() => null);
        if (tender) {
          result = await tenderWorkflow.submitBid(actor, procurementId, {
            items,
            documents,
            technicalPacket,
            financialPacket,
            remarks,
            bidAmount: items.reduce((sum: number, it: any) => sum + (it.basePrice * (it.quantity || 1)), 0),
          });
        } else {
          // Tender bid recorded via ProcurementBidParticipation
          result = await db.procurementBidParticipation.upsert({
            where: {
              bidId_sellerId: {
                bidId: procurementId,
                sellerId: sellerOrgId,
              },
            },
            update: {
              submissionStatus: 'SUBMITTED',
              quotedAmount: items.reduce((sum: number, it: any) => sum + (it.basePrice * (it.quantity || 1)), 0),
              financialQuote: financialPacket || { items, remarks },
              technicalDocuments: technicalPacket || documents,
              submittedAt: new Date(),
            },
            create: {
              bidId: procurementId,
              sellerId: sellerOrgId,
              submissionStatus: 'SUBMITTED',
              quotedAmount: items.reduce((sum: number, it: any) => sum + (it.basePrice * (it.quantity || 1)), 0),
              financialQuote: financialPacket || { items, remarks },
              technicalDocuments: technicalPacket || documents,
              submittedAt: new Date(),
            },
          });
        }
      }

      await auditLog({
        actorUserId: req.user.id,
        actorRole: req.user.role,
        action: 'procurement.quotation_submitted',
        entityType: 'procurement_submission',
        entityId: procurementId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: maskSensitive({
          procurementType,
          itemCount: items.length,
          documentCount: documents?.length ?? 0,
        }),
      });

      return apiResponse.success(res, maskSensitive(result), 201, 'Quotation submitted successfully');
    } catch (err) {
      return next(err);
    }
  }
);

export default router;
