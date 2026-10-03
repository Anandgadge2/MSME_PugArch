import { Router, type Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, optionalAuthenticate, type AuthRequest } from '../middleware/authenticate.js';
import { requirePermission } from '../middleware/auth.js';
import { redisKeys } from '../constants/redis-keys.js';
import { withDistributedLock } from '../utils/redisLock.js';
import { ApiError } from '../utils/ApiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import { maskSensitive } from '../utils/maskSensitive.js';
import { auditLog } from '../modules/audit/audit.service.js';
import { notificationService, resolveSellerOrgName } from '../services/notification.service.js';
import { logger } from '../config/logger.js';
import { upload } from '../config/storage.js';
import { uploadFile } from '../services/storage/storage.service.js';
import { env } from '../config/env.js';
import { numberSeries } from '../services/workflow/workflow-common.js';
import { broadcastToAuction, broadcastToProcurement, broadcastToUser } from '../services/websocket.service.js';
import { formatIstDateTime } from '../services/email-template.builder.js';
import { invalidateBidCaches } from '../modules/procurementBid/procurement-bid.routes.js';

const router = Router();
const db = prisma as any;
const orgScope = {
  scopeType: 'ORGANIZATION' as const,
  getScopeId: (req: AuthRequest) => req.user?.organizationId
};

const toNumber = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const nextAuctionCode = () => numberSeries('RA');

const actor = (req: AuthRequest) => ({
  actorUserId: req.user?.id,
  actorRole: req.user?.role,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent']
});

const writeAuctionEvent = async (req: AuthRequest, auctionId: number, eventType: string, message: string, values?: Record<string, unknown>) => {
  await Promise.all([
    db.auctionEventLog.create({
      data: {
        auctionId,
        actorUserId: req.user?.id || null,
        actorOrgId: req.user?.organizationId || null,
        eventType,
        message,
        newValue: values || undefined
      }
    }).catch(() => undefined),
    auditLog({
      ...actor(req),
      action: `reverse_auction.${eventType}`,
      entityType: 'auction',
      entityId: auctionId,
      metadata: maskSensitive(values || {})
    })
  ]);
};

const auctionFieldsSchema = z.object({
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().max(3000).optional(),
  procurementMethod: z.enum(['REVERSE_AUCTION', 'BID_WITH_REVERSE_AUCTION']).default('REVERSE_AUCTION'),
  category: z.string().trim().max(160).optional(),
  currency: z.string().trim().length(3).default('INR'),
  buyerOrganization: z.string().trim().max(180).optional(),
  department: z.string().trim().max(160).optional(),
  purchaseGroup: z.string().trim().max(120).optional(),
  purchaseOrganization: z.string().trim().max(160).optional(),
  auctionType: z.enum(['ENGLISH_REVERSE', 'RANK_BASED_REVERSE']).default('ENGLISH_REVERSE'),
  auctionMode: z.enum(['ONLINE']).default('ONLINE'),
  linkedTenderId: z.coerce.number().int().positive().optional(),
  linkedBidId: z.coerce.number().int().positive().optional(),
  linkedRequirementId: z.coerce.number().int().positive().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  startingPrice: z.coerce.number().positive(),
  reservePrice: z.coerce.number().positive().optional(),
  minDecrementAmount: z.coerce.number().positive(),
  minDecrementPercent: z.coerce.number().min(0).max(100).optional(),
  autoExtensionEnabled: z.coerce.boolean().default(false),
  autoExtensionWindowMinutes: z.coerce.number().int().min(1).max(120).optional(),
  autoExtensionByMinutes: z.coerce.number().int().min(1).max(120).optional(),
  maxAutoExtensions: z.coerce.number().int().min(0).max(100).default(0),
  rankVisibility: z.enum(['SHOW_RANK_ONLY', 'SHOW_LOWEST_PRICE', 'HIDDEN']).default('SHOW_RANK_ONLY'),
  minimumQualifiedBidders: z.coerce.number().int().min(2).default(2),
  termsDocumentFileId: z.coerce.number().int().positive().optional(),
  termsDocumentName: z.string().trim().max(2000).optional(),
  buyerMonitorSettings: z.record(z.string(), z.unknown()).optional(),
  preBidStage: z.record(z.string(), z.unknown()).optional(),
  auctionTrigger: z.enum(['AFTER_TECHNICAL_QUALIFICATION', 'TOP_N_BIDDERS', 'ALL_TECHNICALLY_QUALIFIED']).optional(),
  visibilityMode: z.enum(['INVITED_SELLERS_ONLY', 'TECHNICALLY_QUALIFIED_ONLY']).default('INVITED_SELLERS_ONLY'),
  allowCompetitorNames: z.coerce.boolean().default(false),
  remarks: z.string().trim().max(1000).optional(),
  qualifiedVendors: z.array(z.object({
    sellerOrgId: z.coerce.number().int().positive(),
    sellerUserId: z.coerce.number().int().positive().optional()
  })).optional()
});

const createAuctionSchema = auctionFieldsSchema.refine(value => Boolean(value.linkedTenderId || value.linkedBidId || value.linkedRequirementId), {
  message: 'Link the auction to a tender, procurement bid, or buyer requirement',
  path: ['linkedTenderId']
}).refine(value => value.endAt > value.startAt, {
  message: 'Auction end time must be after start time',
  path: ['endAt']
}).refine(value => value.reservePrice === undefined || value.reservePrice <= value.startingPrice, {
  message: 'Reserve price must be less than or equal to starting price',
  path: ['reservePrice']
}).refine(value => !value.autoExtensionEnabled || Boolean(value.autoExtensionWindowMinutes && value.autoExtensionByMinutes && value.maxAutoExtensions > 0), {
  message: 'Auto extension trigger, duration, and maximum extensions are required when auto extension is enabled',
  path: ['autoExtensionWindowMinutes']
}).refine(value => !value.qualifiedVendors || value.qualifiedVendors.length >= value.minimumQualifiedBidders, {
  message: 'Qualified vendor list must satisfy minimum qualified bidders',
  path: ['qualifiedVendors']
});

const updateAuctionSchema = auctionFieldsSchema.omit({ linkedTenderId: true, linkedBidId: true, linkedRequirementId: true }).partial();
const inviteSchema = z.object({
  sellers: z.array(z.object({
    sellerOrgId: z.coerce.number().int().positive(),
    sellerUserId: z.coerce.number().int().positive().optional()
  })).min(1).max(100)
});
const bidSchema = z.object({ amount: z.coerce.number().positive(), deviceHash: z.string().trim().max(128).optional() });
const cancelSchema = z.object({ reason: z.string().trim().min(5).max(500) });
const awardSchema = z.object({
  participantId: z.coerce.number().int().positive().optional(),
  remarks: z.string().trim().max(1000).optional(),
  isPriceMatch: z.boolean().optional(),
  counterOfferAmount: z.coerce.number().positive().optional()
});
const initialQuoteSchema = z.object({
  quotedAmount: z.coerce.number().positive(),
  gstPercentage: z.coerce.number().min(0).max(100).optional().default(0),
  totalAmount: z.coerce.number().positive().optional(),
  makeBrand: z.string().trim().max(160).optional(),
  model: z.string().trim().max(160).optional()
});
const qualificationReviewSchema = z.object({
  decision: z.enum(['QUALIFY', 'DISQUALIFY']),
  remarks: z.string().trim().max(1000).optional()
});

const isAdmin = (req: AuthRequest) => req.user?.role === 'admin' || req.user?.role === 'master_admin';

const canManageAuction = (req: AuthRequest, auction: any) =>
  isAdmin(req) ||
  auction.createdByUserId === req.user?.id ||
  (auction.buyerOrgId && auction.buyerOrgId === req.user?.organizationId);

const assertAuctionManager = (req: AuthRequest, auction: any) => {
  if (!canManageAuction(req, auction)) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
};

/**
 * A reverse auction is stored as a Requirement; the biddable Auction row has its own
 * id and links back via linkedRequirementId. Links across the app sometimes carry the
 * requirement id (or a public-opportunity id) instead of the auction id. Accept either:
 * try the auction primary key first, then fall back to the linked requirement id so a
 * stale/aliased link self-heals instead of 404-ing.
 */
const TERMINAL_AUCTION_STATUSES = ['CLOSED', 'CANCELLED', 'AWARD_RECOMMENDED', 'AWARDED', 'AWARD_ACCEPTED'];
const resolveAuctionId = async (rawId: number | string): Promise<number | null> => {
  const str = String(rawId ?? '').trim();
  if (!str) return null;

  // 1. Direct match by auctionCode or referenceNo (case-insensitive)
  const byCode = await db.auction.findFirst({
    where: {
      OR: [
        { auctionCode: { equals: str, mode: 'insensitive' } },
        { referenceNo: { equals: str, mode: 'insensitive' } },
        { auctionCode: str },
        { referenceNo: str }
      ]
    },
    select: { id: true }
  });
  if (byCode) return byCode.id;

  // 2. If it has a prefix like "RA-" or "PRC-" followed by an integer, try direct ID fallback or linked lookups
  if (str.toUpperCase().startsWith('RA-') || str.toUpperCase().startsWith('PRC-')) {
    const stripped = str.replace(/^(RA-|PRC-)/i, '');
    const numStripped = Number(stripped);
    if (Number.isFinite(numStripped) && numStripped > 0) {
      const byStrippedId = await db.auction.findUnique({ where: { id: numStripped }, select: { id: true } });
      if (byStrippedId) return byStrippedId.id;
      const linked = await db.auction.findFirst({
        where: { linkedRequirementId: numStripped },
        select: { id: true },
        orderBy: { id: 'desc' }
      });
      if (linked) return linked.id;
      const linkedBid = await db.auction.findFirst({
        where: { linkedBidId: numStripped },
        select: { id: true },
        orderBy: { id: 'desc' }
      });
      if (linkedBid) return linkedBid.id;
    }
  }

  // 3. Try lookup via linked ProcurementBid by bidNumber or tenderNumber (e.g. "RFP-2026-26500")
  const linkedBidRow = await db.procurementBid.findFirst({
    where: {
      OR: [
        { bidNumber: { equals: str, mode: 'insensitive' } },
        { tenderNumber: { equals: str, mode: 'insensitive' } },
        { bidNumber: str },
        { tenderNumber: str }
      ]
    },
    select: { id: true, bidNumber: true }
  }).catch(() => null);

  if (linkedBidRow) {
    const auctionForBid = await db.auction.findFirst({
      where: {
        OR: [
          { linkedBidId: linkedBidRow.id },
          ...(linkedBidRow.bidNumber ? [{ referenceNo: linkedBidRow.bidNumber }, { auctionCode: linkedBidRow.bidNumber }] : [])
        ]
      },
      select: { id: true },
      orderBy: { id: 'desc' }
    });
    if (auctionForBid) return auctionForBid.id;
  }

  // 4. Try numeric lookup if valid number
  const num = Number(str);
  if (Number.isFinite(num) && num > 0) {
    const direct = await db.auction.findUnique({ where: { id: num }, select: { id: true } });
    if (direct) return direct.id;
    const linked = await db.auction.findFirst({
      where: { linkedRequirementId: num },
      select: { id: true },
      orderBy: { createdAt: 'desc' }
    });
    if (linked) return linked.id;
    const linkedBid = await db.auction.findFirst({
      where: { linkedBidId: num },
      select: { id: true },
      orderBy: { createdAt: 'desc' }
    });
    if (linkedBid) return linkedBid.id;
  }
  return null;
};

/**
 * True when the auction's linked requirement is publicly visible (open to all sellers).
 * The Requirement model has NO visibility column — selecting it throws, which used to
 * 500 every reverse-auction detail request. Openness lives in the wizard payload:
 * payload.vendors.selection === 'Open' (with payload.visibility as an explicit override).
 */
const isAuctionPublic = async (auction: any): Promise<boolean> => {
  if (!auction?.linkedRequirementId) return false;
  const requirement = await db.requirement.findUnique({
    where: { id: auction.linkedRequirementId },
    select: { payload: true }
  });
  const payload = (requirement?.payload || {}) as any;
  const explicit = String(payload.visibility || payload.basics?.visibility || '').toUpperCase();
  if (explicit) return explicit === 'PUBLIC';
  return String(payload.vendors?.selection || '').toLowerCase() === 'open';
};

/**
 * Auction status only changes on explicit buyer actions, so a row whose end time
 * passed (or whose scheduled window opened) keeps a stale DRAFT/SCHEDULED/LIVE
 * label forever. Derive the effective status from the clock at read time and
 * lazily persist it so every consumer (detail, list, live console) agrees.
 */
const withEffectiveStatus = async (auction: any) => {
  if (!auction) return auction;
  const current = String(auction.statusEnum || auction.status || 'DRAFT').toUpperCase();
  if (TERMINAL_AUCTION_STATUSES.includes(current)) return auction;
  const now = Date.now();
  const start = auction.startTime ? new Date(auction.startTime).getTime() : NaN;
  const end = auction.endTime ? new Date(auction.endTime).getTime() : NaN;
  let effective = current;
  let evaluationPending = false;

  // Check if qualification is required and pending
  const hasPreBidStage = Boolean(
    auction.preBidStage ||
    auction.procurementMethod === 'BID_WITH_REVERSE_AUCTION' ||
    auction.visibilityMode === 'TECHNICALLY_QUALIFIED_ONLY' ||
    auction.linkedBidId ||
    auction.linkedRequirementId
  );

  if (hasPreBidStage && ['SCHEDULED', 'LIVE', 'ACTIVE'].includes(current)) {
    const [qualifiedCount, pendingSubmissions] = await Promise.all([
      db.auctionParticipant.count({
        where: {
          auctionId: auction.id,
          status: { in: ['TECHNICALLY_QUALIFIED', 'ACCEPTED'] }
        }
      }).catch(() => 0),
      db.auctionParticipant.count({
        where: {
          auctionId: auction.id,
          qualificationStatus: 'SUBMITTED'
        }
      }).catch(() => 0)
    ]);

    const minimumRequired = Math.max(1, Number(auction.minimumQualifiedBidders) || 1);
    // If submissions are waiting for buyer review, or qualified count is below threshold
    if (pendingSubmissions > 0 || qualifiedCount < minimumRequired) {
      evaluationPending = true;
    }
  }

  if (Number.isFinite(end) && end <= now) {
    effective = 'CLOSED';
  } else if (['SCHEDULED', 'LIVE', 'ACTIVE'].includes(current) && Number.isFinite(start) && start <= now) {
    if (evaluationPending) {
      // Evaluation is delayed: keep auction on hold in SCHEDULED
      effective = 'SCHEDULED';
    } else {
      effective = 'LIVE';
    }
  }

  const data: any = {};
  if (effective !== current) {
    data.status = effective;
    data.statusEnum = effective;
    if (effective === 'CLOSED' && !auction.actualClosedAt) data.actualClosedAt = new Date();
    await db.auction.update({ where: { id: auction.id }, data }).catch(() => undefined);
    if (effective === 'CLOSED' && auction.linkedBidId) {
      await db.procurementBid.update({
        where: { id: auction.linkedBidId },
        data: { status: 'L1_GENERATED', lifecycleStage: 'L1_GENERATED' }
      }).catch(() => undefined);
    }
  }
  return { ...auction, ...data, evaluationPending };
};

/**
 * Wizard-created auctions carry only commercial fields; the procurement facts the
 * buyer filled (items, documents, delivery, consignees, timelines) live on the linked
 * Requirement payload. Attach a read-only summary so the seller detail page can show
 * everything without a second round trip.
 */
