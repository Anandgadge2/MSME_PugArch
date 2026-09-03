import { Router, type Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { apiResponse } from '../utils/apiResponse.js';
import { maskSensitive } from '../utils/maskSensitive.js';
import { auditLog } from '../modules/audit/audit.service.js';
import { shortCache } from '../middleware/httpCache.js';
import { deleteCache, invalidateByPattern } from '../services/cache.service.js';
import { redisKeys } from '../constants/redis-keys.js';

const router = Router();
const db = prisma as any;

const purgeBannerCache = async () => {
  await invalidateByPattern('cache:marketplace:*').catch(() => undefined);
  await deleteCache(redisKeys.cacheMarketplaceHome()).catch(() => undefined);
  await deleteCache('marketplace:home:v2').catch(() => undefined);
};

const adminRoles = ['admin', 'master_admin'];
const isAdmin = (req: AuthRequest) => adminRoles.includes(String(req.user?.role));

const audit = (req: AuthRequest, action: string, entityType: string, entityId?: number, metadata?: Record<string, unknown>) =>
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

const publicLocationSchema = z.object({
  location: z.enum(['HOME_HERO', 'MARKETPLACE_HOME', 'DASHBOARD']).default('HOME_HERO')
}).partial();

const bannerFieldsSchema = z.object({
  title: z.string().trim().min(2).max(160),
  subtitle: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().max(1000).optional().refine(
    val => !val || val === '' || /^\//.test(val) || /^https?:\/\/.+/.test(val) || /^data:image\/.+/.test(val),
    { message: 'imageUrl must be a valid absolute URL, relative path, data URI, or empty' }
  ),
  documentId: z.coerce.number().int().positive().optional(),
  targetUrl: z.string().trim().max(1000).optional(),
  ctaText: z.string().trim().max(100).optional(),
  ctaLink: z.string().trim().max(1000).optional(),
  bannerType: z.enum(['DEFAULT_ADMIN', 'TOP_BUYER_PROMOTION', 'TOP_SELLER_PROMOTION', 'TOP_SHG_PROMOTION', 'ANNOUNCEMENT']).default('DEFAULT_ADMIN'),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'HIDDEN']).optional(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
  durationDays: z.coerce.number().int().min(1).max(365).default(10),
  priority: z.coerce.number().int().min(0).max(100000).default(0),
  displayLocation: z.enum(['HOME_HERO', 'MARKETPLACE_HOME', 'DASHBOARD']).default('HOME_HERO'),
  remarks: z.string().trim().max(1000).optional()
});

const requireBannerImage = <T extends z.ZodTypeAny>(schema: T) => schema.refine((value: any) => Boolean(value.imageUrl || value.documentId), {
  message: 'Banner image URL or uploaded document id is required',
  path: ['imageUrl']
});

const bannerInputSchema = requireBannerImage(bannerFieldsSchema);

const orgBannerInputSchema = requireBannerImage(bannerFieldsSchema.omit({ bannerType: true, status: true, priority: true }).extend({
  bannerType: z.enum(['TOP_BUYER_PROMOTION', 'TOP_SELLER_PROMOTION', 'TOP_SHG_PROMOTION']).optional()
}));

const rejectSchema = z.object({ reason: z.string().trim().min(5).max(500) });
const rankingQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2020).max(2100).optional()
});
const grantSchema = z.object({
  organizationId: z.coerce.number().int().positive(),
  eligibilityType: z.enum(['TOP_BUYER', 'TOP_SELLER', 'TOP_SHG', 'MANUAL']).default('MANUAL'),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2020).max(2100),
  expiresAt: z.coerce.date().optional()
});
const revokeSchema = grantSchema.pick({ organizationId: true, eligibilityType: true, month: true, year: true });
const reorderSchema = z.object({
  items: z.array(z.object({ id: z.coerce.number().int().positive(), priority: z.coerce.number().int().min(0), displayOrder: z.coerce.number().int().min(0).optional() })).min(1).max(100)
});

const currentMonthYear = () => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

const monthWindow = (month: number, year: number) => {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
};

const safeBannerSelect = {
  id: true,
  title: true,
  subtitle: true,
  imageUrl: true,
  documentId: true,
  targetUrl: true,
  ctaText: true,
  ctaLink: true,
  bannerType: true,
  status: true,
  startAt: true,
  endAt: true,
  durationDays: true,
  priority: true,
  displayOrder: true,
  displayLocation: true,
  uploadedByOrgId: true,
  approvedAt: true,
  createdAt: true,
  updatedAt: true
};

