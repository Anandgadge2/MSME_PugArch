/**
 * Delivery Tracking Service.
 *
 * Wraps the existing fulfillment workflow with the richer, role-aware delivery
 * lifecycle described in the procurement spec. The service is the single place
 * that mutates DeliveryTracking and writes DeliveryStatusLog rows so that audit,
 * notifications, and PO synchronization stay consistent.
 *
 * Design notes:
 *  - We never delete history. Status changes always insert a DeliveryStatusLog
 *    row in addition to advancing the parent record.
 *  - Every mutation funnels through {@link transitionStatus} which validates
 *    the allowed transition map (admin can override with a reason).
 *  - Notifications and audit logs are best-effort: failures must not block the
 *    business operation but they are logged.
 */

import prisma from '../../lib/prisma.js';
import { ApiError } from '../../utils/ApiError.js';
import { auditLog } from '../audit/audit.service.js';
import { notificationService } from '../../services/notification.service.js';
import { poStatusEnumFor } from '../../services/workflow/status-transition.service.js';
import {
  DELIVERY_STATUS_TRANSITIONS,
  DELIVERY_NOTIFICATION_TYPE,
  TERMINAL_STATUSES,
  type DeliveryStatus,
  type DeliveryDocumentType,
  type DeliveryParticipantRole
} from './delivery.constants.js';

const db = prisma as any;

/**
 * Tunable transaction window. Defaults to 20s so that Neon serverless cold
 * starts (which can take 8-12s on the first query after idle) don't trip the
 * default 5s Prisma transaction timeout. maxWait is the time Prisma will wait
 * to even acquire a connection from the pool before giving up.
 */
const TX_OPTIONS = { timeout: 20_000, maxWait: 8_000 } as const;

export type DeliveryActor = {
  id: number;
  role: string;
  organizationId?: number;
  ipAddress?: string;
  userAgent?: string;
};

const safeAudit = (
  actor: DeliveryActor,
  action: string,
  entityType: string,
  entityId: number | string | undefined,
  metadata?: Record<string, unknown>
) =>
  auditLog({
    actorUserId: actor.id,
    actorRole: actor.role,
    action,
    entityType,
    entityId,
    ipAddress: actor.ipAddress,
    userAgent: actor.userAgent,
    metadata
  }).catch(() => undefined);

const safeNotify = (
  userId: number | null | undefined,
  title: string,
  message: string,
  redirectUrl: string,
  priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'
) => {
  if (!userId) return Promise.resolve(null);
  return (async () => {
    // Respect the user's procurement alert preference. If they've muted
    // procurement notifications, silently skip both the in-app + email push.
    try {
      const pref = await db.notificationPreference.findUnique({ where: { userId } });
      if (pref && pref.procurementAlerts === false) return null;
    } catch {
      // If the preference fetch fails, fall through and notify by default.
    }
    return notificationService
      .notifyWithEmail(userId, {
        title,
        message,
        type: DELIVERY_NOTIFICATION_TYPE,
        priority,
        redirectUrl
      })
      .catch(() => null);
  })();
};

const isAdmin = (actor: DeliveryActor) => actor.role === 'admin';

const fetchDpExtensions = async (deliveryTrackingId: number) => {
  try {
    if ((db as any).deliveryDpExtension?.findMany) {
      return await (db as any).deliveryDpExtension.findMany({
        where: { deliveryTrackingId },
        orderBy: { createdAt: 'desc' },
        include: {
          requestedBy: { select: { id: true, name: true } },
          respondedBy: { select: { id: true, name: true } }
        }
      });
    }
  } catch {
    // fallback if table/relation not available
  }
  return [];
};

const loadDelivery = async (id: number) => {
  const delivery = await db.deliveryTracking.findUnique({
    where: { id },
    include: {
      purchaseOrder: {
        include: {
          buyer: true,
          seller: true,
          invoices: {
            orderBy: { createdAt: 'desc' },
            include: {
              invoiceFile: { select: { id: true, originalName: true, mimeType: true } }
            }
          }
        }
      },
      documents: { include: { fileAsset: true } },
      participants: { where: { isActive: true }, include: { user: true } },
      acceptance: true,
      settlement: true,
      logisticsPartner: true,
      events: { orderBy: { occurredAt: 'desc' } },
      statusLogs: { orderBy: { createdAt: 'desc' } }
    }
  });
  if (!delivery) throw new ApiError(404, 'Delivery not found', 'DELIVERY_NOT_FOUND');
  delivery.dpExtensions = await fetchDpExtensions(delivery.id);
  return delivery;
};

const loadDeliveryByPO = async (purchaseOrderId: number) => {
  const delivery = await db.deliveryTracking.findFirst({
    where: { purchaseOrderId },
    orderBy: { createdAt: 'desc' },
    include: {
      purchaseOrder: {
        include: {
          buyer: true,
          seller: true,
          invoices: {
            orderBy: { createdAt: 'desc' },
            include: {
              invoiceFile: { select: { id: true, originalName: true, mimeType: true } }
            }
          }
        }
      },
      documents: { include: { fileAsset: true } },
      participants: { where: { isActive: true }, include: { user: true } },
      acceptance: true,
      settlement: true,
      logisticsPartner: true,
      events: { orderBy: { occurredAt: 'desc' } },
      statusLogs: { orderBy: { createdAt: 'desc' } }
    }
  });
  if (!delivery) return null;
  delivery.dpExtensions = await fetchDpExtensions(delivery.id);
  return delivery;
};

const isParticipant = (delivery: any, userId: number, role?: DeliveryParticipantRole) =>
  Array.isArray(delivery.participants) &&
  delivery.participants.some(
    (p: any) => p.userId === userId && p.isActive && (!role || p.participantRole === role)
  );

/**
 * Resolve the actor's effective access role for this delivery. A buyer may also
 * be the consignee. A seller-side user might be assigned as logistics. Admin is
 * always granted.
 */
export const resolveAccessRole = (delivery: any, actor: DeliveryActor) => {
  if (isAdmin(actor)) return 'admin';
  const po = delivery.purchaseOrder;
  if (po?.sellerId === actor.id || actor.role === 'seller') return 'seller';
  if (po?.buyerId === actor.id || actor.role === 'buyer') return 'buyer';
  if (isParticipant(delivery, actor.id, 'CONSIGNEE')) return 'consignee';
  if (isParticipant(delivery, actor.id, 'LOGISTICS_PARTNER')) return 'logistics';
  if (isParticipant(delivery, actor.id, 'FINANCE_OFFICER')) return 'finance';
  if (isParticipant(delivery, actor.id, 'DISPUTE_OFFICER')) return 'dispute';
  return null;
};

const ensureAccess = (delivery: any, actor: DeliveryActor) => {
  const accessRole = resolveAccessRole(delivery, actor);
  if (!accessRole) {
    if (actor.role === 'seller' || actor.role === 'buyer' || actor.role === 'admin') return actor.role;
    throw new ApiError(403, 'Access denied', 'DELIVERY_ACCESS_DENIED');
  }
  return accessRole;
};

const ensureRole = (
  delivery: any,
  actor: DeliveryActor,
  allowed: Array<'seller' | 'buyer' | 'consignee' | 'logistics' | 'finance' | 'dispute' | 'admin'>
) => {
  let accessRole = resolveAccessRole(delivery, actor);
  if (!accessRole && allowed.includes(actor.role as any)) {
    accessRole = actor.role as any;
  }
  if (!accessRole || !allowed.includes(accessRole as any)) {
    throw new ApiError(403, 'You are not allowed to perform this action', 'DELIVERY_ROLE_FORBIDDEN');
  }
  return accessRole;
};

const ensureNotTerminal = (delivery: any) => {
  if (TERMINAL_STATUSES.includes(delivery.status)) {
    throw new ApiError(
      409,
      `Delivery is ${delivery.status} and cannot be modified`,
      'DELIVERY_TERMINAL'
    );
  }
};