const linkedRequirementSummary = async (auction: any) => {
  if (!auction) return null;
  const linkedBidId = auction.linkedBidId ? Number(auction.linkedBidId) : null;
  const linkedReqId = auction.linkedRequirementId ? Number(auction.linkedRequirementId) : null;
  const refNo = auction.referenceNo || null;

  const candidateRefs: string[] = [];
  let stripped: string | null = null;
  if (refNo) {
    candidateRefs.push(refNo);
    stripped = refNo.replace(/^(RA-|PRC-|AUCTION-|TENDER-|TND-|RFQ-|RFP-|RC-|RATE-)/i, '');
    if (stripped && stripped !== refNo) candidateRefs.push(stripped);
  }
  const configParentRef = auction.auctionConfig?.parentRefNumber;
  if (configParentRef && typeof configParentRef === 'string') {
    candidateRefs.push(configParentRef);
    const configStripped = configParentRef.replace(/^(RA-|PRC-|AUCTION-|TENDER-|TND-|RFQ-|RFP-|RC-|RATE-)/i, '');
    if (configStripped && configStripped !== configParentRef) {
      candidateRefs.push(configStripped);
      if (!stripped) stripped = configStripped;
    }
  }
  const configParentId = auction.auctionConfig?.parentProcurementId;
  const configNumId = Number(configParentId);
  const resolvedBidId = linkedBidId || (Number.isFinite(configNumId) && configNumId > 0 ? configNumId : null);

  // 1. Try finding linked procurementBid
  if (resolvedBidId || candidateRefs.length > 0 || stripped) {
    const pBid = await db.procurementBid.findFirst({
      where: {
        OR: [
          ...(resolvedBidId ? [{ id: resolvedBidId }] : []),
          ...(candidateRefs.length > 0 ? [{ bidNumber: { in: candidateRefs } }] : []),
          ...(stripped ? [{ bidNumber: { contains: stripped } }] : [])
        ]
      },
      include: {
        buyerOrganization: true,
        buyer: { include: { buyerProfile: true } },
        documents: true
      }
    }).catch(() => null);

    if (pBid) {
      const techPacket = (pBid.technicalPacket || {}) as any;
      const basics = techPacket.basics || {};
      const terms = techPacket.terms || {};
      const schedule = techPacket.schedule || {};
      const org = pBid.buyerOrganization || (pBid.buyer as any)?.buyerProfile?.organization;
      const regAddr = org
        ? [org.addressLine1, org.addressLine2, org.city, org.district, org.state, org.pincode].filter(Boolean).join(', ')
        : null;

      const items = (Array.isArray(pBid.items) && pBid.items.length > 0 ? pBid.items : null) ||
        (Array.isArray(techPacket.items) && techPacket.items.length > 0 ? techPacket.items : null) ||
        (Array.isArray(techPacket.boqTable) && techPacket.boqTable.length > 0 ? techPacket.boqTable : []) ||
        [];

      const boqTable = Array.isArray(pBid.boqTable) && pBid.boqTable.length > 0
        ? pBid.boqTable
        : (Array.isArray(techPacket.boqTable) ? techPacket.boqTable : []);

      const termsList = Array.isArray(pBid.termsAndConditions) && pBid.termsAndConditions.length > 0
        ? pBid.termsAndConditions
        : (Array.isArray(terms.termsAndConditions) ? terms.termsAndConditions : (typeof terms === 'string' ? [terms] : []));

      const eligList = Array.isArray(pBid.eligibilityCriteria) && pBid.eligibilityCriteria.length > 0
        ? pBid.eligibilityCriteria
        : (Array.isArray(basics.eligibilityCriteria) ? basics.eligibilityCriteria : []);

      return {
        id: pBid.id,
        bidNumber: pBid.bidNumber,
        requirementNumber: pBid.bidNumber,
        title: pBid.title,
        description: pBid.description || basics.description || '',
        procurementMethod: pBid.procurementMethod || 'REVERSE_AUCTION',
        canonicalMethod: pBid.procurementMethod,
        status: pBid.status,
        estimatedValue: pBid.estimatedValue,
        category: pBid.category || basics.category || null,
        deliveryLocation: pBid.deliveryLocation || basics.deliveryLocation || null,
        paymentTerms: pBid.paymentTerms || terms.paymentTerms || basics.paymentTerms || null,
        deliveryTerms: pBid.deliveryTerms || terms.deliveryTerms || basics.deliveryTerms || null,
        items,
        boqTable,
        documents: pBid.documents || techPacket.documents || [],
        requiredDocuments: pBid.requiredDocuments || techPacket.requiredDocs || techPacket.requiredDocuments || [],
        termsAndConditions: termsList,
        eligibilityCriteria: eligList,
        consigneeDetails: Array.isArray(techPacket.consigneeDetails) ? techPacket.consigneeDetails : [],
        approvalAuthority: pBid.approvalAuthority || techPacket.internal?.approvalAuthority || null,
        justification: pBid.justification || techPacket.internal?.justification || null,
        internalDetails: pBid.internalDetails || techPacket.internal || null,
        payload: techPacket,
        technicalPacket: techPacket,
        bidStartDate: pBid.startDate || schedule.publishDate || null,
        bidClosingDate: pBid.endDate || schedule.submissionDate || null,
        buyerOrganization: org ? {
          id: org.id,
          organizationName: org.organizationName,
          registeredAddress: regAddr,
          city: org.city || null,
          district: org.district || null,
          state: org.state || null,
          pincode: org.pincode || null
        } : null,
        buyer: pBid.buyer || null
      };
    }
  }

  // 2. Try finding linked buyerRequirement
  if (linkedReqId || refNo || stripped || candidateRefs.length > 0) {
    const buyerReq = await db.buyerRequirement.findFirst({
      where: {
        OR: [
          ...(linkedReqId ? [{ id: linkedReqId }] : []),
          ...(candidateRefs.length > 0 ? [{ title: { in: candidateRefs } }] : []),
          ...(refNo ? [{ title: { contains: refNo } }] : []),
          ...(stripped ? [{ title: { contains: stripped } }] : [])
        ]
      },
      include: {
        buyerOrganization: true,
        createdBy: { include: { buyerProfile: true } },
        category: true
      }
    }).catch(() => null);

    if (buyerReq) {
      const payload = (buyerReq.payload || {}) as any;
      const basics = payload.basics || {};
      const terms = payload.terms || {};
      const org = buyerReq.buyerOrganization;
      const regAddr = org
        ? [org.addressLine1, org.addressLine2, org.city, org.district, org.state, org.pincode].filter(Boolean).join(', ')
        : null;

      const items = Array.isArray(buyerReq.items) && buyerReq.items.length > 0
        ? buyerReq.items
        : (Array.isArray(payload.items) ? payload.items : (Array.isArray(payload.boqTable) ? payload.boqTable : []));

      const boqTable = Array.isArray(payload.boqTable) ? payload.boqTable : [];
      const termsList = Array.isArray(terms.termsAndConditions)
        ? terms.termsAndConditions
        : (buyerReq.terms ? [buyerReq.terms] : []);

      return {
        id: buyerReq.id,
        requirementNumber: `REQ-${buyerReq.id}`,
        title: buyerReq.title,
        description: buyerReq.description || basics.description || '',
        procurementMethod: 'REVERSE_AUCTION',
        canonicalMethod: 'REVERSE_AUCTION',
        status: buyerReq.status,
        estimatedValue: buyerReq.estimatedValue || buyerReq.budgetMax || buyerReq.budgetMin,
        category: buyerReq.category?.name || basics.category || null,
        deliveryLocation: buyerReq.location || basics.deliveryLocation || null,
        paymentTerms: buyerReq.paymentTerms || terms.paymentTerms || basics.paymentTerms || null,
        deliveryTerms: buyerReq.deliveryTerms || terms.deliveryTerms || null,
        items,
        boqTable,
        documents: Array.isArray(payload.documents) ? payload.documents : [],
        requiredDocuments: buyerReq.requiredDocuments || payload.requiredDocs || [],
        termsAndConditions: termsList,
        eligibilityCriteria: Array.isArray(basics.eligibilityCriteria) ? basics.eligibilityCriteria : [],
        consigneeDetails: Array.isArray(payload.consigneeDetails) ? payload.consigneeDetails : [],
        approvalAuthority: payload.internal?.approvalAuthority || null,
        justification: payload.internal?.justification || null,
        internalDetails: payload.internal || null,
        payload,
        bidStartDate: buyerReq.createdAt,
        bidClosingDate: buyerReq.lastDate,
        buyerOrganization: org ? {
          id: org.id,
          organizationName: org.organizationName,
          registeredAddress: regAddr,
          city: org.city || null,
          district: org.district || null,
          state: org.state || null,
          pincode: org.pincode || null
        } : null,
        buyer: buyerReq.createdBy || null
      };
    }
  }

  // 3. Fallback to requirement (primary unified table)
  if (!linkedReqId && !stripped && candidateRefs.length === 0) return null;
  const requirement = await db.requirement.findFirst({
    where: {
      OR: [
        ...(linkedReqId ? [{ id: linkedReqId }] : []),
        ...(candidateRefs.length > 0 ? [{ requirementNumber: { in: candidateRefs } }] : []),
        ...(stripped ? [{ requirementNumber: { contains: stripped } }] : [])
      ]
    },
    include: {
      items: true,
      category: true,
      organization: {
        select: {
          id: true,
          organizationName: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          district: true,
          state: true,
          pincode: true,
          country: true
        }
      },
      buyer: {
        include: {
          buyerProfile: {
            include: {
              organization: true
            }
          }
        }
      }
    }
  }).catch(() => null);
  if (!requirement) return null;

  const payload = (requirement.payload || {}) as any;
  const basics = payload.basics || {};
  const tender = payload.tender || {};
  const terms = payload.terms || {};
  const schedule = payload.schedule || {};
  const evaluation = payload.evaluation || {};
  const rules = payload.rules || {};
  const vendors = payload.vendors || {};
  const documents = Array.isArray(payload.documents) ? payload.documents : [];
  const requiredDocs = Array.isArray(payload.requiredDocs)
    ? payload.requiredDocs
    : (Array.isArray(payload.requiredDocuments) ? payload.requiredDocuments : []);

  const org = requirement.organization || requirement.buyer?.buyerProfile?.organization;
  const registeredAddress = org
    ? [org.addressLine1, org.addressLine2, org.city, org.district, org.state, org.pincode].filter(Boolean).join(', ')
    : null;

  // Resolve items with robust fallback across DB requirementItems, payload.items, and payload.boqTable
  const rawItems = (requirement.items && requirement.items.length > 0)
    ? requirement.items
    : (Array.isArray(payload.items) && payload.items.length > 0
        ? payload.items
        : (Array.isArray(payload.boqTable) ? payload.boqTable : []));

  const items = rawItems.map((item: any, idx: number) => {
    const specs = (typeof item.specifications === 'object' && item.specifications) ? item.specifications : {};
    const name = item.itemName || item.name || item.description || `Line Item ${idx + 1}`;
    const desc = item.description || item.specification || specs.specification || specs.description || '';
    const qty = Number(item.quantity ?? item.qty ?? 1);
    const uom = String(item.unitOfMeasure || item.unit || item.uom || 'Nos').trim();
    const unitPrice = Number(item.estimatedUnitPrice ?? item.unitPrice ?? item.baseRate ?? item.estimatedRate ?? 0);
    return {
      id: item.id || idx + 1,
      name,
      itemName: name,
      description: desc,
      specification: desc,
      quantity: qty,
      qty,
      unitOfMeasure: uom,
      unit: uom,
      uom,
      estimatedUnitPrice: unitPrice,
      unitPrice,
      specifications: specs
    };
  });

  const boqTable = Array.isArray(payload.boqTable) ? payload.boqTable : [];

  const effectiveBidStartDate =
    schedule.submissionStartDate ||
    schedule.publishDate ||
    schedule.bidStartDate ||
    tender.bidStartDate ||
    (auction.startTime ? new Date(auction.startTime).toISOString() : null) ||
    requirement.createdAt;

  const effectiveBidClosingDate =
    schedule.submissionDate ||
    schedule.bidClosingDate ||
    schedule.bidSubmissionEnd ||
    tender.bidClosingDate ||
    (auction.endTime ? new Date(auction.endTime).toISOString() : null) ||
    null;

  const effectiveValidityDays = schedule.validityDays ? Number(schedule.validityDays) : 90;
  const effectiveBidValidityDate = schedule.bidValidityDate || (effectiveBidClosingDate && effectiveValidityDays
    ? new Date(new Date(effectiveBidClosingDate).getTime() + effectiveValidityDays * 86400000).toISOString().slice(0, 10)
    : null);

  const effectiveRequiredBy =
    requirement.requiredBy ||
    basics.requiredByDate ||
    schedule.requiredByDate ||
    schedule.expectedDeliveryDate ||
    tender.requiredByDate ||
    null;

  const termsList = Array.isArray(terms.termsAndConditions)
    ? terms.termsAndConditions
    : (typeof terms.termsAndConditions === 'string'
        ? [terms.termsAndConditions]
        : [terms.paymentTerms, terms.deliveryTerms, terms.penaltyClause].filter(Boolean));

  const resolvedEstValue = Number(
    requirement.estimatedValue ||
    basics.estimatedValue ||
    payload.auctionConfig?.startingBidPrice ||
    auction.startPrice ||
    auction.basePrice ||
    0
  );

  return {
    id: requirement.id,
    requirementNumber: requirement.requirementNumber,
    title: requirement.title,
    description: requirement.description || basics.description || '',
    canonicalMethod: requirement.canonicalMethod || requirement.procurementMethod || 'REVERSE_AUCTION',
    procurementMethod: requirement.procurementMethod || 'REVERSE_AUCTION',
    status: requirement.status,
    estimatedValue: resolvedEstValue,
    currency: requirement.currency || 'INR',
    requiredBy: effectiveRequiredBy,
    category: requirement.category?.name || basics.category || auction.category || null,
    deliveryLocation: basics.deliveryLocation || tender.deliveryLocation || null,
    items,
    boqTable,
    documents: documents.map((doc: any, idx: number) => ({
      id: doc.id || doc.fileAssetId || `req-doc-${idx + 1}`,
      name: doc.name || doc.fileName || `Procurement Document ${idx + 1}`,
      fileName: doc.fileName || null,
      fileAssetId: doc.fileAssetId ? Number(doc.fileAssetId) : null,
      url: doc.url || null,
      required: doc.required !== false
    })),
    requiredDocuments: requiredDocs.map((doc: any, idx: number) => {
      if (typeof doc === 'string') return doc;
      return {
        id: doc.id || doc.fileAssetId || `req-doc-check-${idx + 1}`,
        name: doc.name || doc.fileName || `Required Document ${idx + 1}`,
        fileName: doc.fileName || null,
        fileAssetId: doc.fileAssetId ? Number(doc.fileAssetId) : null,
        url: doc.url || null,
        required: doc.required !== false,
        instructions: doc.instructions || doc.remarks || ''
      };
    }),
    termsAndConditions: termsList,
    eligibilityCriteria: Array.isArray(basics.eligibilityCriteria) ? basics.eligibilityCriteria : [],
    consigneeDetails: Array.isArray(payload.consigneeDetails) ? payload.consigneeDetails : [],
    paymentTerms: terms.paymentTerms || basics.paymentTerms || null,
    deliveryTerms: terms.deliveryTerms || null,
    penaltyClause: terms.penaltyClause || null,
    freightTerms: terms.freightTerms || null,
    approvalAuthority: payload.internal?.approvalAuthority || null,
    justification: payload.internal?.justification || basics.justification || null,
    internalDetails: payload.internal || null,
    schedule: {
      ...schedule,
      submissionStartDate: effectiveBidStartDate,
      submissionDate: effectiveBidClosingDate,
      bidValidityDate: effectiveBidValidityDate,
      validityDays: effectiveValidityDays,
      requiredByDate: effectiveRequiredBy
    },
    terms: {
      ...terms,
      paymentTerms: terms.paymentTerms || basics.paymentTerms || null,
      deliveryTerms: terms.deliveryTerms || null,
      penaltyClause: terms.penaltyClause || null
    },
    evaluation: {
      ...evaluation,
      msmePreference: evaluation.msmePreference ?? evaluation.msmeExemption ?? false,
      localVendorPreference: evaluation.localVendorPreference ?? evaluation.makeInIndiaPreference ?? false,
      method: evaluation.method || 'L1 total value'
    },
    rules: {
      ...rules,
      msmePreference: rules.msmePreference ?? evaluation.msmePreference ?? false,
      localVendorPreference: rules.localVendorPreference ?? evaluation.localVendorPreference ?? false,
      validityDays: effectiveValidityDays
    },
    vendors: {
      ...vendors,
      msmePreference: vendors.msmePreference ?? evaluation.msmePreference ?? false
    },
    payload: {
      ...payload,
      items,
      boqTable,
      schedule: {
        ...schedule,
        submissionStartDate: effectiveBidStartDate,
        submissionDate: effectiveBidClosingDate,
        bidValidityDate: effectiveBidValidityDate,
        validityDays: effectiveValidityDays,
        requiredByDate: effectiveRequiredBy
      },
      terms: {
        ...terms,
        paymentTerms: terms.paymentTerms || basics.paymentTerms || null,
        deliveryTerms: terms.deliveryTerms || null,
        penaltyClause: terms.penaltyClause || null
      },
      evaluation: {
        ...evaluation,
        msmePreference: evaluation.msmePreference ?? evaluation.msmeExemption ?? false,
        localVendorPreference: evaluation.localVendorPreference ?? evaluation.makeInIndiaPreference ?? false,
        method: evaluation.method || 'L1 total value'
      },
      rules: {
        ...rules,
        msmePreference: rules.msmePreference ?? evaluation.msmePreference ?? false,
        localVendorPreference: rules.localVendorPreference ?? evaluation.localVendorPreference ?? false,
        validityDays: effectiveValidityDays
      },
      requiredDocs
    },
    bidStartDate: effectiveBidStartDate,
    bidClosingDate: effectiveBidClosingDate,
    bidValidityDate: effectiveBidValidityDate,
    validityDays: effectiveValidityDays,
    buyerOrganization: org ? {
      id: org.id,
      organizationName: org.organizationName,
      registeredAddress: registeredAddress || null,
      city: org.city || null,
      district: org.district || null,
      state: org.state || null,
      pincode: org.pincode || null
    } : null,
    buyer: requirement.buyer || null
  };
};

const auctionIncludeFor = (req: AuthRequest) => ({
  bids: req.user?.role === 'seller'
    ? { where: { OR: [{ sellerId: req.user.id }, { sellerOrgId: req.user.organizationId || -1 }] }, orderBy: { submittedAt: 'desc' } }
    : { orderBy: { submittedAt: 'desc' }, take: 200 }
});

const recalculateRanks = async (client: any, auctionId: number) => {
  try {
    const target = client?.$transaction ? client : db;
    const bids = await target.auctionBid.findMany({
      where: { auctionId, isValid: true },
      orderBy: [{ amount: 'asc' }, { bidAmount: 'asc' }, { submittedAt: 'asc' }]
    });
    const bestByOrg = new Map<number, any>();
    for (const bid of bids) {
      const orgId = Number(bid.sellerOrgId || 0);
      if (orgId && !bestByOrg.has(orgId)) bestByOrg.set(orgId, bid);
    }

    const participants = await target.auctionParticipant.findMany({
      where: { auctionId }
    });
    const participantMap = new Map<number, any>(participants.map((p: any) => [Number(p.sellerOrgId), p]));

    let rank = 1;
    const participantUpdates: any[] = [];
    const bidUpdates: any[] = [];

    for (const bid of bestByOrg.values()) {
      const orgId = Number(bid.sellerOrgId || 0);
      const p = participantMap.get(orgId);
      const bidAmount = bid.amount || bid.bidAmount;

      if (p) {
        if (p.currentRank !== rank || toNumber(p.lastBidAmount) !== toNumber(bidAmount)) {
          participantUpdates.push(
            target.auctionParticipant.updateMany({
              where: { auctionId, sellerOrgId: orgId },
              data: { currentRank: rank, lastBidAmount: bidAmount }
            }).catch((err: any) => logger.warn({ err }, 'Failed to update participant rank'))
          );
        }
      } else {
        participantUpdates.push(
          target.auctionParticipant.updateMany({
            where: { auctionId, sellerOrgId: orgId },
            data: { currentRank: rank, lastBidAmount: bidAmount }
          }).catch((err: any) => logger.warn({ err }, 'Failed to update participant rank'))
        );
      }

      if (bid.rankAtSubmission !== rank) {
        bidUpdates.push(
          target.auctionBid.update({
            where: { id: bid.id },
            data: { rankAtSubmission: rank }
          }).catch(() => undefined)
        );
      }
      rank += 1;
    }

    if (participantUpdates.length > 0) {
      await Promise.all(participantUpdates);
    }
    if (bidUpdates.length > 0) {
      await Promise.all(bidUpdates);
    }
  } catch (err) {
    logger.warn({ err, auctionId }, '[ReverseAuction] Error in recalculateRanks (non-fatal)');
  }
};

const procurementAuctionCache = new Map<string, { data: any; expiresAt: number }>();
export const invalidateProcurementAuctionCache = (procurementId?: string | number) => {
  if (procurementId) {
    procurementAuctionCache.delete(String(procurementId));
    procurementAuctionCache.delete(`RFQ-${procurementId}`);
    procurementAuctionCache.delete(`REQ-${procurementId}`);
  } else {
    procurementAuctionCache.clear();
  }
};

router.get('/reverse-auctions/by-procurement/:procurementId', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const rawId = String(req.params.procurementId || '').trim();
    const numId = Number(rawId);

    const cached = procurementAuctionCache.get(rawId);
    if (cached && cached.expiresAt > Date.now()) {
      if (cached.data === null) {
        return apiResponse.success(res, null, 200, 'No auction linked to this procurement');
      }
      return apiResponse.success(res, cached.data);
    }

    const auctionInclude = {
      winnerSeller: { select: { id: true, name: true, email: true } },
      bids: {
        orderBy: { createdAt: 'desc' },
        take: 10
      }
    };

    // 1. Direct match by referenceNo or auctionCode first (prevents integer ID cross-contamination between bids & requirements)
    let auction = await db.auction.findFirst({
      where: {
        OR: [
          { referenceNo: rawId },
          { referenceNo: `RFQ-${rawId}` },
          { referenceNo: `REQ-${rawId}` },
          { referenceNo: `RA-${rawId}` },
          { referenceNo: `RFP-${rawId}` },
          { auctionCode: rawId },
          { auctionCode: `RA-${rawId}` },
        ]
      },
      include: auctionInclude,
      orderBy: { id: 'desc' }
    });

    let pb: any = null;
    let reqItem: any = null;

    // 2. If not found by reference string, resolve via specific linked entity
    if (!auction) {
      if (Number.isFinite(numId) && numId > 0) {
        pb = await db.procurementBid.findUnique({
          where: { id: numId },
          select: {
            id: true,
            bidNumber: true,
            allowReverseAuction: true,
            estimatedValue: true,
            technicalPacket: true,
            procurementMethod: true
          }
        }).catch(() => null);
      }
      if (!pb && rawId) {
        pb = await db.procurementBid.findFirst({
          where: {
            OR: [
              { bidNumber: rawId },
              { bidNumber: `RFQ-${rawId}` },
              { bidNumber: `RFP-${rawId}` },
            ]
          },
          select: {
            id: true,
            bidNumber: true,
            allowReverseAuction: true,
            estimatedValue: true,
            technicalPacket: true,
            procurementMethod: true
          }
        }).catch(() => null);
      }

      if (pb) {
        auction = await db.auction.findFirst({
          where: {
            OR: [
              { linkedBidId: pb.id },
              ...(pb.bidNumber ? [{ referenceNo: pb.bidNumber }, { auctionCode: pb.bidNumber }] : [])
            ]
          },
          include: auctionInclude,
          orderBy: { id: 'desc' }
        });
      }

      // If still not found, check Requirement
      if (!auction) {
        if (Number.isFinite(numId) && numId > 0) {
          reqItem = await (db as any).requirement.findUnique({
            where: { id: numId },
            select: { id: true, requirementNumber: true, payload: true }
          }).catch(() => null);
        }
        if (!reqItem && rawId) {
          reqItem = await (db as any).requirement.findFirst({
            where: {
              OR: [
                { requirementNumber: rawId },
                { requirementNumber: `REQ-${rawId}` },
                { requirementNumber: `RFP-${rawId}` },
              ]
            },
            select: { id: true, requirementNumber: true, payload: true }
          }).catch(() => null);
        }

        if (reqItem) {
          auction = await db.auction.findFirst({
            where: {
              OR: [
                { linkedRequirementId: reqItem.id },
                ...(reqItem.requirementNumber ? [{ referenceNo: reqItem.requirementNumber }] : [])
              ]
            },
            include: auctionInclude,
            orderBy: { id: 'desc' }
          });
        }
      }
    }

    if (!auction) {
      // SAP Ariba Follow-On Pattern: Check if the requirement or bid has reverse auction
      // configured but the auction hasn't been created yet (follow-on pattern).
      if (pb) {
        const techPacket = (pb.technicalPacket || {}) as any;
        const isPlannedOnBid = Boolean(
          pb.allowReverseAuction ||
          pb.procurementMethod === 'BID_WITH_REVERSE_AUCTION' ||
          techPacket.allowReverseAuction ||
          techPacket.basics?.isReverseAuctionNeeded ||
          techPacket.rules?.allowReverseAuction
        );

        if (isPlannedOnBid) {
          const auctionConfig = techPacket.auctionConfig || techPacket.rules?.auctionConfig || {};
          const plannedData = {
            auctionPlanned: true,
            procurementBidId: pb.id,
            startPrice: Number(auctionConfig.startingBidPrice || techPacket.rules?.startPrice || pb.estimatedValue || 0),
            minDecrementAmount: Number(auctionConfig.minimumBidDecrement || techPacket.rules?.minimumDecrement || 0),
            autoExtensionEnabled: Boolean(auctionConfig.autoExtensionEnabled !== false),
            extensionTriggerMinutes: auctionConfig.extensionTriggerMinutes || 5,
            extensionDurationMinutes: auctionConfig.extensionDurationMinutes || 5,
            maximumExtensions: auctionConfig.maximumExtensions || 3,
            rankVisibility: auctionConfig.rankVisibility || 'SHOW_RANK_ONLY',
            durationMinutes: auctionConfig.durationMinutes || 60,
            triggerConfiguration: auctionConfig.triggerConfiguration || {},
          };
          procurementAuctionCache.set(rawId, { data: plannedData, expiresAt: Date.now() + 30_000 });
          return apiResponse.success(res, plannedData);
        }
      }

      if (reqItem) {
        const reqPayload = (reqItem.payload || {}) as any;
        const isPlanned = Boolean(
          reqPayload.allowReverseAuction ||
          reqPayload.basics?.isReverseAuctionNeeded ||
          reqPayload.rules?.allowReverseAuction
        );

        if (isPlanned) {
          const auctionConfig = reqPayload.auctionConfig || reqPayload.rules?.auctionConfig || {};
          const plannedData = {
            auctionPlanned: true,
            requirementId: reqItem.id,
            startPrice: Number(auctionConfig.startingBidPrice || reqPayload.rules?.startPrice || 0),
            minDecrementAmount: Number(auctionConfig.minimumBidDecrement || reqPayload.rules?.minimumDecrement || 0),
            autoExtensionEnabled: Boolean(auctionConfig.autoExtensionEnabled),
            extensionTriggerMinutes: auctionConfig.extensionTriggerMinutes || 5,
            extensionDurationMinutes: auctionConfig.extensionDurationMinutes || 5,
            maximumExtensions: auctionConfig.maximumExtensions || 3,
            rankVisibility: auctionConfig.rankVisibility || 'SHOW_RANK_ONLY',
            durationMinutes: auctionConfig.durationMinutes || 60,
            triggerConfiguration: auctionConfig.triggerConfiguration || {},
          };
          procurementAuctionCache.set(rawId, { data: plannedData, expiresAt: Date.now() + 30_000 });
          return apiResponse.success(res, plannedData);
        }
      }

      procurementAuctionCache.set(rawId, { data: null, expiresAt: Date.now() + 30_000 });
      return apiResponse.success(res, null, 200, 'No auction linked to this procurement');
    }

    const effective = await withEffectiveStatus(auction);
    const winnerPart = await db.auctionParticipant.findFirst({
      where: { auctionId: auction.id, currentRank: 1 },
      select: { id: true, status: true, sellerUserId: true, sellerOrgId: true, lastBidAmount: true, currentRank: true, acceptedAt: true }
    }).catch(() => null);

    if (winnerPart && String(winnerPart.status || '').toUpperCase() === 'ACCEPTED') {
      (effective as any).winnerStatus = 'ACCEPTED';
      (effective as any).isAwardAccepted = true;
      (effective as any).winnerParticipant = winnerPart;
      effective.status = 'AWARD_ACCEPTED';
    } else if (String(auction.status || auction.statusEnum || '').toUpperCase() === 'AWARD_ACCEPTED') {
      (effective as any).winnerStatus = 'ACCEPTED';
      (effective as any).isAwardAccepted = true;
    }
    const result = maskSensitive(effective);
    const isLive = String(effective.statusEnum || effective.status || '').toUpperCase() === 'LIVE';
    procurementAuctionCache.set(rawId, { data: result, expiresAt: Date.now() + (isLive ? 5_000 : 30_000) });
    return apiResponse.success(res, result);
  } catch (error: any) {
    return apiResponse.error(res, 500, error.message || 'Error looking up auction', 'AUCTION_LOOKUP_ERROR');
  }
});