const formatBannerImageUrl = (url: string | null | undefined, documentId?: number | null) => {
  if (url) {
    const trimmed = url.trim();
    if (trimmed.startsWith('/banners/')) {
      return `/api/files/raw${trimmed}`;
    }
    const gcsMatch = trimmed.match(/^https?:\/\/storage\.googleapis\.com\/[^/]+\/(.+)$/);
    if (gcsMatch) {
      return `/api/files/raw/${gcsMatch[1]}`;
    }
    return trimmed;
  }
  if (documentId) return `/api/files/${documentId}/view`;
  return url;
};

const withBannerImageUrls = (banners: any[]) => banners.map(banner => ({
  ...banner,
  imageUrl: formatBannerImageUrl(banner.imageUrl, banner.documentId)
}));

router.get('/banners/active', shortCache(60), async (req, res: Response) => {
  try {
    const query = publicLocationSchema.parse(req.query);
    const now = new Date();
    const banners = await db.marketplaceBanner.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        displayLocation: query.location || 'HOME_HERO',
        status: { in: ['ACTIVE', 'APPROVED'] },
        OR: [{ startAt: null }, { startAt: { lte: now } }],
        AND: [{ OR: [{ endAt: null }, { endAt: { gt: now } }] }]
      },
      select: safeBannerSelect,
      orderBy: [{ priority: 'desc' }, { displayOrder: 'asc' }, { startAt: 'desc' }]
    });
    return apiResponse.success(res, { banners: maskSensitive(withBannerImageUrls(banners)) });
  } catch (error: any) {
    return apiResponse.error(res, 500, 'Unable to load active banners', 'ACTIVE_BANNERS_ERROR');
  }
});

router.get('/my-org/banner-eligibility', authenticate, authorize('buyer', 'seller', 'admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = currentMonthYear();
    if (!req.user?.organizationId && !isAdmin(req)) return apiResponse.success(res, { eligible: false, eligibility: [] });
    const eligibility = await db.bannerEligibility.findMany({
      where: {
        organizationId: req.user?.organizationId || -1,
        isEligible: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      orderBy: { createdAt: 'desc' }
    });
    const banners = await db.marketplaceBanner.findMany({
      where: { uploadedByOrgId: req.user?.organizationId || -1, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    return apiResponse.success(res, { month, year, eligible: eligibility.length > 0, eligibility: maskSensitive(eligibility), banners: maskSensitive(withBannerImageUrls(banners)) });
  } catch (error: any) {
    return apiResponse.error(res, 500, 'Unable to load banner eligibility', 'BANNER_ELIGIBILITY_ERROR');
  }
});

router.post('/my-org/banner-upload', authenticate, authorize('buyer', 'seller', 'admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const payload = orgBannerInputSchema.parse(req.body);
    const orgId = req.user?.organizationId;
    if (!orgId) return apiResponse.error(res, 403, 'Organization context is required', 'ORG_REQUIRED');
    const eligibility = await db.bannerEligibility.findFirst({
      where: {
        organizationId: orgId,
        isEligible: true,
        usedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      orderBy: { createdAt: 'desc' }
    });
    if (!eligibility && !isAdmin(req)) {
      return apiResponse.error(res, 403, 'Your organization is not eligible for promotional banner upload right now', 'BANNER_NOT_ELIGIBLE');
    }
    const startAt = payload.startAt || new Date();
    const endAt = payload.endAt || new Date(startAt.getTime() + payload.durationDays * 24 * 60 * 60 * 1000);
    const banner = await db.marketplaceBanner.create({
      data: {
        title: payload.title,
        subtitle: payload.subtitle || null,
        imageUrl: payload.imageUrl || null,
        documentId: payload.documentId || null,
        targetUrl: payload.targetUrl || null,
        ctaLink: payload.targetUrl || null,
        bannerType: payload.bannerType || (eligibility?.eligibilityType === 'TOP_SELLER' ? 'TOP_SELLER_PROMOTION' : eligibility?.eligibilityType === 'TOP_SHG' ? 'TOP_SHG_PROMOTION' : 'TOP_BUYER_PROMOTION'),
        status: 'PENDING_APPROVAL',
        startAt,
        endAt,
        durationDays: payload.durationDays,
        displayLocation: payload.displayLocation,
        uploadedByOrgId: orgId,
        uploadedByUserId: req.user?.id,
        remarks: payload.remarks || null,
        isActive: false
      }
    });
    if (eligibility) await db.bannerEligibility.update({ where: { id: eligibility.id }, data: { usedAt: new Date() } });
    await audit(req, 'banner.uploaded_by_org', 'marketplaceBanner', banner.id, { organizationId: orgId });
    return apiResponse.created(res, maskSensitive(banner), 'Banner uploaded for approval');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to upload banner', error.code || 'BANNER_UPLOAD_ERROR');
  }
});

router.get('/admin/banners', authenticate, authorize('admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const where = { deletedAt: null, ...(status ? { status } : {}) };
    const banners = await db.marketplaceBanner.findMany({ where, orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }], take: 200 });
    return apiResponse.success(res, { banners: maskSensitive(withBannerImageUrls(banners)) });
  } catch (error: any) {
    return apiResponse.error(res, 500, 'Unable to load banners', 'ADMIN_BANNERS_ERROR');
  }
});