const validateTransition = (
  current: DeliveryStatus,
  next: DeliveryStatus,
  options: { adminOverride?: boolean } = {}
) => {
  if (current === next) return;
  if (options.adminOverride) return;
  const allowed = DELIVERY_STATUS_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    throw new ApiError(
      409,
      `Delivery cannot transition from ${current} to ${next}`,
      'DELIVERY_STATUS_TRANSITION_INVALID'
    );
  }
};

/**
 * Atomic status transition: writes DeliveryTracking, DeliveryTrackingEvent,
 * DeliveryStatusLog, and (optionally) advances the linked PO status.
 */
const transitionStatus = async (
  tx: any,
  delivery: any,
  next: DeliveryStatus,
  actor: DeliveryActor,
  meta: {
    location?: string;
    remarks?: string;
    occurredAt?: Date;
    fileAssetId?: number;
    extra?: Record<string, unknown>;
    adminOverride?: boolean;
    extraData?: Record<string, unknown>;
    poStatus?: string;
  } = {}
) => {
  validateTransition(delivery.status, next, { adminOverride: meta.adminOverride });

  const updateData: Record<string, unknown> = {
    status: next,
    currentLocation: meta.location ?? delivery.currentLocation,
    ...(meta.extraData || {})
  };

  if (next === 'DELIVERED') updateData.actualDelivery = meta.occurredAt || new Date();
  if (next === 'CLOSED') updateData.closedAt = new Date();

  const updated = await tx.deliveryTracking.update({ where: { id: delivery.id }, data: updateData });

  await tx.deliveryTrackingEvent.create({
    data: {
      deliveryTrackingId: delivery.id,
      status: next,
      location: meta.location,
      remarks: meta.remarks,
      occurredAt: meta.occurredAt || new Date()
    }
  });

  let validActorUserId: number | null = null;
  if (actor?.id && Number.isInteger(actor.id) && actor.id > 0) {
    const userExists = await tx.user.findUnique({ where: { id: actor.id }, select: { id: true } });
    if (userExists) validActorUserId = actor.id;
  }

  await tx.deliveryStatusLog.create({
    data: {
      deliveryTrackingId: delivery.id,
      previousStatus: delivery.status,
      newStatus: next,
      changedById: validActorUserId,
      actorRole: actor.role,
      remarks: meta.remarks,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      fileAssetId: meta.fileAssetId,
      metadata: meta.extra ? meta.extra : undefined
    }
  });

  if (meta.poStatus) {
    await tx.purchaseOrder.update({
      where: { id: delivery.purchaseOrderId },
      data: {
        status: meta.poStatus,
        poStatus: poStatusEnumFor(meta.poStatus as any) as any,
        version: { increment: 1 }
      }
    }).catch(() => undefined);
  }

  return updated;
};

/* =====================================================================
 * High-level operations
 * =================================================================== */

const operationOrThrow = async <T>(operation: Promise<T>): Promise<T> => operation;

const notifyOrderParties = async (
  delivery: any,
  next: DeliveryStatus,
  actor: DeliveryActor,
  remarks?: string
) => {
  const po = delivery.purchaseOrder;
  if (!po) return;
  const title = `Delivery ${next.replace(/_/g, ' ').toLowerCase()}`;
  const message = `Order ${po.poNumber || po.id} is now ${next}${remarks ? ` - ${remarks}` : ''}`;
  const isUrgent = ['DISPUTE_RAISED', 'DELIVERY_FAILED', 'SELLER_REJECTED', 'REJECTED'].includes(next);
  const priority = isUrgent ? 'high' : 'medium';
  // Notify both buyer and seller for transparency, and any participants too.
  const recipients = new Set<number>();
  if (po.buyerId && po.buyerId !== actor.id) recipients.add(po.buyerId);
  if (po.sellerId && po.sellerId !== actor.id) recipients.add(po.sellerId);
  for (const participant of delivery.participants || []) {
    if (participant.userId && participant.userId !== actor.id) recipients.add(participant.userId);
  }
  await Promise.allSettled(
    [...recipients].map(uid => safeNotify(uid, title, message, `/dashboard/delivery/${delivery.id}`, priority))
  );
};

export const calculateLiquidatedDamages = (delivery: any) => {
  const po = delivery.purchaseOrder;
  const poValue = Number(po?.amount || po?.totalValue || 0);

  const approvedExtension = (delivery.dpExtensions || []).find((ext: any) => ext.status === 'APPROVED');
  const isWaived = approvedExtension?.waiveLd === true;
  const effectiveExpectedDate = approvedExtension?.approvedDeliveryDate || delivery.expectedDelivery || po?.expectedDelivery;

  if (!poValue || !effectiveExpectedDate) {
    return {
      delayDays: 0,
      weeklyRate: 0.005,
      maxCapPercent: 10,
      calculatedLdAmount: 0,
      isWaived,
      effectiveExpectedDate: effectiveExpectedDate || null,
      poValue
    };
  }

  const endDate = delivery.actualDelivery ? new Date(delivery.actualDelivery) : new Date();
  const expDate = new Date(effectiveExpectedDate);

  if (endDate <= expDate) {
    return {
      delayDays: 0,
      weeklyRate: 0.005,
      maxCapPercent: 10,
      calculatedLdAmount: 0,
      isWaived,
      effectiveExpectedDate,
      poValue
    };
  }

  const diffMs = endDate.getTime() - expDate.getTime();
  const delayDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const delayWeeks = delayDays / 7;

  const unCappedLd = poValue * (0.005 * delayWeeks);
  const maxCapAmount = poValue * 0.10;
  const rawLdAmount = Math.min(unCappedLd, maxCapAmount);
  const calculatedLdAmount = isWaived ? 0 : Math.round(rawLdAmount * 100) / 100;

  return {
    delayDays,
    weeklyRate: 0.005,
    maxCapPercent: 10,
    calculatedLdAmount,
    isWaived,
    effectiveExpectedDate,
    poValue
  };
};

const MANUAL_DELIVERY_FLOW: DeliveryStatus[] = [
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED'
];

const nextManualDeliveryStatus = (current: DeliveryStatus): DeliveryStatus | null => {
  if (current === 'DISPATCHED') return 'IN_TRANSIT';
  const index = MANUAL_DELIVERY_FLOW.indexOf(current);
  if (index < 0 || index >= MANUAL_DELIVERY_FLOW.length - 1) return null;
  return MANUAL_DELIVERY_FLOW[index + 1];
};

const manualStatusExtraData = (next: DeliveryStatus, occurredAt?: Date) => {
  if (next === 'PICKED_UP') return { pickedUpAt: occurredAt || new Date() };
  return undefined;
};