router.get('/reverse-auctions/:id', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = await resolveAuctionId(req.params.id);
    if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    let auction = await db.auction.findUnique({ where: { id }, include: auctionIncludeFor(req) });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    if (!auction.auctionCode) {
      const generatedCode = nextAuctionCode();
      await db.auction.update({ where: { id: auction.id }, data: { auctionCode: generatedCode } }).catch(() => {});
      auction.auctionCode = generatedCode;
    }
    auction = await withEffectiveStatus(auction);

    const isPublic = await isAuctionPublic(auction);
    let hasJoined = false;
    let authorized = false;

    if (isPublic) {
      authorized = true;
    }

    let myParticipant = null;
    if (req.user) {
      if (isAdmin(req) || auction.createdByUserId === req.user.id || (auction.buyerOrgId && auction.buyerOrgId === req.user.organizationId)) {
        authorized = true;
      }
      if (req.user.role === 'seller' || req.user.role === 'shg') {
        const foundParticipant = await db.auctionParticipant.findFirst({
          where: {
            auctionId: id,
            OR: [
              ...(req.user.organizationId ? [{ sellerOrgId: req.user.organizationId }] : []),
              ...(req.user.id ? [{ sellerUserId: req.user.id }] : [])
            ]
          },
          include: {
            qualificationDocuments: true
          }
        });
        if (foundParticipant) {
          hasJoined = true;
          authorized = true;

          // Find seller's lowest valid bid in this auction if any
          const myBestBid = await db.auctionBid.findFirst({
            where: {
              auctionId: id,
              isValid: true,
              OR: [
                ...(req.user.organizationId ? [{ sellerOrgId: req.user.organizationId }] : []),
                ...(req.user.id ? [{ sellerId: req.user.id }] : [])
              ]
            },
            orderBy: [{ amount: 'asc' }, { submittedAt: 'asc' }]
          });

          // Resolve linked procurement participation if auction originated from a procurement
          let linkedParticipation: any = null;
          let parentBidId = auction.linkedBidId || null;
          if (!parentBidId && (auction.referenceNo || (auction.auctionConfig as any)?.parentRefNumber)) {
            const ref = auction.referenceNo || (auction.auctionConfig as any)?.parentRefNumber;
            const cleanRef = String(ref).trim();
            const foundBid = await db.procurementBid.findFirst({
              where: {
                OR: [
                  { bidNumber: cleanRef },
                  { bidNumber: cleanRef.replace(/^RA-/, 'RFQ-') },
                  { bidNumber: cleanRef.replace(/^RA-/, 'TEN-') },
                  { bidNumber: cleanRef.replace(/^RA-/, 'TND-') },
                  { bidNumber: cleanRef.replace(/^RA-/, 'RC-') }
                ]
              },
              select: { id: true }
            });
            if (foundBid) parentBidId = foundBid.id;
          }

          if (parentBidId) {
            linkedParticipation = await db.procurementBidParticipation.findFirst({
              where: {
                bidId: parentBidId,
                OR: [
                  ...(req.user.organizationId ? [{ seller: { organizationId: req.user.organizationId } }] : []),
                  ...(req.user.id ? [{ sellerId: req.user.id }] : [])
                ]
              },
              include: { documents: true }
            });
          }

          const ack = (linkedParticipation?.acknowledgement && typeof linkedParticipation.acknowledgement === 'object' && !Array.isArray(linkedParticipation.acknowledgement))
            ? linkedParticipation.acknowledgement as any
            : {};

          const quotedVal = Number(
            myBestBid?.amount ||
            myBestBid?.bidAmount ||
            foundParticipant.lastBidAmount ||
            foundParticipant.initialQuoteTotal ||
            foundParticipant.initialQuoteAmount ||
            linkedParticipation?.totalAmount ||
            linkedParticipation?.quotedAmount ||
            linkedParticipation?.offeredPrice ||
            0
          );

          const initialVal = Number(
            foundParticipant.initialQuoteTotal ||
            foundParticipant.initialQuoteAmount ||
            linkedParticipation?.totalAmount ||
            linkedParticipation?.quotedAmount ||
            quotedVal
          );

          const docs = (linkedParticipation?.documents && Array.isArray(linkedParticipation.documents) && linkedParticipation.documents.length > 0)
            ? linkedParticipation.documents
            : (Array.isArray(ack.documents) && ack.documents.length > 0)
              ? ack.documents
              : (foundParticipant.qualificationDocuments || []);

          myParticipant = {
            ...foundParticipant,
            quotedAmount: quotedVal,
            totalAmount: quotedVal,
            offeredPrice: quotedVal,
            initialQuoteAmount: initialVal,
            initialQuoteTotal: initialVal,
            lastBidAmount: foundParticipant.lastBidAmount || myBestBid?.amount || quotedVal,
            deliveryTimeline: ack.deliveryTimeline || linkedParticipation?.deliveryTimeline || null,
            paymentTerms: ack.paymentTerms || ack.terms || linkedParticipation?.paymentTerms || null,
            documents: docs,
            lineItems: (Array.isArray(ack.lineItems) && ack.lineItems.length > 0) ? ack.lineItems : [],
            acknowledgement: linkedParticipation?.acknowledgement || null,
            makeBrand: foundParticipant.makeBrand || linkedParticipation?.makeBrand || ack.makeBrand || null,
            model: foundParticipant.model || linkedParticipation?.model || ack.model || null,
          };
        }
      }
    }

    if (!authorized) {
      return apiResponse.error(res, 404, 'Auction not found', 'AUCTION_NOT_FOUND');
    }

    // Anonymize competitor bids if competitor names are hidden
    const isManagerUser = canManageAuction(req, auction);
    if ((req.user?.role === 'seller' || req.user?.role === 'shg' || !isManagerUser) && !auction.allowCompetitorNames) {
      auction.bids = (auction.bids || []).map((bid: any, idx: number) => {
        const isMe = (req.user?.organizationId && bid.sellerOrgId === req.user.organizationId) ||
                     (req.user?.id && bid.sellerId === req.user.id);
        if (isMe) return { ...bid, isMyBid: true };
        return {
          ...bid,
          sellerOrgName: `Bidder ${bid.rankAtSubmission || idx + 1}`,
          sellerOrgId: null,
          sellerId: null,
          ipAddress: null,
          deviceHash: null,
          userAgent: null,
          userAgentHash: null,
          isMyBid: false
        };
      });
    }

    let buyerOrganizationName = 'Verified Buyer';
    let buyerOrganization: any = null;
    if (auction.buyerOrgId) {
      const buyerOrg = await db.organization.findUnique({
        where: { id: auction.buyerOrgId },
        select: {
          id: true,
          organizationName: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          district: true,
          state: true,
          pincode: true,
          country: true
        }
      });
      if (buyerOrg) {
        buyerOrganizationName = buyerOrg.organizationName;
        const regAddr = [buyerOrg.addressLine1, buyerOrg.addressLine2, buyerOrg.city, buyerOrg.district, buyerOrg.state, buyerOrg.pincode].filter(Boolean).join(', ');
        buyerOrganization = {
          id: buyerOrg.id,
          organizationName: buyerOrg.organizationName,
          registeredAddress: regAddr || null,
          city: buyerOrg.city || null,
          district: buyerOrg.district || null,
          state: buyerOrg.state || null,
          pincode: buyerOrg.pincode || null
        };
      }
    }

    const linkedRequirement = await linkedRequirementSummary(auction);
    if (!buyerOrganization && linkedRequirement?.buyerOrganization) {
      buyerOrganization = linkedRequirement.buyerOrganization;
      if (linkedRequirement.buyerOrganization.organizationName) {
        buyerOrganizationName = linkedRequirement.buyerOrganization.organizationName;
      }
    }

    let auctionCategory = auction.category;
    if ((!auctionCategory || auctionCategory.toLowerCase() === 'general procurement') && linkedRequirement?.category) {
      auctionCategory = linkedRequirement.category;
      auction.category = linkedRequirement.category;
      db.auction.update({
        where: { id: auction.id },
        data: {
          category: linkedRequirement.category,
          ...(linkedRequirement.id && !auction.linkedBidId ? { linkedBidId: linkedRequirement.id } : {})
        }
      }).catch(() => {});
    }

    return apiResponse.success(res, maskSensitive({
      ...auction,
      category: (auctionCategory && auctionCategory.toLowerCase() !== 'general procurement') ? auctionCategory : (linkedRequirement?.category || null),
      isPublic,
      hasJoined,
      evaluationPending: Boolean(auction.evaluationPending),
      linkedRequirement,
      buyerOrganizationName,
      buyerOrganization,
      myParticipant
    }));
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 500, error.message || 'Unable to load auction', error.code || 'REVERSE_AUCTION_DETAIL_ERROR');
  }
});

router.get('/reverse-auctions/:id/live-summary', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = await resolveAuctionId(req.params.id);
    if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    let [auction, participant] = await Promise.all([
      db.auction.findUnique({ where: { id } }),
      req.user?.role === 'seller'
        ? db.auctionParticipant.findFirst({
            where: {
              auctionId: id,
              OR: [
                ...(req.user.organizationId ? [{ sellerOrgId: req.user.organizationId }] : []),
                ...(req.user.id ? [{ sellerUserId: req.user.id }] : [])
              ]
            }
          })
        : Promise.resolve(null)
    ]);
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    auction = await withEffectiveStatus(auction);

    const isPublic = await isAuctionPublic(auction);
    let authorized = false;

    if (isPublic) {
      authorized = true;
    }

    if (req.user) {
      if (isAdmin(req) || auction.createdByUserId === req.user.id || (auction.buyerOrgId && auction.buyerOrgId === req.user.organizationId)) {
        authorized = true;
      }
      if (participant) {
        authorized = true;
      }
    }

    if (!authorized) {
      return apiResponse.error(res, 404, 'Auction not found', 'AUCTION_NOT_FOUND');
    }

    const [activeParticipantsCount, totalParticipantsCount, totalBidsCount, myBestBidRecord] = await Promise.all([
      db.auctionParticipant.count({
        where: {
          auctionId: id,
          status: { in: ['ACCEPTED', 'TECHNICALLY_QUALIFIED', 'BID_SUBMITTED'] }
        }
      }),
      db.auctionParticipant.count({
        where: { auctionId: id }
      }),
      db.auctionBid.count({
        where: { auctionId: id, isValid: true }
      }),
      req.user?.role === 'seller' && (req.user.organizationId || req.user.id)
        ? db.auctionBid.findFirst({
            where: {
              auctionId: id,
              isValid: true,
              OR: [
                ...(req.user.organizationId ? [{ sellerOrgId: req.user.organizationId }] : []),
                ...(req.user.id ? [{ sellerId: req.user.id }] : [])
              ]
            },
            orderBy: [{ amount: 'asc' }, { submittedAt: 'asc' }]
          })
        : Promise.resolve(null)
    ]);

    const canBid = Boolean(
      participant &&
      ['TECHNICALLY_QUALIFIED', 'ACCEPTED'].includes(participant.status) &&
      !auction.evaluationPending
    );
    const disqualificationReason = participant?.disqualificationReason || participant?.rejectionReason || participant?.qualificationRemarks || null;

    const currentLow = toNumber(auction.currentLowestAmount ?? auction.currentLowestBid ?? auction.currentBid ?? auction.startPrice);
    const amountDecrement = toNumber(auction.minDecrementAmount ?? auction.minDecrement, 0);
    const percentDecrement = auction.minDecrementPercent ? currentLow * (toNumber(auction.minDecrementPercent) / 100) : 0;
    const requiredDecrement = Math.max(amountDecrement, percentDecrement);
    const calculatedNextBid = Math.max(0, currentLow - requiredDecrement);

    let liveCategory = auction.category;
    if (!liveCategory || liveCategory.toLowerCase() === 'general procurement') {
      const summary = await linkedRequirementSummary(auction);
      if (summary?.category) {
        liveCategory = summary.category;
        auction.category = summary.category;
        db.auction.update({
          where: { id: auction.id },
          data: {
            category: summary.category,
            ...(summary.id && !auction.linkedBidId ? { linkedBidId: summary.id } : {})
          }
        }).catch(() => {});
      }
    }

    return apiResponse.success(res, {
      serverTime: new Date(),
      auction: maskSensitive({
        ...auction,
        category: (liveCategory && liveCategory.toLowerCase() !== 'general procurement') ? liveCategory : null,
        isPublic,
        hasJoined: !!participant,
        evaluationPending: Boolean(auction.evaluationPending)
      }),
      participant: maskSensitive(participant ? {
        ...participant,
        quotedAmount: Number(myBestBidRecord?.amount ?? myBestBidRecord?.bidAmount ?? participant.lastBidAmount ?? participant.initialQuoteTotal ?? participant.initialQuoteAmount ?? 0),
        totalAmount: Number(myBestBidRecord?.amount ?? myBestBidRecord?.bidAmount ?? participant.lastBidAmount ?? participant.initialQuoteTotal ?? participant.initialQuoteAmount ?? 0),
        offeredPrice: Number(myBestBidRecord?.amount ?? myBestBidRecord?.bidAmount ?? participant.lastBidAmount ?? participant.initialQuoteTotal ?? participant.initialQuoteAmount ?? 0),
        initialQuoteAmount: Number(participant.initialQuoteAmount ?? participant.initialQuoteTotal ?? 0),
        initialQuoteTotal: Number(participant.initialQuoteTotal ?? participant.initialQuoteAmount ?? 0),
        canBid,
        disqualificationReason
      } : null),
      activeParticipantsCount,
      totalParticipantsCount,
      totalBidsCount,
      myBestBid: myBestBidRecord ? toNumber(myBestBidRecord.amount ?? myBestBidRecord.bidAmount) : null,
      myRank: participant?.currentRank || null,
      minimumNextBid: Number(calculatedNextBid.toFixed(2))
    });
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 500, error.message || 'Unable to load live summary', error.code || 'REVERSE_AUCTION_SUMMARY_ERROR');
  }
});

router.use('/reverse-auctions', authenticate);

router.post('/reverse-auctions', requirePermission('reverse_auction.create', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    const payload = createAuctionSchema.parse(req.body);
    const auction = await db.auction.create({
      data: {
        tenderId: payload.linkedTenderId || null,
        linkedBidId: payload.linkedBidId || null,
        linkedRequirementId: payload.linkedRequirementId || null,
        auctionCode: nextAuctionCode(),
        referenceNo: payload.linkedTenderId ? `TENDER-${payload.linkedTenderId}` : payload.linkedBidId ? `PBID-${payload.linkedBidId}` : `REQ-${payload.linkedRequirementId}`,
        title: payload.title,
        description: payload.description || null,
        procurementMethod: payload.procurementMethod,
        category: payload.category || null,
        auctionType: payload.auctionType,
        auctionMode: payload.auctionMode,
        auctionDurationMinutes: payload.durationMinutes || Math.max(1, Math.round((payload.endAt.getTime() - payload.startAt.getTime()) / 60000)),
        purchaseGroup: payload.purchaseGroup || null,
        purchaseOrganization: payload.purchaseOrganization || null,
        buyerOrgId: req.user?.organizationId || null,
        createdByUserId: req.user?.id,
        startPrice: payload.startingPrice,
        basePrice: payload.startingPrice,
        reservePrice: payload.reservePrice || null,
        currentBid: payload.startingPrice,
        currentLowestBid: null,
        currentLowestAmount: null,
        minDecrement: payload.minDecrementAmount,
        minDecrementAmount: payload.minDecrementAmount,
        minDecrementPercent: payload.minDecrementPercent || null,
        autoExtensionEnabled: payload.autoExtensionEnabled,
        autoExtensionWindowMinutes: payload.autoExtensionWindowMinutes || 5,
        autoExtensionByMinutes: payload.autoExtensionByMinutes || 5,
        maxAutoExtensions: payload.maxAutoExtensions,
        currency: payload.currency.toUpperCase(),
        rankVisibility: payload.rankVisibility,
        minimumQualifiedBidders: payload.minimumQualifiedBidders,
        termsDocumentFileId: payload.termsDocumentFileId || null,
        termsDocumentName: payload.termsDocumentName || null,
        buyerMonitorSettings: payload.buyerMonitorSettings || undefined,
        preBidStage: payload.preBidStage || undefined,
        auctionTrigger: payload.auctionTrigger || null,
        auctionConfig: {
          procurementMethod: payload.procurementMethod,
          auctionType: payload.auctionType,
          auctionMode: payload.auctionMode,
          rankVisibility: payload.rankVisibility,
          minimumQualifiedBidders: payload.minimumQualifiedBidders,
          buyerOrganization: payload.buyerOrganization || null,
          department: payload.department || null,
          qualifiedVendorCount: payload.qualifiedVendors?.length || 0
        },
        visibilityMode: payload.visibilityMode,
        allowCompetitorNames: payload.allowCompetitorNames,
        remarks: payload.remarks || null,
        startTime: payload.startAt,
        endTime: payload.endAt,
        status: 'DRAFT',
        statusEnum: 'DRAFT'
      }
    });
    if (payload.qualifiedVendors?.length) {
      await db.auctionParticipant.createMany({
        data: payload.qualifiedVendors.map(seller => ({
          auctionId: auction.id,
          sellerOrgId: seller.sellerOrgId,
          sellerUserId: seller.sellerUserId || null,
          status: payload.procurementMethod === 'BID_WITH_REVERSE_AUCTION' ? 'TECHNICALLY_QUALIFIED' : 'INVITED'
        })),
        skipDuplicates: true
      });
    }
    await writeAuctionEvent(req, auction.id, 'created', 'Reverse auction created', { auctionCode: auction.auctionCode });
    return apiResponse.created(res, maskSensitive(auction), 'Reverse auction created');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to create reverse auction', error.code || 'REVERSE_AUCTION_CREATE_ERROR');
  }
});