router.post('/admin/banners', authenticate, authorize('admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const payload = bannerInputSchema.parse(req.body);
    const startAt = payload.startAt || new Date();
    const endAt = payload.endAt || new Date(startAt.getTime() + payload.durationDays * 24 * 60 * 60 * 1000);
    const banner = await db.marketplaceBanner.create({
      data: {
        ...payload,
        ctaLink: payload.targetUrl || undefined,
        startAt,
        endAt,
        uploadedByUserId: req.user?.id,
        status: payload.status || 'ACTIVE',
        isActive: ['ACTIVE', 'APPROVED'].includes(payload.status || 'ACTIVE')
      }
    });
    await audit(req, 'banner.created_by_admin', 'marketplaceBanner', banner.id);
    await purgeBannerCache();
    return apiResponse.created(res, maskSensitive(banner), 'Banner created');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to create banner', error.code || 'ADMIN_BANNER_CREATE_ERROR');
  }
});

router.patch('/admin/banners/:id', authenticate, authorize('admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const payload = bannerFieldsSchema.partial().parse(req.body);
    const updateData: any = { ...payload };
    if (payload.ctaLink || payload.targetUrl) updateData.ctaLink = payload.ctaLink || payload.targetUrl;
    if (payload.targetUrl || payload.ctaLink) updateData.targetUrl = payload.targetUrl || payload.ctaLink;
    if (payload.status) updateData.isActive = ['ACTIVE', 'APPROVED'].includes(payload.status);
    const banner = await db.marketplaceBanner.update({
      where: { id },
      data: updateData
    });
    await audit(req, 'banner.updated', 'marketplaceBanner', id, payload);
    await purgeBannerCache();
    return apiResponse.success(res, maskSensitive(banner), 200, 'Banner updated');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to update banner', error.code || 'ADMIN_BANNER_UPDATE_ERROR');
  }
});

router.put('/admin/banners/:id', authenticate, authorize('admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const payload = bannerFieldsSchema.partial().parse(req.body);
    const updateData: any = { ...payload };
    if (payload.ctaLink || payload.targetUrl) updateData.ctaLink = payload.ctaLink || payload.targetUrl;
    if (payload.targetUrl || payload.ctaLink) updateData.targetUrl = payload.targetUrl || payload.ctaLink;
    if (payload.status) updateData.isActive = ['ACTIVE', 'APPROVED'].includes(payload.status);
    const banner = await db.marketplaceBanner.update({
      where: { id },
      data: updateData
    });
    await audit(req, 'banner.updated', 'marketplaceBanner', id, payload);
    await purgeBannerCache();
    return apiResponse.success(res, maskSensitive(banner), 200, 'Banner updated');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to update banner', error.code || 'ADMIN_BANNER_UPDATE_ERROR');
  }
});

const bannerStatusAction = (status: string, isActive: boolean) => async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const extra = status === 'APPROVED' || status === 'ACTIVE'
      ? { approvedByUserId: req.user?.id, approvedAt: new Date() }
      : {};
    const banner = await db.marketplaceBanner.update({ where: { id }, data: { status, isActive, ...extra } });
    await audit(req, `banner.${status.toLowerCase()}`, 'marketplaceBanner', id);
    await purgeBannerCache();
    return apiResponse.success(res, maskSensitive(banner));
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to update banner status', error.code || 'BANNER_STATUS_ERROR');
  }
};