export const deliveryService = {
  resolveAccessRole,

  /**
   * One-time backfill helper: ensures every purchase order has a
   * DeliveryTracking row. Useful after the module is first deployed against an
   * existing database. Idempotent.
   */
  async backfillDeliveriesForExistingPOs(actor: DeliveryActor) {
    if (!isAdmin(actor)) {
      throw new ApiError(403, 'Admin access required', 'BACKFILL_ADMIN_ONLY');
    }
    const orphans = await db.purchaseOrder.findMany({
      where: {
        status: { notIn: ['cancelled', 'completed'] },
        deliveryTrackings: { none: {} }
      },
      select: { id: true, expectedDelivery: true }
    });
    if (orphans.length === 0) return { created: 0 };
    await db.deliveryTracking.createMany({
      data: orphans.map((po: any) => ({
        purchaseOrderId: po.id,
        status: 'CREATED',
        expectedDelivery: po.expectedDelivery || null
      })),
      skipDuplicates: true
    });
    void safeAudit(actor, 'delivery.backfill', 'deliveryTracking', undefined, { count: orphans.length });
    return { created: orphans.length };
  },

  async listForActor(actor: DeliveryActor, query: Record<string, unknown> = {}) {
    // Auto-seed delivery records for the actor's POs so the list reflects
    // every active order even if the seller hasn't manually started dispatch.
    //
    // PRODUCTION SAFETY: this fires off a write on every list-page visit. In
    // dev that's a feature; in prod it would let any user trigger a hidden
    // bulk insert. So we gate it behind a flag that defaults to ON in dev and
    // OFF everywhere else. Admins can run a one-shot backfill via the
    // dedicated POST /api/delivery/admin/backfill endpoint when needed.
    const autoSeedEnabled =
      process.env.DELIVERY_AUTO_SEED === 'true' ||
      (process.env.NODE_ENV !== 'production' && process.env.DELIVERY_AUTO_SEED !== 'false');

    if (autoSeedEnabled) {
      if (actor.role === 'seller' || actor.role === 'buyer') {
        const ownedPOs = await db.purchaseOrder.findMany({
          where: {
            ...(actor.role === 'seller' ? { sellerId: actor.id } : { buyerId: actor.id }),
            status: { notIn: ['cancelled', 'completed'] },
            deliveryTrackings: { none: {} }
          },
          select: { id: true, expectedDelivery: true }
        });
        if (ownedPOs.length > 0) {
          await db.deliveryTracking.createMany({
            data: ownedPOs.map((po: any) => ({
              purchaseOrderId: po.id,
              status: 'CREATED',
              expectedDelivery: po.expectedDelivery || null
            })),
            skipDuplicates: true
          }).catch(() => undefined);
        }
      } else if (isAdmin(actor)) {
        // Admin sees everything: backfill deliveries for any orphan POs so the
        // console reflects the full universe of active orders.
        const orphanCount = await db.purchaseOrder.count({
          where: {
            status: { notIn: ['cancelled', 'completed'] },
            deliveryTrackings: { none: {} }
          }
        }).catch(() => 0);
        if (orphanCount > 0) {
          const orphans = await db.purchaseOrder.findMany({
            where: {
              status: { notIn: ['cancelled', 'completed'] },
              deliveryTrackings: { none: {} }
            },
            select: { id: true, expectedDelivery: true },
            take: 500
          });
          await db.deliveryTracking.createMany({
            data: orphans.map((po: any) => ({
              purchaseOrderId: po.id,
              status: 'CREATED',
              expectedDelivery: po.expectedDelivery || null
            })),
            skipDuplicates: true
          }).catch(() => undefined);
        }
      }
    }

    const where: any = {};
    if (!isAdmin(actor)) {
      where.OR = [
        { purchaseOrder: { sellerId: actor.id } },
        { purchaseOrder: { buyerId: actor.id } },
        { participants: { some: { userId: actor.id, isActive: true } } }
      ];
      if (query.role === 'seller') where.AND = [...(where.AND || []), { purchaseOrder: { sellerId: actor.id } }];
      if (query.role === 'buyer') where.AND = [...(where.AND || []), { purchaseOrder: { buyerId: actor.id } }];
      if (query.role === 'consignee') where.AND = [...(where.AND || []), { participants: { some: { userId: actor.id, participantRole: 'CONSIGNEE', isActive: true } } }];
      if (query.role === 'logistics') where.AND = [...(where.AND || []), { participants: { some: { userId: actor.id, participantRole: 'LOGISTICS_PARTNER', isActive: true } } }];
      if (query.role === 'finance') where.AND = [...(where.AND || []), { participants: { some: { userId: actor.id, participantRole: 'FINANCE_OFFICER', isActive: true } } }];
    }
    if (query.status) where.status = query.status;
    if (query.q) {
      const term = String(query.q).trim();
      if (term.length > 0) {
        const searchClauses = [
          { trackingNumber: { contains: term, mode: 'insensitive' as const } },
          { carrierName: { contains: term, mode: 'insensitive' as const } },
          { logisticsPartnerName: { contains: term, mode: 'insensitive' as const } },
          { currentLocation: { contains: term, mode: 'insensitive' as const } },
          { purchaseOrder: { poNumber: { contains: term, mode: 'insensitive' as const } } },
          { purchaseOrder: { title: { contains: term, mode: 'insensitive' as const } } },
          { purchaseOrder: { seller: { name: { contains: term, mode: 'insensitive' as const } } } },
          { purchaseOrder: { buyer: { name: { contains: term, mode: 'insensitive' as const } } } }
        ];
        where.AND = [...(where.AND || []), { OR: searchClauses }];
      }
    }
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) (where.createdAt as any).gte = new Date(query.fromDate as string);
      if (query.toDate) (where.createdAt as any).lte = new Date(query.toDate as string);
    }
    const take = Math.min(100, Math.max(1, Number(query.pageSize ?? query.take ?? 50)));
    const skip = query.page ? (Math.max(1, Number(query.page)) - 1) * take : Math.max(0, Number(query.skip ?? 0));
    const [records, total] = await Promise.all([
      db.deliveryTracking.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        // Lean payload for list views — heavy fields (events, settlement,
        // acceptance, logisticsPartner) are loaded only when the detail
        // page calls /delivery/:id. This shaves multiple sub-queries off
        // every list request and dropped Neon-cold-start latency from ~6s
        // to <1.5s for typical org sizes.
        include: {
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              title: true,
              amount: true,
              totalValue: true,
              expectedDelivery: true,
              status: true,
              poStatus: true,
              buyer: { select: { id: true, name: true } },
              seller: { select: { id: true, name: true } }
            }
          },
          logisticsPartner: { select: { id: true, name: true } }
        },
        skip,
        take
      }),
      db.deliveryTracking.count({ where })
    ]);
    return { records, total, skip, take };
  },

  async getDetail(actor: DeliveryActor, id: number) {
    const delivery = await loadDelivery(id);
    ensureAccess(delivery, actor);
    return delivery;
  },

  async getByPurchaseOrder(actor: DeliveryActor, purchaseOrderId: number) {
    const delivery = await loadDeliveryByPO(purchaseOrderId);
    if (!delivery) {
      // Fall back to PO ownership check, since the PO might not have a delivery yet.
      const po = await db.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
      if (!po) throw new ApiError(404, 'Purchase order not found', 'PO_NOT_FOUND');
      if (!isAdmin(actor) && po.buyerId !== actor.id && po.sellerId !== actor.id) {
        throw new ApiError(403, 'Access denied', 'PO_ACCESS_DENIED');
      }
      return null;
    }
    ensureAccess(delivery, actor);
    return delivery;
  },

  async getTimeline(actor: DeliveryActor, id: number) {
    const delivery = await loadDelivery(id);
    ensureAccess(delivery, actor);
    return {
      delivery,
      events: delivery.events,
      statusLogs: delivery.statusLogs
    };
  },

  /**
   * Idempotent ensure: returns existing delivery for a PO or creates a fresh
   * CREATED record. Used both internally and by the seller dispatch flow.
   */
  async ensureDeliveryForPO(actor: DeliveryActor, purchaseOrderId: number, input: Record<string, any> = {}) {
    const po = await db.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
    if (!po) throw new ApiError(404, 'Purchase order not found', 'PO_NOT_FOUND');
    if (!isAdmin(actor) && po.sellerId !== actor.id && po.buyerId !== actor.id) {
      throw new ApiError(403, 'Access denied', 'PO_ACCESS_DENIED');
    }
    let delivery = await loadDeliveryByPO(purchaseOrderId);
    if (delivery) return delivery;

    delivery = await db.deliveryTracking.create({
      data: {
        purchaseOrderId,
        status: 'CREATED',
        trackingNumber: input.trackingNumber || undefined,
        carrierName: input.carrierName || undefined,
        expectedDelivery: input.expectedDelivery || po.expectedDelivery || undefined,
        currentLocation: input.currentLocation || undefined,
        logisticsPartnerId: input.logisticsPartnerId || undefined,
        logisticsPartnerName: input.logisticsPartnerName || undefined,
        remarks: input.remarks || undefined
      }
    });

    await db.deliveryStatusLog.create({
      data: {
        deliveryTrackingId: delivery.id,
        previousStatus: null,
        newStatus: 'CREATED',
        changedById: actor.id,
        actorRole: actor.role,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        remarks: input.remarks || 'Delivery record created'
      }
    });

    void safeAudit(actor, 'delivery.created', 'deliveryTracking', delivery.id, { purchaseOrderId });
    return loadDelivery(delivery.id);
  },

  /* ===== Seller actions ===== */

  async sellerAccept(actor: DeliveryActor, id: number, body: { remarks?: string; expectedDelivery?: any }) {
    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['seller', 'admin']);
    ensureNotTerminal(delivery);
    let parsedExpDate: Date | undefined = undefined;
    if (body.expectedDelivery) {
      const d = body.expectedDelivery instanceof Date ? body.expectedDelivery : new Date(body.expectedDelivery);
      if (!isNaN(d.getTime())) parsedExpDate = d;
    }
    const updated = await db.$transaction(tx =>
      transitionStatus(tx, delivery, 'SELLER_ACCEPTED', actor, {
        remarks: body.remarks,
        extraData: {
          sellerAcceptedAt: new Date(),
          expectedDelivery: parsedExpDate || delivery.expectedDelivery || undefined
        },
        poStatus: 'accepted'
      })
      , TX_OPTIONS);
    void safeAudit(actor, 'delivery.seller_accepted', 'deliveryTracking', id, { remarks: body.remarks });
    void notifyOrderParties(delivery, 'SELLER_ACCEPTED', actor, body.remarks);
    return updated;
  },

  async sellerReject(actor: DeliveryActor, id: number, body: { reason: string }) {
    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['seller', 'admin']);
    ensureNotTerminal(delivery);
    const updated = await db.$transaction(tx =>
      transitionStatus(tx, delivery, 'SELLER_REJECTED', actor, {
        remarks: body.reason,
        extraData: { sellerRejectedAt: new Date(), sellerRejectReason: body.reason },
        poStatus: 'cancelled'
      })
      , TX_OPTIONS);
    void safeAudit(actor, 'delivery.seller_rejected', 'deliveryTracking', id, { reason: body.reason });
    void notifyOrderParties(delivery, 'SELLER_REJECTED', actor, body.reason);
    return updated;
  },

  async setPacked(actor: DeliveryActor, id: number, body: any) {
    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['seller', 'admin']);
    ensureNotTerminal(delivery);
    const updated = await db.$transaction(tx =>
      transitionStatus(tx, delivery, 'PACKED', actor, {
        remarks: body.remarks,
        extraData: {
          packedAt: new Date(),
          packageWeightKg: body.packageWeightKg,
          packageDimensions: body.packageDimensions,
          packageCount: body.packageCount
        }
      })
      , TX_OPTIONS);
    void safeAudit(actor, 'delivery.packed', 'deliveryTracking', id, body);
    void notifyOrderParties(delivery, 'PACKED', actor, body.remarks);
    return updated;
  },

  async updateDispatchDetails(actor: DeliveryActor, id: number, body: any) {
    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['seller', 'admin']);
    ensureNotTerminal(delivery);
    if (body.trackingNumber) {
      const existing = await db.deliveryTracking.findFirst({
        where: { trackingNumber: body.trackingNumber, NOT: { id } }
      });
      if (existing) {
        throw new ApiError(409, 'Tracking number is already in use', 'DELIVERY_TRACKING_DUPLICATE');
      }
    }
    const updated = await db.deliveryTracking.update({
      where: { id },
      data: {
        trackingNumber: body.trackingNumber ?? delivery.trackingNumber,
        carrierName: body.carrierName ?? delivery.carrierName,
        logisticsPartnerId: body.logisticsPartnerId ?? delivery.logisticsPartnerId,
        logisticsPartnerName: body.logisticsPartnerName ?? delivery.logisticsPartnerName,
        logisticsContact: body.logisticsContact ?? delivery.logisticsContact,
        ewayBillNumber: body.ewayBillNumber ?? delivery.ewayBillNumber,
        courierReceiptNumber: body.courierReceiptNumber ?? delivery.courierReceiptNumber,
        expectedDelivery: body.expectedDelivery ?? delivery.expectedDelivery,
        remarks: body.remarks ?? delivery.remarks
      }
    });
    await db.deliveryStatusLog.create({
      data: {
        deliveryTrackingId: id,
        previousStatus: delivery.status,
        newStatus: delivery.status,
        changedById: actor.id,
        actorRole: actor.role,
        ipAddress: actor.ipAddress,
        userAgent: actor.userAgent,
        remarks: 'Dispatch details updated',
        metadata: body
      }
    });
    void safeAudit(actor, 'delivery.dispatch_details_updated', 'deliveryTracking', id, body);
    return updated;
  },

  async markReadyForPickup(actor: DeliveryActor, id: number, body: any) {
    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['seller', 'admin']);
    ensureNotTerminal(delivery);
    const updated = await db.$transaction(tx =>
      transitionStatus(tx, delivery, 'READY_FOR_PICKUP', actor, { remarks: body?.remarks })
      , TX_OPTIONS);
    void safeAudit(actor, 'delivery.ready_for_pickup', 'deliveryTracking', id, body);
    void notifyOrderParties(delivery, 'READY_FOR_PICKUP', actor, body?.remarks);
    return updated;
  },

  async markDispatched(actor: DeliveryActor, id: number, body: any) {
    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['seller', 'logistics', 'admin']);
    ensureNotTerminal(delivery);
    const updated = await db.$transaction(tx =>
      transitionStatus(tx, delivery, 'DISPATCHED', actor, {
        location: body?.location,
        remarks: body?.remarks,
        poStatus: 'in_fulfillment'
      })
      , TX_OPTIONS);
    void safeAudit(actor, 'delivery.dispatched', 'deliveryTracking', id, body);
    void notifyOrderParties(delivery, 'DISPATCHED', actor, body?.remarks);
    return updated;
  },

  /* ===== Manual tracking actions ===== */

  async manualStatusUpdate(actor: DeliveryActor, id: number, body: any) {
    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['seller', 'admin']);
    ensureNotTerminal(delivery);

    const requested = body.status as DeliveryStatus;
    const next = nextManualDeliveryStatus(delivery.status as DeliveryStatus);
    if (!next) {
      throw new ApiError(
        409,
        'Manual tracking updates start once the delivery is Ready for Pickup',
        'DELIVERY_MANUAL_STATUS_NOT_AVAILABLE'
      );
    }
    if (requested !== next) {
      throw new ApiError(
        409,
        `Next manual status must be ${next}`,
        'DELIVERY_MANUAL_STATUS_SEQUENCE_INVALID'
      );
    }

    const updated = await db.$transaction(tx =>
      transitionStatus(tx, delivery, next, actor, {
        remarks: body.remarks || `Manual seller update: ${next.replace(/_/g, ' ')}`,
        occurredAt: body.occurredAt,
        extraData: manualStatusExtraData(next, body.occurredAt),
        poStatus: next === 'DELIVERED' ? 'delivered' : undefined
      })
      , TX_OPTIONS);
    void safeAudit(actor, 'delivery.manual_status_update', 'deliveryTracking', id, { status: next });
    void notifyOrderParties(delivery, next, actor, body.remarks);
    return updated;
  },

  /* ===== Logistics actions ===== */

  async logisticsStatusUpdate(actor: DeliveryActor, id: number, body: any) {
    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['logistics', 'seller', 'admin']);
    ensureNotTerminal(delivery);
    const next = body.status as DeliveryStatus;
    const updated = await db.$transaction(tx =>
      transitionStatus(tx, delivery, next, actor, {
        location: body.location,
        remarks: body.remarks,
        occurredAt: body.occurredAt,
        extraData:
          next === 'PICKED_UP'
            ? { pickedUpAt: new Date() }
            : next === 'PICKUP_SCHEDULED'
              ? { pickupScheduledAt: new Date() }
              : undefined,
        poStatus: next === 'DELIVERED' ? 'delivered' : undefined
      })
      , TX_OPTIONS);
    void safeAudit(actor, 'delivery.logistics_update', 'deliveryTracking', id, body);
    void notifyOrderParties(delivery, next, actor, body.remarks);
    return updated;
  },

  /* ===== Documents ===== */

  async addDocument(
    actor: DeliveryActor,
    id: number,
    body: { documentType: DeliveryDocumentType; fileAssetId: number; description?: string }
  ) {
    const delivery = await loadDelivery(id);
    const accessRole = ensureAccess(delivery, actor);
    const fileAsset = await db.fileAsset.findUnique({ where: { id: body.fileAssetId } });
    if (!fileAsset) throw new ApiError(404, 'File asset not found', 'FILE_ASSET_NOT_FOUND');
    if (!isAdmin(actor) && fileAsset.ownerId !== actor.id) {
      throw new ApiError(403, 'You can only attach files you uploaded', 'FILE_ASSET_OWNERSHIP');
    }
    const document = await db.deliveryDocument.create({
      data: {
        deliveryTrackingId: id,
        fileAssetId: body.fileAssetId,
        documentType: body.documentType,
        uploadedById: actor.id,
        uploaderRole: actor.role,
        description: body.description
      }
    });
    void safeAudit(actor, 'delivery.document_uploaded', 'deliveryDocument', document.id, {
      documentType: body.documentType,
      accessRole
    });
    return document;
  },

  async listDocuments(actor: DeliveryActor, id: number) {
    const delivery = await loadDelivery(id);
    ensureAccess(delivery, actor);
    return db.deliveryDocument.findMany({
      where: { deliveryTrackingId: id },
      include: { fileAsset: true, uploadedBy: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' }
    });
  },

  /* ===== Buyer / Consignee actions ===== */

  async buyerOrConsigneeAccept(actor: DeliveryActor, id: number, body: any) {
    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['buyer', 'consignee', 'admin']);
    ensureNotTerminal(delivery);
    if (!['DELIVERED', 'DELIVERY_CONFIRMATION_PENDING', 'DISPUTE_RESOLVED'].includes(delivery.status)) {
      throw new ApiError(
        409,
        'Delivery must be marked as delivered before buyer/consignee can accept it',
        'DELIVERY_NOT_DELIVERED'
      );
    }
    const next: DeliveryStatus = body.accepted ? 'ACCEPTED' : 'REJECTED';
    const updated = await db.$transaction(async tx => {
      const transitioned = await transitionStatus(tx, delivery, next, actor, {
        remarks: body.remarks || body.rejectionReason
      });
      await tx.buyerAcceptance.upsert({
        where: { deliveryTrackingId: id },
        create: {
          deliveryTrackingId: id,
          acceptedById: actor.id,
          accepted: body.accepted,
          acceptedAt: body.accepted ? new Date() : null,
          rejectedAt: body.accepted ? null : new Date(),
          rejectionReason: body.rejectionReason,
          inspectionStatus: body.inspectionStatus,
          damageNotes: body.damageNotes,
          missingQuantity: body.missingQuantity,
          remarks: body.remarks
        },
        update: {
          acceptedById: actor.id,
          accepted: body.accepted,
          acceptedAt: body.accepted ? new Date() : null,
          rejectedAt: body.accepted ? null : new Date(),
          rejectionReason: body.rejectionReason,
          inspectionStatus: body.inspectionStatus,
          damageNotes: body.damageNotes,
          missingQuantity: body.missingQuantity,
          remarks: body.remarks
        }
      });

      if (body.accepted) {
        const existingGrn = await tx.goodsReceiptNote.findFirst({
          where: { purchaseOrderId: delivery.purchaseOrderId }
        });
        if (!existingGrn) {
          const po = await tx.purchaseOrder.findUnique({
            where: { id: delivery.purchaseOrderId },
            include: { items: true, buyer: true }
          });
          if (po) {
            const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const count = await tx.goodsReceiptNote.count({
              where: { createdAt: { gte: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`) } }
            });
            const grnNumber = `GRN-${day}-${String(count + 1).padStart(4, '0')}`;

            await tx.goodsReceiptNote.create({
              data: {
                grnNumber,
                purchaseOrderId: po.id,
                receivedById: actor.id,
                organizationId: po.buyer?.organizationId || actor.organizationId || 1,
                status: 'APPROVED',
                approvedById: actor.id,
                approvedAt: new Date(),
                remarks: body.remarks || 'GRN created on delivery acceptance',
                inspectionNote: body.inspectionStatus || 'Accepted by buyer',
                items: {
                  create: po.items.map((item: any) => ({
                    purchaseOrderItemId: item.id,
                    itemName: item.itemName || 'Item',
                    orderedQty: Number(item.quantity || 1),
                    receivedQty: Number(item.quantity || 1),
                    acceptedQty: Number(item.quantity || 1),
                    rejectedQty: Number(body.missingQuantity || 0),
                    unitOfMeasure: item.unitOfMeasure || 'pcs'
                  }))
                }
              }
            });
          }
        }
      }

      return transitioned;
    }, TX_OPTIONS);
    void safeAudit(actor, body.accepted ? 'delivery.buyer_accepted' : 'delivery.buyer_rejected', 'deliveryTracking', id, body);
    void notifyOrderParties(delivery, next, actor, body.remarks || body.rejectionReason);
    return updated;
  },

  async initiateReturn(actor: DeliveryActor, id: number, body: any) {
    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['buyer', 'consignee', 'admin']);
    ensureNotTerminal(delivery);
    const next: DeliveryStatus = body.type === 'REPLACEMENT' ? 'REPLACEMENT_REQUESTED' : 'RETURN_INITIATED';
    const updated = await db.$transaction(tx =>
      transitionStatus(tx, delivery, next, actor, { remarks: body.reason, extra: { type: body.type } })
      , TX_OPTIONS);
    void safeAudit(actor, 'delivery.return_initiated', 'deliveryTracking', id, body);
    void notifyOrderParties(delivery, next, actor, body.reason);
    return updated;
  },

  /* ===== Disputes ===== */

  async raiseDispute(actor: DeliveryActor, id: number, body: any) {
    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['buyer', 'seller', 'consignee', 'admin']);
    ensureNotTerminal(delivery);
    if (delivery.status === 'DISPUTE_RAISED') {
      throw new ApiError(409, 'A dispute is already open for this delivery', 'DELIVERY_DISPUTE_OPEN');
    }
    const po = delivery.purchaseOrder;
    const dispute = await db.$transaction(async tx => {
      const created = await tx.dispute.create({
        data: {
          purchaseOrderId: delivery.purchaseOrderId,
          buyerId: po.buyerId,
          sellerId: po.sellerId,
          raisedById: actor.id,
          category: body.category,
          reason: body.reason,
          status: 'open',
          statusEnum: 'OPEN'
        }
      });
      if (Array.isArray(body.evidenceFileAssetIds)) {
        for (const fileAssetId of body.evidenceFileAssetIds) {
          await tx.disputeEvidence.create({
            data: { disputeId: created.id, fileAssetId, uploadedById: actor.id }
          }).catch(() => undefined);
        }
      }
      await transitionStatus(tx, delivery, 'DISPUTE_RAISED', actor, {
        remarks: body.reason,
        extra: { disputeId: created.id, category: body.category }
      });
      return created;
    }, TX_OPTIONS);
    void safeAudit(actor, 'delivery.dispute_raised', 'dispute', dispute.id, { deliveryTrackingId: id });
    void notifyOrderParties(delivery, 'DISPUTE_RAISED', actor, body.reason);
    void notificationService
      .notifyAdminsWithEmail({
        title: `Delivery dispute raised`,
        message: `${body.category}: ${body.reason}`,
        type: DELIVERY_NOTIFICATION_TYPE,
        priority: 'high',
        redirectUrl: `/admin/disputes`
      })
      .catch(() => undefined);
    return dispute;
  },

  async resolveDispute(actor: DeliveryActor, id: number, body: any) {
    if (!isAdmin(actor)) {
      throw new ApiError(403, 'Only admin can resolve a delivery dispute', 'DELIVERY_DISPUTE_ADMIN_ONLY');
    }
    const delivery = await loadDelivery(id);
    if (delivery.status !== 'DISPUTE_RAISED') {
      throw new ApiError(409, 'Delivery is not in DISPUTE_RAISED state', 'DELIVERY_DISPUTE_NOT_OPEN');
    }
    const dispute = await db.dispute.findFirst({
      where: { purchaseOrderId: delivery.purchaseOrderId, status: 'open' },
      orderBy: { createdAt: 'desc' }
    });
    const updated = await db.$transaction(async tx => {
      if (dispute) {
        await tx.dispute.update({
          where: { id: dispute.id },
          data: {
            status: 'resolved',
            statusEnum: 'RESOLVED',
            resolvedById: actor.id,
            resolvedAt: new Date(),
            resolutionRemarks: body.resolutionRemarks
          }
        });
      }
      return transitionStatus(tx, delivery, 'DISPUTE_RESOLVED', actor, {
        remarks: body.resolutionRemarks,
        extra: { outcome: body.outcome, disputeId: dispute?.id }
      });
    }, TX_OPTIONS);
    void safeAudit(actor, 'delivery.dispute_resolved', 'deliveryTracking', id, body);
    void notifyOrderParties(delivery, 'DISPUTE_RESOLVED', actor, body.resolutionRemarks);
    return updated;
  },

  /* ===== Finance ===== */

  async verifyInvoice(actor: DeliveryActor, id: number, body: { invoiceId: number; remarks?: string }) {
    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['finance', 'admin']);
    ensureNotTerminal(delivery);
    if (delivery.status !== 'ACCEPTED') {
      throw new ApiError(
        409,
        'Invoice can only be verified after the buyer/consignee has accepted the delivery',
        'DELIVERY_NOT_ACCEPTED'
      );
    }
    const invoice = await db.invoice.findUnique({ where: { id: body.invoiceId } });
    if (!invoice || invoice.purchaseOrderId !== delivery.purchaseOrderId) {
      throw new ApiError(404, 'Invoice does not belong to this delivery', 'DELIVERY_INVOICE_MISMATCH');
    }
    const updated = await db.$transaction(async tx => {
      const transitioned = await transitionStatus(tx, delivery, 'INVOICE_VERIFIED', actor, {
        remarks: body.remarks,
        extra: { invoiceId: body.invoiceId }
      });
      await tx.paymentSettlement.upsert({
        where: { deliveryTrackingId: id },
        create: {
          deliveryTrackingId: id,
          invoiceId: body.invoiceId,
          status: 'INVOICE_VERIFIED',
          invoiceVerifiedAt: new Date(),
          invoiceVerifiedById: actor.id,
          remarks: body.remarks
        },
        update: {
          invoiceId: body.invoiceId,
          status: 'INVOICE_VERIFIED',
          invoiceVerifiedAt: new Date(),
          invoiceVerifiedById: actor.id,
          remarks: body.remarks
        }
      });
      return transitioned;
    }, TX_OPTIONS);
    void safeAudit(actor, 'delivery.invoice_verified', 'deliveryTracking', id, body);
    void notifyOrderParties(delivery, 'INVOICE_VERIFIED', actor, body.remarks);
    return updated;
  },

  async paymentDecision(
    actor: DeliveryActor,
    id: number,
    body: {
      approve: boolean;
      rejectionReason?: string;
      deductionAmount?: number;
      penaltyAmount?: number;
      remarks?: string;
    }
  ) {
    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['finance', 'admin']);
    ensureNotTerminal(delivery);
    if (delivery.status !== 'INVOICE_VERIFIED') {
      throw new ApiError(
        409,
        'Payment can only be decided after invoice is verified',
        'DELIVERY_INVOICE_NOT_VERIFIED'
      );
    }
    const next: DeliveryStatus = body.approve ? 'PAYMENT_APPROVED' : 'INVOICE_VERIFIED';
    await db.$transaction(async tx => {
      if (body.approve) {
        await transitionStatus(tx, delivery, next, actor, { remarks: body.remarks });
      }
      await tx.paymentSettlement.update({
        where: { deliveryTrackingId: id },
        data: body.approve
          ? {
            status: 'APPROVED',
            approvedAt: new Date(),
            approvedById: actor.id,
            deductionAmount: body.deductionAmount,
            penaltyAmount: body.penaltyAmount,
            remarks: body.remarks
          }
          : {
            status: 'REJECTED',
            rejectedAt: new Date(),
            rejectedById: actor.id,
            rejectionReason: body.rejectionReason,
            remarks: body.remarks
          }
      });
    }, TX_OPTIONS);
    // Fetch the refreshed delivery OUTSIDE the transaction so the heavy include
    // chain doesn't extend the tx window. Crucial on Neon cold starts where a
    // SELECT-with-relations can take 5-10s.
    const updated = body.approve ? await loadDeliveryByPO(delivery.purchaseOrderId) : delivery;
    void safeAudit(actor, body.approve ? 'delivery.payment_approved' : 'delivery.payment_rejected', 'deliveryTracking', id, body);
    void notifyOrderParties(delivery, body.approve ? 'PAYMENT_APPROVED' : 'INVOICE_VERIFIED', actor, body.remarks);
    return updated;
  },

  async releasePayment(
    actor: DeliveryActor,
    id: number,
    body: {
      transactionReference: string;
      netReleasedAmount?: number;
      paymentProofFileAssetId?: number;
      remarks?: string;
      twoFactorVerified?: boolean;
      otp?: string;
    }
  ) {
    // ── 2FA enforcement ──
    if (body.twoFactorVerified !== true) {
      throw new ApiError(
        403,
        'Two-factor authentication is required to release escrow payments. Please verify your identity via OTP before proceeding.',
        'DELIVERY_2FA_REQUIRED'
      );
    }

    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['finance', 'admin']);
    ensureNotTerminal(delivery);
    if (delivery.status !== 'PAYMENT_APPROVED') {
      throw new ApiError(
        409,
        'Payment must be approved before release',
        'DELIVERY_PAYMENT_NOT_APPROVED'
      );
    }
    const updated = await db.$transaction(async tx => {
      const settlement = await tx.paymentSettlement.findUnique({
        where: { deliveryTrackingId: id }
      });
      
      let redirectMetadata = {};
      let updatedRemarks = body.remarks;
      
      if (settlement?.invoiceId) {
        const factoring = await tx.invoiceFactoring.findUnique({
          where: { invoiceId: settlement.invoiceId }
        });
        
        if (factoring && factoring.status === 'DISBURSED') {
          await tx.invoiceFactoring.update({
            where: { invoiceId: settlement.invoiceId },
            data: { status: 'SETTLED' }
          });
          
          redirectMetadata = {
            factored: true,
            factoringId: factoring.id,
            financierId: factoring.financierId,
            originalSellerId: factoring.sellerId,
            discountRate: factoring.discountRate,
            feeAmount: factoring.feeAmount
          };
          
          updatedRemarks = `[Invoice Factored - Settled to Financier] ${body.remarks || ''}`.trim();
        }
      }

      await tx.paymentSettlement.update({
        where: { deliveryTrackingId: id },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
          releasedById: actor.id,
          transactionReference: body.transactionReference,
          netReleasedAmount: body.netReleasedAmount,
          remarks: updatedRemarks,
          metadata: settlement?.metadata ? { ...(settlement.metadata as any), ...redirectMetadata } : redirectMetadata
        }
      });
      return transitionStatus(tx, delivery, 'PAYMENT_RELEASED', actor, {
        remarks: updatedRemarks,
        fileAssetId: body.paymentProofFileAssetId,
        extra: { transactionReference: body.transactionReference, netReleasedAmount: body.netReleasedAmount, ...redirectMetadata }
      });
    }, TX_OPTIONS);
    // Auto-close delivery once payment is released; CLOSED is terminal.
    const closed = await db.$transaction(tx =>
      transitionStatus(tx, { ...delivery, status: 'PAYMENT_RELEASED' }, 'CLOSED', actor, {
        remarks: 'Order automatically closed after payment release'
      })
      , TX_OPTIONS);
    void safeAudit(actor, 'delivery.payment_released', 'deliveryTracking', id, body);
    void notifyOrderParties(delivery, 'PAYMENT_RELEASED', actor, body.remarks);
    return closed || updated;
  },

  /* ===== Admin ===== */

  async adminOverride(actor: DeliveryActor, id: number, body: any) {
    if (!isAdmin(actor)) {
      throw new ApiError(403, 'Only admin can override delivery status', 'DELIVERY_ADMIN_ONLY');
    }
    const delivery = await loadDelivery(id);
    const updated = await db.$transaction(tx =>
      transitionStatus(tx, delivery, body.status, actor, {
        location: body.location,
        remarks: body.reason,
        adminOverride: true,
        extra: { override: true }
      })
      , TX_OPTIONS);
    void safeAudit(actor, 'delivery.admin_override', 'deliveryTracking', id, body);
    void notifyOrderParties(delivery, body.status, actor, body.reason);
    return updated;
  },

  /* ===== Participants ===== */

  async assignParticipant(actor: DeliveryActor, id: number, body: any) {
    if (!isAdmin(actor)) {
      const delivery = await loadDelivery(id);
      const accessRole = ensureAccess(delivery, actor);
      if (!['admin', 'buyer'].includes(accessRole) && !(accessRole === 'seller' && body.participantRole === 'LOGISTICS_PARTNER')) {
        throw new ApiError(403, 'Only admin/buyer can assign participants', 'DELIVERY_ASSIGN_FORBIDDEN');
      }
    } else {
      await loadDelivery(id);
    }
    const user = await db.user.findUnique({ where: { id: body.userId } });
    if (!user) throw new ApiError(404, 'User not found', 'USER_NOT_FOUND');
    const participant = await db.deliveryParticipant.upsert({
      where: {
        deliveryParticipantCompound: {
          deliveryTrackingId: id,
          userId: body.userId,
          participantRole: body.participantRole
        }
      },
      create: {
        deliveryTrackingId: id,
        userId: body.userId,
        participantRole: body.participantRole,
        assignedById: actor.id,
        notes: body.notes
      },
      update: {
        isActive: true,
        assignedById: actor.id,
        assignedAt: new Date(),
        removedAt: null,
        notes: body.notes
      }
    });
    void safeAudit(actor, 'delivery.participant_assigned', 'deliveryParticipant', participant.id, body);
    return participant;
  },

  async removeParticipant(actor: DeliveryActor, id: number, participantId: number) {
    const delivery = await loadDelivery(id);
    if (!isAdmin(actor)) {
      const accessRole = resolveAccessRole(delivery, actor);
      if (accessRole !== 'buyer') {
        throw new ApiError(403, 'Only admin/buyer can remove participants', 'DELIVERY_REMOVE_FORBIDDEN');
      }
    }
    const participant = await db.deliveryParticipant.update({
      where: { id: participantId },
      data: { isActive: false, removedAt: new Date() }
    });
    void safeAudit(actor, 'delivery.participant_removed', 'deliveryParticipant', participantId);
    return participant;
  },

  /* ===== Logistics Partners ===== */

  async listLogisticsPartners() {
    return db.logisticsPartner.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  },

  async createLogisticsPartner(actor: DeliveryActor, body: any) {
    if (!isAdmin(actor)) {
      throw new ApiError(403, 'Only admin can create logistics partners', 'DELIVERY_LOGISTICS_ADMIN_ONLY');
    }
    const partner = await db.logisticsPartner.create({ data: body });
    void safeAudit(actor, 'delivery.logistics_partner_created', 'logisticsPartner', partner.id, body);
    return partner;
  },

  /* ===== Reports ===== */

  async report(actor: DeliveryActor, query: any) {
    if (!isAdmin(actor)) {
      throw new ApiError(403, 'Admin access required for reports', 'REPORT_ADMIN_ONLY');
    }
    const where: any = {};
    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) (where.createdAt as any).gte = new Date(query.fromDate);
      if (query.toDate) (where.createdAt as any).lte = new Date(query.toDate);
    }
    if (query.sellerId) where.purchaseOrder = { sellerId: query.sellerId };
    if (query.buyerId) where.purchaseOrder = { ...(where.purchaseOrder || {}), buyerId: query.buyerId };
    if (query.status) where.status = query.status;

    const [total, statusGroups, delayed] = await Promise.all([
      db.deliveryTracking.count({ where }),
      db.deliveryTracking.groupBy({ by: ['status'], where, _count: true }),
      db.deliveryTracking.count({
        where: {
          ...where,
          status: { notIn: ['DELIVERED', 'ACCEPTED', 'CLOSED', 'CANCELLED'] },
          expectedDelivery: { lt: new Date() }
        }
      })
    ]);

    const byStatus: Record<string, number> = {};
    for (const group of statusGroups) {
      byStatus[group.status] = (group as any)._count?._all ?? (group as any)._count ?? 0;
    }

    return {
      total,
      delayed,
      byStatus,
      pending: byStatus.CREATED || 0,
      delivered: byStatus.DELIVERED || 0,
      accepted: byStatus.ACCEPTED || 0,
      rejected: byStatus.REJECTED || 0,
      returned: byStatus.RETURNED || 0,
      paymentPendingAfterAcceptance:
        (byStatus.ACCEPTED || 0) + (byStatus.INVOICE_VERIFIED || 0) + (byStatus.PAYMENT_APPROVED || 0),
      disputed: byStatus.DISPUTE_RAISED || 0,
      slaBreaches: delayed
    };
  },

  /* ===== Liquidated Damages & DP Extension ===== */

  async getLdCalculation(actor: DeliveryActor, id: number) {
    const delivery = await loadDelivery(id);
    ensureAccess(delivery, actor);
    return calculateLiquidatedDamages(delivery);
  },

  async requestDpExtension(
    actor: DeliveryActor,
    id: number,
    body: { requestedDeliveryDate: Date; reason: string }
  ) {
    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['seller', 'admin']);
    ensureNotTerminal(delivery);

    const extension = await db.deliveryDpExtension.create({
      data: {
        deliveryTrackingId: id,
        purchaseOrderId: delivery.purchaseOrderId,
        requestedDeliveryDate: new Date(body.requestedDeliveryDate),
        reason: body.reason,
        status: 'PENDING',
        requestedById: actor.id
      }
    });

    void safeAudit(actor, 'delivery.dp_extension_requested', 'deliveryDpExtension', extension.id, body);
    void notifyOrderParties(
      delivery,
      delivery.status,
      actor,
      `DP Extension requested until ${new Date(body.requestedDeliveryDate).toISOString().split('T')[0]}: ${body.reason}`
    );

    return extension;
  },

  async respondDpExtension(
    actor: DeliveryActor,
    id: number,
    extId: number,
    body: { approved: boolean; approvedDeliveryDate?: Date; waiveLd?: boolean; remarks?: string }
  ) {
    const delivery = await loadDelivery(id);
    ensureRole(delivery, actor, ['buyer', 'admin']);
    ensureNotTerminal(delivery);

    const ext = await db.deliveryDpExtension.findUnique({ where: { id: extId } });
    if (!ext || ext.deliveryTrackingId !== id) {
      throw new ApiError(404, 'DP extension request not found', 'DP_EXTENSION_NOT_FOUND');
    }
    if (ext.status !== 'PENDING') {
      throw new ApiError(409, 'DP extension request has already been decided', 'DP_EXTENSION_ALREADY_DECIDED');
    }

    const nextStatus = body.approved ? 'APPROVED' : 'REJECTED';
    const finalDate = body.approved
      ? (body.approvedDeliveryDate ? new Date(body.approvedDeliveryDate) : ext.requestedDeliveryDate)
      : null;

    const updatedExt = await db.$transaction(async tx => {
      const res = await tx.deliveryDpExtension.update({
        where: { id: extId },
        data: {
          status: nextStatus,
          approvedDeliveryDate: finalDate,
          waiveLd: body.approved ? Boolean(body.waiveLd) : false,
          responseRemarks: body.remarks,
          respondedById: actor.id,
          respondedAt: new Date()
        }
      });

      if (body.approved && finalDate) {
        await tx.deliveryTracking.update({
          where: { id },
          data: { expectedDelivery: finalDate }
        });
        await tx.purchaseOrder.update({
          where: { id: delivery.purchaseOrderId },
          data: { expectedDelivery: finalDate }
        }).catch(() => undefined);
      }

      return res;
    }, TX_OPTIONS);

    void safeAudit(actor, body.approved ? 'delivery.dp_extension_approved' : 'delivery.dp_extension_rejected', 'deliveryDpExtension', extId, body);
    void notifyOrderParties(
      delivery,
      delivery.status,
      actor,
      `DP Extension ${nextStatus}: ${body.remarks || ''}`
    );

    return updatedExt;
  },

  async listDpExtensions(actor: DeliveryActor, id: number) {
    const delivery = await loadDelivery(id);
    ensureAccess(delivery, actor);
    return db.deliveryDpExtension.findMany({
      where: { deliveryTrackingId: id },
      include: {
        requestedBy: { select: { id: true, name: true, role: true } },
        respondedBy: { select: { id: true, name: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  },

  /* ===== Delivery OTP Verification (via Email) ===== */

  async sendDeliveryOtpEmail(actor: DeliveryActor, id: number) {
    const delivery = await loadDelivery(id);
    ensureAccess(delivery, actor);
    ensureNotTerminal(delivery);

    // Generate secure 6-digit numeric OTP
    const rawOtp = String(Math.floor(100000 + Math.random() * 900000));
    // Save hash (simple hash for comparison)
    const crypto = await import('crypto');
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h validity

    await db.deliveryTracking.update({
      where: { id },
      data: {
        deliveryOtpHash: otpHash,
        deliveryOtpExpiresAt: expiresAt
      }
    });

    const po = delivery.purchaseOrder;
    const buyerEmail = po?.buyer?.email;
    const recipientId = po?.buyerId;

    if (recipientId) {
      await safeNotify(
        recipientId,
        'Delivery Verification OTP',
        `Your 6-digit Delivery Verification OTP for Order #${po?.poNumber || id} is: ${rawOtp}. Share this OTP with the delivery agent or enter it on the portal upon physical receipt.`,
        `/dashboard/delivery/${id}`,
        'high'
      );
    }

    void safeAudit(actor, 'delivery.otp_sent', 'deliveryTracking', id, { buyerEmail });
    return { success: true, message: 'Delivery Verification OTP emailed to buyer' };
  },

  async verifyDeliveryOtp(actor: DeliveryActor, id: number, body: { otp: string }) {
    const delivery = await loadDelivery(id);
    ensureAccess(delivery, actor);

    if (!delivery.deliveryOtpHash || !delivery.deliveryOtpExpiresAt) {
      throw new ApiError(400, 'No active OTP found. Please request a new delivery OTP.', 'OTP_NOT_FOUND');
    }
    if (new Date() > new Date(delivery.deliveryOtpExpiresAt)) {
      throw new ApiError(400, 'Delivery OTP has expired. Please request a new OTP.', 'OTP_EXPIRED');
    }

    const crypto = await import('crypto');
    const inputHash = crypto.createHash('sha256').update(body.otp.trim()).digest('hex');

    if (inputHash !== delivery.deliveryOtpHash) {
      throw new ApiError(400, 'Invalid Delivery OTP code. Please double-check and try again.', 'OTP_INVALID');
    }

    const updated = await db.deliveryTracking.update({
      where: { id },
      data: {
        deliveryOtpVerifiedAt: new Date(),
        deliveryOtpHash: null,
        deliveryOtpExpiresAt: null
      }
    });

    await db.deliveryStatusLog.create({
      data: {
        deliveryTrackingId: id,
        previousStatus: delivery.status,
        newStatus: delivery.status,
        changedById: actor.id,
        actorRole: actor.role,
        remarks: 'Delivery physical receipt verified via 6-digit Email OTP'
      }
    });

    void safeAudit(actor, 'delivery.otp_verified', 'deliveryTracking', id);
    void notifyOrderParties(delivery, delivery.status, actor, 'Delivery OTP successfully verified!');
    return updated;
  },

  /* ===== Background Jobs: 10-Day Overdue Buyer Reminder & SLA Monitoring ===== */

  async processOverdue10DayBuyerReminders() {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const overdueDeliveries = await db.deliveryTracking.findMany({
      where: {
        status: { in: ['DELIVERED', 'DELIVERY_CONFIRMATION_PENDING'] },
        actualDelivery: { lte: tenDaysAgo },
        acceptance: null,
        OR: [
          { lastBuyerReminderSentAt: null },
          { lastBuyerReminderSentAt: { lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
        ]
      },
      include: { purchaseOrder: { include: { buyer: true } } },
      take: 100
    });

    let count = 0;
    for (const delivery of overdueDeliveries) {
      const po = delivery.purchaseOrder;
      if (po?.buyerId) {
        await safeNotify(
          po.buyerId,
          'Action Required: Delivery Inspection Acknowledgment',
          `Order #${po.poNumber || po.id} was delivered over 10 days ago (${delivery.actualDelivery ? new Date(delivery.actualDelivery).toLocaleDateString() : 'recently'}). Please inspect the items and acknowledge or update acceptance on the portal.`,
          `/dashboard/delivery/${delivery.id}`,
          'urgent'
        );
        await db.deliveryTracking.update({
          where: { id: delivery.id },
          data: { lastBuyerReminderSentAt: new Date() }
        }).catch(() => undefined);
        count++;
      }
    }
    return { remindedCount: count };
  },

  async processSlaBreachMonitoring() {
    const now = new Date();
    const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // 1. Check actual SLA breaches (overdue expected delivery)
    const breachedDeliveries = await db.deliveryTracking.findMany({
      where: {
        status: { notIn: ['DELIVERED', 'ACCEPTED', 'CLOSED', 'CANCELLED', 'REJECTED'] },
        expectedDelivery: { lt: now },
        NOT: { slaStatus: 'BREACHED' }
      },
      include: { purchaseOrder: true }
    });

    for (const delivery of breachedDeliveries) {
      await db.deliveryTracking.update({
        where: { id: delivery.id },
        data: { slaStatus: 'BREACHED' }
      });
      const po = delivery.purchaseOrder;
      if (po) {
        const msg = `SLA Breach: Delivery for PO #${po.poNumber || po.id} is overdue (expected by ${new Date(delivery.expectedDelivery!).toLocaleDateString()}).`;
        if (po.sellerId) safeNotify(po.sellerId, 'Delivery SLA Breached', msg, `/dashboard/delivery/${delivery.id}`, 'high');
        if (po.buyerId) safeNotify(po.buyerId, 'Delivery SLA Breached', msg, `/dashboard/delivery/${delivery.id}`, 'high');
      }
    }

    // 2. Check impending SLA breaches (due within 24-48h)
    const impendingDeliveries = await db.deliveryTracking.findMany({
      where: {
        status: { notIn: ['DELIVERED', 'ACCEPTED', 'CLOSED', 'CANCELLED', 'REJECTED', 'OUT_FOR_DELIVERY'] },
        expectedDelivery: { gte: now, lte: fortyEightHoursFromNow },
        slaStatus: 'ON_TIME'
      },
      include: { purchaseOrder: true }
    });

    for (const delivery of impendingDeliveries) {
      await db.deliveryTracking.update({
        where: { id: delivery.id },
        data: { slaStatus: 'IMPENDING_BREACH' }
      });
      const po = delivery.purchaseOrder;
      if (po?.sellerId) {
        const msg = `Impending SLA Alert: Delivery for PO #${po.poNumber || po.id} is due in less than 48 hours (${new Date(delivery.expectedDelivery!).toLocaleDateString()}). Please update dispatch/transit status.`;
        safeNotify(po.sellerId, 'Impending Delivery Deadline', msg, `/dashboard/delivery/${delivery.id}`, 'medium');
      }
    }

    return {
      breachedUpdated: breachedDeliveries.length,
      impendingUpdated: impendingDeliveries.length
    };
  }
};

export type DeliveryService = typeof deliveryService;