router.post('/reverse-auctions/start-from-bids', requirePermission('reverse_auction.create', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      procurementId: z.union([z.string(), z.number()]),
      title: z.string().trim().optional(),
      startPrice: z.coerce.number().positive().optional(),
      minDecrementAmount: z.coerce.number().positive().default(1000),
      autoExtensionWindowMinutes: z.coerce.number().int().min(1).max(120).default(5),
      autoExtensionByMinutes: z.coerce.number().int().min(1).max(120).default(5),
      maxAutoExtensions: z.coerce.number().int().min(0).max(100).default(10),
      startTime: z.coerce.date().optional(),
      endTime: z.coerce.date().optional(),
      durationMinutes: z.coerce.number().int().positive().optional(),
      selectedSellers: z.array(z.object({
        sellerOrgId: z.coerce.number().int().positive().optional(),
        sellerUserId: z.coerce.number().int().positive().optional(),
        sellerId: z.coerce.number().int().positive().optional(),
        quotedAmount: z.coerce.number().positive().optional(),
        vendorName: z.string().optional()
      })).min(1, 'At least 1 qualified vendor required to start reverse auction')
    });

    const payload = schema.parse(req.body);
    const rawId = payload.procurementId;
    const numId = Number(rawId);

    // Resolve linked procurement
    let linkedBid: any = null;
    let linkedReq: any = null;

    if (Number.isFinite(numId) && numId > 0) {
      linkedBid = await db.procurementBid.findUnique({ where: { id: numId } }).catch(() => null);
      if (!linkedBid) {
        linkedReq = await db.buyerRequirement.findUnique({ where: { id: numId } }).catch(() => null);
      }
    }

    if (!linkedBid && !linkedReq && typeof rawId === 'string') {
      linkedBid = await db.procurementBid.findFirst({ where: { bidNumber: rawId } }).catch(() => null);
      const stripped = rawId.replace(/^(RA-|PRC-|AUCTION-|TENDER-|TND-|RFQ-|RFP-|RC-|RATE-)/i, '');
      if (!linkedBid && stripped && stripped !== rawId) {
        linkedBid = await db.procurementBid.findFirst({
          where: {
            OR: [
              { bidNumber: stripped },
              { bidNumber: { contains: stripped } }
            ]
          }
        }).catch(() => null);
      }
      if (!linkedReq) {
        linkedReq = await db.requirement.findFirst({
          where: {
            OR: [
              { requirementNumber: rawId },
              ...(stripped ? [{ requirementNumber: { contains: stripped } }] : [])
            ]
          }
        }).catch(() => null);
      }
      if (!linkedReq) {
        linkedReq = await db.buyerRequirement.findFirst({
          where: {
            OR: [
              { title: { contains: rawId } },
              ...(stripped ? [{ title: { contains: stripped } }] : [])
            ]
          }
        }).catch(() => null);
      }
    }

    if (linkedBid) {
      const packetMeta = (linkedBid.technicalPacket && typeof linkedBid.technicalPacket === 'object') ? linkedBid.technicalPacket as any : {};
      const isTwoPacket = String(linkedBid.packetType || packetMeta.packetType || packetMeta.schedule?.packetType || '').toUpperCase().includes('TWO') || Boolean(linkedBid.financialOpeningDate || packetMeta.financialOpeningDate || packetMeta.schedule?.financialOpeningDate);

      if (isTwoPacket) {
        // 1. Stage 1 Technical Evaluation must be completed
        const isTechComplete = [
          'TECHNICAL_EVALUATION_COMPLETED',
          'FINANCIAL_EVALUATION',
          'L1_GENERATED',
          'AWARD_RECOMMENDED',
          'AWARDED',
          'PO_GENERATED',
          'COMPLETED'
        ].includes(String(linkedBid.status || '').toUpperCase()) ||
        [
          'TECHNICAL_EVALUATION_COMPLETED',
          'FINANCIAL_EVALUATION',
          'L1_GENERATED',
          'AWARD_RECOMMENDED',
          'AWARDED',
          'PO_GENERATED',
          'COMPLETED'
        ].includes(String(linkedBid.lifecycleStage || '').toUpperCase());

        if (!isTechComplete) {
          return res.status(400).json({
            success: false,
            error: 'Stage 1 Technical Evaluation must be fully completed before launching Stage 2 Reverse Auction.',
            code: 'STAGE_1_NOT_COMPLETED'
          });
        }

        // 2. Financial Opening Date check
        const finOpenCandidate = linkedBid.financialOpeningDate || packetMeta.financialOpeningDate || packetMeta.schedule?.financialOpeningDate || packetMeta.financialEvaluationDate;
        if (finOpenCandidate) {
          const finOpenTime = new Date(finOpenCandidate).getTime();
          if (!isNaN(finOpenTime) && finOpenTime > Date.now()) {
            return res.status(400).json({
              success: false,
              error: `Stage 2 Reverse Auction cannot be initiated before the scheduled financial opening date and time (${new Date(finOpenCandidate).toLocaleString('en-IN')}).`,
              code: 'FINANCIAL_OPENING_NOT_REACHED'
            });
          }
        }

        // 3. Minimum 2 qualified participants required for competitive reverse auction
        if (payload.selectedSellers.length < 2) {
          return res.status(400).json({
            success: false,
            error: 'Stage 2 Reverse Auction requires at least 2 technically qualified sellers for competitive bidding.',
            code: 'INSUFFICIENT_QUALIFIED_SELLERS'
          });
        }
      }
    }

    const parentRef = linkedBid?.bidNumber || linkedReq?.requirementNumber || (Number.isFinite(numId) ? `RC-${numId}` : String(rawId));
    const parentBaseTitle = linkedBid?.title || linkedReq?.title || 'Procurement';
    const procurementTitle = payload.title
      || `${parentBaseTitle} (${parentRef}) — Reverse Auction`;

    // Calculate baseline quote
    const validQuotes = payload.selectedSellers
      .map(s => Number(s.quotedAmount))
      .filter(q => Number.isFinite(q) && q > 0);

    const lowestQuote = validQuotes.length ? Math.min(...validQuotes) : 0;
    const startPrice = payload.startPrice || lowestQuote || Number(linkedBid?.estimatedValue || linkedReq?.budgetMax || 100000);
    const currentLowestAmount = lowestQuote > 0 && lowestQuote <= startPrice ? lowestQuote : startPrice;

    const startAt = payload.startTime ? new Date(payload.startTime) : new Date();
    const duration = payload.durationMinutes || 60;
    const endAt = payload.endTime ? new Date(payload.endTime) : new Date(startAt.getTime() + duration * 60000);
    const isLiveImmediately = startAt <= new Date();

    const effectiveLinkedBidId = linkedBid?.id || (Number.isFinite(numId) && numId > 0 ? numId : null);

    const auction = await db.auction.create({
      data: {
        auctionCode: nextAuctionCode(),
        referenceNo: parentRef,
        linkedBidId: effectiveLinkedBidId,
        linkedRequirementId: linkedReq?.id || null,
        title: procurementTitle,
        description: linkedBid?.description || linkedReq?.description || `Dynamic Reverse Auction event initiated for ${parentRef}.`,
        procurementMethod: 'REVERSE_AUCTION',
        category: (() => {
          const packet = (linkedBid?.technicalPacket && typeof linkedBid.technicalPacket === 'object') ? linkedBid.technicalPacket as any : {};
          const cat = linkedBid?.category ||
            packet.basics?.category ||
            packet.category ||
            packet.wizardData?.basics?.category ||
            linkedReq?.category?.name ||
            linkedReq?.category ||
            (linkedReq?.payload as any)?.basics?.category ||
            null;
          return (cat && String(cat).toLowerCase() !== 'general procurement') ? String(cat) : null;
        })(),
        startPrice: Number(startPrice),
        basePrice: startPrice,
        currentBid: Number(currentLowestAmount),
        currentLowestBid: currentLowestAmount,
        currentLowestAmount,
        minDecrement: Number(payload.minDecrementAmount),
        minDecrementAmount: payload.minDecrementAmount,
        autoExtensionEnabled: true,
        autoExtensionWindowMinutes: payload.autoExtensionWindowMinutes,
        autoExtensionByMinutes: payload.autoExtensionByMinutes,
        maxAutoExtensions: payload.maxAutoExtensions,
        currency: 'INR',
        rankVisibility: 'SHOW_LOWEST_PRICE',
        minimumQualifiedBidders: payload.selectedSellers.length,
        buyerOrgId: req.user?.organizationId || linkedBid?.buyerOrganizationId || null,
        createdByUserId: req.user?.id,
        startTime: startAt,
        endTime: endAt,
        actualStartedAt: isLiveImmediately ? new Date() : null,
        status: isLiveImmediately ? 'LIVE' : 'SCHEDULED',
        statusEnum: isLiveImmediately ? 'LIVE' : 'SCHEDULED',
        auctionConfig: {
          startedFromBids: true,
          initialLowestQuote: lowestQuote,
          enrolledCount: payload.selectedSellers.length,
          parentRefNumber: parentRef,
          parentProcurementId: rawId,
          parentTitle: parentBaseTitle
        }
      }
    });

    // Enroll participants with their quotes and assign initial ranks
    const sortedVendors = [...payload.selectedSellers].sort((a, b) => (Number(a.quotedAmount) || Infinity) - (Number(b.quotedAmount) || Infinity));

    const participantRecords: any[] = [];
    for (let i = 0; i < sortedVendors.length; i++) {
      const vendor = sortedVendors[i];
      const rank = i + 1;
      const amount = Number(vendor.quotedAmount) || startPrice;
      const sellerUserId = vendor.sellerUserId || vendor.sellerId || null;
      let sellerOrgId = vendor.sellerOrgId || null;

      if (!sellerOrgId && sellerUserId) {
        const u = await db.user.findUnique({ where: { id: sellerUserId }, select: { organizationId: true } }).catch(() => null);
        if (u?.organizationId) sellerOrgId = u.organizationId;
      }

      if (!sellerOrgId) {
        sellerOrgId = sellerUserId || 1;
      }

      let bpMatch: any = null;
      if (linkedBid?.id) {
        bpMatch = await db.procurementBidParticipation.findFirst({
          where: {
            bidId: linkedBid.id,
            OR: [
              ...(sellerUserId ? [{ sellerId: sellerUserId }] : []),
              ...(sellerOrgId ? [{ seller: { organizationId: sellerOrgId } }] : [])
            ]
          }
        }).catch(() => null);
      }
      const vendorAny = vendor as any;
      const mb = vendorAny.makeBrand || bpMatch?.makeBrand || (bpMatch?.acknowledgement as any)?.makeBrand || (bpMatch?.acknowledgement as any)?.lineItems?.[0]?.makeBrand || null;
      const mod = vendorAny.model || bpMatch?.model || (bpMatch?.acknowledgement as any)?.model || (bpMatch?.acknowledgement as any)?.lineItems?.[0]?.model || null;
      const gst = Number(vendorAny.gstPercentage || vendorAny.gstPercent || bpMatch?.gstPercentage || (bpMatch?.acknowledgement as any)?.lineItems?.[0]?.gstPercent || 0) || null;
      const initialAmount = Number(vendorAny.quotedAmount || bpMatch?.quotedAmount || amount);

      const part = await db.auctionParticipant.create({
        data: {
          auctionId: auction.id,
          sellerOrgId,
          sellerUserId,
          status: 'TECHNICALLY_QUALIFIED',
          qualificationStatus: 'APPROVED',
          qualifiedAt: new Date(),
          currentRank: rank,
          lastBidAmount: amount,
          initialQuoteTotal: amount,
          initialQuoteAmount: initialAmount,
          initialQuoteGstPercent: gst,
          makeBrand: mb,
          model: mod
        }
      });
      participantRecords.push(part);

      // Record baseline bid
      await db.auctionBid.create({
        data: {
          auctionId: auction.id,
          sellerId: sellerUserId || 0,
          sellerOrgId,
          participantId: part.id,
          amount,
          bidAmount: amount,
          rankAtSubmission: rank,
          isValid: true
        }
      }).catch(() => null);
    }

    // Update winner pointer to L1
    if (participantRecords.length > 0) {
      await db.auction.update({
        where: { id: auction.id },
        data: {
          currentWinnerId: participantRecords[0].sellerUserId || null
        }
      });
    }

    // Advance linked procurementBid lifecycle stage & status, and ensure allowReverseAuction is permanently flagged
    if (linkedBid) {
      await db.procurementBid.update({
        where: { id: linkedBid.id },
        data: {
          status: 'REVERSE_AUCTION_ACTIVE',
          lifecycleStage: 'REVERSE_AUCTION_ACTIVE',
          allowReverseAuction: true
        }
      }).catch(() => null);
    }
    if (linkedReq) {
      await db.buyerRequirement.update({
        where: { id: linkedReq.id },
        data: {
          status: 'REVERSE_AUCTION_ACTIVE'
        }
      }).catch(() => null);
    }

    // Invalidate caches so seller and buyer views update immediately
    invalidateProcurementAuctionCache(rawId);
    if (parentRef) invalidateProcurementAuctionCache(parentRef);
    if (linkedBid?.id) invalidateProcurementAuctionCache(linkedBid.id);
    if (linkedReq?.id) invalidateProcurementAuctionCache(linkedReq.id);

    // Write audit event
    await writeAuctionEvent(req, auction.id, 'started_from_bids', 'Reverse auction initiated post-evaluation from submitted quotations', {
      auctionCode: auction.auctionCode,
      procurementId: rawId,
      parentRefNumber: parentRef,
      vendorsCount: participantRecords.length,
      openingL1: currentLowestAmount
    });

    // Notify all enrolled sellers with email and in-app alert
    for (const part of participantRecords) {
      const sellerId = part.sellerUserId;
      if (sellerId) {
        notificationService.notifyWithEmail(sellerId, {
          title: '🔥 Live Reverse Auction Floor Opened!',
          message: `The buyer has initiated a live Reverse Auction for "${procurementTitle}". Opening benchmark: ₹${currentLowestAmount.toLocaleString('en-IN')}. Enter the live room now to submit your lower bids.`,
          type: 'REVERSE_AUCTION_STARTED',
          priority: 'high',
          redirectUrl: `/seller/procurement/reverse-auction/${auction.auctionCode || auction.id}/live`,
          emailSubject: `[Action Required] Live Reverse Auction Floor Opened: ${auction.auctionCode || ('RA-' + auction.id)}`,
          emailHtml: `
            <div style="padding: 18px 20px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; margin-bottom: 20px;">
              <p style="margin: 0 0 6px; color: #1d4ed8; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Reverse Auction Floor Open</p>
              <h2 style="margin: 0; color: #1e3a8a; font-size: 20px; line-height: 1.3;">🔥 Reverse Auction #${auction.auctionCode || auction.id} is Live</h2>
            </div>
            <p style="margin: 0 0 16px; color: #334155; font-size: 15px; line-height: 1.6;">
              A dynamic Reverse Auction has been initiated for <strong>${procurementTitle}</strong>. All qualified participants can now enter the live floor and place counter-bids.
            </p>
            <table role="presentation" style="width: 100%; margin: 0 0 22px; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <tr style="background: #f8fafc;">
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 700; width: 40%;">Auction Code</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 800;">${auction.auctionCode || `RA-${auction.id}`}</td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 12px; font-weight: 700;">Opening Ceiling Benchmark</td>
                <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #059669; font-size: 14px; font-weight: 800;">₹${currentLowestAmount.toLocaleString('en-IN')}</td>
              </tr>
            </table>
          `
        }).catch(err => logger.warn({ err, sellerId }, '[START_AUCTION] Failed to notify seller'));
      }
    }

    // Broadcast realtime WebSocket events
    try {
      broadcastToAuction(auction.id, {
        type: 'REVERSE_AUCTION_UPDATED',
        auctionId: auction.id,
        status: String(auction.status),
        timestamp: new Date().toISOString()
      });
      if (linkedBid) {
        broadcastToProcurement(linkedBid.id, {
          type: 'PROCUREMENT_UPDATED',
          requirementId: linkedBid.id,
          procurementId: linkedBid.id,
          status: 'REVERSE_AUCTION_ACTIVE',
          timestamp: new Date().toISOString()
        });
      }
    } catch (wsErr) {
      logger.warn({ wsErr }, '[START_AUCTION] Realtime broadcast error');
    }

    return apiResponse.created(res, maskSensitive(auction), 'Reverse auction started from submitted quotes');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to start reverse auction from bids', error.code || 'REVERSE_AUCTION_START_ERROR');
  }
});

const enrichAuctions = async (auctions: any[]) => {
  if (!auctions || auctions.length === 0) return auctions;

  const buyerOrgIds = Array.from(new Set(auctions.map((a: any) => a.buyerOrgId).filter((id: any) => typeof id === 'number' && id > 0)));
  const creatorUserIds = Array.from(new Set(auctions.map((a: any) => a.createdByUserId).filter((id: any) => typeof id === 'number' && id > 0)));
  const linkedReqIds = Array.from(new Set(auctions.map((a: any) => a.linkedRequirementId).filter((id: any) => typeof id === 'number' && id > 0)));
  const linkedBidIds = Array.from(new Set(auctions.map((a: any) => a.linkedBidId).filter((id: any) => typeof id === 'number' && id > 0)));

  const [orgs, creators, reqItems, bidItems] = await Promise.all([
    buyerOrgIds.length > 0 ? db.organization.findMany({
      where: { id: { in: buyerOrgIds } },
      select: { id: true, organizationName: true, addressLine1: true, addressLine2: true, city: true, district: true, state: true, pincode: true }
    }).catch((err: any) => { logger.warn({ err }, '[enrichAuctions] org fetch failed'); return []; }) : [],
    creatorUserIds.length > 0 ? db.user.findMany({
      where: { id: { in: creatorUserIds } },
      select: { id: true, name: true, organizationId: true, organization: { select: { id: true, organizationName: true, district: true, state: true } } }
    }).catch((err: any) => { logger.warn({ err }, '[enrichAuctions] creator fetch failed'); return []; }) : [],
    linkedReqIds.length > 0 ? db.requirement.findMany({
      where: { id: { in: linkedReqIds } },
      select: {
        id: true,
        requirementNumber: true,
        title: true,
        payload: true,
        organization: { select: { id: true, organizationName: true, district: true, state: true } },
        buyer: { select: { id: true, name: true } }
      }
    }).catch((err: any) => { logger.warn({ err }, '[enrichAuctions] requirement fetch failed'); return []; }) : [],
    linkedBidIds.length > 0 ? db.procurementBid.findMany({
      where: { id: { in: linkedBidIds } },
      select: {
        id: true,
        bidNumber: true,
        title: true,
        deliveryLocation: true,
        district: true,
        state: true,
        buyerOrganizationName: true,
        buyer: { select: { id: true, name: true } },
        buyerOrganization: { select: { id: true, organizationName: true, district: true, state: true } }
      }
    }).catch((err: any) => { logger.warn({ err }, '[enrichAuctions] bid fetch failed'); return []; }) : []
  ]);

  const orgMap = new Map<number, any>(orgs.map((o: any) => [o.id, o]));
  const creatorMap = new Map<number, any>(creators.map((c: any) => [c.id, c]));
  const reqMap = new Map<number, any>(reqItems.map((r: any) => [r.id, r]));
  const bidMap = new Map<number, any>(bidItems.map((b: any) => [b.id, b]));

  return auctions.map((auction: any) => {
    const org = auction.buyerOrgId ? orgMap.get(auction.buyerOrgId) : null;
    const creator = auction.createdByUserId ? creatorMap.get(auction.createdByUserId) : null;
    const reqItem = auction.linkedRequirementId ? reqMap.get(auction.linkedRequirementId) : null;
    const bidItem = auction.linkedBidId ? bidMap.get(auction.linkedBidId) : null;
    const reqPayload = (reqItem?.payload || {}) as any;

    const buyerOrgName = org?.organizationName
      || bidItem?.buyerOrganizationName
      || bidItem?.buyerOrganization?.organizationName
      || reqItem?.organization?.organizationName
      || creator?.organization?.organizationName
      || null;

    const buyerName = creator?.name
      || bidItem?.buyer?.name
      || reqItem?.buyer?.name
      || buyerOrgName
      || null;

    const district = reqPayload?.deliveryDistrict
      || reqPayload?.district
      || bidItem?.district
      || bidItem?.buyerOrganization?.district
      || org?.district
      || creator?.organization?.district
      || reqItem?.organization?.district
      || null;

    const state = reqPayload?.deliveryState
      || reqPayload?.state
      || bidItem?.state
      || bidItem?.buyerOrganization?.state
      || org?.state
      || creator?.organization?.state
      || reqItem?.organization?.state
      || null;

    const deliveryLocation = reqPayload?.deliveryLocation
      || reqPayload?.deliveryAddress
      || bidItem?.deliveryLocation
      || (district && state ? `${district}, ${state}` : district || state || null);

    const buyerOrganization = org || creator?.organization || reqItem?.organization || bidItem?.buyerOrganization || null;

    return {
      ...auction,
      buyerOrgName: buyerOrgName || auction.buyerOrgName || 'Verified Buyer',
      buyerOrganizationName: buyerOrgName || auction.buyerOrganizationName || 'Verified Buyer',
      buyerName: buyerName || auction.buyerName || buyerOrgName || 'Verified Buyer',
      district: district || auction.district || null,
      state: state || auction.state || null,
      deliveryLocation: deliveryLocation || auction.deliveryLocation || null,
      location: deliveryLocation || auction.location || null,
      buyerOrganization: buyerOrganization || auction.buyerOrganization || null
    };
  });
};

router.get('/reverse-auctions', requirePermission('reverse_auction.view', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize || 20)));
    const status = req.query.status ? String(req.query.status) : undefined;
    const where: any = status ? { status } : {};
    if (req.user?.role === 'seller' || req.user?.role === 'shg') {
      where.participants = undefined;
      const orConditions: any[] = [];
      if (req.user.organizationId) {
        orConditions.push({ sellerOrgId: req.user.organizationId });
      }
      if (req.user.id) {
        orConditions.push({ sellerUserId: req.user.id });
      }
      const participantRows = orConditions.length > 0 ? await db.auctionParticipant.findMany({
        where: { OR: orConditions },
        select: { auctionId: true }
      }).catch(() => []) : [];
      const participatingAuctionIds = participantRows.map((row: any) => row.auctionId);

      const sellerOrList: any[] = [];
      if (participatingAuctionIds.length > 0) {
        sellerOrList.push({ id: { in: participatingAuctionIds } });
      }
      sellerOrList.push({
        visibilityMode: 'TECHNICALLY_QUALIFIED_ONLY',
        status: { in: ['scheduled', 'live', 'open', 'paused', 'completed', 'active', 'SCHEDULED', 'LIVE', 'OPEN', 'PAUSED', 'COMPLETED', 'ACTIVE'] }
      });
      where.OR = sellerOrList;
    } else if (!isAdmin(req)) {
      where.OR = [{ createdByUserId: req.user?.id }, { buyerOrgId: req.user?.organizationId || -1 }];
    }
    const [auctions, total] = await Promise.all([
      db.auction.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      db.auction.count({ where })
    ]);
    const withStatuses = await Promise.all(auctions.map((auction: any) => withEffectiveStatus(auction)));
    const enriched = await enrichAuctions(withStatuses);
    return apiResponse.success(res, { auctions: maskSensitive(enriched), total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (error: any) {
    logger.error({ error, stack: error?.stack }, '[REVERSE_AUCTION_LIST_ERROR] Unable to load reverse auctions');
    return apiResponse.error(res, 500, 'Unable to load reverse auctions', 'REVERSE_AUCTION_LIST_ERROR');
  }
});



router.patch('/reverse-auctions/:id', requirePermission('reverse_auction.update', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    const id = await resolveAuctionId(req.params.id);
    if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const current = await db.auction.findUnique({ where: { id } });
    if (!current) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    assertAuctionManager(req, current);
    if (!['DRAFT', 'SCHEDULED', 'PAUSED'].includes(String(current.status))) {
      throw new ApiError(409, 'Only draft, scheduled, or paused auctions can be edited', 'AUCTION_NOT_EDITABLE');
    }
    const payload = updateAuctionSchema.parse(req.body);
    const updated = await db.auction.update({
      where: { id },
      data: {
        title: payload.title,
        description: payload.description,
        procurementMethod: payload.procurementMethod,
        category: payload.category,
        auctionType: payload.auctionType,
        auctionMode: payload.auctionMode,
        auctionDurationMinutes: payload.durationMinutes,
        purchaseGroup: payload.purchaseGroup,
        purchaseOrganization: payload.purchaseOrganization,
        currency: payload.currency?.toUpperCase(),
        startTime: payload.startAt,
        endTime: payload.endAt,
        startPrice: payload.startingPrice,
        basePrice: payload.startingPrice,
        reservePrice: payload.reservePrice,
        minDecrement: payload.minDecrementAmount,
        minDecrementAmount: payload.minDecrementAmount,
        minDecrementPercent: payload.minDecrementPercent,
        autoExtensionEnabled: payload.autoExtensionEnabled,
        autoExtensionWindowMinutes: payload.autoExtensionWindowMinutes,
        autoExtensionByMinutes: payload.autoExtensionByMinutes,
        maxAutoExtensions: payload.maxAutoExtensions,
        rankVisibility: payload.rankVisibility,
        minimumQualifiedBidders: payload.minimumQualifiedBidders,
        termsDocumentFileId: payload.termsDocumentFileId,
        termsDocumentName: payload.termsDocumentName,
        buyerMonitorSettings: payload.buyerMonitorSettings,
        preBidStage: payload.preBidStage,
        auctionTrigger: payload.auctionTrigger,
        auctionConfig: payload.procurementMethod ? {
          procurementMethod: payload.procurementMethod,
          auctionType: payload.auctionType,
          auctionMode: payload.auctionMode,
          rankVisibility: payload.rankVisibility,
          minimumQualifiedBidders: payload.minimumQualifiedBidders
        } : undefined,
        visibilityMode: payload.visibilityMode,
        allowCompetitorNames: payload.allowCompetitorNames,
        remarks: payload.remarks
      }
    });
    await writeAuctionEvent(req, id, 'updated', 'Reverse auction updated', payload);
    return apiResponse.success(res, maskSensitive(updated), 200, 'Reverse auction updated');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to update auction', error.code || 'REVERSE_AUCTION_UPDATE_ERROR');
  }
});