router.post('/admin/banners/:id/approve', authenticate, authorize('admin', 'master_admin'), bannerStatusAction('APPROVED', true));
router.post('/admin/banners/:id/show', authenticate, authorize('admin', 'master_admin'), bannerStatusAction('ACTIVE', true));
router.post('/admin/banners/:id/hide', authenticate, authorize('admin', 'master_admin'), bannerStatusAction('HIDDEN', false));

router.post('/admin/banners/:id/reject', authenticate, authorize('admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const payload = rejectSchema.parse(req.body);
    const banner = await db.marketplaceBanner.update({ where: { id }, data: { status: 'REJECTED', isActive: false, rejectionReason: payload.reason } });
    await audit(req, 'banner.rejected', 'marketplaceBanner', id, { reason: payload.reason });
    await purgeBannerCache();
    return apiResponse.success(res, maskSensitive(banner), 200, 'Banner rejected');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to reject banner', error.code || 'BANNER_REJECT_ERROR');
  }
});

router.delete('/admin/banners/:id', authenticate, authorize('admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const banner = await db.marketplaceBanner.update({ where: { id }, data: { status: 'DELETED', isActive: false, deletedAt: new Date() } });
    await audit(req, 'banner.deleted', 'marketplaceBanner', id);
    await purgeBannerCache();
    return apiResponse.success(res, maskSensitive(banner), 200, 'Banner deleted');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to delete banner', error.code || 'BANNER_DELETE_ERROR');
  }
});

router.patch('/admin/banners/reorder', authenticate, authorize('admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const payload = reorderSchema.parse(req.body);
    await Promise.all(payload.items.map(item => db.marketplaceBanner.update({ where: { id: item.id }, data: { priority: item.priority, displayOrder: item.displayOrder ?? item.priority } })));
    await audit(req, 'banner.reordered', 'marketplaceBanner', undefined, { count: payload.items.length });
    await purgeBannerCache();
    return apiResponse.success(res, { success: true }, 200, 'Banners reordered');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to reorder banners', error.code || 'BANNER_REORDER_ERROR');
  }
});

const computeRankings = async (month: number, year: number, adminUserId?: number) => {
  const { start, end } = monthWindow(month, year);
  const payments = await db.paymentTransaction.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      OR: [
        { status: { in: ['success', 'settled', 'escrow_released', 'PORTAL_PAYMENT_SUCCESS', 'OFFLINE_PROOF_VERIFIED', 'SETTLED'] } },
        { paymentStatus: { in: ['SUCCESS', 'PORTAL_PAYMENT_SUCCESS', 'OFFLINE_PROOF_VERIFIED', 'SETTLED'] } }
      ]
    },
    include: {
      payer: { select: { organizationId: true } },
      payee: { select: { organizationId: true } }
    }
  });

  const payeeOrgIds = Array.from(new Set(payments.map(p => Number(p.payee?.organizationId)).filter(Boolean)));
  const payeeOrgs = payeeOrgIds.length > 0 ? await db.organization.findMany({
    where: { id: { in: payeeOrgIds } },
    select: { id: true, organizationType: true, shgProfiles: { select: { id: true } } }
  }) : [];
  const shgOrgIdSet = new Set(
    payeeOrgs
      .filter((o: any) => o.organizationType === 'SHG' || Boolean(o.shgProfiles))
      .map((o: any) => o.id)
  );

  const buyerTotals = new Map<number, { total: number; count: number }>();
  const sellerTotals = new Map<number, { total: number; count: number }>();
  const shgTotals = new Map<number, { total: number; count: number }>();

  for (const payment of payments) {
    const amount = Number(payment.amount || 0);
    const buyerOrgId = Number(payment.payer?.organizationId || 0);
    const sellerOrgId = Number(payment.payee?.organizationId || 0);
    if (buyerOrgId) {
      const current = buyerTotals.get(buyerOrgId) || { total: 0, count: 0 };
      buyerTotals.set(buyerOrgId, { total: current.total + amount, count: current.count + 1 });
    }
    if (sellerOrgId) {
      if (shgOrgIdSet.has(sellerOrgId)) {
        const current = shgTotals.get(sellerOrgId) || { total: 0, count: 0 };
        shgTotals.set(sellerOrgId, { total: current.total + amount, count: current.count + 1 });
      } else {
        const current = sellerTotals.get(sellerOrgId) || { total: 0, count: 0 };
        sellerTotals.set(sellerOrgId, { total: current.total + amount, count: current.count + 1 });
      }
    }
  }

  const persist = async (type: 'BUYER' | 'SELLER' | 'SHG', rows: Array<[number, { total: number; count: number }]>) => {
    const ranked = rows.sort((a, b) => b[1].total - a[1].total).map(([organizationId, value], index) => ({ organizationId, value, rank: index + 1 }));
    for (const row of ranked) {
      const rank = await db.organizationMonthlyRank.upsert({
        where: { organizationId_organizationType_month_year: { organizationId: row.organizationId, organizationType: type, month, year } },
        update: {
          totalPurchaseValue: type === 'BUYER' ? row.value.total : 0,
          totalSalesValue: type !== 'BUYER' ? row.value.total : 0,
          orderCount: row.value.count,
          rank: row.rank,
          computedAt: new Date()
        },
        create: {
          organizationId: row.organizationId,
          organizationType: type,
          month,
          year,
          totalPurchaseValue: type === 'BUYER' ? row.value.total : 0,
          totalSalesValue: type !== 'BUYER' ? row.value.total : 0,
          orderCount: row.value.count,
          rank: row.rank
        }
      });
      if (row.rank <= 3) {
        const eligibilityType = type === 'BUYER' ? 'TOP_BUYER' : type === 'SHG' ? 'TOP_SHG' : 'TOP_SELLER';
        await db.bannerEligibility.upsert({
          where: {
            organizationId_month_year_eligibilityType: {
              organizationId: row.organizationId,
              month,
              year,
              eligibilityType
            }
          },
          update: { isEligible: true, rankId: rank.id, revokedByUserId: null, expiresAt: new Date(Date.UTC(year, month, 15)) },
          create: {
            organizationId: row.organizationId,
            rankId: rank.id,
            eligibilityType,
            month,
            year,
            grantedByUserId: adminUserId || null,
            expiresAt: new Date(Date.UTC(year, month, 15))
          }
        });
      }
    }
    return ranked;
  };

  return {
    buyers: await persist('BUYER', Array.from(buyerTotals.entries())),
    sellers: await persist('SELLER', Array.from(sellerTotals.entries())),
    shgs: await persist('SHG', Array.from(shgTotals.entries()))
  };
};