// Before an auction can go LIVE, enough sellers must have cleared the pre-bid
// qualification stage — otherwise the auction opens with no eligible bidders.
const assertEnoughQualifiedBidders = async (auction: any) => {
  const isPublic = await isAuctionPublic(auction);
  const qualified = await db.auctionParticipant.count({
    where: {
      auctionId: auction.id,
      status: { in: ['TECHNICALLY_QUALIFIED', 'ACCEPTED', 'ONLINE'] }
    }
  });
  const minimum = Math.max(isPublic ? 2 : 1, Number(auction.minimumQualifiedBidders) || 2);
  if (qualified < minimum) {
    throw new ApiError(422, `At least ${minimum} qualified bidder(s) are required before the auction can go live (currently ${qualified}).`, 'AUCTION_INSUFFICIENT_QUALIFIED');
  }
};

/**
 * Ensures Limited Reverse Auctions have enough invited/confirmed suppliers before scheduling.
 * Open auctions are exempt because participants register publicly.
 */
const assertEnoughScheduledParticipants = async (auction: any) => {
  const isPublic = await isAuctionPublic(auction);
  if (isPublic) return; // Public/Open auction requires no invited suppliers upfront

  const invitedCount = await db.auctionParticipant.count({
    where: {
      auctionId: auction.id,
      status: { in: ['INVITED', 'ACCEPTED', 'CONFIRMED', 'TECHNICALLY_QUALIFIED'] },
    },
  });

  const minimum = Math.max(2, Number(auction.minimumQualifiedBidders) || 2);
  if (invitedCount < minimum) {
    throw new ApiError(
      422,
      `Limited reverse auction requires at least ${minimum} invited supplier(s) before scheduling (currently ${invitedCount}).`,
      'AUCTION_INSUFFICIENT_PARTICIPANTS'
    );
  }
};

const transition = (target: string, enumStatus: string, extra?: (req: AuthRequest, auction?: any) => Record<string, unknown>, guard?: (auction: any) => Promise<void>) =>
  async (req: AuthRequest, res: Response) => {
    try {
      const id = await resolveAuctionId(req.params.id);
      if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
      const auction = await db.auction.findUnique({ where: { id } });
      if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
      assertAuctionManager(req, auction);
      const current = String(auction.status || 'DRAFT').toUpperCase();
      if (['CLOSED', 'CANCELLED'].includes(current)) {
        throw new ApiError(400, 'Cannot transition an auction that is closed or cancelled', 'AUCTION_ALREADY_FINALIZED');
      }
      if (guard) await guard(auction);
      const data = { status: target, statusEnum: enumStatus, ...(extra ? extra(req, auction) : {}) };
      const updated = await db.auction.update({ where: { id }, data });
      await writeAuctionEvent(req, id, target.toLowerCase(), `Auction moved to ${target}`, data);
      try {
        broadcastToAuction(id, {
          type: 'REVERSE_AUCTION_STATUS_CHANGED',
          auctionId: id,
          status: target,
          timestamp: new Date().toISOString()
        });
        broadcastToAuction(id, {
          type: 'REVERSE_AUCTION_UPDATED',
          auctionId: id,
          status: target,
          timestamp: new Date().toISOString()
        });
      } catch (bcErr) {
        logger.warn({ bcErr }, '[ReverseAuction] Failed to broadcast auction update');
      }
      if (auction.linkedBidId && ['CLOSED', 'COMPLETED'].includes(target)) {
        await db.procurementBid.update({
          where: { id: auction.linkedBidId },
          data: {
            status: 'L1_GENERATED',
            lifecycleStage: 'L1_GENERATED'
          }
        }).catch(() => null);

        if (updated.currentWinnerId && updated.currentLowestAmount) {
          const finalAmount = Number(updated.currentLowestAmount);
          await db.procurementBidParticipation.updateMany({
            where: {
              bidId: auction.linkedBidId,
              sellerId: updated.currentWinnerId
            },
            data: {
              quotedAmount: finalAmount,
              totalAmount: finalAmount,
              rank: 1,
              finalStatus: 'L1'
            }
          }).catch(() => null);
        }
      }
      return apiResponse.success(res, maskSensitive(updated));
    } catch (error: any) {
      return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to update auction status', error.code || 'REVERSE_AUCTION_STATUS_ERROR');
    }
  };

router.post('/reverse-auctions/:id/schedule', requirePermission('reverse_auction.publish', orgScope), transition('SCHEDULED', 'SCHEDULED', undefined, assertEnoughScheduledParticipants));
router.post('/reverse-auctions/:id/start', requirePermission('reverse_auction.publish', orgScope), transition('LIVE', 'LIVE', (req, auction) => {
  const now = new Date();
  let endTime = auction?.endTime;
  const currentEnd = auction?.endTime ? new Date(auction.endTime).getTime() : 0;
  // If the auction was delayed past scheduled end time or less than 10 mins remain, preserve full duration
  if (!currentEnd || currentEnd <= now.getTime() + (10 * 60_000)) {
    const durationMinutes = Number(auction?.durationMinutes) || (auction?.startTime && auction?.endTime ? Math.round((new Date(auction.endTime).getTime() - new Date(auction.startTime).getTime()) / 60000) : 60);
    endTime = new Date(now.getTime() + Math.max(15, durationMinutes) * 60_000);
  }
  return { actualStartedAt: now, startTime: now, endTime };
}, assertEnoughQualifiedBidders));
router.post('/reverse-auctions/:id/pause', requirePermission('reverse_auction.update', orgScope), transition('PAUSED', 'PAUSED'));
router.post('/reverse-auctions/:id/resume', requirePermission('reverse_auction.publish', orgScope), transition('LIVE', 'LIVE'));
router.post('/reverse-auctions/:id/close', requirePermission('reverse_auction.close', orgScope), transition('CLOSED', 'CLOSED', () => ({ actualClosedAt: new Date() })));
router.post('/reverse-auctions/:id/cancel', requirePermission('reverse_auction.close', orgScope), async (req: AuthRequest, res: Response) => {
  req.body = { ...req.body, reason: cancelSchema.parse(req.body).reason };
  return transition('CANCELLED', 'CANCELLED', request => ({ cancellationReason: request.body.reason, actualClosedAt: new Date() }))(req, res);
});

router.post('/reverse-auctions/:id/invite-sellers', requirePermission('reverse_auction.invite_seller', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    const id = await resolveAuctionId(req.params.id);
    if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const auction = await db.auction.findUnique({ where: { id } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    assertAuctionManager(req, auction);
    const payload = inviteSchema.parse(req.body);
    const rows = [];
    for (const seller of payload.sellers) {
      rows.push(await db.auctionParticipant.upsert({
        where: { auctionId_sellerOrgId: { auctionId: id, sellerOrgId: seller.sellerOrgId } },
        update: { sellerUserId: seller.sellerUserId || undefined, status: 'INVITED' },
        create: { auctionId: id, sellerOrgId: seller.sellerOrgId, sellerUserId: seller.sellerUserId || null, status: 'INVITED' }
      }));
    }
    await writeAuctionEvent(req, id, 'sellers_invited', 'Sellers invited to reverse auction', { count: rows.length });

    // Notify each invited seller — in-app + email. Fire-and-forget so a mail/SMTP
    // failure never blocks the invite response.
    void (async () => {
      const auctionTitle = auction.title || auction.auctionCode || `Reverse Auction #${id}`;
      const endsAt = auction.endTime ? formatIstDateTime(auction.endTime) : null;
      const redirectUrl = `/reverse-auctions/${id}`;
      for (const seller of payload.sellers) {
        // Prefer the explicitly named user; otherwise notify every user in the seller org.
        const targets = seller.sellerUserId
          ? [{ id: seller.sellerUserId }]
          : await db.user.findMany({ where: { organizationId: seller.sellerOrgId }, select: { id: true } });
        for (const u of targets) {
          await notificationService.notifyWithEmail(u.id, {
            title: 'Reverse Auction Invitation',
            message: `You have been invited to participate in the reverse auction "${auctionTitle}".${endsAt ? ` Bidding closes ${endsAt}.` : ''} Open the portal to review the terms and place your bids.`,
            type: 'reverse_auction_invite',
            priority: 'high',
            redirectUrl,
            emailSubject: `Reverse Auction Invitation — ${auctionTitle}`,
            emailHtml: `<p>Your organization has been invited to a reverse auction on the MSME Procurement Portal.</p>
<p><strong>Auction:</strong> ${auctionTitle}</p>
${endsAt ? `<p><strong>Bidding closes:</strong> ${endsAt}</p>` : ''}
<p>Log in to review the auction terms, accept the invitation, and submit your competitive bids.</p>`
          });
        }
      }
    })().catch(err => logger.warn({ err, auctionId: id }, 'Failed to notify invited sellers'));

    return apiResponse.success(res, { participants: maskSensitive(rows) }, 200, 'Sellers invited');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to invite sellers', error.code || 'REVERSE_AUCTION_INVITE_ERROR');
  }
});

router.get('/reverse-auctions/:id/participants', requirePermission('reverse_auction.view', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    const id = await resolveAuctionId(req.params.id);
    if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const auction = await db.auction.findUnique({ where: { id } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const isManager = canManageAuction(req, auction);
    let myParticipant = null;
    if (req.user) {
      myParticipant = await db.auctionParticipant.findFirst({
        where: {
          auctionId: id,
          OR: [
            ...(req.user.organizationId ? [{ sellerOrgId: req.user.organizationId }] : []),
            ...(req.user.id ? [{ sellerUserId: req.user.id }] : [])
          ]
        }
      });
    }
    const isPublic = await isAuctionPublic(auction);
    if (!isManager && !myParticipant && !isPublic && !isAdmin(req)) {
      throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    }

    let participants = await db.auctionParticipant.findMany({
      where: { auctionId: id },
      include: {
        qualificationDocuments: true
      },
      orderBy: [{ currentRank: 'asc' }, { invitedAt: 'asc' }]
    });

    // If no explicit participant records exist but valid bids were placed, derive participants from bids
    if (participants.length === 0) {
      const bids = await db.auctionBid.findMany({
        where: { auctionId: id, isValid: true },
        orderBy: [{ amount: 'asc' }, { submittedAt: 'asc' }]
      });
      if (bids.length > 0) {
        const vendorBidMap = new Map<string, any>();
        for (const b of bids) {
          const key = String(b.sellerOrgId || b.sellerId || 'unknown');
          if (!vendorBidMap.has(key)) {
            vendorBidMap.set(key, b);
          } else {
            const cur = vendorBidMap.get(key);
            if (Number(b.amount) < Number(cur.amount)) {
              vendorBidMap.set(key, b);
            }
          }
        }
        const distinctBids = Array.from(vendorBidMap.values()).sort((a, b) => Number(a.amount || 0) - Number(b.amount || 0));
        participants = distinctBids.map((b, idx) => ({
          id: b.id,
          auctionId: id,
          sellerOrgId: b.sellerOrgId || null,
          sellerUserId: b.sellerId || null,
          status: 'TECHNICALLY_QUALIFIED',
          qualificationStatus: 'APPROVED',
          currentRank: idx + 1,
          lastBidAmount: b.amount || b.bidAmount,
          initialQuoteAmount: b.amount || b.bidAmount,
          initialQuoteTotal: b.amount || b.bidAmount,
          qualificationDocuments: []
        }));
      }
    }

    const orgIds = Array.from(new Set(participants.map((p: any) => p.sellerOrgId).filter(Boolean)));
    const orgs = await db.organization.findMany({
      where: { id: { in: orgIds as number[] } },
      select: { id: true, organizationName: true, legalBusinessName: true }
    });
    const orgMap = new Map(orgs.map((o: any) => [o.id, o.organizationName || o.legalBusinessName]));

    const userIds = Array.from(new Set(participants.map((p: any) => p.sellerUserId).filter(Boolean)));
    const users = userIds.length ? await db.user.findMany({
      where: { id: { in: userIds as number[] } },
      select: { id: true, name: true, email: true, mobile: true, organizationId: true }
    }) : [];
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    // Resolve linked procurement bid if present to retrieve authentic Stage 1 proposals, line items, and contacts
    let parentBidId = auction.linkedBidId || null;
    if (!parentBidId && (auction.referenceNo || (auction.auctionConfig as any)?.parentRefNumber)) {
      const ref = auction.referenceNo || (auction.auctionConfig as any)?.parentRefNumber;
      const cleanRef = String(ref).trim();
      const foundBid = await db.procurementBid.findFirst({
        where: {
          OR: [
            { bidNumber: cleanRef },
            { bidNumber: cleanRef.replace(/^RA-/, 'RFQ-') },
            { bidNumber: cleanRef.replace(/^RA-/, 'TEN-') },
            { bidNumber: cleanRef.replace(/^RA-/, 'TND-') },
            { bidNumber: cleanRef.replace(/^RA-/, 'RC-') }
          ]
        },
        select: { id: true }
      });
      if (foundBid) parentBidId = foundBid.id;
    }

    const bidParticipations = parentBidId
      ? await db.procurementBidParticipation.findMany({
          where: { bidId: parentBidId },
          include: {
            seller: {
              select: {
                id: true,
                name: true,
                email: true,
                mobile: true,
                organizationId: true,
                organization: {
                  select: { id: true, organizationName: true, legalBusinessName: true }
                }
              }
            },
            documents: true
          }
        })
      : [];

    const showAllNames = isManager || Boolean(auction.allowCompetitorNames);
    const mappedParticipants = participants.map((p: any, index: number) => {
      const isMe = (req.user?.organizationId && p.sellerOrgId === req.user.organizationId) ||
                   (req.user?.id && p.sellerUserId === req.user.id);
      const realOrgName = orgMap.get(p.sellerOrgId) || `Organization #${p.sellerOrgId}`;
      const displayName = (showAllNames || isMe) ? realOrgName : `Bidder ${p.currentRank || index + 1}`;

      const matchedBp = bidParticipations.find((bp: any) => 
        (p.sellerUserId && bp.sellerId === p.sellerUserId) ||
        (p.sellerOrgId && (bp.seller?.organizationId === p.sellerOrgId || bp.sellerOrgId === p.sellerOrgId))
      );

      const ack = (matchedBp?.acknowledgement && typeof matchedBp.acknowledgement === 'object' && !Array.isArray(matchedBp.acknowledgement))
        ? matchedBp.acknowledgement as any
        : {};

      const sellerUserObj = userMap.get(p.sellerUserId) || matchedBp?.seller || null;
      const makeBrand = p.makeBrand || matchedBp?.makeBrand || ack.makeBrand || ack.lineItems?.[0]?.makeBrand || null;
      const model = p.model || matchedBp?.model || ack.model || ack.lineItems?.[0]?.model || null;
      const initialQuoteAmount = p.initialQuoteAmount ?? matchedBp?.quotedAmount ?? null;
      const initialQuoteTotal = p.initialQuoteTotal ?? matchedBp?.totalAmount ?? null;
      const initialQuoteGstPercent = p.initialQuoteGstPercent ?? matchedBp?.gstPercentage ?? ack.lineItems?.[0]?.gstPercent ?? null;
      const lineItems = (Array.isArray(ack.lineItems) && ack.lineItems.length > 0) ? ack.lineItems : [];
      const documents = (matchedBp?.documents && Array.isArray(matchedBp.documents) && matchedBp.documents.length > 0)
        ? matchedBp.documents
        : (p.qualificationDocuments || []);

      const quotedVal = Number(
        p.lastBidAmount ??
        initialQuoteTotal ??
        initialQuoteAmount ??
        matchedBp?.totalAmount ??
        matchedBp?.quotedAmount ??
        0
      );
      const initialVal = Number(
        initialQuoteTotal ??
        initialQuoteAmount ??
        matchedBp?.totalAmount ??
        matchedBp?.quotedAmount ??
        quotedVal
      );

      return {
        ...p,
        sellerOrgName: displayName,
        sellerOrgId: (showAllNames || isMe) ? p.sellerOrgId : null,
        sellerUserId: (showAllNames || isMe) ? p.sellerUserId : null,
        isCurrentViewer: Boolean(isMe),
        makeBrand,
        model,
        quotedAmount: quotedVal,
        totalAmount: quotedVal,
        offeredPrice: quotedVal,
        initialQuoteAmount: initialVal,
        initialQuoteTotal: initialVal,
        lastBidAmount: p.lastBidAmount || quotedVal,
        technicalSpecifications: matchedBp?.offeredItemDescription || ack.technicalSpecifications || ack.lineItems?.[0]?.specifications || null,
        deliveryTimeline: ack.deliveryTimeline || matchedBp?.deliveryTimeline || null,
        paymentTerms: ack.paymentTerms || ack.terms || matchedBp?.paymentTerms || null,
        lineItems,
        acknowledgement: matchedBp?.acknowledgement || null,
        documents,
        sellerUser: (showAllNames || isMe) && sellerUserObj ? {
          id: sellerUserObj.id,
          name: sellerUserObj.name,
          email: sellerUserObj.email,
          mobile: sellerUserObj.mobile
        } : null,
        sellerName: (showAllNames || isMe) ? (sellerUserObj?.name || null) : null,
        sellerEmail: (showAllNames || isMe) ? (sellerUserObj?.email || null) : null,
        sellerPhone: (showAllNames || isMe) ? (sellerUserObj?.mobile || null) : null,
        contactPerson: (showAllNames || isMe) ? (sellerUserObj?.name || null) : null
      };
    });
    return apiResponse.success(res, { participants: maskSensitive(mappedParticipants) });
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 500, error.message || 'Unable to load participants', error.code || 'REVERSE_AUCTION_PARTICIPANTS_ERROR');
  }
});

// ── Auction Clarifications (Q&A between sellers and the buyer) ──
// Stored in the polymorphic RequirementClarification table with entityType='AUCTION'
// and entityId=Auction.id (canonicalized via resolveAuctionId, so either id works).

const auctionClarificationAskBody = z.object({
  question: z.string().trim().min(3).max(2000),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional().default('PUBLIC')
});

const auctionClarificationReplyBody = z.object({
  response: z.string().trim().min(1).max(3000)
});

const isAuctionManagerUser = (req: AuthRequest, auction: any) =>
  isAdmin(req) || auction.createdByUserId === req.user?.id || (req.user?.organizationId && auction.buyerOrgId === req.user.organizationId);

router.post('/reverse-auctions/:id/clarifications', requirePermission('reverse_auction.view', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    const id = await resolveAuctionId(req.params.id);
    if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const auction = await db.auction.findUnique({ where: { id } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const body = auctionClarificationAskBody.parse(req.body);

    // Closed/awarded/live/scheduled auctions no longer take questions.
    const status = String(auction.statusEnum || auction.status || '').toUpperCase();
    if (['LIVE', 'SCHEDULED', 'PAUSED', 'CLOSED', 'COMPLETED', 'AWARD_RECOMMENDED', 'AWARDED', 'CANCELLED'].includes(status)) {
      throw new ApiError(400, 'The clarification window has closed for this auction.', 'AUCTION_CLARIFICATION_CLOSED');
    }
    const now = Date.now();
    if (auction.endTime && new Date(auction.endTime).getTime() < now) {
      throw new ApiError(400, 'The clarification window has closed for this auction.', 'AUCTION_CLARIFICATION_CLOSED');
    }

    if (auction.linkedRequirementId) {
      const linkedReq = await db.procurementRequirement.findUnique({
        where: { id: auction.linkedRequirementId },
        select: { clarificationDeadline: true, bidSubmissionEnd: true }
      });
      if (linkedReq?.clarificationDeadline && new Date(linkedReq.clarificationDeadline).getTime() < now) {
        throw new ApiError(400, 'The clarification submission window has closed.', 'AUCTION_CLARIFICATION_CLOSED');
      }
      if (linkedReq?.bidSubmissionEnd && new Date(linkedReq.bidSubmissionEnd).getTime() < now) {
        throw new ApiError(400, 'Bid submission has ended. Clarification window is closed.', 'AUCTION_CLARIFICATION_CLOSED');
      }
    }

    if (auction.linkedBidId) {
      const linkedBid = await db.procurementBid.findUnique({
        where: { id: auction.linkedBidId },
        select: { clarificationEndDate: true, endDate: true }
      });
      if (linkedBid?.clarificationEndDate && new Date(linkedBid.clarificationEndDate).getTime() < now) {
        throw new ApiError(400, 'The clarification submission window has closed.', 'AUCTION_CLARIFICATION_CLOSED');
      }
      if (linkedBid?.endDate && new Date(linkedBid.endDate).getTime() < now) {
        throw new ApiError(400, 'Bid submission has ended. Clarification window is closed.', 'AUCTION_CLARIFICATION_CLOSED');
      }
    }

    // Sellers ask; the buyer/manager may also post announcements.
    if (req.user?.role !== 'seller' && !isAuctionManagerUser(req, auction)) {
      throw new ApiError(403, 'Access denied', 'AUCTION_CLARIFICATION_FORBIDDEN');
    }

    const clarification = await db.requirementClarification.create({
      data: {
        entityType: 'AUCTION',
        entityId: id,
        question: body.question,
        visibility: body.visibility,
        askedById: req.user!.id
      }
    });

    // Notify the auction owner (best-effort).
    if (auction.createdByUserId && auction.createdByUserId !== req.user?.id) {
      void notificationService.notifyNow(auction.createdByUserId, {
        title: 'New Auction Clarification',
        message: `Regarding "${auction.title || auction.auctionCode}": ${body.question.substring(0, 100)}${body.question.length > 100 ? '…' : ''}`,
        type: 'auction_clarification',
        priority: 'medium',
        redirectUrl: `/reverse-auctions/${id}`
      }).catch(err => logger.warn({ err, auctionId: id }, 'Auction clarification notify failed'));
    }

    await writeAuctionEvent(req, id, 'clarification_asked', 'Clarification question asked', { clarificationId: clarification.id });
    return apiResponse.created(res, maskSensitive(clarification), 'Clarification submitted');
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return apiResponse.error(res, 400, 'Question must be 3-2000 characters.', 'VALIDATION_ERROR');
    }
    return apiResponse.error(res, error.statusCode || 500, error.message || 'Unable to submit clarification', error.code || 'AUCTION_CLARIFICATION_ERROR');
  }
});

router.post('/reverse-auctions/:id/clarifications/:clarId/reply', requirePermission('reverse_auction.view', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    const id = await resolveAuctionId(req.params.id);
    if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const auction = await db.auction.findUnique({ where: { id } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const clarId = Number(req.params.clarId);
    const body = auctionClarificationReplyBody.parse(req.body);

    // Only the auction manager (buyer side) or admin can answer.
    if (!isAuctionManagerUser(req, auction)) {
      throw new ApiError(403, 'Only the auction owner can answer clarifications.', 'AUCTION_CLARIFICATION_FORBIDDEN');
    }

    const clarification = await db.requirementClarification.findUnique({ where: { id: clarId } });
    if (!clarification || clarification.entityType !== 'AUCTION' || clarification.entityId !== id) {
      throw new ApiError(404, 'Clarification not found', 'CLARIFICATION_NOT_FOUND');
    }
    if (clarification.response) {
      throw new ApiError(409, 'Clarification already answered.', 'ALREADY_ANSWERED');
    }

    const updated = await db.requirementClarification.update({
      where: { id: clarId },
      data: { response: body.response, answeredById: req.user!.id, answeredAt: new Date() }
    });

    void notificationService.notifyNow(clarification.askedById, {
      title: 'Auction Clarification Answered',
      message: `Your question on "${auction.title || auction.auctionCode}" has been answered.`,
      type: 'auction_clarification_replied',
      priority: 'medium',
      redirectUrl: `/reverse-auctions/${id}`
    }).catch(err => logger.warn({ err, auctionId: id }, 'Auction clarification reply notify failed'));

    await writeAuctionEvent(req, id, 'clarification_answered', 'Clarification answered', { clarificationId: clarId });
    return apiResponse.success(res, maskSensitive(updated));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return apiResponse.error(res, 400, 'Reply must be 1-3000 characters.', 'VALIDATION_ERROR');
    }
    return apiResponse.error(res, error.statusCode || 500, error.message || 'Unable to submit reply', error.code || 'AUCTION_CLARIFICATION_ERROR');
  }
});

router.get('/reverse-auctions/:id/clarifications', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = await resolveAuctionId(req.params.id);
    if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const auction = await db.auction.findUnique({ where: { id } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');

    const clarifications = await db.requirementClarification.findMany({
      where: { entityType: 'AUCTION', entityId: id },
      orderBy: { askedAt: 'asc' }
    });

    const currentUserId = req.user?.id ? Number(req.user.id) : null;
    const isManager = Boolean(req.user && isAuctionManagerUser(req, auction));

    // Private clarifications must NOT be shown to the public or other sellers/bidders.
    // They must be visible to the asking seller and the buyer/manager only.
    const filtered = isManager
      ? clarifications
      : clarifications.filter((c: any) => {
          const vis = String(c.visibility || 'PUBLIC').toUpperCase();
          if (vis === 'PUBLIC') return true;
          if (!currentUserId) return false;
          return Number(c.askedById) === currentUserId;
        });

    return apiResponse.success(res, maskSensitive(filtered));
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 500, error.message || 'Unable to load clarifications', error.code || 'AUCTION_CLARIFICATION_ERROR');
  }
});

/**
 * Self-enrolment for PUBLIC/OPEN reverse auctions. A verified seller opts in explicitly
 * (auditable) which creates their AuctionParticipant row and unlocks the bidding console.
 * Private/invite-only auctions reject self-join — they require a buyer invite.
 */router.post('/reverse-auctions/:id/join', requirePermission('reverse_auction.view', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'seller') throw new ApiError(403, 'Only sellers can join an auction', 'AUCTION_JOIN_FORBIDDEN');
    const sellerOrgId = req.user.organizationId;
    if (!sellerOrgId) throw new ApiError(400, 'Seller organization is required to join', 'AUCTION_JOIN_NO_ORG');
    const id = await resolveAuctionId(req.params.id);
    if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const auction = await db.auction.findUnique({ where: { id } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');

    const existing = await db.auctionParticipant.findFirst({ where: { auctionId: id, sellerOrgId } });
    if (existing) return apiResponse.success(res, { participant: maskSensitive(existing), alreadyJoined: true }, 200, 'Already participating');

    if (!(await isAuctionPublic(auction))) {
      throw new ApiError(403, 'This auction is invite-only. Please wait for the buyer to invite your organization.', 'AUCTION_INVITE_ONLY');
    }
    // Every reverse auction now runs a pre-bid qualification stage: joining only
    // creates the participant in INVITED / PENDING qualification. The seller must
    // upload the mandatory documents (plus an initial quote for the hybrid method)
    // and be promoted to TECHNICALLY_QUALIFIED by the buyer before bidding opens.
    const participant = await db.auctionParticipant.create({
      data: { auctionId: id, sellerOrgId, sellerUserId: req.user.id || null, status: 'INVITED', qualificationStatus: 'PENDING' }
    });
    await writeAuctionEvent(req, id, 'seller_joined', 'Seller joined public reverse auction', { sellerOrgId });
    return apiResponse.created(res, { participant: maskSensitive(participant), requiresQualification: true }, 'Joined auction — complete qualification to bid');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 500, error.message || 'Unable to join auction', error.code || 'REVERSE_AUCTION_JOIN_ERROR');
  }
});

// ── Pre-bid Qualification Stage ──────────────────────────────────────────────
// Sellers must qualify before the live auction: upload mandatory documents and,
// for BID_WITH_REVERSE_AUCTION, an initial commercial quote; then submit for
// buyer review. The buyer qualifies (-> TECHNICALLY_QUALIFIED, unlocks bidding)
// or disqualifies. This is the process behind the gate enforced in POST /bids.

const requiresInitialQuote = (auction: any) => String(auction?.procurementMethod || '') === 'BID_WITH_REVERSE_AUCTION';

// The seller's own participant row for an auction, or throw. Sellers self-serve
// their qualification, so the row must already exist (via invite or self-join).
const getOwnParticipant = async (req: AuthRequest, auctionId: number) => {
  const sellerOrgId = req.user?.organizationId;
  if (!sellerOrgId) throw new ApiError(400, 'Seller organization is required', 'AUCTION_NO_ORG');
  const participant = await db.auctionParticipant.findFirst({ where: { auctionId, sellerOrgId } });
  if (!participant) throw new ApiError(404, 'You are not a participant in this auction. Join or await an invite first.', 'AUCTION_PARTICIPANT_NOT_FOUND');
  return participant;
};

const assertQualificationEditable = (participant: any) => {
  if (participant.status === 'TECHNICALLY_QUALIFIED') throw new ApiError(400, 'You are already qualified for this auction.', 'AUCTION_ALREADY_QUALIFIED');
  if (participant.status === 'DISQUALIFIED') throw new ApiError(400, 'Your qualification was declined for this auction.', 'AUCTION_DISQUALIFIED');
  if (participant.qualificationStatus === 'SUBMITTED') throw new ApiError(400, 'Your qualification is already submitted and under review.', 'AUCTION_QUALIFICATION_SUBMITTED');
};

// Seller uploads one mandatory qualification document.
router.post('/reverse-auctions/:id/qualification/documents', requirePermission('reverse_auction.bid.submit', orgScope), upload.single('file'), async (req: AuthRequest & { file?: Express.Multer.File }, res: Response) => {
  try {
    if (req.user?.role !== 'seller') throw new ApiError(403, 'Only sellers can upload qualification documents', 'AUCTION_QUALIFICATION_FORBIDDEN');
    const auctionId = await resolveAuctionId(req.params.id);
    if (!auctionId) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const auction = await db.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    if (['CLOSED', 'CANCELLED', 'AWARDED', 'AWARD_RECOMMENDED'].includes(String(auction.statusEnum || auction.status || '').toUpperCase())) {
      throw new ApiError(400, 'This auction is no longer accepting qualification submissions.', 'AUCTION_QUALIFICATION_CLOSED');
    }
    const participant = await getOwnParticipant(req, auctionId);
    assertQualificationEditable(participant);
    if (!req.file) throw new ApiError(400, 'File is required', 'FILE_REQUIRED');

    const asset = await uploadFile(req.file, {
      ownerId: req.user!.id,
      ownerRole: req.user!.role,
      entityType: 'auction_qualification_document',
      entityId: participant.id,
      purpose: String(req.body.documentCategory || 'TECHNICAL'),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    }, env.STORAGE_PROVIDER);

    const doc = await db.auctionQualificationDocument.create({
      data: {
        auctionId,
        participantId: participant.id,
        sellerOrgId: participant.sellerOrgId,
        sellerUserId: req.user!.id,
        documentCategory: String(req.body.documentCategory || 'TECHNICAL'),
        documentName: String(req.body.documentName || req.body.documentCategory || 'Technical Document'),
        fileAssetId: asset.id,
        fileName: asset.originalName,
        fileUrl: asset.url,
        fileKey: asset.key,
        mimeType: asset.mimeType,
        fileSize: asset.size
      }
    });
    if (participant.qualificationStatus !== 'IN_PROGRESS') {
      await db.auctionParticipant.update({ where: { id: participant.id }, data: { qualificationStatus: 'IN_PROGRESS' } });
    }
    await writeAuctionEvent(req, auctionId, 'qualification_document_uploaded', 'Qualification document uploaded', { participantId: participant.id, documentCategory: doc.documentCategory });
    return apiResponse.created(res, { document: maskSensitive(doc) }, 'Document uploaded');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 500, error.message || 'Unable to upload document', error.code || 'AUCTION_QUALIFICATION_UPLOAD_ERROR');
  }
});

// Seller saves / updates their initial commercial quote (required for hybrid method).
router.post('/reverse-auctions/:id/qualification/initial-quote', requirePermission('reverse_auction.bid.submit', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'seller') throw new ApiError(403, 'Only sellers can submit an initial quote', 'AUCTION_QUALIFICATION_FORBIDDEN');
    const auctionId = await resolveAuctionId(req.params.id);
    if (!auctionId) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const auction = await db.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const participant = await getOwnParticipant(req, auctionId);
    assertQualificationEditable(participant);
    const payload = initialQuoteSchema.parse(req.body);
    const total = payload.totalAmount ?? payload.quotedAmount + (payload.quotedAmount * payload.gstPercentage / 100);
    const updated = await db.auctionParticipant.update({
      where: { id: participant.id },
      data: {
        initialQuoteAmount: payload.quotedAmount,
        initialQuoteGstPercent: payload.gstPercentage,
        initialQuoteTotal: total,
        makeBrand: payload.makeBrand || null,
        model: payload.model || null,
        qualificationStatus: participant.qualificationStatus === 'PENDING' ? 'IN_PROGRESS' : participant.qualificationStatus
      }
    });
    await writeAuctionEvent(req, auctionId, 'qualification_quote_saved', 'Initial commercial quote saved', { participantId: participant.id });
    // Quote amount is sensitive until the auction opens — never echo it back.
    return apiResponse.success(res, { participant: maskSensitive({ ...updated, initialQuoteAmount: 'MASKED', initialQuoteTotal: 'MASKED' }) }, 200, 'Initial quote saved');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to save initial quote', error.code || 'AUCTION_QUALIFICATION_QUOTE_ERROR');
  }
});

// Seller submits their qualification packet for buyer review.
router.post('/reverse-auctions/:id/qualification/submit', requirePermission('reverse_auction.bid.submit', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'seller') throw new ApiError(403, 'Only sellers can submit qualification', 'AUCTION_QUALIFICATION_FORBIDDEN');
    const auctionId = await resolveAuctionId(req.params.id);
    if (!auctionId) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const auction = await db.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const participant = await getOwnParticipant(req, auctionId);
    assertQualificationEditable(participant);

    const docCount = await db.auctionQualificationDocument.count({ where: { participantId: participant.id } });
    if (!docCount) throw new ApiError(400, 'Upload at least one mandatory document before submitting.', 'AUCTION_QUALIFICATION_NO_DOCUMENTS');
    if (requiresInitialQuote(auction) && participant.initialQuoteAmount == null) {
      throw new ApiError(400, 'An initial commercial quote is required to qualify for this auction.', 'AUCTION_QUALIFICATION_QUOTE_REQUIRED');
    }

    const updated = await db.auctionParticipant.update({
      where: { id: participant.id },
      data: { qualificationStatus: 'SUBMITTED', qualificationSubmittedAt: new Date() }
    });
    await writeAuctionEvent(req, auctionId, 'qualification_submitted', 'Seller submitted qualification for review', { participantId: participant.id });

    // Notify the auction manager(s) that a submission is awaiting review.
    void (async () => {
      const title = auction.title || auction.auctionCode || `Reverse Auction #${auctionId}`;
      if (auction.createdByUserId) {
        await notificationService.notifyWithEmail(auction.createdByUserId, {
          title: 'Auction Qualification Submitted',
          message: `A seller submitted qualification documents for "${title}". Review and qualify them to let them bid.`,
          type: 'reverse_auction_qualification',
          priority: 'high',
          redirectUrl: `/reverse-auctions/${auctionId}`,
          emailSubject: `Qualification submitted — ${title}`,
          emailHtml: `<p>A seller has submitted their qualification packet for the reverse auction "${title}".</p><p>Log in to review documents and qualify or decline the bidder.</p>`
        });
      }
    })().catch(err => logger.warn({ err, auctionId }, 'Failed to notify buyer of qualification submission'));

    return apiResponse.success(res, { participant: maskSensitive(updated) }, 200, 'Qualification submitted for review');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to submit qualification', error.code || 'AUCTION_QUALIFICATION_SUBMIT_ERROR');
  }
});

// Qualification overview. Sellers see their own packet; buyers/managers see every participant.
router.get('/reverse-auctions/:id/qualification', requirePermission('reverse_auction.view', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    const auctionId = await resolveAuctionId(req.params.id);
    if (!auctionId) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const auction = await db.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const isSeller = req.user?.role === 'seller';
    const where: any = { auctionId };
    if (isSeller) where.sellerOrgId = req.user?.organizationId || -1;
    else assertAuctionManager(req, auction);

    const participants = await db.auctionParticipant.findMany({
      where,
      include: { qualificationDocuments: { orderBy: { uploadedAt: 'desc' } } },
      orderBy: [{ qualificationSubmittedAt: 'asc' }, { invitedAt: 'asc' }]
    });
    const orgIds = Array.from(new Set(participants.map((p: any) => p.sellerOrgId).filter(Boolean)));
    const orgs = await db.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, organizationName: true } });
    const orgMap = new Map(orgs.map((o: any) => [o.id, o.organizationName]));

    // Sellers must not see rivals' quote amounts; buyers only see quotes once submitted.
    const mapped = participants.map((p: any) => {
      const base = { ...p, sellerOrgName: orgMap.get(p.sellerOrgId) || `Organization #${p.sellerOrgId}` };
      const ownRow = isSeller && p.sellerOrgId === req.user?.organizationId;
      if (!ownRow && isSeller) {
        return { id: p.id, sellerOrgId: p.sellerOrgId, sellerOrgName: base.sellerOrgName, status: p.status, qualificationStatus: p.qualificationStatus };
      }
      return base;
    });
    return apiResponse.success(res, {
      requiresInitialQuote: requiresInitialQuote(auction),
      participants: maskSensitive(mapped)
    });
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 500, error.message || 'Unable to load qualification', error.code || 'AUCTION_QUALIFICATION_LOAD_ERROR');
  }
});

// Buyer reviews a submitted seller: qualify (unlock bidding) or disqualify.
router.post('/reverse-auctions/:id/qualification/:participantId/review', requirePermission('reverse_auction.invite_seller', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    const auctionId = await resolveAuctionId(req.params.id);
    if (!auctionId) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const auction = await db.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    assertAuctionManager(req, auction);
    const payload = qualificationReviewSchema.parse(req.body);
    const participant = await db.auctionParticipant.findFirst({ where: { id: Number(req.params.participantId), auctionId } });
    if (!participant) throw new ApiError(404, 'Participant not found', 'AUCTION_PARTICIPANT_NOT_FOUND');
    if (participant.qualificationStatus !== 'SUBMITTED') {
      throw new ApiError(400, 'Only submitted qualifications can be reviewed.', 'AUCTION_QUALIFICATION_NOT_SUBMITTED');
    }

    const qualify = payload.decision === 'QUALIFY';
    const updated = await db.auctionParticipant.update({
      where: { id: participant.id },
      data: {
        status: qualify ? 'TECHNICALLY_QUALIFIED' : 'DISQUALIFIED',
        qualificationStatus: qualify ? 'QUALIFIED' : 'DISQUALIFIED',
        qualifiedAt: qualify ? new Date() : null,
        qualificationRemarks: payload.remarks || null,
        disqualificationReason: qualify ? null : (payload.remarks || 'Did not meet qualification criteria')
      }
    });
    await writeAuctionEvent(req, auctionId, qualify ? 'seller_qualified' : 'seller_disqualified', qualify ? 'Seller technically qualified' : 'Seller disqualified', { participantId: participant.id });

    void (async () => {
      const title = auction.title || auction.auctionCode || `Reverse Auction #${auctionId}`;
      const targets = participant.sellerUserId
        ? [{ id: participant.sellerUserId }]
        : await db.user.findMany({ where: { organizationId: participant.sellerOrgId }, select: { id: true } });
      for (const u of targets) {
        await notificationService.notifyWithEmail(u.id, {
          title: qualify ? 'Qualified for Reverse Auction' : 'Auction Qualification Declined',
          message: qualify
            ? `Your organization is qualified for "${title}". You can place bids once the auction goes live.`
            : `Your qualification for "${title}" was not accepted.${payload.remarks ? ` Reason: ${payload.remarks}` : ''}`,
          type: 'reverse_auction_qualification',
          priority: qualify ? 'high' : 'medium',
          redirectUrl: `/reverse-auctions/${auctionId}`,
          emailSubject: qualify ? `You are qualified — ${title}` : `Qualification update — ${title}`,
          emailHtml: qualify
            ? `<p>Congratulations — your organization has been technically qualified for the reverse auction "${title}".</p><p>Log in when the auction goes live to place your competitive bids.</p>`
            : `<p>Your qualification submission for "${title}" was not accepted.</p>${payload.remarks ? `<p><strong>Reason:</strong> ${payload.remarks}</p>` : ''}`
        });
      }
    })().catch(err => logger.warn({ err, auctionId }, 'Failed to notify seller of qualification decision'));

    return apiResponse.success(res, { participant: maskSensitive(updated) }, 200, qualify ? 'Seller qualified' : 'Seller disqualified');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to review qualification', error.code || 'AUCTION_QUALIFICATION_REVIEW_ERROR');
  }
});