router.get('/admin/banner-eligibility/organizations', authenticate, authorize('admin', 'master_admin'), async (_req: AuthRequest, res: Response) => {
  try {
    const orgs = await db.organization.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        organizationName: true,
        organizationType: true,
        district: true,
        state: true,
        verificationStatus: true,
        shgProfiles: { select: { id: true, shgType: true } }
      },
      orderBy: { organizationName: 'asc' }
    });

    const sanitized = orgs.map((o: any) => ({
      id: o.id,
      organizationName: o.organizationName,
      organizationType: o.organizationType,
      district: o.district,
      state: o.state,
      verificationStatus: o.verificationStatus,
      isShg: o.organizationType === 'SHG' || Boolean(o.shgProfiles)
    }));

    return apiResponse.success(res, { organizations: maskSensitive(sanitized) });
  } catch (error: any) {
    return apiResponse.error(res, 500, 'Unable to load organizations', 'ORGS_LOAD_ERROR');
  }
});

router.get('/admin/rankings/monthly', authenticate, authorize('admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const fallback = currentMonthYear();
    const query = rankingQuerySchema.parse(req.query);
    const month = query.month || fallback.month;
    const year = query.year || fallback.year;
    const rankings = await db.organizationMonthlyRank.findMany({
      where: { month, year },
      orderBy: [{ organizationType: 'asc' }, { rank: 'asc' }]
    });

    const orgIds = Array.from(new Set(rankings.map(r => r.organizationId)));
    const orgs = orgIds.length > 0 ? await db.organization.findMany({
      where: { id: { in: orgIds } },
      select: {
        id: true,
        organizationName: true,
        organizationType: true,
        district: true,
        state: true,
        verificationStatus: true,
        gstin: true,
        udyamNumber: true,
        shgProfiles: { select: { id: true, shgType: true } }
      }
    }) : [];
    const orgMap = new Map<number, any>(orgs.map((o: any) => [o.id, o]));

    const eligibilities = orgIds.length > 0 ? await db.bannerEligibility.findMany({
      where: {
        organizationId: { in: orgIds },
        month,
        year
      }
    }) : [];
    const eligibilityMap = new Map<number, any>(eligibilities.map((e: any) => [e.organizationId, e]));

    const banners = orgIds.length > 0 ? await db.marketplaceBanner.findMany({
      where: {
        uploadedByOrgId: { in: orgIds },
        deletedAt: null
      },
      select: {
        id: true,
        title: true,
        status: true,
        isActive: true,
        uploadedByOrgId: true,
        imageUrl: true,
        documentId: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    }) : [];
    const bannerMap = new Map<number, any>();
    for (const b of banners) {
      if (!bannerMap.has(b.uploadedByOrgId)) {
        bannerMap.set(b.uploadedByOrgId, {
          ...b,
          imageUrl: formatBannerImageUrl(b.imageUrl, b.documentId)
        });
      }
    }

    const enrichedRankings = rankings.map((r: any) => {
      const org = orgMap.get(r.organizationId);
      const elig = eligibilityMap.get(r.organizationId);
      const banner = bannerMap.get(r.organizationId);

      return {
        ...r,
        organization: org ? {
          id: org.id,
          organizationName: org.organizationName,
          organizationType: org.organizationType,
          district: org.district,
          state: org.state,
          verificationStatus: org.verificationStatus,
          gstin: org.gstin,
          udyamNumber: org.udyamNumber,
          isShg: org.organizationType === 'SHG' || Boolean(org.shgProfiles)
        } : null,
        eligibility: elig ? {
          id: elig.id,
          isEligible: elig.isEligible,
          eligibilityType: elig.eligibilityType,
          usedAt: elig.usedAt,
          expiresAt: elig.expiresAt
        } : null,
        banner: banner ? {
          id: banner.id,
          title: banner.title,
          status: banner.status,
          isActive: banner.isActive,
          imageUrl: banner.imageUrl
        } : null
      };
    });

    return apiResponse.success(res, { month, year, rankings: maskSensitive(enrichedRankings) });
  } catch (error: any) {
    return apiResponse.error(res, 500, 'Unable to load monthly rankings', 'MONTHLY_RANKINGS_ERROR');
  }
});

router.post('/admin/rankings/compute-monthly', authenticate, authorize('admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const fallback = currentMonthYear();
    const body = rankingQuerySchema.parse(req.body);
    const month = body.month || fallback.month;
    const year = body.year || fallback.year;
    const result = await computeRankings(month, year, req.user?.id);
    await audit(req, 'ranking.computed', 'organizationMonthlyRank', undefined, { month, year });
    return apiResponse.success(res, maskSensitive({ month, year, ...result }), 200, 'Monthly rankings computed');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to compute rankings', error.code || 'RANKING_COMPUTE_ERROR');
  }
});

router.post('/admin/banner-eligibility/grant', authenticate, authorize('admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const payload = grantSchema.parse(req.body);
    const eligibility = await db.bannerEligibility.upsert({
      where: { organizationId_month_year_eligibilityType: { organizationId: payload.organizationId, month: payload.month, year: payload.year, eligibilityType: payload.eligibilityType } },
      update: { isEligible: true, grantedByUserId: req.user?.id, revokedByUserId: null, expiresAt: payload.expiresAt || null },
      create: { ...payload, grantedByUserId: req.user?.id, isEligible: true }
    });
    await audit(req, 'banner_eligibility.granted', 'bannerEligibility', eligibility.id, payload);
    return apiResponse.success(res, maskSensitive(eligibility), 200, 'Banner eligibility granted');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to grant eligibility', error.code || 'BANNER_ELIGIBILITY_GRANT_ERROR');
  }
});

router.post('/admin/banner-eligibility/revoke', authenticate, authorize('admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const payload = revokeSchema.parse(req.body);
    const eligibility = await db.bannerEligibility.update({
      where: { organizationId_month_year_eligibilityType: { organizationId: payload.organizationId, month: payload.month, year: payload.year, eligibilityType: payload.eligibilityType } },
      data: { isEligible: false, revokedByUserId: req.user?.id }
    });
    await audit(req, 'banner_eligibility.revoked', 'bannerEligibility', eligibility.id, payload);
    return apiResponse.success(res, maskSensitive(eligibility), 200, 'Banner eligibility revoked');
  } catch (error: any) {
    return apiResponse.error(res, error.statusCode || 400, error.message || 'Unable to revoke eligibility', error.code || 'BANNER_ELIGIBILITY_REVOKE_ERROR');
  }
});

export default router;