router.post('/reverse-auctions/:id/bids', requirePermission('reverse_auction.bid.submit', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    const auctionId = await resolveAuctionId(req.params.id);
    if (!auctionId) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const payload = bidSchema.parse(req.body);
    const result = await withDistributedLock(redisKeys.lockAuction(auctionId), async () => {
      const txResult = await db.$transaction(async (tx: any) => {
        const auction = await tx.auction.findUnique({ where: { id: auctionId } });
        if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
        // Both reverse-auction methods now run a pre-bid qualification stage, so only
        // participants the buyer promoted to TECHNICALLY_QUALIFIED may place live bids.
        const participant = await tx.auctionParticipant.findFirst({
          where: {
            auctionId,
            OR: [
              ...(req.user?.organizationId ? [{ sellerOrgId: req.user.organizationId }] : []),
              ...(req.user?.id ? [{ sellerUserId: req.user.id }] : [])
            ],
            status: { in: ['TECHNICALLY_QUALIFIED', 'ACCEPTED'] }
          }
        });
        if (!participant) throw new ApiError(403, 'Only technically qualified sellers can bid. Complete the qualification stage first.', 'AUCTION_SELLER_NOT_QUALIFIED');
        const now = new Date();
        if (!['LIVE', 'active'].includes(String(auction.status))) throw new ApiError(409, 'Auction is not live', 'AUCTION_NOT_LIVE');
        if (auction.startTime > now || auction.endTime <= now) throw new ApiError(409, 'Auction is outside the bidding window', 'AUCTION_WINDOW_CLOSED');

        const current = toNumber(auction.currentLowestAmount ?? auction.currentLowestBid ?? auction.currentBid ?? auction.startPrice);
        const amountDecrement = toNumber(auction.minDecrementAmount ?? auction.minDecrement, 0);
        if (amountDecrement <= 0) throw new ApiError(400, 'Auction minimum decrement is not configured', 'AUCTION_MIN_DECREMENT_REQUIRED');
        const percentDecrement = auction.minDecrementPercent ? current * (toNumber(auction.minDecrementPercent) / 100) : 0;
        const requiredDecrement = Math.max(amountDecrement, percentDecrement);
        const maxAllowed = current - requiredDecrement;
        if (payload.amount > maxAllowed) {
          throw new ApiError(
            400,
            `Bid of ₹${payload.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} is too high. Current lowest offer is ₹${current.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Your bid must be at least ₹${requiredDecrement.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lower (maximum permitted: ₹${maxAllowed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`,
            'AUCTION_MIN_DECREMENT',
            {
              currentLowest: current,
              requiredDecrement,
              maxAllowedBid: Number(maxAllowed.toFixed(2)),
              submittedAmount: payload.amount
            }
          );
        }
        // Reserve price is the buyer's floor: in a reverse auction sellers drive the
        // price down, so a bid under the reserve is rejected. (bidSchema already
        // guarantees amount > 0, so no separate positivity check is needed here.)
        const reserve = auction.reservePrice != null ? toNumber(auction.reservePrice) : null;
        if (reserve != null && reserve > 0 && payload.amount < reserve) {
          throw new ApiError(
            400,
            `Bid cannot be below the auction reserve price of ₹${reserve.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            'AUCTION_BELOW_RESERVE',
            { reservePrice: reserve, submittedAmount: payload.amount }
          );
        }

        const msToEnd = new Date(auction.endTime).getTime() - now.getTime();
        const shouldExtend = auction.autoExtensionEnabled &&
          auction.extensionCount < auction.maxAutoExtensions &&
          msToEnd <= auction.autoExtensionWindowMinutes * 60_000;
        const endTime = shouldExtend
          ? new Date(new Date(auction.endTime).getTime() + auction.autoExtensionByMinutes * 60_000)
          : auction.endTime;

        const bid = await tx.auctionBid.create({
          data: {
            auctionId,
            participantId: participant.id,
            sellerOrgId: req.user?.organizationId || null,
            sellerId: req.user?.id,
            bidAmount: payload.amount,
            amount: payload.amount,
            ipAddress: req.ip,
            userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
            deviceHash: payload.deviceHash || null
          }
        });
        const updatedAuction = await tx.auction.update({
          where: { id: auctionId },
          data: {
            currentBid: payload.amount,
            currentLowestBid: payload.amount,
            currentLowestAmount: payload.amount,
            currentWinnerId: req.user?.id,
            endTime,
            extensionCount: shouldExtend ? { increment: 1 } : undefined
          }
        });
        return { auction: updatedAuction, auctionBid: bid, requiredDecrement };
      }, { maxWait: 10_000, timeout: 25_000 });

      // Run rank recalculation within the distributed lock
      await recalculateRanks(db, auctionId);
      return txResult;
    }, { ttlMs: 30_000 });
    await writeAuctionEvent(req, auctionId, 'bid_submitted', 'Seller submitted reverse auction bid', { amount: payload.amount });

    try {
      const currentLow = toNumber(payload.amount);
      const reqDec = toNumber((result as any)?.requiredDecrement || 0);
      const nextMax = Math.max(0, currentLow - reqDec);
      broadcastToAuction(auctionId, {
        type: 'REVERSE_AUCTION_BID',
        auctionId,
        auctionCode: result.auction?.auctionCode,
        currentLowest: currentLow,
        minimumNextBid: Number(nextMax.toFixed(2)),
        sellerOrgId: req.user?.organizationId || null,
        timestamp: new Date().toISOString()
      });
      if (result.auction?.linkedBidId) {
        broadcastToProcurement(result.auction.linkedBidId, {
          type: 'PROCUREMENT_UPDATED',
          requirementId: result.auction.linkedBidId,
          procurementId: result.auction.linkedBidId,
          timestamp: new Date().toISOString()
        });
      }
      if (result.auction?.linkedRequirementId) {
        broadcastToProcurement(result.auction.linkedRequirementId, {
          type: 'PROCUREMENT_UPDATED',
          requirementId: result.auction.linkedRequirementId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (bcErr) {
      logger.warn({ bcErr }, '[ReverseAuction] Failed to broadcast bid event');
    }

    return apiResponse.created(res, maskSensitive(result), 'Bid submitted');
  } catch (error: any) {
    logger.error({ err: error, rawId: req.params.id }, '[ReverseAuction] Bid submission failure');
    const isDbError = Boolean(error.code?.startsWith?.('P') || String(error.message || '').includes('Transaction') || String(error.message || '').includes('invocation'));
    const userMessage = isDbError
      ? 'The bidding server experienced a momentary transaction delay. Please retry submitting your bid.'
      : (error.message || 'Unable to submit bid');

    return apiResponse.error(
      res,
      error.statusCode || (isDbError ? 503 : 400),
      userMessage,
      error.code || 'REVERSE_AUCTION_BID_ERROR',
      error.details
    );
  }
});

router.get('/reverse-auctions/:id/bids', requirePermission('reverse_auction.view', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    const id = await resolveAuctionId(req.params.id);
    if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const auction = await db.auction.findUnique({ where: { id } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');

    const isManager = canManageAuction(req, auction);
    let myParticipant = null;
    if (req.user) {
      myParticipant = await db.auctionParticipant.findFirst({
        where: {
          auctionId: id,
          OR: [
            ...(req.user.organizationId ? [{ sellerOrgId: req.user.organizationId }] : []),
            ...(req.user.id ? [{ sellerUserId: req.user.id }] : [])
          ]
        }
      });
    }
    const isPublic = await isAuctionPublic(auction);
    if (!isManager && !myParticipant && !isPublic && !isAdmin(req)) {
      throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    }

    const [bids, participants] = await Promise.all([
      db.auctionBid.findMany({
        where: { auctionId: id, isValid: true },
        orderBy: [{ submittedAt: 'desc' }]
      }),
      db.auctionParticipant.findMany({
        where: { auctionId: id }
      })
    ]);

    const participantByOrg = new Map<number, any>(participants.map((p: any) => [Number(p.sellerOrgId), p]));
    const orgIds = Array.from(new Set(bids.map((b: any) => b.sellerOrgId).filter(Boolean)));
    const orgs = await db.organization.findMany({
      where: { id: { in: orgIds as number[] } },
      select: { id: true, organizationName: true }
    });
    const orgMap = new Map(orgs.map((o: any) => [o.id, o.organizationName]));

    // Anonymized competitor label mapping
    const competitorLabelMap = new Map<number, string>();
    let competitorIndex = 1;
    for (const p of participants) {
      const pOrgId = Number(p.sellerOrgId);
      if (pOrgId && !competitorLabelMap.has(pOrgId)) {
        competitorLabelMap.set(pOrgId, `Bidder ${p.currentRank || competitorIndex++}`);
      }
    }

    const showAllNames = isManager || Boolean(auction.allowCompetitorNames);
    const mappedBids = bids.map((b: any) => {
      const bOrgId = Number(b.sellerOrgId || 0);
      const isMe = (req.user?.organizationId && bOrgId === Number(req.user.organizationId)) ||
                   (req.user?.id && b.sellerId === Number(req.user.id));
      const realOrgName = orgMap.get(bOrgId) || `Organization #${bOrgId}`;
      const fallbackLabel = competitorLabelMap.get(bOrgId) || `Bidder #${bOrgId || '?'}`;
      const displayName = (showAllNames || isMe) ? realOrgName : fallbackLabel;
      const part = bOrgId ? participantByOrg.get(bOrgId) : null;
      const bidderRank = part?.currentRank || b.rankAtSubmission || null;

      return {
        ...b,
        sellerOrgName: displayName,
        sellerOrgId: (showAllNames || isMe) ? b.sellerOrgId : null,
        sellerId: (showAllNames || isMe) ? b.sellerId : null,
        ipAddress: (showAllNames || isMe) ? b.ipAddress : null,
        deviceHash: null,
        userAgent: null,
        userAgentHash: null,
        isMyBid: Boolean(isMe),
        bidderRank
      };
    });

    return apiResponse.success(res, { bids: maskSensitive(mappedBids) });
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 500, error.message || 'Unable to load bids', error.code || 'REVERSE_AUCTION_BIDS_ERROR');
  }
});



router.get('/reverse-auctions/:id/result', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = await resolveAuctionId(req.params.id);
    if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const auction = await db.auction.findUnique({ where: { id } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');

    const isManager = canManageAuction(req, auction);
    let myParticipant = null;
    if (req.user) {
      myParticipant = await db.auctionParticipant.findFirst({
        where: {
          auctionId: id,
          OR: [
            ...(req.user.organizationId ? [{ sellerOrgId: req.user.organizationId }] : []),
            ...(req.user.id ? [{ sellerUserId: req.user.id }] : [])
          ]
        }
      });
    }

    const isPublic = await isAuctionPublic(auction);
    const isConcluded = ['CLOSED', 'COMPLETED', 'AWARD_RECOMMENDED', 'AWARDED', 'ENDED'].includes(auction.status || auction.statusEnum);

    if (!isManager && !myParticipant && !isPublic && !isConcluded) {
      throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    }

    const participants = await db.auctionParticipant.findMany({
      where: { auctionId: id },
      orderBy: [{ currentRank: 'asc' }, { lastBidAmount: 'asc' }]
    });
    
    // Resolve organization names for the ranking table
    const orgIds = participants.map((p: any) => p.sellerOrgId).filter(Boolean);
    const orgs = await db.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, organizationName: true }
    });
    const orgMap = new Map(orgs.map((o: any) => [o.id, o.organizationName]));

    // Identify winning participant if awarded or offered
    const winningParticipant = auction.winnerSellerId
      ? participants.find((p: any) => p.sellerUserId === auction.winnerSellerId || p.sellerOrgId === auction.winnerSellerId)
      : participants.find((p: any) => p.currentRank === 1) || (participants.length > 0 ? participants[0] : null);

    // Also fetch associated Purchase Order if generated
    const purchaseOrder = await db.purchaseOrder.findFirst({
      where: {
        sourceType: 'auction',
        sourceId: id
      },
      select: {
        id: true,
        poNumber: true,
        status: true,
        poStatus: true,
        totalValue: true,
        currency: true,
        createdAt: true,
        metadata: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const isAwardOffered = ['AWARD_OFFERED', 'AWARD_RECOMMENDED'].includes(auction.status) ||
                          (auction.statusEnum === 'AWARD_RECOMMENDED' && Boolean(auction.winnerSellerId));

    const isAwardAccepted = auction.status === 'AWARD_ACCEPTED' ||
                           Boolean(winningParticipant && winningParticipant.status === 'ACCEPTED' && winningParticipant.acceptedAt) ||
                           Boolean(purchaseOrder);

    const isWinningSeller = Boolean(
      req.user &&
      winningParticipant &&
      ((req.user.organizationId && winningParticipant.sellerOrgId === req.user.organizationId) ||
       (req.user.id && winningParticipant.sellerUserId === req.user.id) ||
       (auction.winnerSellerId && (req.user.id === auction.winnerSellerId || (req.user.organizationId && winningParticipant.sellerOrgId === req.user.organizationId))))
    );

    const canAcceptAward = isWinningSeller && isAwardOffered && !isAwardAccepted;
    const canGeneratePo = isManager && isAwardAccepted && !purchaseOrder;
    const canOfferAward = isManager && !isAwardOffered && !isAwardAccepted && !purchaseOrder && ['CLOSED', 'COMPLETED', 'FINALIZED'].includes(auction.status || auction.statusEnum);

    const showAllNames = isManager || Boolean(auction.allowCompetitorNames);
    const ranking = participants.map((p: any, index: number) => {
      const isMe = (req.user?.organizationId && p.sellerOrgId === req.user.organizationId) ||
                   (req.user?.id && p.sellerUserId === req.user.id);
      const realOrgName = orgMap.get(p.sellerOrgId) || `Organization #${p.sellerOrgId}`;
      const displayName = (showAllNames || isMe) ? realOrgName : `Bidder ${p.currentRank || index + 1}`;

      const isWinner = Boolean(winningParticipant && winningParticipant.id === p.id);
      const isAwardOfferedToP = isWinner && isAwardOffered;
      const isAwardAcceptedByP = isWinner && isAwardAccepted;
      const isAwarded = isWinner && Boolean(purchaseOrder || auction.statusEnum === 'AWARDED');

      return {
        ...p,
        sellerOrgName: displayName,
        isCurrentViewer: Boolean(isMe),
        isWinner,
        isAwardOffered: isAwardOfferedToP,
        isAwardAccepted: isAwardAcceptedByP,
        isAwarded
      };
    });

    const linkedRequirement = await linkedRequirementSummary(auction);
    let resolvedCategory = auction.category;
    if ((!resolvedCategory || resolvedCategory.toLowerCase() === 'general procurement') && linkedRequirement?.category) {
      resolvedCategory = linkedRequirement.category;
      auction.category = linkedRequirement.category;
      db.auction.update({
        where: { id: auction.id },
        data: {
          category: linkedRequirement.category,
          ...(linkedRequirement.id && !auction.linkedBidId ? { linkedBidId: linkedRequirement.id } : {})
        }
      }).catch(() => {});
    }

    return apiResponse.success(res, {
      auction: maskSensitive({
        ...auction,
        category: (resolvedCategory && resolvedCategory.toLowerCase() !== 'general procurement') ? resolvedCategory : (linkedRequirement?.category || null),
        linkedRequirement
      }),
      ranking: maskSensitive(ranking),
      purchaseOrder: purchaseOrder ? maskSensitive(purchaseOrder) : null,
      canRecommendAward: isManager,
      canOfferAward,
      canAcceptAward,
      canGeneratePo,
      isAwardOffered,
      isAwardAccepted,
      isWinningSeller,
      winningParticipant: winningParticipant ? maskSensitive(winningParticipant) : null,
      isManager,
      myParticipant: maskSensitive(myParticipant)
    });
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 500, error.message || 'Unable to load auction result', error.code || 'REVERSE_AUCTION_RESULT_ERROR');
  }
});

router.post('/reverse-auctions/:id/award-recommendation', requirePermission('reverse_auction.award', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    const id = await resolveAuctionId(req.params.id);
    if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const payload = awardSchema.parse(req.body);
    const auction = await db.auction.findUnique({ where: { id } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    assertAuctionManager(req, auction);
    const winner = payload.participantId
      ? await db.auctionParticipant.findFirst({ where: { id: payload.participantId, auctionId: id } })
      : await db.auctionParticipant.findFirst({ where: { auctionId: id, currentRank: 1 } });
    
    if (!winner) {
      throw new ApiError(400, 'No qualifying participant found for award recommendation', 'NO_WINNER_FOUND');
    }

    let sellerUserId = winner.sellerUserId;
    if (!sellerUserId && winner.sellerOrgId) {
      const sellerUser = await db.user.findFirst({
        where: { organizationId: winner.sellerOrgId }
      });
      if (sellerUser) sellerUserId = sellerUser.id;
    }
    if (!sellerUserId) {
      sellerUserId = winner.sellerOrgId || 1;
    }

    const isNonL1 = (winner.currentRank || 1) !== 1;
    const isPriceMatch = Boolean(payload.isPriceMatch);
    const l1Amount = Number(auction.currentLowestAmount || auction.currentLowestBid || auction.currentBid || 0);
    const candidateAwardAmount = isPriceMatch
      ? (Number(payload.counterOfferAmount) > 0 ? Number(payload.counterOfferAmount) : l1Amount)
      : Number(winner.lastBidAmount || auction.currentLowestAmount || auction.startPrice || 0);
    const awardAmount = candidateAwardAmount > 0 ? candidateAwardAmount : Number(auction.startPrice || 0);
    const awardRemarks = isPriceMatch
      ? `[Price Match Counter-Offer to Match L1 Price] ${payload.remarks || ''}`.trim()
      : (payload.remarks || 'Award offered from Reverse Auction outcome');

    const updated = await db.auction.update({
      where: { id },
      data: {
        status: 'AWARD_OFFERED',
        statusEnum: 'AWARD_RECOMMENDED',
        winnerSellerId: sellerUserId,
        overrideReason: isNonL1 ? (payload.remarks || 'Discretionary award recommendation') : null,
        remarks: payload.remarks || auction.remarks
      }
    });

    // If linked to a procurementBid, issue the formal bid award offer
    if (auction.linkedBidId) {
      const bidParticipation = await db.procurementBidParticipation.findFirst({
        where: {
          bidId: auction.linkedBidId,
          OR: [
            { sellerId: sellerUserId },
            ...(winner.sellerOrgId ? [{ seller: { organizationId: winner.sellerOrgId } }] : [])
          ]
        }
      });

      if (bidParticipation) {
        const finalSellerUserId = bidParticipation.sellerId || sellerUserId;
        const existingAward = await db.procurementBidAward.findFirst({
          where: { bidId: auction.linkedBidId, participationId: bidParticipation.id }
        });
        if (existingAward) {
          await db.procurementBidAward.update({
            where: { id: existingAward.id },
            data: {
              awardStatus: 'OFFERED',
              awardedAmount: awardAmount,
              originalBidAmount: Number(winner.lastBidAmount || awardAmount),
              isPriceMatched: isPriceMatch,
              priceMatchTargetPrice: isPriceMatch ? awardAmount : null,
              counterOfferStatus: isPriceMatch ? 'PENDING_SUPPLIER' : 'NONE',
              counterOfferNotes: isPriceMatch ? awardRemarks : null,
              justificationReason: isNonL1 ? payload.remarks : null,
              remarks: awardRemarks,
              awardedAt: new Date()
            }
          }).catch((err: any) => console.error('[award-recommendation] Error updating award:', err));
        } else {
          await db.procurementBidAward.create({
            data: {
              bidId: auction.linkedBidId,
              participationId: bidParticipation.id,
              sellerId: finalSellerUserId,
              awardedAmount: awardAmount,
              originalBidAmount: Number(winner.lastBidAmount || awardAmount),
              isPriceMatched: isPriceMatch,
              priceMatchTargetPrice: isPriceMatch ? awardAmount : null,
              counterOfferStatus: isPriceMatch ? 'PENDING_SUPPLIER' : 'NONE',
              counterOfferNotes: isPriceMatch ? awardRemarks : null,
              justificationReason: isNonL1 ? payload.remarks : null,
              awardStatus: 'OFFERED',
              awardedById: req.user!.id,
              remarks: awardRemarks,
              awardedAt: new Date()
            }
          }).catch((err: any) => console.error('[award-recommendation] Error creating award:', err));
        }
        await db.procurementBidParticipation.update({
          where: { id: bidParticipation.id },
          data: { finalStatus: 'AWARD_OFFERED' }
        }).catch(() => null);
      }
      await db.procurementBid.update({
        where: { id: auction.linkedBidId },
        data: {
          status: 'AWARD_OFFERED',
          lifecycleStage: 'AWARD_RECOMMENDED'
        }
      }).catch(() => null);

      await invalidateBidCaches(auction.linkedBidId, auction.referenceNo).catch(() => null);
      if (auction.referenceNo) await invalidateBidCaches(auction.referenceNo).catch(() => null);
      if (auction.auctionCode) await invalidateBidCaches(auction.auctionCode).catch(() => null);
    }

    await writeAuctionEvent(req, id, 'award_offered', `Contract award offer issued for participant #${winner.id} (Rank L${winner.currentRank || 1})`, {
      participantId: winner.id,
      sellerOrgId: winner.sellerOrgId,
      sellerUserId,
      isNonL1,
      overrideReason: isNonL1 ? payload.remarks : null
    });

    await notificationService.notifyUser(sellerUserId, {
      title: 'Contract Award Offer Received',
      message: `You have been offered the contract award for Reverse Auction "${auction.title || auction.auctionCode || ('RA-' + auction.id)}". Please review and formally accept the award.`,
      type: 'bid_awarded',
      redirectUrl: `/seller/procurement/reverse-auction/${encodeURIComponent(auction.auctionCode || auction.id)}/result`
    }).catch(() => undefined);

    try {
      broadcastToAuction(auction.id, {
        type: 'REVERSE_AUCTION_STATUS_CHANGED',
        auctionId: auction.id,
        status: 'AWARDED',
        timestamp: new Date().toISOString()
      });
      broadcastToAuction(auction.id, {
        type: 'REVERSE_AUCTION_UPDATED',
        auctionId: auction.id,
        status: 'AWARDED',
        timestamp: new Date().toISOString()
      });
      const targets = [auction.linkedBidId, auction.referenceNo, auction.auctionCode, auction.linkedRequirementId].filter(Boolean);
      targets.forEach((tid) => {
        broadcastToProcurement(tid, {
          type: 'PROCUREMENT_AWARDED',
          procurementId: auction.linkedBidId || auction.id,
          status: 'AWARD_OFFERED',
          sellerOrgId: winner.sellerOrgId,
          sellerUserId,
          awardedAmount: awardAmount,
          timestamp: new Date().toISOString()
        });
        broadcastToProcurement(tid, {
          type: 'PROCUREMENT_UPDATED',
          procurementId: auction.linkedBidId || auction.id,
          requirementId: auction.linkedRequirementId || auction.linkedBidId || auction.id,
          status: 'AWARD_OFFERED',
          timestamp: new Date().toISOString()
        });
      });
      if (sellerUserId) {
        broadcastToUser(sellerUserId, {
          type: 'AWARD_RECEIVED',
          auctionId: auction.id,
          procurementId: auction.linkedBidId || undefined,
          awardedAmount: awardAmount,
          timestamp: new Date().toISOString()
        });
      }
    } catch (bcErr) {
      logger.warn({ bcErr }, '[reverse-auction.routes] Broadcast failed for award recommendation');
    }

    return apiResponse.success(res, { auction: maskSensitive(updated), winner: maskSensitive(winner) }, 200, 'Award offer successfully issued to supplier');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to recommend award', error.code || 'REVERSE_AUCTION_AWARD_ERROR');
  }
});

router.post('/reverse-auctions/:id/accept-award', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = await resolveAuctionId(req.params.id);
    if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const auction = await db.auction.findUnique({ where: { id } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');

    // Find the participant intended for award
    const winner = await db.auctionParticipant.findFirst({
      where: {
        auctionId: id,
        OR: [
          ...(auction.winnerSellerId ? [{ sellerUserId: auction.winnerSellerId }, { sellerOrgId: auction.winnerSellerId }] : []),
          { currentRank: 1 }
        ]
      }
    });

    if (!winner) {
      throw new ApiError(404, 'Awarded participant not found for this auction', 'WINNER_NOT_FOUND');
    }

    const userOrgId = req.user?.organizationId ? String(req.user.organizationId) : "";
    const userId = req.user?.id ? String(req.user.id) : "";
    const isWinningSeller = Boolean(
      req.user && (
        req.user.role === 'admin' ||
        req.user.role === 'master_admin' ||
        (auction.winnerSellerId && (String(auction.winnerSellerId) === userId || String(auction.winnerSellerId) === userOrgId)) ||
        (winner.sellerUserId && (String(winner.sellerUserId) === userId || String(winner.sellerUserId) === userOrgId)) ||
        (winner.sellerOrgId && (String(winner.sellerOrgId) === userOrgId || String(winner.sellerOrgId) === userId))
      )
    );

    if (!isWinningSeller) {
      throw new ApiError(403, 'Only the awarded supplier organization can formally accept this award offer', 'FORBIDDEN_AWARD_ACCEPTANCE');
    }

    // Invalidate caches early
    invalidateProcurementAuctionCache(id);
    if (auction.referenceNo) invalidateProcurementAuctionCache(auction.referenceNo);
    if (auction.auctionCode) invalidateProcurementAuctionCache(auction.auctionCode);
    if (auction.linkedBidId) invalidateProcurementAuctionCache(auction.linkedBidId);
    if (auction.linkedRequirementId) invalidateProcurementAuctionCache(auction.linkedRequirementId);

    // Idempotent check: if already accepted
    if (auction.status === 'AWARD_ACCEPTED' || winner.status === 'ACCEPTED') {
      return apiResponse.success(res, { auction: maskSensitive(auction), winner: maskSensitive(winner) }, 200, 'Award offer has already been accepted');
    }

    // Update auction status
    const updatedAuction = await db.auction.update({
      where: { id },
      data: {
        status: 'AWARD_ACCEPTED'
      }
    });

    const updatedWinner = await db.auctionParticipant.update({
      where: { id: winner.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: winner.acceptedAt || new Date()
      }
    });

    // If linked to bid, update procurementBid and award records
    if (auction.linkedBidId) {
      await db.procurementBid.update({
        where: { id: auction.linkedBidId },
        data: {
          status: 'AWARD_ACCEPTED',
          lifecycleStage: 'AWARD_ACCEPTED'
        }
      }).catch(() => null);

      const existingAward = await db.procurementBidAward.findFirst({
        where: {
          bidId: auction.linkedBidId,
          OR: [
            { sellerId: winner.sellerUserId || auction.winnerSellerId || 0 },
            ...(winner.sellerOrgId ? [{ sellerId: winner.sellerOrgId }] : [])
          ]
        }
      });

      if (existingAward) {
        await db.procurementBidAward.update({
          where: { id: existingAward.id },
          data: { awardStatus: 'ACCEPTED', acceptedAt: existingAward.acceptedAt || new Date() }
        }).catch(() => null);
      } else {
        const winningAmount = Number(winner.lastBidAmount || auction.currentLowestAmount || auction.currentLowestBid || auction.currentBid || 0);
        const pbPart = await db.procurementBidParticipation.findFirst({
          where: {
            bidId: auction.linkedBidId,
            OR: [
              { sellerId: winner.sellerUserId || auction.winnerSellerId || 0 },
              ...(winner.sellerOrgId ? [{ seller: { organizationId: winner.sellerOrgId } }] : [])
            ]
          }
        });
        if (pbPart) {
          await db.procurementBidAward.create({
            data: {
              bidId: auction.linkedBidId,
              participationId: pbPart.id,
              sellerId: pbPart.sellerId || winner.sellerUserId || auction.winnerSellerId || 0,
              awardedAmount: winningAmount > 0 ? winningAmount : Number(auction.startPrice || 0),
              originalBidAmount: Number(winner.lastBidAmount || winningAmount),
              awardStatus: 'ACCEPTED',
              awardedById: auction.createdByUserId || 1,
              awardedAt: new Date(),
              acceptedAt: new Date(),
              remarks: 'Reverse Auction Award'
            }
          }).catch((err) => console.error('[accept-award] Failed to create missing award:', err));
        }
      }

      await db.procurementBidAward.updateMany({
        where: {
          bidId: auction.linkedBidId,
          OR: [
            { sellerId: winner.sellerUserId || auction.winnerSellerId || 0 },
            ...(winner.sellerOrgId ? [{ sellerId: winner.sellerOrgId }] : [])
          ]
        },
        data: { awardStatus: 'ACCEPTED' }
      }).catch(() => null);

      if (winner.sellerOrgId) {
        await db.procurementBidAward.updateMany({
          where: {
            bidId: auction.linkedBidId,
            seller: { organizationId: winner.sellerOrgId }
          },
          data: { awardStatus: 'ACCEPTED' }
        }).catch(() => null);
      }

      await db.procurementBidParticipation.updateMany({
        where: {
          bidId: auction.linkedBidId,
          OR: [
            ...(winner.sellerUserId ? [{ sellerUserId: winner.sellerUserId }] : []),
            ...(winner.sellerOrgId ? [{ sellerOrganizationId: winner.sellerOrgId }, { organizationId: winner.sellerOrgId }] : [])
          ]
        },
        data: { finalStatus: 'AWARD_ACCEPTED' }
      }).catch(() => null);

      await invalidateBidCaches(auction.linkedBidId, auction.referenceNo).catch(() => null);
      if (auction.referenceNo) await invalidateBidCaches(auction.referenceNo).catch(() => null);
      if (auction.auctionCode) await invalidateBidCaches(auction.auctionCode).catch(() => null);
    }

    await writeAuctionEvent(req, id, 'award_accepted', `Contract award offer accepted by supplier organization #${winner.sellerOrgId || winner.sellerUserId}`, {
      participantId: winner.id,
      sellerOrgId: winner.sellerOrgId,
      sellerUserId: winner.sellerUserId
    });

    // Notify buyer
    const buyerUserId = auction.createdByUserId;
    if (buyerUserId) {
      const sellerOrgName = await resolveSellerOrgName(winner.sellerUserId || winner.sellerOrgId);
      await notificationService.notifyUser(buyerUserId, {
        title: 'Award Offer Formally Accepted',
        message: `${sellerOrgName} has formally accepted your contract award offer for Reverse Auction "${auction.title || auction.auctionCode || ('RA-' + auction.id)}". You may now generate the official Purchase Order.`,
        type: 'award_accepted',
        redirectUrl: `/buyer/procurement/reverse-auction/${encodeURIComponent(auction.auctionCode || auction.id)}/result`
      }).catch(() => undefined);
    }

    try {
      broadcastToAuction(auction.id, {
        type: 'REVERSE_AUCTION_STATUS_CHANGED',
        auctionId: auction.id,
        status: 'AWARD_ACCEPTED',
        timestamp: new Date().toISOString()
      });
      broadcastToAuction(auction.id, {
        type: 'REVERSE_AUCTION_UPDATED',
        auctionId: auction.id,
        status: 'AWARD_ACCEPTED',
        timestamp: new Date().toISOString()
      });
      const targets = [auction.linkedBidId, auction.referenceNo, auction.auctionCode, auction.linkedRequirementId].filter(Boolean);
      targets.forEach((tid) => {
        broadcastToProcurement(tid, {
          type: 'AWARD_ACCEPTED',
          procurementId: auction.linkedBidId || auction.id,
          requirementId: auction.linkedRequirementId || auction.linkedBidId || auction.id,
          status: 'AWARD_ACCEPTED',
          sellerOrgId: winner.sellerOrgId,
          sellerUserId: winner.sellerUserId,
          timestamp: new Date().toISOString()
        });
        broadcastToProcurement(tid, {
          type: 'BID_ACCEPTED',
          procurementId: auction.linkedBidId || auction.id,
          requirementId: auction.linkedRequirementId || auction.linkedBidId || auction.id,
          status: 'AWARD_ACCEPTED',
          sellerOrgId: winner.sellerOrgId,
          timestamp: new Date().toISOString()
        });
        broadcastToProcurement(tid, {
          type: 'PROCUREMENT_UPDATED',
          procurementId: auction.linkedBidId || auction.id,
          requirementId: auction.linkedRequirementId || auction.linkedBidId || auction.id,
          status: 'AWARD_ACCEPTED',
          timestamp: new Date().toISOString()
        });
      });
      if (auction.createdByUserId) {
        broadcastToUser(auction.createdByUserId, {
          type: 'BID_STATUS_CHANGED',
          auctionId: auction.id,
          procurementId: auction.linkedBidId || undefined,
          status: 'AWARD_ACCEPTED',
          timestamp: new Date().toISOString()
        });
      }
    } catch (bcErr) {
      logger.warn({ bcErr }, '[reverse-auction.routes] Broadcast failed for accept award');
    }

    return apiResponse.success(res, {
      auction: maskSensitive(updatedAuction),
      winner: maskSensitive(updatedWinner)
    }, 200, 'Contract award offer formally accepted');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to accept award offer', error.code || 'REVERSE_AUCTION_ACCEPT_AWARD_ERROR');
  }
});

router.post('/reverse-auctions/:id/decline-award', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = await resolveAuctionId(req.params.id);
    if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const auction = await db.auction.findUnique({ where: { id } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');

    const schema = z.object({
      reason: z.string().trim().max(1000).optional()
    });
    const payload = schema.parse(req.body);

    const winner = await db.auctionParticipant.findFirst({
      where: {
        auctionId: id,
        OR: [
          ...(auction.winnerSellerId ? [{ sellerUserId: auction.winnerSellerId }, { sellerOrgId: auction.winnerSellerId }] : []),
          { currentRank: 1 }
        ]
      }
    });

    const userOrgId = req.user?.organizationId ? String(req.user.organizationId) : "";
    const userId = req.user?.id ? String(req.user.id) : "";
    const isWinningSeller = Boolean(
      req.user && (
        req.user.role === 'admin' ||
        req.user.role === 'master_admin' ||
        (auction.winnerSellerId && (String(auction.winnerSellerId) === userId || String(auction.winnerSellerId) === userOrgId)) ||
        (winner && (
          (winner.sellerUserId && (String(winner.sellerUserId) === userId || String(winner.sellerUserId) === userOrgId)) ||
          (winner.sellerOrgId && (String(winner.sellerOrgId) === userOrgId || String(winner.sellerOrgId) === userId))
        ))
      )
    );

    if (!isWinningSeller) {
      throw new ApiError(403, 'Only the awarded supplier can decline this award offer', 'FORBIDDEN_AWARD_DECLINE');
    }

    // Invalidate caches
    invalidateProcurementAuctionCache(id);
    if (auction.referenceNo) invalidateProcurementAuctionCache(auction.referenceNo);
    if (auction.auctionCode) invalidateProcurementAuctionCache(auction.auctionCode);
    if (auction.linkedBidId) invalidateProcurementAuctionCache(auction.linkedBidId);
    if (auction.linkedRequirementId) invalidateProcurementAuctionCache(auction.linkedRequirementId);

    // Reset auction award state to CLOSED so buyer can award another bidder
    const updatedAuction = await db.auction.update({
      where: { id },
      data: {
        status: 'CLOSED',
        statusEnum: 'CLOSED',
        winnerSellerId: null,
        remarks: payload.reason ? `Award declined: ${payload.reason}` : 'Award offer declined by supplier'
      }
    });

    if (winner) {
      await db.auctionParticipant.update({
        where: { id: winner.id },
        data: {
          status: 'DECLINED',
          disqualificationReason: payload.reason || 'Award declined by supplier'
        }
      });
    }

    if (auction.linkedBidId) {
      await db.procurementBidAward.updateMany({
        where: {
          bidId: auction.linkedBidId,
          OR: [
            { sellerId: winner?.sellerUserId || auction.winnerSellerId || 0 },
            ...(winner?.sellerOrgId ? [{ sellerId: winner.sellerOrgId }] : [])
          ]
        },
        data: {
          awardStatus: 'DECLINED',
          remarks: payload.reason || 'Award declined by supplier'
        }
      }).catch(() => null);

      await db.procurementBidParticipation.updateMany({
        where: {
          bidId: auction.linkedBidId,
          OR: [
            ...(winner?.sellerUserId ? [{ sellerUserId: winner.sellerUserId }] : []),
            ...(winner?.sellerOrgId ? [{ sellerOrganizationId: winner.sellerOrgId }, { organizationId: winner.sellerOrgId }] : [])
          ]
        },
        data: {
          finalStatus: 'AWARD_DECLINED',
          rejectionReason: payload.reason || 'Award declined by supplier'
        }
      }).catch(() => null);

      await db.procurementBid.update({
        where: { id: auction.linkedBidId },
        data: { status: 'L1_GENERATED', lifecycleStage: 'EVALUATION' }
      }).catch(() => null);
    }

    await writeAuctionEvent(req, id, 'award_declined', `Award offer declined by supplier: ${payload.reason || 'No reason provided'}`, {
      participantId: winner?.id,
      reason: payload.reason
    });

    const buyerUserId = auction.createdByUserId;
    if (buyerUserId) {
      await notificationService.notifyUser(buyerUserId, {
        title: 'Award Offer Declined',
        message: `Supplier declined the award offer for Reverse Auction "${auction.title || auction.auctionCode || ('RA-' + auction.id)}". Reason: ${payload.reason || 'N/A'}. You may award another qualifying bidder.`,
        type: 'award_declined',
        redirectUrl: `/buyer/procurement/reverse-auction/${encodeURIComponent(auction.auctionCode || auction.id)}/result`
      }).catch(() => undefined);
    }

    try {
      broadcastToAuction(auction.id, {
        type: 'REVERSE_AUCTION_STATUS_CHANGED',
        auctionId: auction.id,
        status: 'AWARD_DECLINED',
        timestamp: new Date().toISOString()
      });
      broadcastToAuction(auction.id, {
        type: 'REVERSE_AUCTION_UPDATED',
        auctionId: auction.id,
        status: 'AWARD_DECLINED',
        timestamp: new Date().toISOString()
      });
      if (auction.linkedBidId) {
        broadcastToProcurement(auction.linkedBidId, {
          type: 'BID_REJECTED',
          procurementId: auction.linkedBidId,
          status: 'AWARD_DECLINED',
          sellerOrgId: winner?.sellerOrgId,
          timestamp: new Date().toISOString()
        });
        broadcastToProcurement(auction.linkedBidId, {
          type: 'PROCUREMENT_UPDATED',
          procurementId: auction.linkedBidId,
          requirementId: auction.linkedBidId,
          status: 'L1_GENERATED',
          timestamp: new Date().toISOString()
        });
      }
      if (auction.createdByUserId) {
        broadcastToUser(auction.createdByUserId, {
          type: 'BID_STATUS_CHANGED',
          auctionId: auction.id,
          procurementId: auction.linkedBidId || undefined,
          status: 'AWARD_DECLINED',
          timestamp: new Date().toISOString()
        });
      }
    } catch (bcErr) {
      logger.warn({ bcErr }, '[reverse-auction.routes] Broadcast failed for decline award');
    }

    return apiResponse.success(res, { auction: maskSensitive(updatedAuction) }, 200, 'Award offer declined');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to decline award offer', error.code || 'REVERSE_AUCTION_DECLINE_AWARD_ERROR');
  }
});

router.post('/reverse-auctions/:id/accept-and-generate-po', requirePermission('reverse_auction.award', orgScope), async (req: AuthRequest, res: Response) => {
  try {
    const id = await resolveAuctionId(req.params.id);
    if (!id) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    const schema = z.object({
      participantId: z.coerce.number().int().positive().optional(),
      remarks: z.string().trim().max(1000).optional()
    });
    const payload = schema.parse(req.body);

    const auction = await db.auction.findUnique({ where: { id } });
    if (!auction) throw new ApiError(404, 'Auction not found', 'AUCTION_NOT_FOUND');
    assertAuctionManager(req, auction);

    // Determine winner: either specified participant or fallback to matching seller or current rank 1
    let winner = payload.participantId
      ? await db.auctionParticipant.findFirst({ where: { id: payload.participantId, auctionId: id } })
      : null;

    if (!winner && payload.participantId) {
      // It might be a ProcurementBidParticipation id from a linked bid
      const bidPart = await db.procurementBidParticipation.findUnique({
        where: { id: payload.participantId },
        select: { sellerId: true, seller: { select: { organizationId: true } } }
      }).catch(() => null);

      if (bidPart) {
        winner = await db.auctionParticipant.findFirst({
          where: {
            auctionId: id,
            OR: [
              ...(bidPart.sellerId ? [{ sellerUserId: bidPart.sellerId }] : []),
              ...(bidPart.seller?.organizationId ? [{ sellerOrgId: bidPart.seller.organizationId }] : [])
            ]
          }
        });
      }
    }

    if (!winner) {
      winner = await db.auctionParticipant.findFirst({ where: { auctionId: id, currentRank: 1 } });
    }

    if (!winner) {
      winner = await db.auctionParticipant.findFirst({
        where: { auctionId: id },
        orderBy: [{ lastBidAmount: 'asc' }, { id: 'asc' }]
      });
    }

    if (!winner) {
      throw new ApiError(400, 'No qualifying participant found for this auction', 'NO_WINNER_FOUND');
    }

    const winningAmount = winner.lastBidAmount || auction.currentLowestAmount || auction.startPrice;

    // Resolve seller user ID
    let sellerUserId = winner.sellerUserId;
    if (!sellerUserId && winner.sellerOrgId) {
      const sellerUser = await db.user.findFirst({
        where: { organizationId: winner.sellerOrgId }
      });
      if (sellerUser) sellerUserId = sellerUser.id;
    }
    if (!sellerUserId) {
      sellerUserId = winner.sellerOrgId || 1;
    }

    const buyerId = req.user?.id || auction.createdByUserId;
    if (!buyerId) throw new ApiError(400, 'Buyer identity not found', 'BUYER_NOT_FOUND');

    const isNonL1 = (winner.currentRank || 1) !== 1;

    // Check if a Purchase Order already exists for this auction or linked procurement bid
    const bidAwards = auction.linkedBidId ? await db.procurementBidAward.findMany({
      where: { bidId: auction.linkedBidId },
      select: { id: true, sellerId: true, seller: { select: { organizationId: true } } }
    }) : [];
    const bidAwardIds = bidAwards.map((a: any) => a.id);
    const matchingBidAward = bidAwards.find((a: any) =>
      a.sellerId === sellerUserId ||
      (winner.sellerOrgId && a.seller?.organizationId === winner.sellerOrgId)
    );

    let po = await db.purchaseOrder.findFirst({
      where: {
        OR: [
          { sourceType: 'auction', sourceId: id },
          ...(bidAwardIds.length > 0 ? [
            {
              sourceType: 'procurement_bid_award',
              sourceId: { in: bidAwardIds }
            }
          ] : [])
        ]
      },
      include: {
        items: true,
        buyer: { select: { id: true, name: true, organization: { select: { organizationName: true } } } },
        seller: { select: { id: true, name: true, organization: { select: { organizationName: true } } } }
      }
    });

    if (!po) {
      const poNumber = `PO-RA-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

      // Create PurchaseOrder record
      po = await db.purchaseOrder.create({
        data: {
          poNumber,
          buyerId,
          sellerId: sellerUserId,
          title: `Purchase Order - Reverse Auction ${auction.auctionCode || auction.id} (${auction.title || 'Official Award'})`,
          amount: winningAmount,
          totalValue: Number(winningAmount),
          currency: auction.currency || 'INR',
          status: 'generated',
          poStatus: 'ISSUED',
          sourceType: 'auction',
          sourceId: auction.id,
          metadata: {
            bidId: auction.linkedBidId || null,
            awardId: matchingBidAward?.id || null,
            auctionId: auction.id,
            auctionCode: auction.auctionCode,
            winningBid: Number(winningAmount),
            winnerParticipantId: winner.id,
            winnerSellerOrgId: winner.sellerOrgId,
            isNonL1Award: isNonL1,
            rankAtAward: winner.currentRank || 1,
            overrideReason: isNonL1 ? payload.remarks : null,
            remarks: payload.remarks || (isNonL1 ? 'Accepted discretionary quote from Reverse Auction and generated Purchase Order.' : 'Accepted L1 quote from Reverse Auction and generated Purchase Order.')
          },
          items: {
            create: [
              {
                itemName: auction.title || 'Reverse Auction Sourced Items',
                description: auction.description || 'Awarded items per Reverse Auction specification',
                quantity: 1,
                unitOfMeasure: 'LOT',
                unitPrice: Number(winningAmount),
                totalAmount: Number(winningAmount)
              }
            ]
          }
        },
        include: {
          items: true,
          buyer: { select: { id: true, name: true, organization: { select: { organizationName: true } } } },
          seller: { select: { id: true, name: true, organization: { select: { organizationName: true } } } }
        }
      });

      // Create delivery workflow tracking
      await db.deliveryWorkflow.create({
        data: {
          purchaseOrderId: po.id,
          status: 'created'
        }
      }).catch(() => null);
    }

    // Finalize auction status
    const updatedAuction = await db.auction.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        statusEnum: 'AWARDED',
        finalizedAt: new Date(),
        actualClosedAt: auction.actualClosedAt || new Date(),
        winnerSellerId: sellerUserId,
        overrideReason: isNonL1 ? (payload.remarks || 'Discretionary award per procurement policy') : null,
        remarks: payload.remarks || `Purchase Order ${po.poNumber} generated.`
      }
    });

    // Mark winning participant as ACCEPTED
    await db.auctionParticipant.update({
      where: { id: winner.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date()
      }
    }).catch(() => null);

    // If linked to a procurementBid, mark it as PO_GENERATED / AWARDED
    if (auction.linkedBidId) {
      await db.procurementBid.update({
        where: { id: auction.linkedBidId },
        data: {
          status: 'PO_GENERATED',
          lifecycleStage: 'PO_ISSUED'
        }
      }).catch(() => null);

      const bidAward = await db.procurementBidAward.findFirst({
        where: {
          bidId: auction.linkedBidId,
          OR: [
            { sellerId: sellerUserId },
            ...(winner.sellerOrgId ? [{ seller: { organizationId: winner.sellerOrgId } }] : [])
          ]
        }
      });
      if (bidAward) {
        await db.procurementBidAward.update({
          where: { id: bidAward.id },
          data: { awardStatus: 'ACCEPTED' }
        }).catch(() => null);

        if (bidAward.participationId) {
          await db.procurementBidParticipation.update({
            where: { id: bidAward.participationId },
            data: { finalStatus: 'AWARDED' }
          }).catch(() => null);
        }
      }
    }

    // Write audit event
    await writeAuctionEvent(req, id, 'po_generated', `Purchase Order ${po.poNumber} generated for winning seller (Rank L${winner.currentRank || 1})`, {
      poNumber: po.poNumber,
      poId: po.id,
      winningAmount: Number(winningAmount),
      winnerSellerId: sellerUserId,
      isNonL1,
      overrideReason: isNonL1 ? payload.remarks : null
    });

    await notificationService.notifyUser(sellerUserId, {
      title: 'Purchase Order Issued',
      message: `Official Purchase Order #${po.poNumber} has been issued for Reverse Auction "${auction.title || auction.auctionCode}". Please accept the PO to commit to fulfillment.`,
      type: 'purchase_order',
      redirectUrl: `/seller/orders?orderId=${po.id}`
    }).catch(() => undefined);

    // Invalidate caches and broadcast lifecycle updates across linked bids and auction
    try {
      if (auction.linkedBidId) {
        invalidateBidCaches(auction.linkedBidId).catch(() => {});
        broadcastToProcurement(auction.linkedBidId, { type: 'PROCUREMENT_UPDATED', procurementId: auction.linkedBidId, status: 'PO_GENERATED', timestamp: new Date().toISOString() });
      }
      if (auction.id) {
        invalidateBidCaches(auction.id).catch(() => {});
        broadcastToAuction(auction.id, { type: 'REVERSE_AUCTION_STATUS_CHANGED', auctionId: auction.id, status: 'COMPLETED', timestamp: new Date().toISOString() });
      }
      if (auction.auctionCode) {
        invalidateBidCaches(auction.auctionCode).catch(() => {});
      }
    } catch {}

    return apiResponse.created(res, {
      success: true,
      purchaseOrder: po,
      auction: maskSensitive(updatedAuction),
      winner: maskSensitive(winner)
    }, `Purchase Order ${po.poNumber} generated successfully`);
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to generate Purchase Order from auction', error.code || 'REVERSE_AUCTION_PO_ERROR');
  }
});

export default router;
