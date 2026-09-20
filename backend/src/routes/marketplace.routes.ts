import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { deleteCache, getOrSetCache, invalidateByPattern } from '../services/cache.service.js';
import { redisKeys } from '../constants/redis-keys.js';
import { apiResponse } from '../utils/apiResponse.js';
import { authenticate, type AuthRequest } from '../middleware/authenticate.js';
import { authorize, checkFeatureEnabled } from '../middleware/authorize.js';
import { verifyAccessToken } from '../services/token.service.js';
import { longCache, shortCache } from '../middleware/httpCache.js';
import { sha256 } from '../utils/crypto.js';
import { formatRequirementNumber, getCanonicalLookupVariants } from '../utils/refIdUtils.js';
import { notifyPurchaseOrderCreated } from '../services/invoice-pdf.service.js';

const db = prisma as any;
const router = Router();

const paginationQuery = z.object({
    q: z.string().trim().max(120).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    category: z.string().trim().max(120).optional(),
    type: z.enum(['PRODUCT', 'SERVICE', 'BOTH']).optional(),
    location: z.string().trim().max(100).optional(),
    district: z.string().trim().max(100).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    priceMin: z.coerce.number().nonnegative().optional(),
    priceMax: z.coerce.number().nonnegative().optional(),
    discount: z.enum(['true', 'active', 'false']).optional(),
    verified: z.enum(['true', 'false']).optional(),
    verifiedSeller: z.enum(['true', 'false']).optional(),
    sort: z.enum(['popular', 'newest', 'latest', 'price_asc', 'price_desc', 'discount', 'most_purchased', 'verified', 'name']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(1000).default(12),
}).partial();

const ok = (res: Response, data: unknown) => res.json({ success: true, data });
const stableCacheHash = (value: unknown) => sha256(JSON.stringify(value));

const optionalAuthenticate = async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) return next();

    try {
        const decoded = verifyAccessToken(token);
        const user = await prisma.user.findUnique({
            where: { id: Number(decoded.id) },
            select: { id: true, role: true, sessionVersion: true, accountStatus: true, organizationId: true, }
        });
        if (user && user.accountStatus === 'ACTIVE' && user.role === decoded.role && user.sessionVersion === Number(decoded.sessionVersion)) {
            req.user = {
                id: user.id,
                role: user.role,
                sessionVersion: user.sessionVersion,
                permissions: [],
                organizationId: user.organizationId,
                
                enabledFeatures: []
            };
        }
    } catch {
        // Public marketplace pages should remain public if an optional token is stale.
    }

    return next();
};

const checkFeatureIfAuthenticated = (featureCode: string) => {
    return async (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) return next();
        // If user has no company context, allow through — marketplace pages are public
        // and should not block authenticated users who lack a companyId.
        
        
        // Only block if the feature is explicitly disabled for the company.
        // For new organizations, allow features by default.
        const disabledRecord = await (prisma as any).platformFeature.findFirst({
            where: { enabled: false, feature: { code: featureCode } }
        });
        if (disabledRecord) {
            return res.status(403).json({ success: false, message: 'Feature is disabled for this company', code: 'FEATURE_DISABLED' });
        }
        return next();
    };
};

const organizationLogoSelect = { id: true, url: true };
const organizationProfileBrandSelect = { logoUrl: true, isLargeIndustry: true, isBigMsme: true };
const sellerOrganizationWhere = {
    verificationStatus: 'VERIFIED',
    isBlacklisted: false,
    deletedAt: null,
    OR: [
        { users: { some: { role: 'shg', accountStatus: 'ACTIVE' } } },
        { users: { some: { role: 'seller', accountStatus: 'ACTIVE' } } },
        { sellerProfiles: { some: {} } },
        { shgProfiles: { applicationStatus: 'APPROVED', marketplaceEnabled: true } },
        { products: { some: {} } },
        { services: { some: {} } },
        { profile: { isBigMsme: true } },
        { organizationType: 'SHG' },
        { organizationType: 'MSME' }
    ]
};

const safeBuyerOrganizationSelect = {
    id: true,
    organizationName: true,
    organizationType: true,
    city: true,
    district: true,
    state: true,
    verificationStatus: true,
    logoFile: { select: organizationLogoSelect },
    profile: true,
    buyerProfiles: {
        where: {
            verificationStatus: 'VERIFIED',
            isActive: true
        },
        select: {
            id: true,
            logoUrl: true,
            bannerUrl: true
        }
    }
};

const requirementCategorySelect = { id: true, name: true, slug: true };

const publicRequirementListSelect = {
    id: true,
    title: true,
    requirementType: true,
    categoryId: true,
    createdById: true,
    buyerOrganizationId: true,
    description: true,
    quantity: true,
    unit: true,
    location: true,
    budgetMin: true,
    budgetMax: true,
    lastDate: true,
    visibility: true,
    status: true,
    isFeatured: true,
    isUrgent: true,
    approvedAt: true,
    createdAt: true,
    updatedAt: true,
    category: { select: requirementCategorySelect },
    buyerOrganization: { select: safeBuyerOrganizationSelect },
    _count: { select: { responses: true } }
};


const publicLegacyRequirementSelect = {
    id: true,
    requirementNumber: true,
    title: true,
    description: true,
    procurementMethod: true,
    canonicalMethod: true,
    payload: true,
    status: true,
    estimatedValue: true,
    currency: true,
    requiredBy: true,
    createdAt: true,
    updatedAt: true,
    buyer: {
        select: {
            id: true,
            name: true,
            organizationId: true,
            buyerProfile: { select: { organizationName: true, organizationType: true, city: true, district: true, state: true } }
        }
    },
    organization: { select: safeBuyerOrganizationSelect },
    category: { select: requirementCategorySelect },
    _count: { select: { tenders: true } }
};

const publicLegacyRequirementDetailSelect = {
    ...publicLegacyRequirementSelect,
    payload: true,
    items: {
        select: {
            id: true,
            productId: true,
            itemName: true,
            description: true,
            quantity: true,
            unitOfMeasure: true,
            estimatedUnitPrice: true,
            specifications: true,
            product: { select: { id: true, name: true, hsnCode: true, unitOfMeasure: true } }
        },
        orderBy: { id: 'asc' as const }
    },
    directPurchases: {
        select: {
            deliveryAddressText: true,
            department: true,
            budgetHead: true,
            costCenter: true,
            justification: true,
            remarks: true,
            deliveryInstructions: true,
            requiredDeliveryDate: true,
            totalAmount: true
        },
        take: 1,
        orderBy: { createdAt: 'desc' as const }
    },
    tenders: {
        select: {
            id: true,
            tenderId: true,
            title: true,
            status: true
        }
    }
};

const publicRequirementDetailSelect = {
    ...publicRequirementListSelect,
    requiredDocuments: true,
    contactPerson: true,
    terms: true,
    attachmentUrl: true
};

const ownerRequirementSelect = {
    ...publicRequirementDetailSelect,
    
    buyerOrganizationId: true,
    createdById: true,
    approvedById: true,
    contactPerson: true
};

const buyerResponseSelect = {
    id: true,
    requirementId: true,
    sellerOrganizationId: true,
    sellerUserId: true,
    offeredPrice: true,
    offeredQuantity: true,
    deliveryTimeline: true,
    message: true,
    attachmentUrl: true,
    terms: true,
    responseData: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    sellerUser: { select: { id: true, name: true, email: true, mobile: true, onboardingStatus: true } },
    sellerOrganization: { select: safeBuyerOrganizationSelect }
};

const sellerResponseSelect = {
    id: true,
    requirementId: true,
    sellerOrganizationId: true,
    sellerUserId: true,
    offeredPrice: true,
    offeredQuantity: true,
    deliveryTimeline: true,
    message: true,
    attachmentUrl: true,
    terms: true,
    responseData: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    requirement: { select: publicRequirementListSelect }
};

const requirementIncludes = {
    category: { select: { id: true, name: true, slug: true } },
    buyerOrganization: {
        select: {
            id: true,
            organizationName: true,
            organizationType: true,
            city: true,
            district: true,
            state: true,
            verificationStatus: true,
            profile: true
        }
    },
    _count: { select: { responses: true } }
};

const getPublicRequirementWhere = (user?: any) => {
    const isVerifiedSeller = user?.role === 'seller';
    const isAdmin = ['admin', 'master_admin'].includes(user?.role || '');
    return {
        status: { in: ['PUBLISHED', 'OPEN', 'CLOSED', 'AWARDED', 'UNDER_REVIEW', 'EXPIRED'] },
        ...((isVerifiedSeller || isAdmin) ? {} : { visibility: 'PUBLIC' as const })
    };
};

const closingSoonMs = 7 * 24 * 60 * 60 * 1000;

const computeRequirementState = (requirement: any) => {
    const rawStatus = String(requirement?.status || '').toUpperCase();
    const lastDateMs = requirement?.lastDate ? new Date(requirement.lastDate).getTime() : 0;
    const msRemaining = lastDateMs - Date.now();
    const daysRemaining = Number.isFinite(msRemaining) ? Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000))) : 0;

    if (rawStatus === 'AWARDED') return { code: 'AWARDED', label: 'Awarded', daysRemaining, timeRemaining: 'Awarded' };
    if (['CLOSED', 'CANCELLED', 'REJECTED'].includes(rawStatus) || (lastDateMs > 0 && msRemaining <= 0)) {
        return { code: 'CLOSED', label: 'Closed', daysRemaining: 0, timeRemaining: 'Closed' };
    }
    if (rawStatus === 'UNDER_REVIEW') return { code: 'UNDER_EVALUATION', label: 'Under Evaluation', daysRemaining, timeRemaining: 'Under evaluation' };
    if (msRemaining <= closingSoonMs) return { code: 'CLOSING_SOON', label: 'Closing Soon', daysRemaining, timeRemaining: `${daysRemaining}d left` };
    return { code: 'OPEN', label: 'Open', daysRemaining, timeRemaining: `${daysRemaining}d left` };
};

const decorateRequirement = (requirement: any) => {
    if (!requirement) return requirement;
    const state = computeRequirementState(requirement);
    return {
        ...requirement,
        buyerId: requirement.buyerId || requirement.createdById,
        buyerOrganizationId: requirement.buyerOrganizationId || requirement.buyerOrganization?.id,
        requirementNumber: formatRequirementNumber(requirement.id, requirement.requirementNumber, requirement.procurementMethod || requirement.canonicalMethod),
        bidStatus: state.code,
        computedStatus: state.code,
        statusLabel: state.label,
        daysRemaining: state.daysRemaining,
        timeRemaining: state.timeRemaining
    };
};

const mapLegacyRequirementToPublic = (requirement: any) => {
    if (!requirement) return requirement;
    const profile = requirement.buyer?.buyerProfile || {};
    const organization = requirement.organization || {
        id: requirement.buyer?.organizationId || requirement.buyer?.id || requirement.id,
        organizationName: profile.organizationName || requirement.buyer?.name || 'Verified buyer',
        organizationType: profile.organizationType || 'BUYER',
        city: profile.city,
        district: profile.district,
        state: profile.state,
        verificationStatus: 'VERIFIED'
    };
    const requiredBy = requirement.requiredBy || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const items = Array.isArray(requirement.items) ? requirement.items : [];
    const totalQty = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
    const primaryUnit = items[0]?.unitOfMeasure || null;
    const directPurchase = Array.isArray(requirement.directPurchases) ? requirement.directPurchases[0] : null;
    const procurementMethod = String(requirement.procurementMethod || '').replace(/_/g, ' ');
    const itemSummary = items.length
        ? items.map((item: any) => item.itemName).filter(Boolean).join(', ')
        : null;

    return decorateRequirement({
        id: -Number(requirement.id),
        buyerId: requirement.buyerId || requirement.buyer?.id,
        buyerOrganizationId: requirement.organizationId || requirement.organization?.id || requirement.buyer?.organizationId,
        sourceModel: 'REQUIREMENT',
        sourceId: requirement.id,
        title: requirement.title,
        requirementType: 'PRODUCT',
        categoryId: requirement.categoryId,
        description: requirement.description || requirement.title,
        quantity: totalQty > 0 ? totalQty : null,
        unit: primaryUnit,
        location: [organization.district || organization.city, organization.state].filter(Boolean).join(', ') || 'Jharsuguda, Odisha',
        budgetMin: requirement.estimatedValue || directPurchase?.totalAmount || null,
        budgetMax: requirement.estimatedValue || directPurchase?.totalAmount || null,
        lastDate: requiredBy,
        visibility: 'PUBLIC',
        status: requirement.status === 'FULFILLED' ? 'AWARDED' : requirement.status === 'CANCELLED' ? 'CANCELLED' : 'OPEN',
        isFeatured: false,
        isUrgent: false,
        approvedAt: requirement.updatedAt,
        createdAt: requirement.createdAt,
        updatedAt: requirement.updatedAt,
        category: requirement.category,
        buyerOrganization: organization,
        _count: { responses: (requirement._count?.tenders || 0) },
        requirementNumber: requirement.requirementNumber,
        procurementMethod: requirement.procurementMethod,
        canonicalMethod: requirement.canonicalMethod || requirement.procurementMethod,
        procurementMethodLabel: procurementMethod || null,
        submissionStartDate: (requirement.payload as any)?.schedule?.submissionStartDate || (requirement.payload as any)?.schedule?.startDate || (requirement.payload as any)?.tender?.bidStartDate || null,
        technicalOpeningDate: (requirement.payload as any)?.schedule?.technicalOpeningDate || (requirement.payload as any)?.tender?.technicalEvaluationDate || (requirement.payload as any)?.technicalOpeningDate || null,
        financialOpeningDate: (requirement.payload as any)?.schedule?.financialOpeningDate || (requirement.payload as any)?.tender?.financialEvaluationDate || (requirement.payload as any)?.financialOpeningDate || null,
        packetType: (requirement.payload as any)?.schedule?.packetType || (requirement.payload as any)?.rules?.packetType || (requirement.payload as any)?.packetType || ((requirement.payload as any)?.schedule?.financialOpeningDate ? 'TWO_PACKET' : 'SINGLE_PACKET'),
        payload: requirement.payload,
        estimatedValue: requirement.estimatedValue || directPurchase?.totalAmount || null,
        currency: requirement.currency || 'INR',
        items: items.map((item: any) => ({
            id: item.id,
            productId: item.productId,
            itemName: item.itemName,
            description: item.description,
            quantity: item.quantity,
            unitOfMeasure: item.unitOfMeasure,
            estimatedUnitPrice: item.estimatedUnitPrice,
            specifications: item.specifications,
            product: item.product || null
        })),
        itemSummary,
        directPurchase: directPurchase
            ? {
                deliveryAddressText: directPurchase.deliveryAddressText,
                department: directPurchase.department,
                budgetHead: directPurchase.budgetHead,
                costCenter: directPurchase.costCenter,
                justification: directPurchase.justification,
                remarks: directPurchase.remarks,
                deliveryInstructions: directPurchase.deliveryInstructions,
                requiredDeliveryDate: directPurchase.requiredDeliveryDate,
                totalAmount: directPurchase.totalAmount
            }
            : null,
        tenders: requirement.tenders
    });
};

const getPublicLegacyRequirementWhere = () => ({
    status: { in: ['APPROVED', 'SOURCING', 'FULFILLED', 'CLOSED', 'EXPIRED'] }
});

const mapProcurementBidToPublic = (bid: any) => {
    if (!bid) return bid;
    const org = bid.buyerOrganization || {};
    const tp = (bid.technicalPacket || {}) as any;
    const tpItems = Array.isArray(tp.items) ? tp.items : (Array.isArray(tp.lineItems) ? tp.lineItems : (Array.isArray(tp.boqTable) ? tp.boqTable : []));
    const consignees = Array.isArray(tp.consigneeDetails) ? tp.consigneeDetails : [];

    let resolvedQty: number | null = (bid.quantity != null && Number(bid.quantity) > 0) ? Number(bid.quantity) : null;
    let resolvedUnit: string | null = bid.unit || null;

    if (!resolvedQty && tpItems.length > 0) {
        resolvedQty = tpItems.reduce((acc: number, it: any) => acc + Number(it.quantity || it.qty || 0), 0);
        resolvedUnit = tpItems[0]?.unitOfMeasure || tpItems[0]?.unit || tpItems[0]?.uom || 'Nos';
    }
    if (!resolvedQty && consignees.length > 0) {
        resolvedQty = consignees.reduce((acc: number, c: any) => acc + Number(c.quantity || 0), 0);
        if (!resolvedUnit) {
            resolvedUnit = tpItems[0]?.unitOfMeasure || tpItems[0]?.unit || 'Nos';
        }
    }
    if (!resolvedUnit && resolvedQty) {
        resolvedUnit = 'Nos';
    }

    const formatState = (st?: string) => {
        if (!st) return '';
        const trimmed = st.trim();
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
    };
    const cleanDistrict = bid.district || org.district || 'Jharsuguda';
    const cleanState = formatState(bid.state || org.state || 'Odisha');
    const cleanLocation = [cleanDistrict, cleanState].filter(Boolean).join(', ') || 'Jharsuguda, Odisha';

    return decorateRequirement({
        id: bid.id,
        buyerId: bid.buyerId,
        buyerOrganizationId: bid.buyerOrganizationId || org.id,
        sourceModel: 'BID',
        sourceId: bid.bidNumber || bid.id,
        bidNumber: bid.bidNumber,
        title: bid.title,
        requirementType: (String(bid.bidType || '').toUpperCase().includes('SERVICE') || String(bid.procurementType || '').toUpperCase().includes('SERVICE')) ? 'SERVICE' : 'PRODUCT',
        description: bid.description || bid.title,
        quantity: resolvedQty,
        unit: resolvedUnit,
        location: cleanLocation,
        budgetMin: bid.estimatedValue != null ? Number(bid.estimatedValue) : null,
        budgetMax: bid.estimatedValue != null ? Number(bid.estimatedValue) : null,
        lastDate: bid.endDate,
        visibility: bid.visibility || 'PUBLIC',
        status: bid.status === 'EXPIRED' ? 'CLOSED' : (bid.status || 'OPEN'),
        isFeatured: false,
        isUrgent: false,
        approvedAt: bid.startDate || bid.createdAt,
        createdAt: bid.createdAt,
        updatedAt: bid.updatedAt,
        category: bid.category ? { id: 0, name: bid.category, slug: bid.category.toLowerCase().replace(/\s+/g, '-') } : null,
        buyerOrganization: {
            id: bid.buyerOrganizationId || org.id || bid.buyerId,
            organizationName: bid.buyerOrganizationName || org.organizationName || 'Verified Buyer',
            organizationType: bid.buyerType || org.organizationType || 'PRIVATE',
            district: cleanDistrict,
            state: cleanState,
            verificationStatus: org.verificationStatus || 'VERIFIED'
        },
        requirementNumber: bid.bidNumber,
        procurementMethod: bid.procurementType,
        canonicalMethod: bid.canonicalMethod || bid.procurementType,
        technicalPacket: bid.technicalPacket
    });
};


const loadLatestTenders = async (take = 6) => {
    const tenders = await db.tender?.findMany?.({
        where: { status: { in: ['published', 'bid_submission'] } },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        select: {
            id: true,
            tenderId: true,
            title: true,
            category: true,
            budget: true,
            description: true,
            status: true,
            closesAt: true,
            publishedAt: true,
            createdAt: true,
            buyer: { select: { id: true, name: true, buyerProfile: { select: { organizationName: true, state: true, district: true } } } },
            _count: { select: { bids: { where: { status: { not: 'withdrawn' } } } } }
        }
    }).catch(() => []);

    return (tenders || []).map((tender: any) => ({
        ...tender,
        bidsCount: tender._count?.bids ?? tender.bidsCount ?? 0,
        _count: undefined
    }));
};

const loadLatestProcurementBids = async (take = 6) => {
    const [procurementBids, tenderBidActivities] = await Promise.all([
        db.procurementBid?.findMany?.({
            where: {
                approvalStatus: 'APPROVED',
                status: { in: ['OPEN', 'APPROVED', 'TECHNICAL_EVALUATION', 'TECHNICAL_EVALUATION_COMPLETED', 'FINANCIAL_EVALUATION', 'L1_GENERATED', 'AWARD_RECOMMENDED', 'AWARDED'] },
                NOT: [
                    { procurementType: { in: ['LIMITED_TENDER', 'DIRECT_PURCHASE', 'CATALOG_PURCHASE', 'REPEAT_ORDER', 'SINGLE_SOURCE', 'PAC', 'EMERGENCY_PURCHASE'] } },
                    { bidType: { in: ['LIMITED_TENDER', 'DIRECT_PURCHASE', 'CATALOG_PURCHASE', 'REPEAT_ORDER', 'SINGLE_SOURCE', 'PAC', 'EMERGENCY_PURCHASE'] } }
                ]
            },
            orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
            take,
            select: {
                id: true,
                bidNumber: true,
                title: true,
                description: true,
                buyerOrganizationName: true,
                buyerType: true,
                category: true,
                bidType: true,
                quantity: true,
                unit: true,
                estimatedValue: true,
                deliveryLocation: true,
                state: true,
                district: true,
                startDate: true,
                endDate: true,
                status: true,
                approvalStatus: true,
                lifecycleStage: true,
                createdAt: true,
                buyerOrganization: { select: safeBuyerOrganizationSelect },
                _count: { select: { participations: true } }
            }
        }).catch(() => []),
        db.bid?.findMany?.({
            where: {
                status: { not: 'withdrawn' },
                withdrawnAt: null,
                tender: { status: { in: ['published', 'bid_submission'] } }
            },
            orderBy: { createdAt: 'desc' },
            take: take * 4,
            select: {
                createdAt: true,
                tender: {
                    select: {
                        id: true,
                        tenderId: true,
                        title: true,
                        description: true,
                        category: true,
                        budget: true,
                        status: true,
                        closesAt: true,
                        publishedAt: true,
                        createdAt: true,
                        buyer: {
                            select: {
                                id: true,
                                name: true,
                                buyerProfile: { select: { organizationName: true, city: true, district: true, state: true } }
                            }
                        },
                        _count: { select: { bids: { where: { status: { not: 'withdrawn' }, withdrawnAt: null } } } }
                    }
                }
            }
        }).catch(() => [])
    ]);

    const procurementRows = (procurementBids || []).map((bid: any) => ({
        ...bid,
        sourceModel: 'PROCUREMENT_BID',
        sourceId: bid.id,
        activityAt: bid.startDate || bid.createdAt,
        quantity: bid.quantity == null ? null : Number(bid.quantity),
        estimatedValue: bid.estimatedValue == null ? null : Number(bid.estimatedValue),
        participantsCount: bid.participantsCount || bid.responsesCount || (Array.isArray(bid.participations) ? bid.participations.length : (bid._count?.participations ?? 0)),
        _count: undefined
    }));

    const seenTenderIds = new Set<number>();
    const tenderRows = (tenderBidActivities || []).flatMap((activity: any) => {
        const tender = activity.tender;
        if (!tender || seenTenderIds.has(tender.id)) return [];
        seenTenderIds.add(tender.id);

        const profile = tender.buyer?.buyerProfile;
        const location = [profile?.city, profile?.district, profile?.state].filter(Boolean).join(', ');
        return [{
            id: -tender.id,
            sourceModel: 'TENDER',
            sourceId: tender.id,
            bidNumber: tender.tenderId,
            title: tender.title,
            description: tender.description,
            buyerOrganizationName: profile?.organizationName || tender.buyer?.name || 'Verified buyer',
            buyerType: 'Tender',
            category: tender.category,
            bidType: 'Tender',
            quantity: null,
            unit: null,
            estimatedValue: tender.budget == null ? null : Number(tender.budget),
            deliveryLocation: location || 'Location not specified',
            state: profile?.state || null,
            district: profile?.district || null,
            startDate: tender.publishedAt || tender.createdAt,
            endDate: tender.closesAt || activity.createdAt,
            status: tender.status,
            approvalStatus: 'APPROVED',
            lifecycleStage: 'BID_SUBMISSION',
            createdAt: tender.createdAt,
            activityAt: activity.createdAt,
            participantsCount: tender._count?.bids ?? 0
        }];
    });

    return [...procurementRows, ...tenderRows]
        .sort((a: any, b: any) => new Date(b.activityAt || b.createdAt).getTime() - new Date(a.activityAt || a.createdAt).getTime())
        .slice(0, take);
};

const loadLatestRequirements = async (take = 6) => {
    const [buyerRequirements, legacyRequirements] = await Promise.all([
        db.buyerRequirement?.findMany?.({
            where: getPublicRequirementWhere(),
            orderBy: { createdAt: 'desc' },
            take,
            select: publicRequirementListSelect
        }).catch(() => []),
        db.requirement?.findMany?.({
            where: getPublicLegacyRequirementWhere(),
            orderBy: { updatedAt: 'desc' },
            take,
            select: publicLegacyRequirementSelect
        }).catch(() => [])
    ]);

    const decoratedBuyer = (buyerRequirements || []).map(decorateRequirement);
    const buyerTitles = new Set(decoratedBuyer.map((b: any) => (b.title || '').trim().toLowerCase()));

    const decoratedLegacy = (legacyRequirements || [])
        .filter((reqItem: any) => {
            const method = reqItem.canonicalMethod || reqItem.procurementMethod || '';
            const isRestricted = ['DIRECT_PURCHASE', 'CATALOG_PURCHASE', 'REPEAT_ORDER', 'LIMITED_TENDER', 'SINGLE_SOURCE', 'PAC', 'EMERGENCY_PURCHASE'].includes(method.toUpperCase());
            const isLimitedRfq = method.toUpperCase() === 'RFQ' && reqItem.payload && typeof reqItem.payload === 'object' && (reqItem.payload as any).rfqType === 'LIMITED';
            return !isRestricted && !isLimitedRfq;
        })
        .map(mapLegacyRequirementToPublic)
        .filter((l: any) => !buyerTitles.has((l.title || '').trim().toLowerCase()));

    const combined = [
        ...decoratedBuyer,
        ...decoratedLegacy
    ]
        .sort((a: any, b: any) => new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime())
        .slice(0, take);

    // Attach linked auction IDs for reverse-auction requirements so the frontend can link directly.
    const legacySourceIds = combined
        .filter((r: any) => r.sourceModel === 'REQUIREMENT' && r.sourceId)
        .map((r: any) => r.sourceId);
    const modernIds = combined
        .filter((r: any) => !r.sourceModel)
        .map((r: any) => r.id);

    const auctionLinks = await db.auction.findMany({
        where: {
            OR: [
                ...(legacySourceIds.length ? [{ linkedRequirementId: { in: legacySourceIds } }] : []),
                ...(modernIds.length ? [{ linkedRequirementId: { in: modernIds } }] : []),
            ]
        },
        select: { id: true, linkedRequirementId: true, category: true },
        orderBy: { createdAt: 'desc' }
    }).catch(() => []);

    const auctionMap = new Map<number, { auctionId: number; category?: string | null }>();
    for (const a of auctionLinks) {
        if (a.linkedRequirementId && !auctionMap.has(a.linkedRequirementId)) {
            auctionMap.set(a.linkedRequirementId, { auctionId: a.id, category: a.category });
        }
    }

    return combined.map((r: any) => {
        const lookupId = r.sourceModel === 'REQUIREMENT' ? r.sourceId : r.id;
        const linked = lookupId ? auctionMap.get(lookupId) : undefined;
        if (!linked) return r;
        const extra: any = { linkedAuctionId: linked.auctionId };
        // Use auction's category as fallback when the requirement has no category
        if (!r.category && linked.category) {
            extra.category = { name: linked.category };
        }
        return { ...r, ...extra };
    });
};

const requirementSchema = z.object({
    title: z.string().trim().min(3).max(180),
    requirementType: z.enum(['PRODUCT', 'SERVICE']),
    categoryId: z.coerce.number().int().positive().optional(),
    description: z.string().trim().min(10).max(5000),
    quantity: z.coerce.number().positive().optional(),
    unit: z.string().trim().max(120).optional(),
    location: z.string().trim().max(160).optional(),
    budgetMin: z.coerce.number().nonnegative().optional(),
    budgetMax: z.coerce.number().nonnegative().optional(),
    lastDate: z.coerce.date(),
    visibility: z.enum(['PUBLIC', 'VERIFIED_SELLERS_ONLY']).default('PUBLIC'),
    requiredDocuments: z.array(z.string().trim().max(120)).optional(),
    contactPerson: z.string().trim().max(120).optional(),
    attachmentUrl: z.string().trim().max(500).optional(),
    terms: z.string().trim().max(3000).optional()
});

const responseDocumentSchema = z.object({
    name: z.string().trim().max(160),
    fileAssetId: z.preprocess(val => (val === null || val === '' || val === undefined ? undefined : Number(val)), z.number().int().positive().optional()),
    fileName: z.string().trim().max(300).optional().nullable(),
    fileUrl: z.string().trim().max(1000).optional().nullable()
});

const responseLineItemSchema = z.object({
    itemName: z.string().trim().max(200),
    quantity: z.coerce.number().nonnegative().optional().nullable(),
    unitOfMeasure: z.string().trim().max(50).optional().nullable(),
    unitPrice: z.coerce.number().nonnegative().optional().nullable(),
    unitRate: z.coerce.number().nonnegative().optional().nullable(),
    gstPercent: z.coerce.number().nonnegative().max(100).optional().nullable(),
    lineTotal: z.coerce.number().nonnegative().optional().nullable(),
    totalAmount: z.coerce.number().nonnegative().optional().nullable(),
    makeBrand: z.string().trim().max(160).optional().nullable(),
    model: z.string().trim().max(160).optional().nullable(),
    specifications: z.string().trim().max(5000).optional().nullable(),
    complianceStatus: z.string().trim().max(100).optional().nullable(),
    hsnCode: z.string().trim().max(50).optional().nullable(),
    brandPolicy: z.string().trim().max(100).optional().nullable(),
    remarks: z.string().trim().max(500).optional().nullable(),
    attachments: z.array(z.any()).optional().nullable()
}).passthrough();

const responseDataSchema = z.object({
    documents: z.array(responseDocumentSchema).max(50).optional(),
    lineItems: z.array(responseLineItemSchema).max(200).optional(),
    lineQuotes: z.array(responseLineItemSchema).max(200).optional(),
    customFields: z.record(z.string(), z.any()).optional()
}).passthrough().optional().nullable();

const responseSchema = z.object({
    offeredPrice: z.coerce.number().nonnegative().optional().nullable(),
    offeredQuantity: z.coerce.number().positive().optional().nullable(),
    deliveryTimeline: z.string().trim().max(120).optional().nullable(),
    message: z.string().trim().max(3000).optional().nullable(),
    attachmentUrl: z.string().trim().max(500).optional().nullable(),
    terms: z.string().trim().max(2000).optional().nullable(),
    responseData: responseDataSchema,
    status: z.enum(['DRAFT', 'SUBMITTED']).default('SUBMITTED')
}).superRefine((data, ctx) => {
    if (data.status === 'SUBMITTED') {
        if (data.offeredPrice === undefined || data.offeredPrice === null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Offered price is required for submission", path: ["offeredPrice"] });
        }
        if (data.offeredQuantity === undefined || data.offeredQuantity === null) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Offered quantity is required for submission", path: ["offeredQuantity"] });
        }
        if (!data.deliveryTimeline || !data.deliveryTimeline.trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Delivery timeline is required for submission", path: ["deliveryTimeline"] });
        }
        if (!data.message || !data.message.trim()) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Quotation message is required", path: ["message"] });
        }
    }
});

const responseListQuery = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20)
}).partial();

const guestCartItemSchema = z.object({
    cartToken: z.string().trim().min(12).max(120),
    productId: z.coerce.number().int().positive().optional(),
    serviceId: z.coerce.number().int().positive().optional(),
    quantity: z.coerce.number().positive().default(1)
}).refine(value => Boolean(value.productId) !== Boolean(value.serviceId), {
    message: 'Either productId or serviceId is required'
});

const marketplaceHomeLayoutQuery = z.object({
    categoryId: z.coerce.number().int().positive().optional(),
    category: z.string().trim().max(120).optional(),
    district: z.string().trim().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(24).default(12),
    role: z.string().trim().max(40).optional()
}).partial();

const marketplaceInteractionSchema = z.object({
    itemId: z.coerce.number().int().positive().optional(),
    itemType: z.enum(['PRODUCT', 'SERVICE']).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    action: z.enum(['VIEW', 'CATEGORY_CLICK', 'ADD_TO_CART', 'COMPARE', 'ORDER', 'REQUIREMENT_POSTED', 'SEARCH']),
    metadata: z.record(z.string(), z.unknown()).optional()
});

const adminHomeSectionSchema = z.object({
    title: z.string().trim().min(2).max(120).optional(),
    enabled: z.coerce.boolean().optional(),
    displayOrder: z.coerce.number().int().min(0).max(999).optional(),
    itemLimit: z.coerce.number().int().min(1).max(24).optional(),
    ruleType: z.enum(['AUTO_POPULAR', 'AUTO_DISCOUNTED', 'AUTO_MOST_PURCHASED', 'MANUAL_FEATURED', 'LOCAL_MSME', 'HERSHG', 'SERVICES', 'BUYER_REQUIREMENTS']).optional()
});

const defaultHomeSections = [
    { key: 'popular_picks', title: 'Popular Picks', enabled: true, displayOrder: 10, itemLimit: 12, ruleType: 'AUTO_POPULAR' },
    { key: 'most_purchased', title: 'Mostly Purchased Items', enabled: true, displayOrder: 20, itemLimit: 12, ruleType: 'AUTO_MOST_PURCHASED' },
    { key: 'discounted_products', title: 'Discounted Products and Offers', enabled: true, displayOrder: 30, itemLimit: 12, ruleType: 'AUTO_DISCOUNTED' },
    { key: 'local_msme', title: 'Local MSME Products', enabled: true, displayOrder: 40, itemLimit: 12, ruleType: 'LOCAL_MSME' },
    { key: 'hershg_products', title: 'SHG and Women SHG Products', enabled: true, displayOrder: 50, itemLimit: 12, ruleType: 'HERSHG' },
    { key: 'services', title: 'Services You May Need', enabled: true, displayOrder: 60, itemLimit: 12, ruleType: 'SERVICES' },
    { key: 'buyer_requirements', title: 'Trending Buyer Requirements', enabled: true, displayOrder: 70, itemLimit: 8, ruleType: 'BUYER_REQUIREMENTS' }
] as const;

const safeCategorySelect = { id: true, name: true, slug: true, type: true, displayOrder: true };
const safeProductInclude = {
    category: { select: safeCategorySelect },
    seller: { select: { id: true, name: true, onboardingStatus: true } },
    organization: {
        select: {
            id: true,
            organizationName: true,
            organizationType: true,
            city: true,
            district: true,
            state: true,
            verificationStatus: true,
            logoFile: { select: organizationLogoSelect },
            profile: { select: organizationProfileBrandSelect }
        }
    },
    images: { include: { fileAsset: { select: { id: true, url: true } } }, orderBy: [{ isPrimary: 'desc' as const }, { displayOrder: 'asc' as const }], take: 1 }
};
const safeServiceInclude = {
    category: { select: safeCategorySelect },
    seller: { select: { id: true, name: true, onboardingStatus: true } },
    organization: {
        select: {
            id: true,
            organizationName: true,
            organizationType: true,
            city: true,
            district: true,
            state: true,
            verificationStatus: true,
            logoFile: { select: organizationLogoSelect },
            profile: { select: organizationProfileBrandSelect }
        }
    }
};

const catalogueFileAssetSelect = { id: true, entityId: true, url: true, mimeType: true, originalName: true, size: true, entityType: true };
const catalogueEntityType = (itemType: 'product' | 'service') => itemType === 'service' ? 'catalogue_service' : 'catalogue_product';

const loadCatalogueFilesForItems = async (
    itemType: 'product' | 'service',
    itemIds: number[],
    options: { imageOnly?: boolean } = {}
) => {
    const ids = Array.from(new Set(itemIds.filter(id => Number.isFinite(id) && id > 0)));
    if (ids.length === 0) return new Map<number, any[]>();

    const targetType = catalogueEntityType(itemType);
    const files = await db.fileAsset.findMany({
        where: {
            entityType: { in: ['catalogue', targetType, itemType, `catalogue_${itemType}`, 'general'] },
            entityId: { in: ids },
            status: 'active',
            ...(options.imageOnly ? { mimeType: { startsWith: 'image/' } } : {})
        },
        select: catalogueFileAssetSelect,
        orderBy: { createdAt: 'asc' }
    }).catch(() => []);

    const byItemId = new Map<number, any[]>();
    for (const file of files || []) {
        const entityId = Number((file as any).entityId || 0);
        if (!entityId) continue;
        const current = byItemId.get(entityId) || [];
        current.push(file);
        byItemId.set(entityId, current);
    }
    return byItemId;
};

const attachCatalogueFilesToItems = async (
    items: any[],
    itemType: 'product' | 'service',
    options: { imageOnly?: boolean } = {}
) => {
    if (!Array.isArray(items) || items.length === 0) return items || [];
    const filesByItemId = await loadCatalogueFilesForItems(itemType, items.map(item => Number(item.id)), options);
    return items.map((item) => {
        const catalogueFiles = filesByItemId.get(Number(item.id)) || [];
        const catalogueImages = catalogueFiles
            .filter(file => {
                const mime = String(file.mimeType || '').toLowerCase();
                const name = String(file.originalName || '').toLowerCase();
                return mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(name);
            })
            .map((file, index) => ({
                id: file.id,
                fileAssetId: file.id,
                altText: file.originalName || `${item.name || 'Catalogue'} image ${index + 1}`,
                displayOrder: index,
                isPrimary: index === 0,
                fileAsset: file
            }));

        const existingImages = Array.isArray(item.images) ? item.images : [];
        const seenAssetIds = new Set(
            existingImages.map((img: any) => img.fileAssetId || img.fileAsset?.id || img.id).filter(Boolean)
        );
        const uniqueCatalogueImages = catalogueImages.filter((cImg: any) => !seenAssetIds.has(cImg.fileAssetId));

        return {
            ...item,
            catalogueFiles,
            images: itemType === 'service'
                ? catalogueImages
                : [...existingImages, ...uniqueCatalogueImages]
        };
    });
};

const attachCatalogueFilesToItem = async (item: any, itemType: 'product' | 'service') => {
    if (!item?.id) return item;
    const [withFiles] = await attachCatalogueFilesToItems([item], itemType);
    return withFiles || item;
};

// ─── Public: Product Detail ──────────────────────────────────────────────────
router.get('/marketplace/products/:id', optionalAuthenticate, checkFeatureIfAuthenticated('product-marketplace'), async (req: AuthRequest, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!id || id < 1) return apiResponse.error(res, 400, 'Invalid product ID', 'INVALID_ID');

        const product = await db.product.findFirst({
            where: { id, status: 'ACTIVE' },
            include: {
                category: { select: { id: true, name: true } },
                seller: { select: { id: true, name: true, onboardingStatus: true } },
                organization: { select: { id: true, organizationName: true, city: true, district: true, state: true, verificationStatus: true, gstin: true } },
                images: { 
                    include: { 
                        fileAsset: { 
                            select: { id: true, url: true, originalName: true, mimeType: true, size: true } 
                        } 
                    }, 
                    orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }] 
                },
                specifications: { orderBy: { name: 'asc' } },
                certifications: { 
                    include: { 
                        fileAsset: { 
                            select: { id: true, url: true, originalName: true, mimeType: true, size: true } 
                        } 
                    } 
                }
            }
        });

        if (!product) return apiResponse.error(res, 404, 'Product not found', 'PRODUCT_NOT_FOUND');
        const productWithFiles = await attachCatalogueFilesToItem(product, 'product');

        // Related products from same category
        const related = await db.product.findMany({
            where: { status: 'ACTIVE', categoryId: product.categoryId, id: { not: id } },
            take: 4,
            include: {
                category: { select: { id: true, name: true } },
                organization: { select: { id: true, organizationName: true, city: true, state: true, verificationStatus: true } },
                images: { 
                    include: { 
                        fileAsset: { 
                            select: { id: true, url: true, originalName: true, mimeType: true } 
                        } 
                    }, 
                    orderBy: [{ isPrimary: 'desc' }], 
                    take: 1 
                }
            }
        });

        return ok(res, { product: productWithFiles, relatedProducts: related });
    } catch (error) {
        console.error('[Marketplace Product Detail]', error);
        return apiResponse.error(res, 500, 'Failed to load product details', 'PRODUCT_DETAIL_ERROR');
    }
});

const approvedSellerStatuses = ['approved_for_procurement'];
const publicSellerApprovalWhere = {
    OR: [
        { organization: { verificationStatus: 'VERIFIED', isBlacklisted: false, deletedAt: null } },
        { seller: { onboardingStatus: { in: approvedSellerStatuses } } }
    ]
};

const publicItemWhere = (extra: Record<string, any> = {}) => {
    const { AND, OR, ...rest } = extra;
    const andConditions: any[] = [publicSellerApprovalWhere];
    if (Array.isArray(AND)) andConditions.push(...AND);
    else if (AND) andConditions.push(AND);
    if (OR) andConditions.push({ OR });
    return { status: 'ACTIVE', ...rest, AND: andConditions };
};

const productPublicWhere = (extra: Record<string, any> = {}) => publicItemWhere(extra);
const servicePublicWhere = (extra: Record<string, any> = {}) => publicItemWhere(extra);

const activeOfferWhere = () => ({
    isOfferActive: true,
    originalPrice: { gt: 0 },
    discountPrice: { gt: 0 },
    OR: [{ offerStartAt: null }, { offerStartAt: { lte: new Date() } }],
    AND: [{ OR: [{ offerEndAt: null }, { offerEndAt: { gte: new Date() } }] }]
});

const resolveCategoryId = async (query: { categoryId?: number; category?: string }) => {
    if (query.categoryId) return query.categoryId;
    if (!query.category) return undefined;
    const category = await db.category.findFirst({
        where: {
            isActive: true,
            OR: [
                { slug: query.category },
                { name: { equals: query.category, mode: 'insensitive' } }
            ]
        },
        select: { id: true }
    }).catch(() => null);
    return category?.id;
};

const isOfferActiveNow = (item: any) => {
    if (!item?.isOfferActive) return false;
    const now = Date.now();
    const start = item.offerStartAt ? new Date(item.offerStartAt).getTime() : 0;
    const end = item.offerEndAt ? new Date(item.offerEndAt).getTime() : Number.POSITIVE_INFINITY;
    return start <= now && now <= end;
};

const offerFor = (item: any, basePrice: number) => {
    const explicitOriginal = Number(item?.originalPrice || 0);
    const explicitDiscount = Number(item?.discountPrice || 0);
    const explicitPercent = Number(item?.discountPercent || 0);
    if (isOfferActiveNow(item) && explicitOriginal > 0 && explicitDiscount > 0 && explicitDiscount < explicitOriginal) {
        return {
            originalPrice: explicitOriginal,
            discountPrice: explicitDiscount,
            discountPercent: explicitPercent > 0 ? explicitPercent : Math.round(((explicitOriginal - explicitDiscount) / explicitOriginal) * 100),
            isOfferActive: true
        };
    }
    const percent = Number(item?.discount || 0);
    if (basePrice > 0 && percent > 0 && percent < 100) {
        const discountPrice = Math.round(basePrice * (1 - percent / 100) * 100) / 100;
        return {
            originalPrice: basePrice,
            discountPrice,
            discountPercent: percent,
            isOfferActive: true
        };
    }
    return {
        originalPrice: null,
        discountPrice: null,
        discountPercent: null,
        isOfferActive: false
    };
};

const normalizeMarketplaceItem = (item: any, itemType: 'PRODUCT' | 'SERVICE', metrics: Record<string, any> = {}) => {
    const basePrice = Number(itemType === 'SERVICE' ? item.basePrice || 0 : item.price || 0);
    const offer = offerFor(item, basePrice);
    const category = item.category || {};
    const organization = item.organization || {};
    const imageUrl = itemType === 'PRODUCT'
        ? item.images?.[0]?.fileAsset?.url || item.imageUrl || null
        : item.imageUrl || item.images?.[0]?.fileAsset?.url || null;
    return {
        id: item.id,
        itemType,
        name: item.name,
        imageUrl,
        categoryId: item.categoryId || category.id || null,
        categoryName: category.name || null,
        categorySlug: category.slug || null,
        sellerId: item.sellerId || item.seller?.id || null,
        sellerName: organization.organizationName || item.seller?.name || 'Verified MSME seller',
        sellerVerified: organization.verificationStatus === 'VERIFIED',
        price: offer.isOfferActive && offer.discountPrice ? offer.discountPrice : basePrice || null,
        originalPrice: offer.originalPrice,
        discountPrice: offer.discountPrice,
        discountPercent: offer.discountPercent,
        unit: itemType === 'SERVICE' ? item.pricingModel : item.unitOfMeasure,
        moq: item.bulkMinQuantity || null,
        location: [organization.city, organization.district, organization.state].filter(Boolean).join(', ') || item.serviceArea || null,
        district: organization.district || null,
        rating: item.rating || null,
        totalOrders: Number(metrics.totalOrders || item.totalOrders || item.orderCount || 0),
        totalQuantity: metrics.totalQuantity || null,
        totalValue: metrics.totalValue || null,
        lastPurchasedAt: metrics.lastPurchasedAt || null,
        isOfferActive: offer.isOfferActive,
        offerLabel: item.offerLabel || null,
        bulkDealAvailable: Boolean(item.bulkDealAvailable),
        avgRating: item.avgRating ?? item.rating ?? null,
        reviewCount: item.reviewCount ?? 0,
        sellerBadges: item.sellerBadges ?? [],
        detailUrl: `/marketplace/${itemType === 'SERVICE' ? 'services' : 'products'}/${item.id}`
    };
};

const enrichMarketplaceItemsWithTrustData = async (items: any[]) => {
    if (!items || items.length === 0) return items;

    try {
        const sellerIds = [...new Set(items.map((it: any) => it.sellerId || it.seller?.id).filter(Boolean))];
        const orgIds = [...new Set(items.map((it: any) => it.organizationId || it.organization?.id).filter(Boolean))];

        const [ratingAggs, topRanks, sellerProfiles] = await Promise.all([
            sellerIds.length
                ? db.supplierRating.groupBy({
                    by: ['sellerId'],
                    where: { sellerId: { in: sellerIds } },
                    _avg: { rating: true },
                    _count: { rating: true }
                }).catch(() => [])
                : [],
            orgIds.length
                ? db.organizationMonthlyRank.findMany({
                    where: {
                        organizationId: { in: orgIds },
                        month: new Date().getMonth() + 1,
                        year: new Date().getFullYear(),
                        rank: { lte: 10 }
                    },
                    select: { organizationId: true, rank: true }
                }).catch(() => [])
                : [],
            orgIds.length
                ? db.sellerProfile.findMany({
                    where: { organizationId: { in: orgIds } },
                    select: { organizationId: true, isUdyamCertified: true }
                }).catch(() => [])
                : []
        ]);

        const ratingMap = new Map<number, { avgRating: number | null; reviewCount: number }>(
            (ratingAggs || []).map((r: any) => [
                r.sellerId,
                {
                    avgRating: r._avg?.rating ? Number(Number(r._avg.rating).toFixed(1)) : null,
                    reviewCount: r._count?.rating || 0
                }
            ])
        );
        const topRankSet = new Set((topRanks || []).map((r: any) => r.organizationId));
        const udyamMap = new Map<number, boolean>((sellerProfiles || []).map((sp: any) => [sp.organizationId, sp.isUdyamCertified]));

        return items.map((item: any) => {
            const sellerId = item.sellerId || item.seller?.id;
            const orgId = item.organizationId || item.organization?.id;
            const ratingInfo = sellerId ? ratingMap.get(sellerId) : undefined;

            const badges: string[] = [];
            if (orgId && topRankSet.has(orgId)) {
                badges.push('TOP_SELLER');
            }
            const isVerified = (item.organization?.verificationStatus || '') === 'VERIFIED';
            const isUdyam = Boolean((orgId && udyamMap.get(orgId)) || item.isMsmeMade || item.organization?.udyamNumber);
            if (isVerified && isUdyam) {
                badges.push('ASSURED_MSME');
            }
            if (item.bulkDealAvailable) {
                badges.push('BULK_DEAL');
            }

            return {
                ...item,
                avgRating: ratingInfo?.avgRating ?? (item.rating ? Number(item.rating) : null),
                reviewCount: ratingInfo?.reviewCount ?? item.reviewCount ?? 0,
                sellerBadges: badges
            };
        });
    } catch (err) {
        console.warn('[Marketplace Trust Enrichment Error]', err);
        return items;
    }
};

let cachedHomeSections: any[] | null = null;
let lastHomeSectionsFetch = 0;

export const clearHomeSectionsCache = () => {
    cachedHomeSections = null;
    lastHomeSectionsFetch = 0;
};

const ensureMarketplaceHomeSections = async () => {
    const now = Date.now();
    if (cachedHomeSections && (now - lastHomeSectionsFetch < 600_000)) {
        return cachedHomeSections;
    }
    if (!db.marketplaceHomeSection) {
        cachedHomeSections = defaultHomeSections.map(section => ({ ...section }));
        lastHomeSectionsFetch = now;
        return cachedHomeSections;
    }
    try {
        let sections = await db.marketplaceHomeSection.findMany({ orderBy: [{ displayOrder: 'asc' }, { key: 'asc' }] });
        if (!sections || sections.length === 0) {
            await Promise.all(defaultHomeSections.map(section =>
                db.marketplaceHomeSection.upsert({
                    where: { key: section.key },
                    update: {},
                    create: section
                }).catch(() => null)
            ));
            sections = await db.marketplaceHomeSection.findMany({ orderBy: [{ displayOrder: 'asc' }, { key: 'asc' }] });
        }
        cachedHomeSections = sections?.length ? sections : defaultHomeSections.map(section => ({ ...section }));
        lastHomeSectionsFetch = now;
        return cachedHomeSections;
    } catch {
        return defaultHomeSections.map(section => ({ ...section }));
    }
};

const loadFeaturedCategories = async () => getOrSetCache(redisKeys.cacheMarketplaceFeaturedCategories(), async () => {
    const categories = await db.category.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        select: {
            id: true,
            parentId: true,
            name: true,
            slug: true,
            type: true,
            description: true,
            displayOrder: true,
            imageUrl: true,
            _count: { select: { products: { where: { status: 'ACTIVE' } }, services: { where: { status: 'ACTIVE' } } } }
        }
    }).catch(() => []);
    return (categories || []).map((category: any) => ({
        id: category.id,
        parentId: category.parentId || null,
        name: category.name,
        slug: category.slug,
        icon: category.slug,
        imageUrl: category.imageUrl || null,
        description: category.description || null,
        type: category.type,
        productCount: category._count?.products || 0,
        serviceCount: category._count?.services || 0,
        displayOrder: category.displayOrder
    }));
}, 60); // 60s cache TTL for marketplace categories

const purchaseCompletionWhere = {
    OR: [
        { poStatus: { in: ['ACCEPTED', 'DELIVERED', 'CLOSED'] } },
        { status: { in: ['accepted', 'delivered', 'closed', 'completed', 'fulfilled', 'paid'] } },
        { invoices: { some: { OR: [{ invoiceStatus: { in: ['APPROVED', 'PAID'] } }, { status: { in: ['approved', 'paid'] } }] } } },
        { payments: { some: { OR: [{ paymentStatus: { in: ['SUCCESS', 'SETTLED', 'PORTAL_PAYMENT_SUCCESS', 'OFFLINE_PROOF_VERIFIED'] } }, { status: { in: ['success', 'settled', 'paid', 'completed'] } }] } } }
    ],
    NOT: [
        { poStatus: { in: ['CANCELLED'] } },
        { status: { in: ['cancelled', 'rejected', 'failed', 'draft', 'pending'] } }
    ]
};

const loadMostPurchasedItems = async (limit = 12, categoryId?: number, buyerId?: number) => {
    const rows = await db.purchaseOrderItem.findMany({
        where: {
            productId: { not: null },
            purchaseOrder: {
                ...(buyerId ? { buyerId } : {}),
                status: { in: ['accepted', 'delivered', 'closed', 'completed', 'fulfilled', 'paid'] }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: Math.max(limit * 2, 16),
        include: {
            product: { include: safeProductInclude },
            purchaseOrder: { select: { id: true, buyerId: true, createdAt: true, acceptedAt: true, status: true, poStatus: true } }
        }
    }).catch(() => []);

    const aggregate = new Map<number, any>();
    for (const row of rows || []) {
        const product = row.product;
        if (!product || product.status !== 'ACTIVE') continue;
        if (categoryId && product.categoryId !== categoryId) continue;
        const current = aggregate.get(product.id) || { product, totalQuantity: 0, orderCount: 0, totalValue: 0, lastPurchasedAt: null };
        current.totalQuantity += Number(row.quantity || 0);
        current.orderCount += 1;
        current.totalValue += Number(row.totalAmount || 0);
        const at = row.purchaseOrder?.acceptedAt || row.purchaseOrder?.createdAt || row.createdAt;
        if (!current.lastPurchasedAt || new Date(at).getTime() > new Date(current.lastPurchasedAt).getTime()) current.lastPurchasedAt = at;
        aggregate.set(product.id, current);
    }

    return Array.from(aggregate.values())
        .sort((a, b) => (b.orderCount - a.orderCount) || (b.totalQuantity - a.totalQuantity))
        .slice(0, limit)
        .map(row => normalizeMarketplaceItem(row.product, 'PRODUCT', {
            totalOrders: row.orderCount,
            totalQuantity: row.totalQuantity,
            totalValue: row.totalValue,
            lastPurchasedAt: row.lastPurchasedAt
        }));
};

const loadTrendingRequirements = async (limit = 8) => loadLatestRequirements(limit);

const buildHomeLayout = async (params: z.infer<typeof marketplaceHomeLayoutQuery>, user?: AuthRequest['user']) => {
    const limit = Math.min(Math.max(Number(params.limit || 12), 1), 24);
    const categoryId = await resolveCategoryId({ categoryId: params.categoryId, category: params.category });
    const district = params.district?.trim();
    const districtFilter = district ? { organization: { district: { contains: district, mode: 'insensitive' } } } : {};
    const categoryFilter = categoryId ? { categoryId } : {};

    const [
        banners,
        categories,
        sectionConfigs,
        popularProducts,
        popularServices,
        discountedProducts,
        discountedServices,
        mostPurchased,
        localProducts,
        herShgProducts,
        trendingRequirements,
        verifiedSellers
    ] = await Promise.all([
        db.marketplaceBanner?.findMany?.({
            where: {
                isActive: true,
                status: 'ACTIVE',
                displayLocation: 'HOME_HERO',
                OR: [{ startAt: null }, { startAt: { lte: new Date() } }],
                AND: [{ OR: [{ endAt: null }, { endAt: { gte: new Date() } }] }]
            },
            orderBy: [{ priority: 'desc' }, { displayOrder: 'asc' }],
            take: 10
        }).catch(() => []),
        loadFeaturedCategories(),
        ensureMarketplaceHomeSections(),
        db.product.findMany({
            where: productPublicWhere({ ...categoryFilter, ...districtFilter }),
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            take: limit,
            include: safeProductInclude
        }).catch(() => []),
        db.service.findMany({
            where: servicePublicWhere({ ...categoryFilter, ...districtFilter }),
            orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
            take: limit,
            include: safeServiceInclude
        }).catch(() => []),
        db.product.findMany({
            where: productPublicWhere({ ...categoryFilter, ...activeOfferWhere() }),
            orderBy: [{ discountPercent: 'desc' }, { updatedAt: 'desc' }],
            take: limit,
            include: safeProductInclude
        }).catch(() => []),
        db.service.findMany({
            where: servicePublicWhere({ ...categoryFilter, ...activeOfferWhere() }),
            orderBy: [{ discountPercent: 'desc' }, { updatedAt: 'desc' }],
            take: limit,
            include: safeServiceInclude
        }).catch(() => []),
        loadMostPurchasedItems(limit, categoryId, user?.role === 'buyer' ? Number(user.id) : undefined),
        db.product.findMany({
            where: productPublicWhere({
                ...categoryFilter,
                organization: { OR: [{ district: { contains: 'Jharsuguda', mode: 'insensitive' } }, { state: { contains: 'Odisha', mode: 'insensitive' } }] }
            }),
            orderBy: [{ updatedAt: 'desc' }],
            take: limit,
            include: safeProductInclude
        }).catch(() => []),
        db.product.findMany({
            where: productPublicWhere({
                ...categoryFilter,
                OR: [
                    { organization: { organizationName: { contains: 'SHG', mode: 'insensitive' } } },
                    { organization: { organizationName: { contains: 'Women', mode: 'insensitive' } } },
                    { category: { name: { contains: 'SHG', mode: 'insensitive' } } },
                    { category: { name: { contains: 'Women', mode: 'insensitive' } } }
                ]
            }),
            orderBy: [{ updatedAt: 'desc' }],
            take: limit,
            include: safeProductInclude
        }).catch(() => []),
        loadTrendingRequirements(Math.min(limit, 8)),
        db.organization.findMany({
            where: sellerOrganizationWhere,
            orderBy: { updatedAt: 'desc' },
            take: 16,
            select: {
                id: true,
                organizationName: true,
                organizationType: true,
                city: true,
                district: true,
                state: true,
                verificationStatus: true,
                logoFile: { select: organizationLogoSelect },
                profile: { select: organizationProfileBrandSelect },
                _count: { select: { products: { where: { status: 'ACTIVE' } }, services: { where: { status: 'ACTIVE' } } } }
            }
        }).catch(() => [])
    ]);

    const [
        popularServicesWithFiles,
        discountedServicesWithFiles
    ] = await Promise.all([
        attachCatalogueFilesToItems(popularServices, 'service', { imageOnly: true }),
        attachCatalogueFilesToItems(discountedServices, 'service', { imageOnly: true })
    ]);

    const sectionData: Record<string, any> = {
        popular_picks: {
            key: 'popular_picks',
            title: 'Popular Picks',
            subtitle: 'Frequently selected marketplace items',
            layout: 'carousel',
            items: [...popularProducts.map((item: any) => normalizeMarketplaceItem(item, 'PRODUCT')), ...popularServicesWithFiles.map((item: any) => normalizeMarketplaceItem(item, 'SERVICE'))].slice(0, limit)
        },
        most_purchased: {
            key: 'most_purchased',
            title: 'Mostly Purchased Items',
            subtitle: 'Commonly procured items by buyers',
            layout: 'carousel',
            items: mostPurchased
        },
        discounted_products: {
            key: 'discounted_products',
            title: 'Discounted Products and Offers',
            subtitle: 'Active seller offers and rate benefits',
            layout: 'carousel',
            items: [...discountedProducts.map((item: any) => normalizeMarketplaceItem(item, 'PRODUCT')), ...discountedServicesWithFiles.map((item: any) => normalizeMarketplaceItem(item, 'SERVICE'))].slice(0, limit)
        },
        local_msme: {
            key: 'local_msme',
            title: 'Local MSME Products',
            subtitle: 'Jharsuguda and Odisha seller listings',
            layout: 'carousel',
            items: localProducts.map((item: any) => normalizeMarketplaceItem(item, 'PRODUCT'))
        },
        hershg_products: {
            key: 'hershg_products',
            title: 'SHG and Women SHG Products',
            subtitle: 'Listings identified from verified seller metadata',
            layout: 'carousel',
            items: herShgProducts.map((item: any) => normalizeMarketplaceItem(item, 'PRODUCT'))
        },
        services: {
            key: 'services',
            title: 'Services You May Need',
            subtitle: 'Professional services from verified providers',
            layout: 'carousel',
            items: popularServicesWithFiles.map((item: any) => normalizeMarketplaceItem(item, 'SERVICE'))
        },
        buyer_requirements: {
            key: 'buyer_requirements',
            title: 'Trending Buyer Requirements',
            subtitle: 'Open procurement needs and RFQs',
            layout: 'list',
            items: trendingRequirements
        }
    };

    const ruleTypeToSectionKey: Record<string, string> = {
        AUTO_POPULAR: 'popular_picks',
        AUTO_MOST_PURCHASED: 'most_purchased',
        AUTO_DISCOUNTED: 'discounted_products',
        LOCAL_MSME: 'local_msme',
        HERSHG: 'hershg_products',
        SERVICES: 'services',
        BUYER_REQUIREMENTS: 'buyer_requirements',
        MANUAL_FEATURED: 'popular_picks'
    };

    const sections = (sectionConfigs || [])
        .filter((section: any) => section.enabled)
        .sort((a: any, b: any) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0))
        .map((section: any) => {
            const dataKey = (section.ruleType && ruleTypeToSectionKey[section.ruleType]) || section.key;
            const data = sectionData[dataKey] || sectionData[section.key] || sectionData.popular_picks;
            return {
                ...data,
                key: section.key,
                title: section.title || data.title,
                items: Array.isArray(data.items) ? data.items.slice(0, Number(section.itemLimit || limit)) : []
            };
        });

    return { banners: banners || [], categories, sections, verifiedSellers };
};

// ─── Public: Home Page Aggregated Data ───────────────────────────────────────
router.get('/marketplace/categories/featured', longCache(300), async (_req: Request, res: Response) => {
    try {
        return ok(res, { categories: await loadFeaturedCategories() });
    } catch (error) {
        console.error('[Marketplace Featured Categories]', error);
        return apiResponse.error(res, 500, 'Failed to load featured categories', 'MARKETPLACE_CATEGORIES_ERROR');
    }
});

router.get('/marketplace/home-layout', optionalAuthenticate, shortCache(60), async (req: AuthRequest, res: Response) => {
    try {
        const query = marketplaceHomeLayoutQuery.parse(req.query);
        const cacheIdentity = { ...query, user: req.user?.role === 'buyer' ? req.user?.id : 'public' };
        const cacheKey = redisKeys.cacheMarketplaceHomeLayout(stableCacheHash(cacheIdentity));
        const data = await getOrSetCache(cacheKey, () => buildHomeLayout(query, req.user), req.user ? 60 : 180);
        return ok(res, data);
    } catch (error) {
        console.error('[Marketplace Home Layout]', error);
        return apiResponse.error(res, 500, 'Failed to load marketplace home layout', 'MARKETPLACE_HOME_LAYOUT_ERROR');
    }
});

router.post('/marketplace/interactions', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
    try {
        const body = marketplaceInteractionSchema.parse(req.body);
        if (!req.user?.id) return ok(res, { tracked: false, storage: 'guest' });
        const since = new Date(Date.now() - 60_000);
        const recentCount = await db.marketplaceInteraction?.count?.({
            where: { userId: Number(req.user.id), action: body.action, createdAt: { gte: since } }
        }).catch(() => 0);
        if (recentCount > 60) return ok(res, { tracked: false, rateLimited: true });

        const metadata = body.metadata
            ? Object.fromEntries(Object.entries(body.metadata).slice(0, 12).map(([key, value]) => [key.slice(0, 40), typeof value === 'string' ? value.slice(0, 200) : value]))
            : undefined;

        const interaction = await db.marketplaceInteraction?.create?.({
            data: {
                userId: Number(req.user.id),
                organizationId: req.user.organizationId || null,
                itemId: body.itemId || null,
                itemType: body.itemType || null,
                categoryId: body.categoryId || null,
                action: body.action,
                metadata
            },
            select: { id: true, action: true, createdAt: true }
        }).catch(() => null);
        return ok(res, { tracked: Boolean(interaction), interaction });
    } catch (error) {
        console.error('[Marketplace Interaction]', error);
        return ok(res, { tracked: false });
    }
});

router.get('/marketplace/recommendations', authenticate, authorize('buyer', 'admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
    try {
        const userIdValue = Number(req.user?.id);
        const organizationId = req.user?.organizationId || undefined;
        const cacheKey = `cache:marketplace:recommendations:${userIdValue}:${organizationId || 'none'}`;

        const data = await getOrSetCache(cacheKey, async () => {
            const [interactions, cartItems, buyerProfile, buyAgain] = await Promise.all([
                db.marketplaceInteraction?.findMany?.({
                    where: {
                        OR: [
                            { userId: userIdValue },
                            ...(organizationId ? [{ organizationId }] : [])
                        ],
                        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    select: { categoryId: true, itemId: true, itemType: true, action: true }
                }).catch(() => []),
                organizationId ? db.cartItem.findMany({
                    where: { cart: { organizationId, status: 'ACTIVE' } },
                    include: { product: { select: { categoryId: true } }, service: { select: { categoryId: true } } },
                    take: 15
                }).catch(() => []) : Promise.resolve([]),
                db.buyerProfile.findFirst({
                    where: { OR: [{ userId: userIdValue }, ...(organizationId ? [{ organizationId }] : [])] },
                    select: { procurementCategories: true }
                }).catch(() => null),
                loadMostPurchasedItems(8, undefined, userIdValue)
            ]);

            const categoryIds = new Set<number>();
            for (const interaction of interactions || []) if (interaction.categoryId) categoryIds.add(Number(interaction.categoryId));
            for (const item of cartItems || []) {
                if (item.product?.categoryId) categoryIds.add(Number(item.product.categoryId));
                if (item.service?.categoryId) categoryIds.add(Number(item.service.categoryId));
            }

            const profileCategories = buyerProfile?.procurementCategories || [];
            if (profileCategories.length) {
                const matched = await db.category.findMany({
                    where: {
                        isActive: true,
                        OR: profileCategories.slice(0, 5).map((name: string) => ({ name: { contains: name, mode: 'insensitive' } }))
                    },
                    select: { id: true }
                }).catch(() => []);
                matched.forEach((category: any) => categoryIds.add(category.id));
            }

            const categoryFilter = categoryIds.size ? { categoryId: { in: Array.from(categoryIds).slice(0, 8) } } : {};
            const [targetedProducts, discountedProducts, fallbackProducts] = await Promise.all([
                categoryIds.size
                    ? db.product.findMany({ where: productPublicWhere(categoryFilter), include: safeProductInclude, orderBy: { updatedAt: 'desc' }, take: 8 }).catch(() => [])
                    : Promise.resolve([]),
                db.product.findMany({ where: productPublicWhere({ ...(categoryIds.size ? categoryFilter : {}), ...activeOfferWhere() }), include: safeProductInclude, orderBy: { updatedAt: 'desc' }, take: 8 }).catch(() => []),
                db.product.findMany({ where: productPublicWhere(), include: safeProductInclude, orderBy: { updatedAt: 'desc' }, take: 8 }).catch(() => [])
            ]);

            const primaryProducts = targetedProducts.length ? targetedProducts : fallbackProducts;

            const sections = [
                {
                    key: 'your_choices',
                    title: 'Your Choices',
                    subtitle: 'Based on your marketplace activity and categories',
                    layout: 'carousel',
                    items: primaryProducts.map((item: any) => normalizeMarketplaceItem(item, 'PRODUCT'))
                },
                {
                    key: 'buy_again',
                    title: 'Buy Again',
                    subtitle: 'From previous completed procurement records',
                    layout: 'carousel',
                    items: buyAgain
                },
                {
                    key: 'similar_to_cart',
                    title: 'Similar to Your Cart',
                    subtitle: 'Matching active cart categories',
                    layout: 'carousel',
                    items: primaryProducts.map((item: any) => normalizeMarketplaceItem(item, 'PRODUCT'))
                },
                {
                    key: 'discounted_in_categories',
                    title: 'Discounted Items in Your Categories',
                    subtitle: 'Active offers only',
                    layout: 'carousel',
                    items: (discountedProducts.length ? discountedProducts : fallbackProducts).map((item: any) => normalizeMarketplaceItem(item, 'PRODUCT'))
                }
            ].filter(section => section.items.length > 0).slice(0, 5);

            const categories = await loadFeaturedCategories();
            return { sections, categories, fallback: sections.length === 0 };
        }, 300);

        return ok(res, data);
    } catch (error) {
        console.error('[Marketplace Recommendations]', error);
        return apiResponse.error(res, 500, 'Failed to load recommendations', 'MARKETPLACE_RECOMMENDATIONS_ERROR');
    }
});

const purgeMarketplaceHomeCache = async () => {
    try {
        clearHomeSectionsCache();
        await Promise.allSettled([
            deleteCache(redisKeys.cacheMarketplaceHome()),
            deleteCache('marketplace:home:v2'),
            invalidateByPattern('cache:marketplace:home-layout:*'),
            invalidateByPattern('cache:marketplace:*')
        ]);
        void fetchMarketplaceHomeData().catch(() => undefined);
    } catch (err) {
        console.warn('[Marketplace Cache Purge Warning]', err);
    }
};

export const fetchMarketplaceHomeData = async () => {
    return getOrSetCache(redisKeys.cacheMarketplaceHome(), async () => {
        const [
            banners,
            categories,
            featuredProducts,
            featuredServices,
            verifiedSellers,
            notices,
            largeIndustries,
            bigMsmes,
            stats,
            latestRequirements,
            latestTenders,
            latestBids,
            homeLayout
        ] = await Promise.all([
            // Banners
            db.marketplaceBanner?.findMany?.({
                where: { isActive: true },
                orderBy: { displayOrder: 'asc' },
                take: 10
            }).catch(() => []),

            // Categories
            db.category.findMany({
                where: { isActive: true },
                orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
                include: {
                    _count: { select: { products: { where: { status: 'ACTIVE' } }, services: { where: { status: 'ACTIVE' } } } }
                }
            }).catch(() => []),

            // Featured Products
            db.product.findMany({
                where: { status: 'ACTIVE' },
                orderBy: { createdAt: 'desc' },
                take: 12,
                include: {
                    category: { select: { id: true, name: true } },
                    seller: { select: { id: true, name: true, onboardingStatus: true } },
                    organization: { select: { id: true, organizationName: true, city: true, district: true, state: true, verificationStatus: true, logoFile: { select: organizationLogoSelect }, profile: { select: organizationProfileBrandSelect } } },
                    images: { include: { fileAsset: { select: { id: true, url: true } } }, orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 1 }
                }
            }).catch(() => []),

            // Featured Services
            db.service.findMany({
                where: { status: 'ACTIVE' },
                orderBy: { createdAt: 'desc' },
                take: 8,
                include: {
                    category: { select: { id: true, name: true } },
                    seller: { select: { id: true, name: true, onboardingStatus: true } },
                    organization: { select: { id: true, organizationName: true, city: true, district: true, state: true, verificationStatus: true, logoFile: { select: organizationLogoSelect }, profile: { select: organizationProfileBrandSelect } } }
                }
            }).catch(() => []),

            // Verified Sellers
            db.organization.findMany({
                where: sellerOrganizationWhere,
                orderBy: { updatedAt: 'desc' },
                take: 16,
                select: {
                    id: true,
                    organizationName: true,
                    organizationType: true,
                    city: true,
                    district: true,
                    state: true,
                    verificationStatus: true,
                    logoFile: { select: organizationLogoSelect },
                    profile: { select: organizationProfileBrandSelect },
                    _count: { select: { products: { where: { status: 'ACTIVE' } }, services: { where: { status: 'ACTIVE' } } } }
                }
            }).catch(() => []),

            // Notices
            db.marketplaceNotice?.findMany?.({
                where: { isActive: true },
                orderBy: { publishedAt: 'desc' },
                take: 5
            }).catch(() => []),

            db.organization.findMany({
                where: {
                    verificationStatus: 'VERIFIED',
                    isBlacklisted: false,
                    deletedAt: null,
                    OR: [
                        { users: { some: { role: 'buyer', accountStatus: 'ACTIVE' } } },
                        { buyerProfiles: { some: {} } },
                        { buyerRequirements: { some: {} } },
                        { procurementBids: { some: {} } },
                        { tenders: { some: {} } },
                        { profile: { isLargeIndustry: true } },
                        { organizationType: { in: ['PUBLIC_LIMITED', 'PSU', 'GOVERNMENT'] } }
                    ]
                },
                orderBy: { updatedAt: 'desc' },
                take: 24,
                select: {
                    id: true,
                    organizationName: true,
                    organizationType: true,
                    city: true,
                    district: true,
                    state: true,
                    verificationStatus: true,
                    logoFile: { select: organizationLogoSelect },
                    profile: true,
                    buyerProfiles: {
                        where: {
                            verificationStatus: 'VERIFIED',
                            isActive: true
                        },
                        select: {
                            id: true,
                            logoUrl: true,
                            bannerUrl: true
                        }
                    },
                    _count: { select: { buyerRequirements: true } }
                }
            }).catch(() => []),

            db.organization.findMany({
                where: {
                    verificationStatus: 'VERIFIED',
                    isBlacklisted: false,
                    deletedAt: null,
                    OR: [
                        { profile: { isBigMsme: true } },
                        { organizationType: 'MSME' }
                    ]
                },
                orderBy: { updatedAt: 'desc' },
                take: 8,
                select: {
                    id: true,
                    organizationName: true,
                    organizationType: true,
                    city: true,
                    district: true,
                    state: true,
                    verificationStatus: true,
                    logoFile: { select: organizationLogoSelect },
                    profile: true,
                    _count: { select: { products: { where: { status: 'ACTIVE' } }, services: { where: { status: 'ACTIVE' } } } }
                }
            }).catch(() => []),

            // Stats
            Promise.all([
                db.organization.count({ where: sellerOrganizationWhere }).catch(() => 0),
                db.user.count({ where: { role: 'buyer', accountStatus: 'ACTIVE', onboardingStatus: { in: ['approved_for_procurement', 'approved'] } } }).catch(() => 0),
                db.organization.count({
                    where: {
                        verificationStatus: 'VERIFIED',
                        isBlacklisted: false,
                        deletedAt: null,
                        OR: [
                            { users: { some: { role: 'buyer', accountStatus: 'ACTIVE' } } },
                            { buyerProfiles: { some: {} } },
                            { buyerRequirements: { some: {} } },
                            { procurementBids: { some: {} } },
                            { tenders: { some: {} } },
                            { profile: { isLargeIndustry: true } },
                            { organizationType: { in: ['PUBLIC_LIMITED', 'PSU', 'GOVERNMENT'] } }
                        ]
                    }
                }).catch(() => 0),
                db.product.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
                db.service.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
                db.category.count({ where: { isActive: true } }).catch(() => 0),
                db.buyerRequirement.count({ where: getPublicRequirementWhere() }).catch(() => 0),
            ]).then(([sellers, buyerUsers, buyerOrganizations, products, services, categories, activeReqs]) => ({
                verifiedSellers: sellers,
                registeredBuyers: Math.max(buyerUsers, buyerOrganizations),
                productsListed: products,
                servicesListed: services,
                categories,
                activeRequirements: activeReqs || 0
            })),

            // Latest requirements, tenders, and bids
            loadLatestRequirements(24),
            loadLatestTenders(6),
            loadLatestProcurementBids(6),

            // Pre-structured Home layout sections
            buildHomeLayout({ limit: 12 }, undefined).catch(() => null)
        ]);

        return {
            banners,
            categories,
            featuredProducts,
            featuredServices,
            verifiedSellers,
            largeIndustries,
            bigMsmes,
            notices,
            stats,
            featuredRequirements: latestRequirements,
            latestTenders,
            latestBids,
            sections: homeLayout?.sections || []
        };
    }, 300); // Cache 5 minutes
};

export const prewarmMarketplaceHomeCache = () => fetchMarketplaceHomeData().catch(() => undefined);

router.get('/marketplace/home', shortCache(60), async (_req: Request, res: Response) => {
    try {
        const data = await fetchMarketplaceHomeData();
        return ok(res, data);
    } catch (error) {
        console.error('[Marketplace Home]', error);
        return apiResponse.error(res, 500, 'Failed to load marketplace data', 'MARKETPLACE_HOME_ERROR');
    }
});

// ─── Public: Banners ─────────────────────────────────────────────────────────
router.get('/marketplace/banners', shortCache(60), async (_req: Request, res: Response) => {
    try {
        const banners = await db.marketplaceBanner?.findMany?.({
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' }
        }).catch(() => []);
        return ok(res, banners || []);
    } catch {
        return ok(res, []);
    }
});

// ─── Public: Product Listing ─────────────────────────────────────────────────
router.get('/marketplace/products', optionalAuthenticate, checkFeatureIfAuthenticated('product-marketplace'), shortCache(45), async (req: AuthRequest, res: Response) => {
    try {
        const query = paginationQuery.parse(req.query);
        const page = query.page || 1;
        const pageSize = query.pageSize || 12;
        const skip = (page - 1) * pageSize;
        const categoryId = await resolveCategoryId(query);

        const where: any = productPublicWhere();
        if (query.q) {
            where.OR = [
                { name: { contains: query.q, mode: 'insensitive' } },
                { description: { contains: query.q, mode: 'insensitive' } },
                { brand: { contains: query.q, mode: 'insensitive' } },
                { category: { name: { contains: query.q, mode: 'insensitive' } } },
                { organization: { organizationName: { contains: query.q, mode: 'insensitive' } } }
            ];
        }
        if (categoryId) where.categoryId = categoryId;
        const minPrice = query.priceMin ?? query.minPrice;
        const maxPrice = query.priceMax ?? query.maxPrice;
        if (minPrice !== undefined || maxPrice !== undefined) {
            where.price = {};
            if (minPrice !== undefined) where.price.gte = minPrice;
            if (maxPrice !== undefined) where.price.lte = maxPrice;
        }
        const district = query.district || query.location;
        if (district) {
            where.AND = [...(where.AND || []), {
                organization: {
                    OR: [
                        { district: { contains: district, mode: 'insensitive' } },
                        { city: { contains: district, mode: 'insensitive' } },
                        { state: { contains: district, mode: 'insensitive' } }
                    ]
                }
            }];
        }
        if (query.verified === 'true' || query.verifiedSeller === 'true') {
            where.AND = [...(where.AND || []), { organization: { verificationStatus: 'VERIFIED' } }];
        }
        if (req.query.msmeOnly === 'true' || req.query.isMsmeMade === 'true') {
            where.isMsmeMade = true;
        }
        if (req.query.bulkDeal === 'true' || req.query.bulkDealAvailable === 'true') {
            where.bulkDealAvailable = true;
        }
        if (req.query.taxRate !== undefined && req.query.taxRate !== '') {
            where.taxRate = Number(req.query.taxRate);
        }
        if (req.query.brand !== undefined && req.query.brand !== '') {
            where.brand = { contains: String(req.query.brand), mode: 'insensitive' };
        }
        if (query.discount === 'true' || query.discount === 'active' || query.sort === 'discount') {
            const offer = activeOfferWhere();
            where.AND = [...(where.AND || []), ...(Array.isArray(offer.AND) ? offer.AND : []), { OR: offer.OR }];
            where.isOfferActive = offer.isOfferActive;
            where.originalPrice = offer.originalPrice;
            where.discountPrice = offer.discountPrice;
        }

        let orderBy: any = { createdAt: 'desc' };
        if (query.sort === 'newest' || query.sort === 'latest') orderBy = { createdAt: 'desc' };
        if (query.sort === 'price_asc') orderBy = { price: 'asc' };
        else if (query.sort === 'price_desc') orderBy = { price: 'desc' };
        else if (query.sort === 'name') orderBy = { name: 'asc' };
        else if (query.sort === 'discount') orderBy = [{ discountPercent: 'desc' }, { updatedAt: 'desc' }];
        else if (query.sort === 'verified') orderBy = [{ updatedAt: 'desc' }];
        else if (query.sort === 'popular') orderBy = [{ updatedAt: 'desc' }];

        let mostPurchasedIds: number[] = [];
        if (query.sort === 'most_purchased') {
            const mostPurchased = await loadMostPurchasedItems(100, categoryId);
            mostPurchasedIds = mostPurchased.map(item => item.id);
            if (mostPurchasedIds.length) where.id = { in: mostPurchasedIds };
        }

        const [products, total] = await Promise.all([
            db.product.findMany({
                where,
                orderBy,
                skip,
                take: pageSize,
                include: {
                    category: { select: { id: true, name: true } },
                    seller: { select: { id: true, name: true, onboardingStatus: true } },
                    organization: { select: { id: true, organizationName: true, city: true, district: true, state: true, verificationStatus: true, logoFile: { select: organizationLogoSelect }, profile: { select: organizationProfileBrandSelect } } },
                    images: { include: { fileAsset: { select: { id: true, url: true } } }, orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }], take: 1 }
                }
            }),
            db.product.count({ where })
        ]);

        const sortedProducts = mostPurchasedIds.length
            ? [...products].sort((a: any, b: any) => mostPurchasedIds.indexOf(a.id) - mostPurchasedIds.indexOf(b.id))
            : products;
        const enrichedProducts = await enrichMarketplaceItemsWithTrustData(sortedProducts);
        return ok(res, { products: enrichedProducts, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return apiResponse.error(res, 400, error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '), 'VALIDATION_ERROR');
        }
        console.error('[Marketplace Products]', error);
        return apiResponse.error(res, 500, 'Failed to load products', 'MARKETPLACE_PRODUCTS_ERROR');
    }
});

// ─── Public: Service Listing ─────────────────────────────────────────────────
router.get('/marketplace/services', optionalAuthenticate, checkFeatureIfAuthenticated('service-marketplace'), shortCache(45), async (req: AuthRequest, res: Response) => {
    try {
        const query = paginationQuery.parse(req.query);
        const page = query.page || 1;
        const pageSize = query.pageSize || 12;
        const skip = (page - 1) * pageSize;
        const categoryId = await resolveCategoryId(query);

        const where: any = servicePublicWhere();
        if (query.q) {
            where.OR = [
                { name: { contains: query.q, mode: 'insensitive' } },
                { description: { contains: query.q, mode: 'insensitive' } },
                { category: { name: { contains: query.q, mode: 'insensitive' } } },
                { organization: { organizationName: { contains: query.q, mode: 'insensitive' } } }
            ];
        }
        if (categoryId) where.categoryId = categoryId;
        const minPrice = query.priceMin ?? query.minPrice;
        const maxPrice = query.priceMax ?? query.maxPrice;
        if (minPrice !== undefined || maxPrice !== undefined) {
            where.basePrice = {};
            if (minPrice !== undefined) where.basePrice.gte = minPrice;
            if (maxPrice !== undefined) where.basePrice.lte = maxPrice;
        }
        const district = query.district || query.location;
        if (district) {
            where.AND = [...(where.AND || []), {
                organization: {
                    OR: [
                        { district: { contains: district, mode: 'insensitive' } },
                        { city: { contains: district, mode: 'insensitive' } },
                        { state: { contains: district, mode: 'insensitive' } }
                    ]
                }
            }];
        }
        if (query.verified === 'true' || query.verifiedSeller === 'true') {
            where.AND = [...(where.AND || []), { organization: { verificationStatus: 'VERIFIED' } }];
        }
        if (req.query.msmeOnly === 'true' || req.query.isMsmeMade === 'true') {
            where.isMsmeMade = true;
        }
        if (req.query.taxRate !== undefined && req.query.taxRate !== '') {
            where.taxRate = Number(req.query.taxRate);
        }
        if (query.discount === 'true' || query.discount === 'active' || query.sort === 'discount') {
            const offer = activeOfferWhere();
            where.AND = [...(where.AND || []), ...(Array.isArray(offer.AND) ? offer.AND : []), { OR: offer.OR }];
            where.isOfferActive = offer.isOfferActive;
            where.originalPrice = offer.originalPrice;
            where.discountPrice = offer.discountPrice;
        }

        let orderBy: any = { createdAt: 'desc' };
        if (query.sort === 'newest' || query.sort === 'latest') orderBy = { createdAt: 'desc' };
        else if (query.sort === 'price_asc') orderBy = { basePrice: 'asc' };
        else if (query.sort === 'price_desc') orderBy = { basePrice: 'desc' };
        else if (query.sort === 'name') orderBy = { name: 'asc' };
        else if (query.sort === 'discount') orderBy = [{ discountPercent: 'desc' }, { updatedAt: 'desc' }];
        else if (query.sort === 'verified' || query.sort === 'popular' || query.sort === 'most_purchased') orderBy = [{ updatedAt: 'desc' }];

        const [services, total] = await Promise.all([
            db.service.findMany({
                where,
                orderBy,
                skip,
                take: pageSize,
                include: {
                    category: { select: { id: true, name: true } },
                    seller: { select: { id: true, name: true, onboardingStatus: true } },
                    organization: { select: { id: true, organizationName: true, city: true, district: true, state: true, verificationStatus: true, logoFile: { select: organizationLogoSelect }, profile: { select: organizationProfileBrandSelect } } }
                }
            }),
            db.service.count({ where })
        ]);

        const servicesWithFiles = await attachCatalogueFilesToItems(services, 'service', { imageOnly: true });
        const enrichedServices = await enrichMarketplaceItemsWithTrustData(servicesWithFiles);
        return ok(res, { services: enrichedServices, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return apiResponse.error(res, 400, error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '), 'VALIDATION_ERROR');
        }
        console.error('[Marketplace Services]', error);
        return apiResponse.error(res, 500, 'Failed to load services', 'MARKETPLACE_SERVICES_ERROR');
    }
});

// ─── Public: Service Detail ──────────────────────────────────────────────────
router.get('/marketplace/services/:id', optionalAuthenticate, checkFeatureIfAuthenticated('service-marketplace'), async (req: AuthRequest, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!id || id < 1) return apiResponse.error(res, 400, 'Invalid service ID', 'INVALID_ID');

        const service = await db.service.findFirst({
            where: { id, status: 'ACTIVE' },
            include: {
                category: { select: { id: true, name: true } },
                seller: { select: { id: true, name: true, onboardingStatus: true } },
                organization: { select: { id: true, organizationName: true, city: true, district: true, state: true, verificationStatus: true, gstin: true } },
                specifications: { orderBy: { name: 'asc' } },
                certifications: { 
                    include: { 
                        fileAsset: { 
                            select: { id: true, url: true, originalName: true, mimeType: true, size: true } 
                        } 
                    } 
                }
            }
        });

        if (!service) return apiResponse.error(res, 404, 'Service not found', 'SERVICE_NOT_FOUND');
        const serviceWithFiles = await attachCatalogueFilesToItem(service, 'service');

        const related = await db.service.findMany({
            where: { status: 'ACTIVE', categoryId: service.categoryId, id: { not: id } },
            take: 4,
            include: {
                category: { select: { id: true, name: true } },
                organization: { select: { id: true, organizationName: true, city: true, state: true, verificationStatus: true } }
            }
        });
        const relatedWithFiles = await attachCatalogueFilesToItems(related, 'service', { imageOnly: true });

        return ok(res, { service: serviceWithFiles, relatedServices: relatedWithFiles });
    } catch (error) {
        console.error('[Marketplace Service Detail]', error);
        return apiResponse.error(res, 500, 'Failed to load service details', 'SERVICE_DETAIL_ERROR');
    }
});

// ─── Public: Verified Sellers ────────────────────────────────────────────────
router.get('/marketplace/sellers', shortCache(60), async (req: Request, res: Response) => {
    try {
        const query = paginationQuery.parse(req.query);
        const page = query.page || 1;
        const pageSize = query.pageSize || 12;
        const skip = (page - 1) * pageSize;

        const where: any = { ...sellerOrganizationWhere };
        if (query.q) {
            where.organizationName = { contains: query.q, mode: 'insensitive' };
        }

        const rawSort = String(req.query.sort || '').toLowerCase();
        let orderBy: any = { updatedAt: 'desc' };
        if (rawSort === 'latest') orderBy = { createdAt: 'desc' };
        else if (rawSort === 'name') orderBy = { organizationName: 'asc' };
        else if (rawSort === 'products') orderBy = { products: { _count: 'desc' } };

        const [sellers, total] = await Promise.all([
            db.organization.findMany({
                where,
                orderBy,
                skip,
                take: pageSize,
                select: {
                    id: true,
                    organizationName: true,
                    organizationType: true,
                    city: true,
                    district: true,
                    state: true,
                    verificationStatus: true,
                    gstin: true,
                    panNumber: true,
                    logoFile: { select: organizationLogoSelect },
                    profile: { select: organizationProfileBrandSelect },
                    products: {
                        where: { status: 'ACTIVE' },
                        select: { category: { select: { name: true } } },
                        take: 15
                    },
                    services: {
                        where: { status: 'ACTIVE' },
                        select: { category: { select: { name: true } } },
                        take: 15
                    },
                    users: {
                        where: {
                            role: { in: ['seller', 'shg'] },
                            accountStatus: 'ACTIVE'
                        },
                        select: {
                            id: true
                        }
                    },
                    _count: { select: { products: { where: { status: 'ACTIVE' } }, services: { where: { status: 'ACTIVE' } } } }
                }
            }),
            db.organization.count({ where })
        ]);

        const mappedSellers = sellers.map((org: any) => {
            const sellerUser = org.users?.[0];
            const categories = Array.from(new Set([
                ...(org.products || []).map((p: any) => p.category?.name),
                ...(org.services || []).map((s: any) => s.category?.name)
            ].filter(Boolean)));

            return {
                id: org.id,
                organizationName: org.organizationName,
                organizationType: org.organizationType,
                city: org.city,
                district: org.district,
                state: org.state,
                verificationStatus: org.verificationStatus,
                gstin: org.gstin,
                panNumber: org.panNumber,
                logoFile: org.logoFile,
                profile: org.profile,
                categories,
                _count: org._count,
                sellerUserId: sellerUser ? sellerUser.id : null
            };
        });

        return ok(res, { sellers: mappedSellers, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return apiResponse.error(res, 400, error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '), 'VALIDATION_ERROR');
        }
        console.error('[Marketplace Sellers]', error);
        return apiResponse.error(res, 500, 'Failed to load sellers', 'MARKETPLACE_SELLERS_ERROR');
    }
});


router.get('/marketplace/sellers/:id', async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!id || id < 1) return apiResponse.error(res, 400, 'Invalid seller ID', 'INVALID_ID');

        let org = await db.organization.findUnique({
            where: { id },
            include: {
                logoFile: { select: organizationLogoSelect },
                profile: { select: { logoUrl: true, bannerUrl: true } },
                buyerProfiles: { select: { logoUrl: true, bannerUrl: true } },
                sellerProfiles: {
                    include: {
                        offices: true
                    }
                },
                users: {
                    where: { role: { in: ['seller', 'shg'] } },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        mobile: true
                    }
                }
            }
        });

        if (!org) {
            const sellerUser = await db.user.findUnique({ where: { id }, select: { organizationId: true } });
            if (sellerUser?.organizationId) {
                org = await db.organization.findUnique({
                    where: { id: sellerUser.organizationId },
                    include: {
                        logoFile: { select: organizationLogoSelect },
                        profile: { select: { logoUrl: true, bannerUrl: true } },
                        buyerProfiles: { select: { logoUrl: true, bannerUrl: true } },
                        sellerProfiles: {
                            include: {
                                offices: true
                            }
                        },
                        users: {
                            where: { role: { in: ['seller', 'shg'] } },
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                mobile: true
                            }
                        }
                    }
                });
            }
        }

        if (!org) {
            return apiResponse.error(res, 404, 'Seller Organization not found', 'SELLER_NOT_FOUND');
        }
        
        const primaryProfile = org.sellerProfiles?.[0] || {};
        const sellerUser = org.users?.[0] || {};
        
        const vendor = {
            id: org.id,
            sellerUserId: sellerUser.id || null,
            name: org.organizationName,
            sellerName: org.users?.map((u: any) => u.name).filter(Boolean).join(', ') || sellerUser.name || null,
            city: org.city,
            state: org.state,
            email: org.users?.map((u: any) => u.email).filter(Boolean).join(', ') || sellerUser.email || null,
            mobile: org.users?.map((u: any) => u.mobile).filter(Boolean).join(', ') || sellerUser.mobile || null,
            logoUrl: org.profile?.logoUrl || org.buyerProfiles?.[0]?.logoUrl || org.logoFile?.url || null,
            bannerUrl: org.profile?.bannerUrl || org.buyerProfiles?.[0]?.bannerUrl || null,
            sellerProfile: {
                ...primaryProfile,
                businessName: org.organizationName,
                offices: primaryProfile.offices || [],
                website: org.website || primaryProfile.website || null,
                productCategories: primaryProfile.productCategories || []
            }
        };

        return ok(res, vendor);
    } catch (error) {
        console.error('[Marketplace Seller Detail]', error);
        return apiResponse.error(res, 500, 'Failed to load seller details', 'SELLER_DETAIL_ERROR');
    }
});


// ─── Public: Verified Buyers ─────────────────────────────────────────────────
router.get('/marketplace/buyers', shortCache(60), async (req: Request, res: Response) => {
    try {
        const query = paginationQuery.parse(req.query);
        const page = query.page || 1;
        const pageSize = query.pageSize || 12;
        const skip = (page - 1) * pageSize;
        const where: any = {
            verificationStatus: 'VERIFIED',
            isBlacklisted: false,
            deletedAt: null,
            OR: [
                { users: { some: { role: 'buyer', accountStatus: 'ACTIVE' } } },
                { buyerProfiles: { some: {} } },
                { buyerRequirements: { some: {} } },
                { procurementBids: { some: {} } },
                { tenders: { some: {} } },
                { profile: { isLargeIndustry: true } },
                { organizationType: { in: ['PUBLIC_LIMITED', 'PSU', 'GOVERNMENT'] } }
            ]
        };
        if (query.q) where.organizationName = { contains: query.q, mode: 'insensitive' };

        const rawSort = String(req.query.sort || '').toLowerCase();
        let orderBy: any = { updatedAt: 'desc' };
        if (rawSort === 'latest') orderBy = { createdAt: 'desc' };
        else if (rawSort === 'name') orderBy = { organizationName: 'asc' };
        else if (rawSort === 'requirements') orderBy = { buyerRequirements: { _count: 'desc' } };

        const [buyers, total] = await Promise.all([
            db.organization.findMany({
                where,
                orderBy,
                skip,
                take: pageSize,
                select: {
                    id: true,
                    organizationName: true,
                    organizationType: true,
                    city: true,
                    district: true,
                    state: true,
                    verificationStatus: true,
                    logoFile: { select: organizationLogoSelect },
                    profile: { select: organizationProfileBrandSelect },
                    buyerProfiles: {
                        where: {
                            verificationStatus: 'VERIFIED',
                            isActive: true
                        },
                        select: {
                            id: true,
                            logoUrl: true,
                            bannerUrl: true
                        }
                    },
                    _count: { select: { buyerRequirements: true } }
                }
            }),
            db.organization.count({ where })
        ]);

        return ok(res, { buyers, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return apiResponse.error(res, 400, error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '), 'VALIDATION_ERROR');
        }
        console.error('[Marketplace Buyers]', error);
        return apiResponse.error(res, 500, 'Failed to load buyers', 'MARKETPLACE_BUYERS_ERROR');
    }
});

// ─── Public: Notices ─────────────────────────────────────────────────────────
router.get('/marketplace/notices', shortCache(60), async (_req: Request, res: Response) => {
    try {
        const notices = await db.marketplaceNotice?.findMany?.({
            where: { isActive: true },
            orderBy: { publishedAt: 'desc' },
            take: 10
        }).catch(() => []);
        return ok(res, notices || []);
    } catch {
        return ok(res, []);
    }
});

// ─── Public: Search ──────────────────────────────────────────────────────────
router.get('/marketplace/requirements', optionalAuthenticate, shortCache(30), async (req: AuthRequest, res: Response) => {
    try {
        const query = paginationQuery.extend({
            type: z.enum(['PRODUCT', 'SERVICE']).optional(),
            tab: z.enum(['all', 'products', 'services', 'closing_soon', 'large_industries', 'government']).optional(),
            buyerOrganizationId: z.coerce.number().int().positive().optional()
        }).parse(req.query);
        const page = query.page || 1;
        const pageSize = query.pageSize || 12;
        const skip = (page - 1) * pageSize;
        const where: any = { ...getPublicRequirementWhere(req.user) };
        if (query.q) where.OR = [{ title: { contains: query.q, mode: 'insensitive' } }, { description: { contains: query.q, mode: 'insensitive' } }, { location: { contains: query.q, mode: 'insensitive' } }];
        if (query.type) where.requirementType = query.type;
        if (query.tab === 'products') where.requirementType = 'PRODUCT';
        if (query.tab === 'services') where.requirementType = 'SERVICE';
        if (query.tab === 'closing_soon') where.lastDate = { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) };
        if (query.tab === 'large_industries') where.buyerOrganization = { profile: { isLargeIndustry: true } };
        if (query.tab === 'government') where.buyerOrganization = { organizationType: { in: ['GOVERNMENT', 'PSU'] } };
        if (query.categoryId) where.categoryId = query.categoryId;
        if (query.buyerOrganizationId) where.buyerOrganizationId = query.buyerOrganizationId;
        if (query.location) where.location = { contains: query.location, mode: 'insensitive' };

        const legacyWhere: any = { ...getPublicLegacyRequirementWhere() };
        if (query.q) legacyWhere.AND = [
            ...(Array.isArray(legacyWhere.AND) ? legacyWhere.AND : []),
            { OR: [
                { title: { contains: query.q, mode: 'insensitive' } },
                { description: { contains: query.q, mode: 'insensitive' } },
                { organization: { OR: [
                    { organizationName: { contains: query.q, mode: 'insensitive' } },
                    { city: { contains: query.q, mode: 'insensitive' } },
                    { district: { contains: query.q, mode: 'insensitive' } },
                    { state: { contains: query.q, mode: 'insensitive' } }
                ] } }
            ] }
        ];
        if (query.tab === 'services' || query.type === 'SERVICE') legacyWhere.id = -1;
        if (query.tab === 'closing_soon') legacyWhere.requiredBy = { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) };
        if (query.tab === 'large_industries') legacyWhere.organization = { profile: { isLargeIndustry: true } };
        if (query.tab === 'government') legacyWhere.organization = { organizationType: { in: ['GOVERNMENT', 'PSU'] } };
        if (query.categoryId) legacyWhere.categoryId = query.categoryId;
        if (query.buyerOrganizationId) legacyWhere.organizationId = query.buyerOrganizationId;
        if (query.location) legacyWhere.organization = {
            ...(legacyWhere.organization || {}),
            OR: [
                { city: { contains: query.location, mode: 'insensitive' } },
                { district: { contains: query.location, mode: 'insensitive' } },
                { state: { contains: query.location, mode: 'insensitive' } }
            ]
        };

        const pbWhere: any = {
            approvalStatus: { in: ['APPROVED', 'PENDING'] },
            status: { in: ['OPEN', 'OPEN_FOR_BIDDING', 'PUBLISHED', 'CLOSED', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'AWARDED', 'EXPIRED'] },
            visibility: 'PUBLIC'
        };
        if (query.q) {
            pbWhere.OR = [
                { title: { contains: query.q, mode: 'insensitive' } },
                { description: { contains: query.q, mode: 'insensitive' } },
                { bidNumber: { contains: query.q, mode: 'insensitive' } },
                { deliveryLocation: { contains: query.q, mode: 'insensitive' } },
                { district: { contains: query.q, mode: 'insensitive' } }
            ];
        }
        if (query.type) pbWhere.bidType = { contains: query.type, mode: 'insensitive' };
        if (query.tab === 'products') pbWhere.bidType = { not: 'SERVICE' };
        if (query.tab === 'services') pbWhere.bidType = { contains: 'SERVICE', mode: 'insensitive' };
        if (query.tab === 'closing_soon') pbWhere.endDate = { gte: new Date(), lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) };
        if (query.tab === 'large_industries') pbWhere.buyerType = { contains: 'LARGE', mode: 'insensitive' };
        if (query.tab === 'government') pbWhere.buyerType = { in: ['GOVERNMENT', 'PSU'] };
        if (query.buyerOrganizationId) pbWhere.buyerOrganizationId = query.buyerOrganizationId;
        if (query.location) {
            pbWhere.OR = [
                ...(pbWhere.OR || []),
                { deliveryLocation: { contains: query.location, mode: 'insensitive' } },
                { district: { contains: query.location, mode: 'insensitive' } },
                { state: { contains: query.location, mode: 'insensitive' } }
            ];
        }

        const rawSort = String(req.query.sort || '').toLowerCase();
        let buyerOrderBy: any = [{ isUrgent: 'desc' }, { lastDate: 'asc' }, { createdAt: 'desc' }];
        if (rawSort === 'latest') {
            buyerOrderBy = [{ createdAt: 'desc' }, { updatedAt: 'desc' }];
        } else if (rawSort === 'deadline') {
            buyerOrderBy = [{ lastDate: 'asc' }];
        }

        const cacheKey = `cache:marketplace:requirements:${req.user?.id || 'anon'}:${JSON.stringify(req.query)}`;
        const cachedResult = await getOrSetCache(cacheKey, async () => {
            const [buyerRequirements, buyerTotal, legacyRequirements, legacyTotal, procurementBids, pbTotal] = await Promise.all([
                db.buyerRequirement.findMany({ where, orderBy: buyerOrderBy, take: pageSize * page, select: publicRequirementListSelect }).catch(() => []),
                db.buyerRequirement.count({ where }).catch(() => 0),
                db.requirement.findMany({ where: legacyWhere, orderBy: [{ requiredBy: 'asc' }, { updatedAt: 'desc' }], take: pageSize * page, select: publicLegacyRequirementSelect }).catch(() => []),
                db.requirement.count({ where: legacyWhere }).catch(() => 0),
                db.procurementBid.findMany({ where: pbWhere, include: { buyerOrganization: true }, orderBy: [{ endDate: 'asc' }, { createdAt: 'desc' }], take: pageSize * page }).catch(() => []),
                db.procurementBid.count({ where: pbWhere }).catch(() => 0)
            ]);

            const currentUserId = req.user?.id ? Number(req.user.id) : null;
            const filteredLegacy = (legacyRequirements || []).filter((reqItem: any) => {
                const method = reqItem.canonicalMethod || reqItem.procurementMethod || '';
                const isRestricted = ['DIRECT_PURCHASE', 'CATALOG_PURCHASE', 'REPEAT_ORDER', 'LIMITED_TENDER', 'SINGLE_SOURCE', 'PAC', 'EMERGENCY_PURCHASE'].includes(method.toUpperCase());
                const isLimitedRfq = method.toUpperCase() === 'RFQ' && reqItem.payload && typeof reqItem.payload === 'object' && (reqItem.payload as any).rfqType === 'LIMITED';
                
                if (isRestricted || isLimitedRfq) {
                    if (!currentUserId) return false;
                    const invited = Array.isArray((reqItem.payload as any)?.vendors?.invitedSellers) ? (reqItem.payload as any).vendors.invitedSellers : [];
                    return invited.includes(currentUserId);
                }
                return true;
            });

            const decoratedPb = (procurementBids || []).map(mapProcurementBidToPublic);
            const decoratedLegacy = (filteredLegacy || []).map(mapLegacyRequirementToPublic);
            const decoratedBuyer = (buyerRequirements || []).map(decorateRequirement);

            // Canonical indexing to prevent duplicate rows while showing authentic bid details
            const combinedMap = new Map<string, any>();

            // 1. Procurement bids have the richest authentic bid data & canonical bid numbers
            for (const item of decoratedPb) {
                const numKey = (item.requirementNumber || '').trim().toUpperCase();
                const titleKey = `${(item.title || '').trim().toLowerCase()}::${item.buyerOrganizationId || item.buyerId || ''}`;
                if (numKey) combinedMap.set(numKey, item);
                combinedMap.set(titleKey, item);
            }

            // 2. Legacy requirements - if not already covered by procurementBid, include
            for (const item of decoratedLegacy) {
                const numKey = (item.requirementNumber || '').trim().toUpperCase();
                const titleKey = `${(item.title || '').trim().toLowerCase()}::${item.buyerOrganizationId || item.buyerId || ''}`;
                if (numKey && combinedMap.has(numKey)) continue;
                if (combinedMap.has(titleKey)) continue;
                if (numKey) combinedMap.set(numKey, item);
                combinedMap.set(titleKey, item);
            }

            // 3. Buyer requirements - if not already covered, include
            for (const item of decoratedBuyer) {
                const numKey = (item.requirementNumber || '').trim().toUpperCase();
                const titleKey = `${(item.title || '').trim().toLowerCase()}::${item.buyerOrganizationId || item.buyerId || ''}`;
                if (numKey && !numKey.startsWith('REQ-') && combinedMap.has(numKey)) continue;
                if (combinedMap.has(titleKey)) continue;
                if (numKey) combinedMap.set(numKey, item);
                combinedMap.set(titleKey, item);
            }

            const uniqueCombined = Array.from(new Set(combinedMap.values()));

            const combined = uniqueCombined.sort((a: any, b: any) => {
                if (rawSort === 'latest') {
                    return new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime();
                }
                if (rawSort === 'deadline') {
                    return new Date(a.lastDate || 0).getTime() - new Date(b.lastDate || 0).getTime();
                }
                const urgent = Number(Boolean(b.isUrgent)) - Number(Boolean(a.isUrgent));
                if (urgent) return urgent;
                return new Date(b.createdAt || b.updatedAt || 0).getTime() - new Date(a.createdAt || a.updatedAt || 0).getTime();
            });
            const total = combined.length;
            return { requirements: combined.slice(skip, skip + pageSize), total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
        }, 30);
        return ok(res, cachedResult);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return apiResponse.error(res, 400, error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '), 'VALIDATION_ERROR');
        }
        console.error('[Marketplace Requirements]', error);
        return apiResponse.error(res, 500, 'Failed to load buyer requirements', 'BUYER_REQUIREMENTS_ERROR');
    }
});

router.get('/marketplace/requirements/:id', optionalAuthenticate, shortCache(30), async (req: AuthRequest, res: Response) => {
    try {
        const idToken = String(req.params.id || '').trim();
        let id = Number(idToken);
        let hasNumericId = idToken !== '' && Number.isFinite(id) && id !== 0;
        
        if (!hasNumericId && idToken.startsWith('REQ-')) {
            const parsed = Number(idToken.replace('REQ-', ''));
            if (Number.isFinite(parsed) && parsed !== 0) {
                id = parsed;
                hasNumericId = true;
            }
        }
        
        const hasReferenceId = idToken.length > 0 && !hasNumericId;
        if (!hasNumericId && !hasReferenceId) return apiResponse.error(res, 400, 'Invalid requirement ID', 'INVALID_ID');

        let requirement: any = null;
        let isLegacy = false;

        if (hasNumericId && id < 0) {
            const legacyId = Math.abs(id);
            const legacyReq = await db.requirement.findFirst({
                where: { id: legacyId },
                select: publicLegacyRequirementDetailSelect
            });
            if (!legacyReq) {
                return apiResponse.error(res, 404, 'Requirement not found', 'REQUIREMENT_NOT_FOUND');
            }
            requirement = mapLegacyRequirementToPublic(legacyReq);
            isLegacy = true;
        } else {
            const searchTokens = Array.from(new Set([
                idToken,
                idToken.replace(/^[A-Z]{2,5}-/, 'REQ-'),
                idToken.replace(/^[A-Z]{2,5}-/, 'TND-'),
                idToken.replace(/^[A-Z]{2,5}-/, 'RFQ-'),
                idToken.replace(/^[A-Z]{2,5}-/, 'RFP-'),
            ]));

            if (hasNumericId) {
                const buyerReq = await db.buyerRequirement.findFirst({
                    where: { id },
                    select: publicRequirementDetailSelect
                });
                if (buyerReq) {
                    requirement = decorateRequirement(buyerReq);
                }
            }
            if (!requirement) {
                const legacyReq = await db.requirement.findFirst({
                    where: hasNumericId ? { id } : { requirementNumber: { in: searchTokens } },
                    select: publicLegacyRequirementDetailSelect
                });
                if (legacyReq) {
                    requirement = mapLegacyRequirementToPublic(legacyReq);
                    isLegacy = true;
                }
            }

            if (!requirement) {
                const contractMatch = await db.contract.findFirst({
                    where: {
                        contractType: 'RATE_CONTRACT',
                        OR: [
                            { contractNumber: idToken },
                            { contractNumber: idToken.startsWith('RC-') ? idToken : `RC-${idToken}` },
                            { metadata: { path: ['requirementNumber'], equals: idToken } }
                        ]
                    }
                }).catch(() => null);

                if (contractMatch) {
                    const meta = (contractMatch.metadata || {}) as any;
                    requirement = {
                        id: contractMatch.contractNumber || `RC-${contractMatch.id}`,
                        requirementNumber: contractMatch.contractNumber || meta.requirementNumber || `RC-${contractMatch.id}`,
                        title: contractMatch.title || meta.contractTitle || 'Rate Contract',
                        description: meta.contractDescription || contractMatch.title || 'Rate Contract Procurement',
                        requirementType: 'PRODUCT',
                        procurementMethod: 'RATE_CONTRACT',
                        canonicalMethod: 'RATE_CONTRACT',
                        status: contractMatch.status || 'OPEN',
                        statusLabel: 'Open',
                        budgetMin: Number(contractMatch.value || 0),
                        budgetMax: Number(contractMatch.value || 0),
                        lastDate: contractMatch.endDate || meta.periodEndDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                        createdAt: contractMatch.createdAt,
                        updatedAt: contractMatch.updatedAt,
                        buyerId: meta.buyerId,
                        buyerOrganizationId: meta.buyerOrganizationId,
                        payload: {
                            rateContractConfig: meta,
                            basics: {
                                title: contractMatch.title || meta.contractTitle,
                                description: meta.contractDescription,
                                procurementMethod: 'RATE_CONTRACT',
                            },
                            items: meta.itemRateSchedule || []
                        }
                    };
                }
            }

            if (!requirement) {
                const pbMatch = await db.procurementBid.findFirst({
                    where: hasNumericId
                        ? { OR: [{ id }, { bidNumber: idToken }] }
                        : { bidNumber: { in: searchTokens } },
                    include: { buyerOrganization: true }
                }).catch(() => null);
                if (pbMatch) {
                    requirement = mapProcurementBidToPublic(pbMatch);
                }
            }
        }

        if (!requirement) {
            return apiResponse.error(res, 404, 'Requirement not found', 'REQUIREMENT_NOT_FOUND');
        }

        if (requirement.visibility === 'VERIFIED_SELLERS_ONLY') {
            const isVerifiedSeller = req.user?.role === 'seller';
            const isAdmin = ['admin', 'master_admin'].includes(req.user?.role || '');
            const isOwner = Boolean(req.user?.id && (requirement.buyerId === req.user.id || requirement.createdById === req.user.id || (req.user.organizationId && requirement.buyerOrganizationId === req.user.organizationId)));
            if (!isVerifiedSeller && !isAdmin && !isOwner) {
                return apiResponse.error(res, 403, 'This requirement is restricted to verified sellers only. Please sign in with an approved seller account.', 'RESTRICTED_REQUIREMENT');
            }
        }

        const currentUserId = req.user?.id ? Number(req.user.id) : null;
        const method = requirement.canonicalMethod || requirement.procurementMethod || '';
        const isRestricted = ['DIRECT_PURCHASE', 'CATALOG_PURCHASE', 'REPEAT_ORDER', 'LIMITED_TENDER', 'SINGLE_SOURCE', 'PAC', 'EMERGENCY_PURCHASE'].includes(method.toUpperCase());
        const isLimitedRfq = method.toUpperCase() === 'RFQ' && requirement.payload && typeof requirement.payload === 'object' && (requirement.payload as any).rfqType === 'LIMITED';
        
        if (isRestricted || isLimitedRfq) {
            if (!currentUserId) {
                return apiResponse.error(res, 403, 'Access denied. This is a restricted procurement event.', 'FORBIDDEN');
            }
            const invited = Array.isArray((requirement.payload as any)?.vendors?.invitedSellers) ? (requirement.payload as any).vendors.invitedSellers : [];
            if (!invited.includes(currentUserId)) {
                return apiResponse.error(res, 403, 'Access denied. You are not invited to this procurement event.', 'FORBIDDEN');
            }
        }

        let similar: any[] = [];
        let ownResponse: any = null;
        const responseRequirementIds = new Set<number>([
            Number(requirement.id),
            Math.abs(Number(requirement.id))
        ].filter((value) => Number.isFinite(value) && value > 0));

        if (req.user?.role === 'seller') {
            const reqTitle = requirement.title;
            const reqBuyerId = requirement.buyerId || requirement.createdById;
            const reqBuyerOrgId = requirement.buyerOrganizationId;
            const reqNumber = requirement.requirementNumber || requirement.bidNumber || idToken;

            const [mirroredRequirement, linkedLegacyReq, linkedBidRecord] = await Promise.all([
                db.buyerRequirement.findFirst({
                    where: {
                        OR: [
                            ...(reqTitle && reqBuyerId ? [{ title: reqTitle, createdById: reqBuyerId }] : []),
                            ...(reqTitle && reqBuyerOrgId ? [{ title: reqTitle, buyerOrganizationId: reqBuyerOrgId }] : [])
                        ]
                    },
                    select: { id: true }
                }).catch(() => null),
                db.requirement.findFirst({
                    where: {
                        OR: [
                            ...(reqNumber ? [{ requirementNumber: reqNumber }] : []),
                            ...(reqTitle && reqBuyerId ? [{ title: reqTitle, buyerId: reqBuyerId }] : [])
                        ]
                    },
                    select: { id: true }
                }).catch(() => null),
                db.procurementBid.findFirst({
                    where: {
                        OR: [
                            ...(reqNumber ? [{ bidNumber: reqNumber }] : []),
                            ...(reqTitle && reqBuyerId ? [{ title: reqTitle, buyerId: reqBuyerId }] : [])
                        ]
                    },
                    select: { id: true }
                }).catch(() => null)
            ]);

            if (mirroredRequirement?.id) responseRequirementIds.add(mirroredRequirement.id);
            if (linkedLegacyReq?.id) responseRequirementIds.add(linkedLegacyReq.id);
            if (linkedBidRecord?.id) responseRequirementIds.add(linkedBidRecord.id);
        }

        const safeReqId = typeof requirement.id === 'number' && requirement.id > 0 ? requirement.id : -999999;
        const [similarList, response] = await Promise.all([
            db.buyerRequirement.findMany({
                where: {
                    ...getPublicRequirementWhere(req.user),
                    ...(safeReqId > 0 ? { id: { not: safeReqId } } : {})
                },
                take: 4,
                orderBy: { createdAt: 'desc' },
                select: publicRequirementListSelect
            }).catch(() => []),
            req.user?.role === 'seller'
                ? db.requirementResponse.findFirst({
                    where: {
                        AND: [
                            { requirementId: { in: Array.from(responseRequirementIds) } },
                            {
                                OR: [
                                    { sellerUserId: Number(req.user.id) },
                                    ...(req.user.organizationId ? [{ sellerOrganizationId: req.user.organizationId }] : [])
                                ]
                            }
                        ]
                    },
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        status: true,
                        createdAt: true,
                        updatedAt: true,
                        offeredPrice: true,
                        offeredQuantity: true,
                        deliveryTimeline: true,
                        message: true,
                        attachmentUrl: true,
                        terms: true,
                        responseData: true
                    }
                })
                : Promise.resolve(null)
        ]);
        similar = similarList.map(decorateRequirement);
        ownResponse = response;

        if (!ownResponse && req.user?.role === 'seller') {
            const pbPart = await db.procurementBidParticipation.findFirst({
                where: {
                    bidId: { in: Array.from(responseRequirementIds) },
                    sellerId: Number(req.user.id),
                    submissionStatus: { not: 'DRAFT' },
                    isWithdrawn: false
                }
            }).catch(() => null);

            if (pbPart) {
                ownResponse = {
                    id: pbPart.id,
                    status: pbPart.submissionStatus || 'SUBMITTED',
                    submissionStatus: pbPart.submissionStatus || 'SUBMITTED',
                    offeredPrice: Number(pbPart.quotedAmount || pbPart.totalAmount || 0),
                    offeredQuantity: pbPart.offeredQuantity || 1,
                    deliveryTimeline: pbPart.deliveryTimeline || 'Standard',
                    message: pbPart.offeredItemDescription || '',
                    terms: pbPart.terms || '',
                    attachmentUrl: null,
                    responseData: pbPart.acknowledgement || {},
                    createdAt: pbPart.createdAt,
                    updatedAt: pbPart.updatedAt
                };
            }
        }

        return ok(res, { requirement, similarRequirements: similar, ownResponse });
    } catch (error) {
        console.error('[Marketplace Requirement Detail]', error);
        return apiResponse.error(res, 500, 'Failed to load requirement detail', 'REQUIREMENT_DETAIL_ERROR');
    }
});

router.get('/public/requirements/latest', shortCache(30), async (req: Request, res: Response) => {
    try {
        const take = Math.min(Math.max(Number(req.query.limit) || 6, 1), 12);
        return ok(res, await loadLatestRequirements(take));
    } catch (error) {
        console.error('[Public Latest Requirements]', error);
        return apiResponse.error(res, 500, 'Failed to load latest requirements', 'PUBLIC_REQUIREMENTS_ERROR');
    }
});

router.post('/buyer/requirements', authenticate, authorize('buyer', 'admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
    try {
        const body = requirementSchema.parse(req.body);
        const actor = await prisma.user.findUnique({
            where: { id: Number(req.user?.id) },
            select: { onboardingStatus: true, organizationId: true,  isDualRole: true, buyerProfile: true }
        });
        const isApproved = actor?.isDualRole
            ? (actor.buyerProfile?.verificationStatusEnum === 'VERIFIED' || actor.buyerProfile?.verificationStatus === 'VERIFIED')
            : ['approved_for_procurement', 'approved'].includes(String(actor?.onboardingStatus));
        if (req.user?.role === 'buyer' && !isApproved) {
            return apiResponse.error(res, 403, 'Please complete buyer onboarding and organization verification to continue.', 'BUYER_VERIFICATION_REQUIRED');
        }
        const requirement = await db.buyerRequirement.create({
            data: { ...body,  buyerOrganizationId: actor?.organizationId || req.user?.organizationId || null, createdById: req.user?.id, status: 'PENDING_APPROVAL' },
            include: requirementIncludes
        });
        return ok(res, requirement);
    } catch (error) {
        console.error('[Create Buyer Requirement]', error);
        return apiResponse.error(res, 400, 'Unable to post buyer requirement', 'BUYER_REQUIREMENT_CREATE_ERROR');
    }
});

router.post('/marketplace/requirements/:id/responses', authenticate, authorize('seller'), async (req: AuthRequest, res: Response) => {
    try {
        const idToken = String(req.params.id || '').trim();
        const tokenVariants = getCanonicalLookupVariants(idToken);
        const packetObject = (value: any) => {
            if (!value) return {};
            if (typeof value === 'object') return value;
            if (typeof value === 'string') {
                try { return JSON.parse(value); } catch { return {}; }
            }
            return {};
        };
        const resolveFromProcurementBid = async (bid: any) => {
            if (!bid) return null;
            const packet = packetObject(bid.technicalPacket);
            const linkedRequirementId = Number(packet.sourceRequirementId || packet.requirementId || packet.linkedRequirementId || 0);

            if (linkedRequirementId > 0) {
                const modern = await db.buyerRequirement.findUnique({ where: { id: linkedRequirementId }, select: { id: true } }).catch(() => null);
                if (modern) return modern.id;

                const legacy = await db.requirement.findUnique({ where: { id: linkedRequirementId }, select: { id: true } }).catch(() => null);
                if (legacy) return -legacy.id;
            }

            const mirror = await db.buyerRequirement.findFirst({
                where: {
                    title: bid.title,
                    createdById: bid.buyerId,
                    ...(bid.buyerOrganizationId ? { buyerOrganizationId: bid.buyerOrganizationId } : {})
                },
                select: { id: true }
            }).catch(() => null);

            return mirror?.id || null;
        };

        let id = Number(idToken);
        if (Number.isFinite(id) && id > 0) {
            const modern = await db.buyerRequirement.findUnique({ where: { id }, select: { id: true } }).catch(() => null);
            if (!modern) {
                const bid = await db.procurementBid.findUnique({
                    where: { id },
                    select: { id: true, bidNumber: true, title: true, description: true, buyerId: true, buyerOrganizationId: true, technicalPacket: true }
                }).catch(() => null);
                const resolved = await resolveFromProcurementBid(bid);
                if (resolved) id = resolved;
                else {
                    const legacy = await db.requirement.findUnique({ where: { id }, select: { id: true } }).catch(() => null);
                    if (legacy) id = -legacy.id;
                }
            }
        } else if (!Number.isFinite(id) || id === 0) {
            const bid = await db.procurementBid.findFirst({
                where: {
                    OR: tokenVariants.map(t => ({ bidNumber: t }))
                },
                select: { id: true, bidNumber: true, title: true, description: true, buyerId: true, buyerOrganizationId: true, technicalPacket: true }
            }).catch(() => null);
            const bidResolved = await resolveFromProcurementBid(bid);

            if (bidResolved) {
                id = bidResolved;
            } else if (bid) {
                // Bid found but couldn't resolve to a BuyerRequirement — use bid.id directly
                id = bid.id;
            } else {
                const legacy = await db.requirement.findFirst({
                    where: {
                        OR: tokenVariants.map(t => ({ requirementNumber: t }))
                    },
                    select: { id: true }
                }).catch(() => null);

                if (legacy) {
                    id = -legacy.id;
                } else {
                    const contractMatch = await db.contract.findFirst({
                        where: {
                            contractType: 'RATE_CONTRACT',
                            OR: tokenVariants.flatMap(t => [
                                { contractNumber: t },
                                { metadata: { path: ['requirementNumber'], equals: t } }
                            ])
                        },
                        select: { id: true }
                    }).catch(() => null);

                    if (contractMatch) {
                        id = -contractMatch.id - 100000;
                    } else {
                        // Last resort: extract trailing numeric sequence (e.g. 39952 from TND-2026-39952)
                        // and try as a direct BuyerRequirement.id or ProcurementBid.id
                        const numericMatch = idToken.match(/(\d+)$/);
                        const numericId = numericMatch ? Number(numericMatch[1]) : 0;
                        if (numericId > 0) {
                            const directReq = await db.buyerRequirement.findUnique({ where: { id: numericId }, select: { id: true } }).catch(() => null);
                            if (directReq) {
                                id = directReq.id;
                            } else {
                                const directBid = await db.procurementBid.findUnique({
                                    where: { id: numericId },
                                    select: { id: true, bidNumber: true, title: true, description: true, buyerId: true, buyerOrganizationId: true, technicalPacket: true }
                                }).catch(() => null);
                                const directResolved = await resolveFromProcurementBid(directBid);
                                if (directResolved) {
                                    id = directResolved;
                                } else if (directBid) {
                                    id = directBid.id;
                                } else {
                                    return apiResponse.error(res, 400, 'Invalid requirement ID', 'INVALID_ID');
                                }
                            }
                        } else {
                            return apiResponse.error(res, 400, 'Invalid requirement ID', 'INVALID_ID');
                        }
                    }
                }
            }
        }

        const body = responseSchema.parse(req.body);
        if (req.user?.role !== 'seller') {
            return apiResponse.error(res, 403, 'Only seller accounts can respond to buyer requirements.', 'SELLER_ROLE_REQUIRED');
        }
        const seller = await prisma.user.findUnique({
            where: { id: Number(req.user?.id) },
            select: { id: true, onboardingStatus: true, organizationId: true, isDualRole: true, sellerProfile: true }
        });
        const isSellerApproved = seller?.isDualRole
            ? seller.sellerProfile?.verificationStatusEnum === 'VERIFIED'
            : ['approved_for_procurement', 'approved'].includes(String(seller?.onboardingStatus));
        if (req.user?.role === 'seller' && !isSellerApproved) {
            return apiResponse.error(res, 403, 'Please complete seller onboarding and verification to respond to this requirement.', 'SELLER_VERIFICATION_REQUIRED');
        }
        const sellerOrganizationId = seller?.organizationId || req.user?.organizationId || null;

        // EMD Security Check: Verify EMD payment if mandatory
        const targetReqRecord = id > 0 ? await db.buyerRequirement.findUnique({
            where: { id },
            select: { id: true, isEmdRequired: true, emdAmount: true, payload: true }
        }).catch(() => null) : null;

        const isEmdRequired = Boolean(
            targetReqRecord?.isEmdRequired ||
            (targetReqRecord?.payload as any)?.terms?.emdRequired ||
            (targetReqRecord?.emdAmount && Number(targetReqRecord.emdAmount) > 0)
        );

        if (isEmdRequired) {
            const { resolveEmdPaymentStatus } = await import('./emd.routes.js');
            const emdPayment = await resolveEmdPaymentStatus(Number(req.user?.id), id, idToken);
            if (!emdPayment || !['PAID', 'VERIFIED'].includes(String(emdPayment.status).toUpperCase())) {
                return apiResponse.error(
                    res,
                    400,
                    'Earnest Money Deposit (EMD) payment is required before submitting your quotation.',
                    'EMD_PAYMENT_REQUIRED'
                );
            }
            if ((emdPayment as any).id && id > 0) {
                await (db as any).emdPayment.update({
                    where: { id: (emdPayment as any).id },
                    data: {
                        requirementId: id,
                        status: 'VERIFIED',
                        verifiedAt: (emdPayment as any).verifiedAt || new Date()
                    }
                }).catch(() => undefined);
            }
        }

        const response = await db.$transaction(async (tx: any) => {
            let targetId = id;
            let requirement = null;

            if (id < 0 && id <= -100000) {
                const contractId = Math.abs(id + 100000);
                const contract = await tx.contract.findUnique({ where: { id: contractId } });
                if (!contract) {
                    throw new Error('REQUIREMENT_NOT_OPEN');
                }
                const meta = (contract.metadata || {}) as any;
                let modernReq = await tx.buyerRequirement.findFirst({
                    where: {
                        title: contract.title,
                        createdById: Number(meta.buyerId || contract.createdById || 1)
                    }
                });
                if (!modernReq) {
                    modernReq = await tx.buyerRequirement.create({
                        data: {
                            title: contract.title,
                            requirementType: 'PRODUCT',
                            description: meta.contractDescription || contract.title,
                            status: 'PUBLISHED',
                            lastDate: contract.endDate || new Date(Date.now() + 360 * 24 * 60 * 60 * 1000),
                            createdById: Number(meta.buyerId || contract.createdById || 1),
                            buyerOrganizationId: meta.buyerOrganizationId ? Number(meta.buyerOrganizationId) : null
                        }
                    });
                }
                requirement = modernReq;
                targetId = modernReq.id;
            } else if (id < 0) {
                const legacyId = Math.abs(id);
                const legacyReq = await tx.requirement.findFirst({
                    where: { id: legacyId },
                    include: { buyer: true, items: true }
                });

                if (!legacyReq) {
                    throw new Error('REQUIREMENT_NOT_OPEN');
                }

                // Check if a modern BuyerRequirement already exists for this legacy requirement
                let modernReq = await tx.buyerRequirement.findFirst({
                    where: {
                        title: legacyReq.title,
                        description: legacyReq.description || legacyReq.title,
                        createdById: legacyReq.buyerId,
                        buyerOrganizationId: legacyReq.organizationId || legacyReq.buyer?.organizationId || null
                    }
                });

                if (!modernReq) {
                    const requiredBy = legacyReq.requiredBy || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                    const items = Array.isArray(legacyReq.items) ? legacyReq.items : [];
                    const totalQty = items.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
                    const primaryUnit = items[0]?.unitOfMeasure || null;

                    modernReq = await tx.buyerRequirement.create({
                        data: {
                            title: legacyReq.title,
                            requirementType: 'PRODUCT',
                            categoryId: legacyReq.categoryId,
                            description: legacyReq.description || legacyReq.title,
                            quantity: totalQty > 0 ? totalQty : null,
                            unit: primaryUnit,
                            location: legacyReq.location || null,
                            budgetMin: legacyReq.estimatedValue || null,
                            budgetMax: legacyReq.estimatedValue || null,
                            lastDate: requiredBy,
                            status: 'PUBLISHED',
                            createdById: legacyReq.buyerId,
                            buyerOrganizationId: legacyReq.organizationId || legacyReq.buyer?.organizationId || null}
                    });
                }

                requirement = modernReq;
                targetId = modernReq.id;
            } else {
                requirement = await tx.buyerRequirement.findFirst({
                    where: { id },
                    select: { id: true, title: true, buyerOrganizationId: true, createdById: true, lastDate: true, status: true, allowRevision: true, payload: true }
                });
            }

            if (!requirement) {
                const bidRecord = await tx.procurementBid.findUnique({
                    where: { id },
                    select: { id: true, title: true, description: true, buyerId: true, buyerOrganizationId: true }
                }).catch(() => null);
                if (bidRecord) {
                    let mirror = await tx.buyerRequirement.findFirst({
                        where: {
                            title: bidRecord.title,
                            createdById: bidRecord.buyerId,
                            ...(bidRecord.buyerOrganizationId ? { buyerOrganizationId: bidRecord.buyerOrganizationId } : {})
                        }
                    }).catch(() => null);
                    if (!mirror) {
                        mirror = await tx.buyerRequirement.create({
                            data: {
                                title: bidRecord.title,
                                requirementType: 'PRODUCT',
                                description: bidRecord.description || bidRecord.title,
                                status: 'PUBLISHED',
                                lastDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                                createdById: bidRecord.buyerId,
                                buyerOrganizationId: bidRecord.buyerOrganizationId
                            }
                        });
                    }
                    requirement = mirror;
                    targetId = mirror.id;
                }
            }

            if (!requirement) {
                throw new Error('REQUIREMENT_NOT_OPEN');
            }

            if (requirement.createdById === Number(req.user?.id) || (sellerOrganizationId && requirement.buyerOrganizationId === sellerOrganizationId)) {
                throw new Error('SELLER_CANNOT_RESPOND_TO_OWN_REQUIREMENT');
            }

            const existing = await tx.requirementResponse.findFirst({
                where: {
                    requirementId: targetId,
                    OR: [
                        { sellerUserId: Number(req.user?.id) },
                        ...(sellerOrganizationId ? [{ sellerOrganizationId }] : [])
                    ],
                    status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'ACCEPTED'] }
                },
                select: { id: true, status: true, offeredPrice: true, offeredQuantity: true, deliveryTimeline: true, message: true, attachmentUrl: true, terms: true, responseData: true }
            });

            // Revisions are allowed if buyer requested a revision OR if the procurement explicitly permits revisions before deadline
            const reqPayload = (requirement.payload || {}) as any;
            const isDeadlinePassed = requirement.lastDate ? new Date(requirement.lastDate).getTime() < Date.now() : false;
            const allowsRevisions = Boolean(
                requirement.allowRevision ||
                reqPayload.schedule?.allowRevision ||
                reqPayload.rules?.allowRevision ||
                reqPayload.schedule?.rebidsAllowed
            );

            const isExplicitRevisionAllowed = existing?.status === 'REVISION_REQUESTED' || 
                requirement.status === 'REVISION_REQUESTED' || 
                (allowsRevisions && !isDeadlinePassed && ['SUBMITTED', 'UNDER_REVIEW'].includes(existing?.status || ''));

            if (existing && !isExplicitRevisionAllowed) {
                // If an existing submitted quotation exists, treat background draft saves as a no-op returning existing record
                if (body.status === 'DRAFT') {
                    return existing;
                }
                throw new Error('REQUIREMENT_RESPONSE_EXISTS');
            }

            const existingDraft = await tx.requirementResponse.findFirst({
                where: {
                    requirementId: targetId,
                    OR: [
                        { sellerUserId: Number(req.user?.id) },
                        ...(sellerOrganizationId ? [{ sellerOrganizationId }] : [])
                    ],
                    status: 'DRAFT'
                }
            });

            const targetExistingResponse = existingDraft || (isExplicitRevisionAllowed ? existing : null);

            let savedResponse;
            if (targetExistingResponse) {
                savedResponse = await tx.requirementResponse.update({
                    where: { id: targetExistingResponse.id },
                    data: {
                        offeredPrice: body.offeredPrice !== undefined ? body.offeredPrice : targetExistingResponse.offeredPrice,
                        offeredQuantity: body.offeredQuantity !== undefined ? body.offeredQuantity : targetExistingResponse.offeredQuantity,
                        deliveryTimeline: body.deliveryTimeline !== undefined ? body.deliveryTimeline : targetExistingResponse.deliveryTimeline,
                        message: body.message !== undefined ? body.message : targetExistingResponse.message,
                        attachmentUrl: body.attachmentUrl !== undefined ? body.attachmentUrl : targetExistingResponse.attachmentUrl,
                        terms: body.terms !== undefined ? body.terms : targetExistingResponse.terms,
                        responseData: body.responseData !== undefined ? body.responseData : targetExistingResponse.responseData,
                        status: body.status || targetExistingResponse.status
                    },
                    select: { id: true, requirementId: true, sellerOrganizationId: true, sellerUserId: true, status: true, createdAt: true, updatedAt: true }
                });
            } else {
                savedResponse = await tx.requirementResponse.create({
                    data: {
                        offeredPrice: body.offeredPrice,
                        offeredQuantity: body.offeredQuantity,
                        deliveryTimeline: body.deliveryTimeline,
                        message: body.message || '',
                        attachmentUrl: body.attachmentUrl,
                        terms: body.terms,
                        responseData: body.responseData ?? undefined,
                        status: body.status || 'SUBMITTED',
                        requirementId: targetId,
                        sellerUserId: Number(req.user?.id),
                        sellerOrganizationId
                    },
                    select: { id: true, requirementId: true, sellerOrganizationId: true, sellerUserId: true, status: true, createdAt: true, updatedAt: true }
                });
            }

            // Sync with ProcurementBidParticipation if linked to a ProcurementBid
            try {
                const matchingBid = await tx.procurementBid.findFirst({
                    where: {
                        OR: [
                            { id: targetId },
                            { technicalPacket: { path: ['sourceRequirementId'], equals: targetId } },
                            { technicalPacket: { path: ['requirementId'], equals: targetId } },
                            ...(requirement.title ? [{
                                title: requirement.title,
                                buyerId: requirement.createdById,
                                ...(requirement.buyerOrganizationId ? { buyerOrganizationId: requirement.buyerOrganizationId } : {})
                            }] : [])
                        ]
                    }
                });

                if (matchingBid) {
                    const sellerUserId = Number(req.user?.id);
                    const existingPart = await tx.procurementBidParticipation.findFirst({
                        where: {
                            bidId: matchingBid.id,
                            sellerId: sellerUserId
                        }
                    });

                    const partData = {
                        quotedAmount: body.offeredPrice !== undefined ? Number(body.offeredPrice) : 0,
                        totalAmount: body.offeredPrice !== undefined ? Number(body.offeredPrice) : 0,
                        submissionStatus: body.status || 'SUBMITTED',
                        technicalStatus: 'PENDING' as any,
                        financialStatus: 'LOCKED' as any,
                        finalStatus: 'PENDING' as any,
                        submittedAt: new Date(),
                        technicalSubmittedAt: new Date(),
                        financialSubmittedAt: new Date(),
                        makeBrand: (body as any).makeBrand || (body.responseData as any)?.makeBrand || null,
                        model: (body as any).model || (body.responseData as any)?.model || null,
                        offeredItemDescription: (body as any).technicalSpecifications || (body.responseData as any)?.technicalSpecifications || body.message || 'Quotation submitted via marketplace',
                        acknowledgement: body.responseData ? body.responseData : undefined
                    };

                    if (existingPart) {
                        await tx.procurementBidParticipation.update({
                            where: { id: existingPart.id },
                            data: {
                                quotedAmount: partData.quotedAmount,
                                totalAmount: partData.totalAmount,
                                submissionStatus: partData.submissionStatus,
                                makeBrand: partData.makeBrand,
                                model: partData.model,
                                offeredItemDescription: partData.offeredItemDescription,
                                ...(partData.acknowledgement ? { acknowledgement: partData.acknowledgement } : {}),
                                ...(existingPart.technicalStatus === 'PENDING' ? { technicalStatus: 'PENDING' as any } : {})
                            }
                        });
                    } else {
                        const count = await tx.procurementBidParticipation.count({ where: { bidId: matchingBid.id } });
                        await tx.procurementBidParticipation.create({
                            data: {
                                bidId: matchingBid.id,
                                sellerId: sellerUserId,
                                participationNumber: `PRT-${matchingBid.id}-${String(count + 1).padStart(3, '0')}`,
                                ...partData
                            }
                        });
                    }
                }
            } catch (syncErr) {
                console.error('[Marketplace Response Sync to Bid Participation Error]', syncErr);
            }

            return savedResponse;
        }, { timeout: 30000, maxWait: 10000 });

        // Invalidate dashboard summary cache for the seller so bid count updates immediately
        if (req.user?.id) {
            await deleteCache(redisKeys.cacheDashboardSummary(req.user.id));
        }

        // Try to invalidate buyer's cache if we have the requirement's creator
        if (response && (response as any).requirementId) {
             const reqData = await db.buyerRequirement.findUnique({
                 where: { id: (response as any).requirementId },
                 select: { createdById: true }
             });
             if (reqData && reqData.createdById) {
                 await deleteCache(redisKeys.cacheDashboardSummary(reqData.createdById));
             }
        }

        return ok(res, response);
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return apiResponse.error(res, 400, error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join(', '), 'VALIDATION_ERROR');
        }
        if (error instanceof Error && error.message === 'REQUIREMENT_NOT_OPEN') {
            return apiResponse.error(res, 404, 'Requirement not found or not open for bidding', 'REQUIREMENT_NOT_OPEN');
        }
        if (error instanceof Error && error.message === 'SELLER_CANNOT_RESPOND_TO_OWN_REQUIREMENT') {
            return apiResponse.error(res, 403, 'You cannot submit a seller response to your own buyer requirement.', 'OWN_REQUIREMENT_RESPONSE_FORBIDDEN');
        }
        if (error instanceof Error && error.message === 'REQUIREMENT_RESPONSE_EXISTS') {
            return apiResponse.error(res, 409, 'You have already submitted your quotation for this procurement.', 'REQUIREMENT_RESPONSE_EXISTS');
        }
        console.error('[Requirement Response]', error);
        return apiResponse.error(res, 400, error?.message || 'Unable to submit response', 'REQUIREMENT_RESPONSE_ERROR');
    }
});

router.get('/buyer/requirements/:id/responses', authenticate, authorize('buyer', 'admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
    try {
        const rawToken = String(req.params.id || '').trim();
        const pureNum = Number(rawToken);
        const absNum = Math.abs(pureNum);
        const trailingMatch = rawToken.match(/\d+/g);
        const lastNum = trailingMatch ? Number(trailingMatch[trailingMatch.length - 1]) : 0;
        const parsedNum = (!isNaN(pureNum) && absNum > 0) ? absNum : lastNum;
        const id = (parsedNum > 0 && parsedNum <= 2147483647) ? parsedNum : 0;
        if (!id && !rawToken) return apiResponse.error(res, 400, 'Invalid requirement ID', 'INVALID_ID');

        const query = responseListQuery.parse(req.query);
        const page = query.page || 1;
        const pageSize = query.pageSize || 20;
        const skip = (page - 1) * pageSize;
        const candidateNumbers = Array.from(new Set([
            rawToken,
            rawToken.replace(/^[A-Z]{2,5}-/i, ''),
            `REQ-${id}`, `RFQ-${id}`, `RC-${id}`, `RATE-${id}`, `TND-${id}`, `TENDER-${id}`,
            `REQ_${id}`, `RFQ_${id}`, `RC_${id}`
        ].filter(Boolean) as string[]));
        const candidateIds = Array.from(new Set([id].filter(i => i > 0 && i <= 2147483647)));

        const [linkedBuyerReq, linkedLegacyReq, linkedBid] = await Promise.all([
            db.buyerRequirement.findFirst({
                where: candidateIds.length ? { id: { in: candidateIds } } : { id: -1 },
                select: { id: true, title: true, createdById: true, buyerOrganizationId: true, status: true, lastDate: true }
            }).catch(() => null),
            db.requirement.findFirst({
                where: { OR: [ ...(candidateIds.length ? [{ id: { in: candidateIds } }] : []), ...(candidateNumbers.length ? [{ requirementNumber: { in: candidateNumbers } }] : []) ] },
                select: { id: true, requirementNumber: true, title: true, buyerId: true, organizationId: true, status: true }
            }).catch(() => null),
            db.procurementBid.findFirst({
                where: { OR: [ ...(candidateIds.length ? [{ id: { in: candidateIds } }] : []), ...(candidateNumbers.length ? [{ bidNumber: { in: candidateNumbers } }] : []) ] },
                select: { id: true, bidNumber: true, title: true, buyerId: true, buyerOrganizationId: true, technicalPacket: true, status: true }
            }).catch(() => null)
        ]);

        let resolvedBuyerReq = linkedBuyerReq;
        let resolvedLegacyReq = linkedLegacyReq;
        let resolvedBid = linkedBid;

        if (resolvedBid && !resolvedBuyerReq) {
            const rawPkt = resolvedBid.technicalPacket;
            const pkt = (typeof rawPkt === 'string' ? JSON.parse(rawPkt) : (rawPkt || {})) as any;
            const sourceReqId = Number(pkt.sourceRequirementId || pkt.requirementId || 0);
            if (sourceReqId > 0) {
                resolvedBuyerReq = await db.buyerRequirement.findUnique({
                    where: { id: sourceReqId },
                    select: { id: true, title: true, createdById: true, buyerOrganizationId: true, status: true, lastDate: true }
                }).catch(() => null);
            }
            if (!resolvedBuyerReq) {
                resolvedBuyerReq = await db.buyerRequirement.findFirst({
                    where: {
                        title: resolvedBid.title,
                        createdById: resolvedBid.buyerId,
                        ...(resolvedBid.buyerOrganizationId ? { buyerOrganizationId: resolvedBid.buyerOrganizationId } : {})
                    },
                    select: { id: true, title: true, createdById: true, buyerOrganizationId: true, status: true, lastDate: true }
                }).catch(() => null);
            }
        }

        if (resolvedBuyerReq && !resolvedBid) {
            resolvedBid = await db.procurementBid.findFirst({
                where: {
                    OR: [
                        { technicalPacket: { path: ['sourceRequirementId'], equals: resolvedBuyerReq.id } },
                        { technicalPacket: { path: ['requirementId'], equals: resolvedBuyerReq.id } },
                        {
                            title: resolvedBuyerReq.title,
                            buyerId: resolvedBuyerReq.createdById,
                            ...(resolvedBuyerReq.buyerOrganizationId ? { buyerOrganizationId: resolvedBuyerReq.buyerOrganizationId } : {})
                        }
                    ]
                },
                select: { id: true, bidNumber: true, title: true, buyerId: true, buyerOrganizationId: true, technicalPacket: true, status: true }
            }).catch(() => null);
        }

        if (!resolvedBuyerReq && !resolvedLegacyReq && !resolvedBid) {
            return apiResponse.error(res, 404, 'Requirement not found', 'REQUIREMENT_NOT_FOUND');
        }

        // Ownership enforcement for buyers
        if (req.user?.role === 'buyer') {
            const userId = Number(req.user.id);
            const userOrgId = req.user.organizationId ? Number(req.user.organizationId) : null;
            const isOwner = (
                (resolvedBuyerReq && (resolvedBuyerReq.createdById === userId || (userOrgId && resolvedBuyerReq.buyerOrganizationId === userOrgId))) ||
                (resolvedLegacyReq && (resolvedLegacyReq.buyerId === userId || (userOrgId && resolvedLegacyReq.organizationId === userOrgId))) ||
                (resolvedBid && (resolvedBid.buyerId === userId || (userOrgId && resolvedBid.buyerOrganizationId === userOrgId)))
            );
            if (!isOwner) {
                return apiResponse.error(res, 403, 'You do not have permission to view responses for this requirement.', 'FORBIDDEN');
            }
        }

        // Scope targets strictly to the authentic matched entities (do not bleed across same-titled or sourceRequirementId requirements)
        const allTargetReqIds = Array.from(new Set([
            resolvedBuyerReq?.id,
            resolvedLegacyReq?.id,
            (!resolvedBid && candidateIds.length) ? candidateIds[0] : null
        ].filter(Boolean) as number[]));

        const allTargetBidIds = Array.from(new Set([
            resolvedBid?.id,
            (!resolvedBuyerReq && !resolvedLegacyReq && candidateIds.length && resolvedBid) ? candidateIds[0] : null
        ].filter(Boolean) as number[]));

        const nonDraftFilter = {
            status: { not: 'DRAFT' }
        };

        let [responses, total] = await Promise.all([
            db.requirementResponse.findMany({
                where: {
                    requirementId: { in: allTargetReqIds },
                    ...nonDraftFilter
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: pageSize,
                select: buyerResponseSelect
            }).catch(() => []),
            db.requirementResponse.count({
                where: {
                    requirementId: { in: allTargetReqIds },
                    ...nonDraftFilter
                }
            }).catch(() => 0)
        ]);

        // Fallback: If no responses in requirementResponse, check procurementBidParticipation table
        const candidateBidIds = allTargetBidIds.length > 0 ? allTargetBidIds : allTargetReqIds;
        if (responses.length === 0 && candidateBidIds.length > 0) {
            const participations = await db.procurementBidParticipation.findMany({
                where: {
                    bidId: { in: candidateBidIds },
                    submissionStatus: { not: 'DRAFT' },
                    isWithdrawn: false
                },
                include: {
                    seller: { select: { id: true, name: true, email: true, mobile: true, role: true, organization: true } },
                    documents: true
                }
            }).catch(() => []);

            if (participations.length > 0) {
                const mappedParticipations = participations.map((p: any) => ({
                    id: p.id,
                    requirementId: p.bidId,
                    sellerUserId: p.sellerId,
                    sellerName: p.seller?.name || 'Seller Partner',
                    sellerEmail: p.seller?.email || '',
                    sellerPhone: p.seller?.mobile || '',
                    sellerOrganization: p.seller?.organization ? { organizationName: p.seller.organization.organizationName } : null,
                    offeredPrice: Number(p.quotedAmount || p.totalAmount || 0),
                    offeredQuantity: p.offeredQuantity || 1,
                    deliveryTimeline: p.deliveryTimeline || 'Standard',
                    makeBrand: p.makeBrand || null,
                    model: p.model || null,
                    acknowledgement: p.acknowledgement || null,
                    offeredItemDescription: p.offeredItemDescription || null,
                    technicalStatus: p.technicalStatus || 'PENDING',
                    financialStatus: p.financialStatus || 'LOCKED',
                    finalStatus: p.finalStatus || 'PENDING',
                    rank: p.rank || null,
                    status: p.submissionStatus || p.status || 'SUBMITTED',
                    responseData: p.responseData || {},
                    documents: p.documents || [],
                    createdAt: p.createdAt,
                    updatedAt: p.updatedAt,
                    sellerUser: p.seller
                }));

                return ok(res, {
                    requirement: decorateRequirement(linkedBuyerReq || linkedBid || { id: id || rawToken }),
                    responses: mappedParticipations,
                    total: mappedParticipations.length,
                    page,
                    pageSize,
                    totalPages: Math.ceil(mappedParticipations.length / pageSize)
                });
            }
        }

        return ok(res, {
            requirement: decorateRequirement(linkedBuyerReq || linkedBid || { id: id || rawToken }),
            responses: responses.map((response: any) => ({
                ...response,
                sellerUser: response.sellerUser
                    ? { ...response.sellerUser, phone: response.sellerUser.mobile }
                    : response.sellerUser
            })),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        });
    } catch (error) {
        console.error('[Buyer Requirement Responses]', error);
        return apiResponse.error(res, 500, 'Failed to load seller responses', 'BUYER_REQUIREMENT_RESPONSES_ERROR');
    }
});

router.post('/buyer/requirements/:id/responses/:responseId/accept', authenticate, authorize('buyer', 'admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
    try {
        const rawToken = String(req.params.id || '').trim();
        const pureNum = Number(rawToken);
        const absNum = Math.abs(pureNum);
        const trailingMatch = rawToken.match(/\d+/g);
        const lastNum = trailingMatch ? Number(trailingMatch[trailingMatch.length - 1]) : 0;
        const parsedNum = (!isNaN(pureNum) && absNum > 0) ? absNum : lastNum;
        const id = (parsedNum > 0 && parsedNum <= 2147483647) ? parsedNum : 0;
        const responseId = Number(req.params.responseId);
        
        if ((!id && !rawToken) || !responseId || responseId < 1) {
            return apiResponse.error(res, 400, 'Invalid IDs', 'INVALID_ID');
        }

        const isPrivileged = req.user?.role === 'admin' || req.user?.role === 'master_admin';

        const targetResponse = await db.requirementResponse.findFirst({
            where: { id: responseId },
            include: { requirement: true }
        });

        if (!targetResponse) {
            return apiResponse.error(res, 404, 'Response not found', 'RESPONSE_NOT_FOUND');
        }

        const requirement = targetResponse.requirement;
        if (!requirement) {
            return apiResponse.error(res, 404, 'Requirement not found or not in an awardable state', 'REQUIREMENT_NOT_AWARDABLE');
        }

        if (!isPrivileged) {
            const userId = Number(req.user?.id);
            const userOrgId = req.user?.organizationId ? Number(req.user.organizationId) : null;
            const isOwner = requirement.createdById === userId || (userOrgId && requirement.buyerOrganizationId === userOrgId);
            if (!isOwner) {
                return apiResponse.error(res, 403, 'You do not have permission to accept this quotation.', 'FORBIDDEN');
            }
        }

        let createdPoId: number | undefined;
        await db.$transaction(async (tx: any) => {
            // Update the accepted response
            await tx.requirementResponse.update({
                where: { id: responseId },
                data: { status: 'ACCEPTED' }
            });
            
            // Reject all other responses
            await tx.requirementResponse.updateMany({
                where: { requirementId: targetResponse.requirementId, id: { not: responseId } },
                data: { status: 'REJECTED' }
            });

            // Update requirement status to AWARDED
            await tx.buyerRequirement.update({
                where: { id: targetResponse.requirementId },
                data: { status: 'AWARDED' }
            });

            // Generate Purchase Order
            const poNumber = `PO-RFQ-${requirement.id}-${Date.now()}`;
            const amount = targetResponse.offeredPrice || 0;
            
            const purchaseOrder = await tx.purchaseOrder.create({
                data: {
                    poNumber,
                    buyerId: Number(req.user?.id),
                    sellerId: targetResponse.sellerUserId,
                    title: requirement.title || `PO for RFQ ${requirement.id}`,
                    amount: amount,
                    totalValue: Number(amount),
                    status: 'GENERATED',
                    poStatus: 'ISSUED',
                    sourceType: 'BuyerRequirement',
                    sourceId: requirement.id,
                    deliveryType: targetResponse.deliveryTimeline || null,
                    paymentTerms: requirement.terms || null
                }
            });

            // Parse response data for line items
            const responseData: any = typeof targetResponse.responseData === 'string' 
                ? JSON.parse(targetResponse.responseData) 
                : (targetResponse.responseData || {});
            
            const lineItems = Array.isArray(responseData.lineItems) ? responseData.lineItems : [];
            
            if (lineItems.length > 0) {
                // Generate items from seller's quote
                for (const item of lineItems) {
                    await tx.purchaseOrderItem.create({
                        data: {
                            purchaseOrderId: purchaseOrder.id,
                            itemName: item.itemName || 'Item',
                            description: item.remarks || null,
                            quantity: item.quantity || 1,
                            unitOfMeasure: 'Unit', // Fallback
                            unitPrice: item.unitPrice || 0,
                            taxRate: item.gstPercent || 0,
                            totalAmount: (Number(item.quantity || 1) * Number(item.unitPrice || 0)) * (1 + Number(item.gstPercent || 0) / 100)
                        }
                    });
                }
            } else {
                // Generate single item from RFQ root fields
                await tx.purchaseOrderItem.create({
                    data: {
                        purchaseOrderId: purchaseOrder.id,
                        itemName: requirement.title || `Item for RFQ ${requirement.id}`,
                        quantity: targetResponse.offeredQuantity || requirement.quantity || 1,
                        unitOfMeasure: requirement.unit || 'Unit',
                        unitPrice: amount,
                        totalAmount: amount
                    }
                });
            }

            // Create Notification for Seller
            await tx.notification.create({
                data: {
                    userId: targetResponse.sellerUserId,
                    title: 'Quotation Accepted',
                    message: `Your quotation for RFQ #${requirement.id} has been accepted. A Purchase Order (${poNumber}) has been generated.`,
                    type: 'PO_GENERATED',
                    priority: 'high',
                    redirectUrl: `/dashboard/orders`
                }
            });

            // Create Notification for Buyer
            await tx.notification.create({
                data: {
                    userId: Number(req.user?.id),
                    title: 'Purchase Order Generated',
                    message: `Purchase Order ${poNumber} has been successfully generated and issued to the seller.`,
                    type: 'PO_GENERATED',
                    priority: 'high',
                    redirectUrl: `/buyer/orders`
                }
            });

            createdPoId = purchaseOrder.id;
        }, { timeout: 30000, maxWait: 10000 });

        if (createdPoId) {
            notifyPurchaseOrderCreated(createdPoId).catch(err => {
                console.warn('[Marketplace] Failed to dispatch purchase order notification with PDF:', err);
            });
        }

        return ok(res, { success: true, message: 'Response accepted and PO generated successfully.' });
    } catch (error: any) {
        console.error('[Accept Requirement Response]', error);
        return apiResponse.error(res, 500, error?.message || 'Failed to accept response', 'REQUIREMENT_RESPONSE_ACCEPT_ERROR');
    }
});

// ── Requirement Clarifications (Q&A on a BuyerRequirement) ──
// Mirrors /quote-requests/:id/clarifications but keyed on requirementId so the
// /seller/rfq?requirementId= flow gets a working Q&A thread.

const requirementClarificationAskBody = z.object({
    question: z.string().trim().min(3).max(2000),
    visibility: z.enum(['PUBLIC', 'PRIVATE']).optional().default('PUBLIC')
});

const requirementClarificationReplyBody = z.object({
    response: z.string().trim().min(1).max(3000)
});

const isRequirementOwner = (req: AuthRequest, requirement: any) =>
    requirement.createdById === Number(req.user?.id) ||
    (req.user?.organizationId && requirement.buyerOrganizationId === req.user.organizationId);

const findRequirementRecord = async (idParam: string | number) => {
    const rawToken = String(idParam || '').trim();
    if (!rawToken) return null;
    const token = rawToken.replace(/^[^\w\d]+/, '');
    if (!token) return null;
    const isNum = /^\d+$/.test(token);
    const numId = isNum ? Number(token) : null;

    if (numId && numId > 0) {
        const [req, bid] = await Promise.all([
            db.buyerRequirement.findUnique({
                where: { id: numId },
                select: { id: true, title: true, lastDate: true, status: true, createdById: true, buyerOrganizationId: true }
            }).catch(() => null),
            db.procurementBid.findUnique({
                where: { id: numId },
                select: { id: true, title: true, endDate: true, status: true, buyerId: true, buyerOrganizationId: true, technicalPacket: true }
            }).catch(() => null)
        ]);

        if (req) {
            const sched = (req.payload as any)?.schedule;
            return {
                ...req,
                submissionStartDate: sched?.submissionStartDate || sched?.startDate || req.startDate || null,
                allowClarification: sched?.clarificationAllowed !== false && (req as any).allowClarification !== false
            };
        }
        if (bid) {
            const sched = (bid.technicalPacket as any)?.schedule;
            return {
                id: bid.id,
                title: bid.title,
                lastDate: bid.endDate,
                status: bid.status,
                createdById: bid.buyerId,
                buyerOrganizationId: bid.buyerOrganizationId,
                submissionStartDate: sched?.submissionStartDate || sched?.startDate || (bid.technicalPacket as any)?.tender?.bidStartDate || bid.startDate || null,
                allowClarification: (bid as any).allowClarification !== false,
                payload: bid.technicalPacket || {}
            };
        }

        const legacy = await db.requirement.findUnique({
            where: { id: numId },
            select: { id: true, title: true, createdById: true, payload: true }
        }).catch(() => null);
        if (legacy) {
            const sched = (legacy.payload as any)?.schedule;
            return {
                id: legacy.id,
                title: legacy.title,
                lastDate: sched?.submissionDate || sched?.submissionDeadline || null,
                status: 'PUBLISHED',
                createdById: legacy.createdById,
                buyerOrganizationId: null,
                submissionStartDate: sched?.submissionStartDate || sched?.startDate || (legacy.payload as any)?.tender?.bidStartDate || null,
                allowClarification: sched?.clarificationAllowed !== false,
                payload: legacy.payload || {}
            };
        }
    }

    const tokenVariants = Array.from(new Set([token, ...getCanonicalLookupVariants(token)]));

    const [bid, legacyMatch] = await Promise.all([
        db.procurementBid.findFirst({
            where: {
                OR: tokenVariants.map(t => ({ bidNumber: t }))
            },
            select: { id: true, title: true, endDate: true, status: true, buyerId: true, buyerOrganizationId: true, technicalPacket: true, allowClarification: true }
        }).catch(() => null),
        db.requirement.findFirst({
            where: {
                OR: tokenVariants.map(t => ({ requirementNumber: t }))
            },
            select: { id: true, title: true, createdById: true, payload: true }
        }).catch(() => null)
    ]);

    if (bid) {
        const sched = (bid.technicalPacket as any)?.schedule;
        return {
            id: bid.id,
            title: bid.title,
            lastDate: bid.endDate,
            status: bid.status,
            createdById: bid.buyerId,
            buyerOrganizationId: bid.buyerOrganizationId,
            submissionStartDate: sched?.submissionStartDate || sched?.startDate || (bid.technicalPacket as any)?.tender?.bidStartDate || null,
            allowClarification: bid.allowClarification !== false,
            payload: bid.technicalPacket || {}
        };
    }
    if (legacyMatch) {
        const sched = (legacyMatch.payload as any)?.schedule;
        return {
            id: legacyMatch.id,
            title: legacyMatch.title,
            lastDate: sched?.submissionDate || sched?.submissionDeadline || null,
            status: 'PUBLISHED',
            createdById: legacyMatch.createdById,
            buyerOrganizationId: null,
            submissionStartDate: sched?.submissionStartDate || sched?.startDate || (legacyMatch.payload as any)?.tender?.bidStartDate || null,
            allowClarification: sched?.clarificationAllowed !== false,
            payload: legacyMatch.payload || {}
        };
    }

    return null;
};

router.post('/marketplace/requirements/:id/clarifications', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const requirement = await findRequirementRecord(req.params.id);
        if (!requirement) return apiResponse.error(res, 404, 'RFQ not found', 'REQUIREMENT_NOT_FOUND');
        const id = requirement.id;
        const body = requirementClarificationAskBody.parse(req.body);

        if ((requirement as any).allowClarification === false) {
            return apiResponse.error(res, 400, 'Clarifications are not enabled for this procurement.', 'CLARIFICATIONS_DISABLED');
        }

        // Only enforce submission-start-date gate if the requirement is NOT already in an active/open status.
        // If it's already PUBLISHED/OPEN/OPEN_FOR_BIDDING, the buyer explicitly opened it.
        const activeStatuses = ['PUBLISHED', 'OPEN', 'OPEN_FOR_BIDDING'];
        const reqStatus = String((requirement as any).status || '').toUpperCase();
        const sched = (requirement.payload as any)?.schedule;
        if (!activeStatuses.includes(reqStatus)) {
            const rawSubmissionStart = (requirement as any).submissionStartDate || sched?.submissionStartDate || sched?.startDate || (requirement.payload as any)?.tender?.bidStartDate || (requirement as any).startDate;
            if (rawSubmissionStart) {
                let startD = new Date(rawSubmissionStart);
                if (typeof rawSubmissionStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawSubmissionStart.trim())) {
                    startD = new Date(`${rawSubmissionStart.trim()}T00:00:00.000`);
                }
                if (!isNaN(startD.getTime()) && startD.getTime() > Date.now()) {
                    return apiResponse.error(res, 400, 'The clarification window has not opened yet. Submissions and clarifications will begin at the scheduled start time.', 'CLARIFICATION_NOT_STARTED');
                }
            }
        }

        const rawSubmissionDeadline = sched?.submissionDate || sched?.submissionDeadline || requirement.lastDate || (requirement as any).endDate;
        if (rawSubmissionDeadline) {
            const deadlineD = new Date(rawSubmissionDeadline);
            if (!isNaN(deadlineD.getTime()) && deadlineD.getTime() < Date.now()) {
                return apiResponse.error(res, 400, 'The clarification window has closed as the quotation submission deadline has passed.', 'REQUIREMENT_DEADLINE_PASSED');
            }
        }

        // Sellers ask; the buyer owner may also post (their message doubles as an announcement).
        if (req.user?.role !== 'seller' && !isRequirementOwner(req, requirement)) {
            return apiResponse.error(res, 403, 'Access denied', 'ACCESS_DENIED');
        }

        const clarification = await db.requirementClarification.create({
            data: {
                entityType: 'REQUIREMENT',
                entityId: id,
                question: body.question,
                visibility: body.visibility || 'PUBLIC',
                askedById: Number(req.user?.id)
            }
        });

        res.status(201);
        return ok(res, clarification);
    } catch (error) {
        console.error('[Requirement Clarification Ask]', error);
        return apiResponse.error(res, 500, 'Failed to post clarification', 'REQUIREMENT_CLARIFICATION_ERROR');
    }
});

router.post('/marketplace/requirements/:id/clarifications/:clarId/reply', authenticate, async (req: AuthRequest, res: Response) => {
    try {
        const requirement = await findRequirementRecord(req.params.id);
        if (!requirement) return apiResponse.error(res, 404, 'RFQ not found', 'REQUIREMENT_NOT_FOUND');
        const clarId = Number(req.params.clarId);
        if (isNaN(clarId) || clarId <= 0) return apiResponse.error(res, 400, 'Invalid clarification ID', 'INVALID_ID');
        const body = requirementClarificationReplyBody.parse(req.body);

        // Only the buyer owner (or admin) can reply to clarification questions.
        if (!isRequirementOwner(req, requirement) && req.user?.role !== 'admin' && req.user?.role !== 'master_admin') {
            return apiResponse.error(res, 403, 'Only the procurement buyer may answer clarifications', 'ACCESS_DENIED');
        }

        const existing = await db.requirementClarification.findUnique({ where: { id: clarId } });
        if (!existing || existing.entityId !== requirement.id) {
            return apiResponse.error(res, 404, 'Clarification not found', 'NOT_FOUND');
        }

        const updated = await db.requirementClarification.update({
            where: { id: clarId },
            data: {
                response: body.response,
                answeredById: Number(req.user?.id),
                answeredAt: new Date()
            }
        });

        return ok(res, updated);
    } catch (error) {
        console.error('[Requirement Clarification Reply]', error);
        return apiResponse.error(res, 500, 'Failed to reply to clarification', 'REQUIREMENT_CLARIFICATION_ERROR');
    }
});

router.get('/marketplace/requirements/:id/clarifications', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
    try {
        const requirement = await findRequirementRecord(req.params.id);
        if (!requirement) return apiResponse.error(res, 404, 'RFQ not found', 'REQUIREMENT_NOT_FOUND');
        const id = requirement.id;

        const [reqClarifications, qrClarifications, procClarifications] = await Promise.all([
            db.requirementClarification.findMany({
                where: { entityType: 'REQUIREMENT', entityId: id },
                orderBy: { askedAt: 'asc' }
            }).catch(() => []),
            db.quoteRequestClarification.findMany({
                where: { quoteRequestId: id },
                orderBy: { askedAt: 'asc' }
            }).catch(() => []),
            db.procurementBidClarification.findMany({
                where: { bidId: id },
                orderBy: { createdAt: 'asc' }
            }).catch(() => [])
        ]);

        const normalizedProcClarifications = procClarifications.map((c: any) => ({
            id: c.id,
            quoteRequestId: c.bidId,
            question: c.question,
            response: c.response,
            visibility: c.isPublic ? 'PUBLIC' : 'PRIVATE',
            askedById: c.sellerId || c.requestedById,
            answeredById: c.respondedById,
            askedAt: c.createdAt,
            answeredAt: c.respondedAt,
        }));

        const allClarifications = [...reqClarifications, ...qrClarifications, ...normalizedProcClarifications].sort((a: any, b: any) =>
            new Date(a.askedAt || a.createdAt).getTime() - new Date(b.askedAt || b.createdAt).getTime()
        );

        const currentUserId = req.user?.id ? Number(req.user.id) : null;
        const isPrivileged = Boolean(
            req.user && (
                req.user.role === 'admin' ||
                req.user.role === 'master_admin' ||
                isRequirementOwner(req, requirement)
            )
        );

        // Private clarifications must NOT be shown to the public or other sellers/bidders.
        // They must be visible to the asking seller and the buyer only.
        const filtered = isPrivileged
            ? allClarifications
            : allClarifications.filter((c: any) => {
                const vis = String(c.visibility || 'PUBLIC').toUpperCase();
                if (vis === 'PUBLIC') return true;
                if (!currentUserId) return false;
                return Number(c.askedById) === currentUserId;
            });

        return ok(res, filtered);
    } catch (error) {
        console.error('[Requirement Clarifications List]', error);
        return apiResponse.error(res, 500, 'Failed to load clarifications', 'REQUIREMENT_CLARIFICATION_ERROR');
    }
});

router.get('/seller/requirement-responses', authenticate, authorize('seller', 'admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
    try {
        const query = responseListQuery.parse(req.query);
        const page = query.page || 1;
        const pageSize = query.pageSize || 20;
        const skip = (page - 1) * pageSize;
        const responseFilters: any[] = [{ sellerUserId: Number(req.user?.id) }];
        if (req.user?.organizationId) responseFilters.push({ sellerOrganizationId: req.user.organizationId });
        const where = {
            ...(req.user?.role === 'admin' || req.user?.role === 'master_admin' ? {} : { OR: responseFilters })
        };
        const [responses, total] = await Promise.all([
            db.requirementResponse.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: pageSize,
                select: sellerResponseSelect
            }),
            db.requirementResponse.count({ where })
        ]);

        return ok(res, {
            responses: responses.map((response: any) => ({
                ...response,
                requirement: decorateRequirement(response.requirement)
            })),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize)
        });
    } catch (error) {
        console.error('[Seller Requirement Responses]', error);
        return apiResponse.error(res, 500, 'Failed to load submitted requirement responses', 'SELLER_REQUIREMENT_RESPONSES_ERROR');
    }
});

router.put('/admin/buyer-requirements/:id/status', authenticate, authorize('admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
    try {
        const id = Number(req.params.id);
        const status = z.enum(['PUBLISHED', 'OPEN', 'REJECTED', 'CLOSED', 'CANCELLED', 'AWARDED']).parse(req.body?.status);
        const requirement = await db.buyerRequirement.update({
            where: { id },
            data: {
                status,
                approvedById: ['PUBLISHED', 'OPEN'].includes(status) ? req.user?.id : undefined,
                approvedAt: ['PUBLISHED', 'OPEN'].includes(status) ? new Date() : undefined,
                rejectionReason: status === 'REJECTED' ? String(req.body?.rejectionReason || '') : null
            },
            include: requirementIncludes
        });
        return ok(res, requirement);
    } catch (error) {
        console.error('[Admin Requirement Status]', error);
        return apiResponse.error(res, 400, 'Unable to update requirement status', 'REQUIREMENT_STATUS_ERROR');
    }
});

router.put('/admin/buyer-requirements/:id/feature', authenticate, authorize('admin', 'master_admin'), async (req: AuthRequest, res: Response) => {
    try {
        const id = Number(req.params.id);
        const requirement = await db.buyerRequirement.update({
            where: { id },
            data: { isFeatured: Boolean(req.body?.isFeatured), isUrgent: Boolean(req.body?.isUrgent) },
            include: requirementIncludes
        });
        return ok(res, requirement);
    } catch (error) {
        console.error('[Admin Requirement Feature]', error);
        return apiResponse.error(res, 400, 'Unable to update requirement feature status', 'REQUIREMENT_FEATURE_ERROR');
    }
});

router.post('/marketplace/guest-cart/items', async (req: Request, res: Response) => {
    try {
        const body = guestCartItemSchema.parse(req.body);
        const [product, service, cart] = await Promise.all([
            body.productId ? db.product.findFirst({ where: { id: body.productId, status: 'ACTIVE' }, select: { id: true, price: true, organizationId: true } }) : Promise.resolve(null),
            body.serviceId ? db.service.findFirst({ where: { id: body.serviceId, status: 'ACTIVE' }, select: { id: true, basePrice: true, organizationId: true } }) : Promise.resolve(null),
            db.guestCart.upsert({ where: { cartToken: body.cartToken }, update: {}, create: { cartToken: body.cartToken } })
        ]);
        if (body.productId && !product) return apiResponse.error(res, 404, 'Product not found', 'PRODUCT_NOT_FOUND');
        if (body.serviceId && !service) return apiResponse.error(res, 404, 'Service not found', 'SERVICE_NOT_FOUND');

        const itemType = body.productId ? 'PRODUCT' : 'SERVICE';
        const productId = body.productId || null;
        const serviceId = body.serviceId || null;

        const existing = await db.guestCartItem.findFirst({
            where: {
                guestCartId: cart.id,
                itemType,
                productId,
                serviceId
            }
        });

        let item;
        if (existing) {
            item = await db.guestCartItem.update({
                where: { id: existing.id },
                data: { quantity: Number(existing.quantity) + body.quantity }
            });
        } else {
            item = await db.guestCartItem.create({
                data: {
                    guestCartId: cart.id,
                    itemType,
                    productId,
                    serviceId,
                    quantity: body.quantity,
                    priceSnapshot: product?.price || service?.basePrice || null,
                    sellerOrganizationId: product?.organizationId || service?.organizationId || null
                }
            });
        }

        const refreshed = await db.guestCart.findUnique({ where: { id: cart.id }, include: { items: { include: { product: true, service: true, sellerOrganization: true } } } });
        return ok(res, { cart: refreshed, item });
    } catch (error) {
        console.error('[Guest Cart Add]', error);
        return apiResponse.error(res, 400, 'Unable to add item to cart', 'GUEST_CART_ADD_ERROR');
    }
});

router.put('/marketplace/guest-cart/items', async (req: Request, res: Response) => {
    try {
        const body = z.object({
            cartToken: z.string().trim().min(12).max(120),
            productId: z.coerce.number().int().positive().optional(),
            serviceId: z.coerce.number().int().positive().optional(),
            quantity: z.coerce.number().int().min(0)
        }).refine(v => Boolean(v.productId) !== Boolean(v.serviceId)).parse(req.body);

        const [cart, product, service] = await Promise.all([
            db.guestCart.findUnique({ where: { cartToken: body.cartToken } }),
            body.productId ? db.product.findFirst({ where: { id: body.productId, status: 'ACTIVE' }, select: { price: true, organizationId: true } }) : Promise.resolve(null),
            body.serviceId ? db.service.findFirst({ where: { id: body.serviceId, status: 'ACTIVE' }, select: { basePrice: true, organizationId: true } }) : Promise.resolve(null),
        ]);
        if (!cart) return apiResponse.error(res, 404, 'Cart not found', 'CART_NOT_FOUND');

        const itemType = body.productId ? 'PRODUCT' : 'SERVICE';
        const productId = body.productId || null;
        const serviceId = body.serviceId || null;

        if (body.quantity === 0) {
            await db.guestCartItem.deleteMany({
                where: { guestCartId: cart.id, itemType, productId, serviceId }
            });
        } else {
            const existing = await db.guestCartItem.findFirst({
                where: {
                    guestCartId: cart.id,
                    itemType,
                    productId,
                    serviceId
                }
            });

            if (existing) {
                await db.guestCartItem.update({
                    where: { id: existing.id },
                    data: { quantity: body.quantity }
                });
            } else {
                await db.guestCartItem.create({
                    data: {
                        guestCartId: cart.id,
                        itemType,
                        productId,
                        serviceId,
                        quantity: body.quantity,
                        priceSnapshot: product?.price || service?.basePrice || null,
                        sellerOrganizationId: product?.organizationId || service?.organizationId || null
                    }
                });
            }
        }
        
        const refreshed = await db.guestCart.findUnique({ where: { id: cart.id }, include: { items: { include: { product: true, service: true, sellerOrganization: true } } } });
        return ok(res, { cart: refreshed });
    } catch (error) {
        console.error('[Guest Cart Update]', error);
        return apiResponse.error(res, 400, 'Unable to update cart item', 'GUEST_CART_UPDATE_ERROR');
    }
});

router.get('/marketplace/guest-cart/:cartToken', async (req: Request, res: Response) => {
    try {
        const cart = await db.guestCart.findUnique({ where: { cartToken: String(req.params.cartToken) }, include: { items: { include: { product: { include: { images: { include: { fileAsset: true }, take: 1 } } }, service: true, sellerOrganization: true } } } });
        return ok(res, cart || { cartToken: req.params.cartToken, items: [] });
    } catch {
        return ok(res, { cartToken: req.params.cartToken, items: [] });
    }
});

router.get('/marketplace/organizations/featured', shortCache(60), async (_req: Request, res: Response) => {
    try {
        const [largeIndustries, bigMsmes] = await Promise.all([
            db.organization.findMany({
                where: { profile: { isLargeIndustry: true }, isBlacklisted: false, deletedAt: null },
                include: {
                    profile: true,
                    buyerProfiles: {
                        where: {
                            verificationStatus: 'VERIFIED',
                            isActive: true
                        },
                        select: {
                            id: true,
                            logoUrl: true,
                            bannerUrl: true
                        }
                    }
                },
                take: 12
            }),
            db.organization.findMany({
                where: { profile: { isBigMsme: true }, isBlacklisted: false, deletedAt: null },
                include: {
                    profile: true,
                    buyerProfiles: {
                        where: {
                            verificationStatus: 'VERIFIED',
                            isActive: true
                        },
                        select: {
                            id: true,
                            logoUrl: true,
                            bannerUrl: true
                        }
                    }
                },
                take: 12
            })
        ]);
        return ok(res, { largeIndustries, bigMsmes });
    } catch {
        return ok(res, { largeIndustries: [], bigMsmes: [] });
    }
});

router.get('/marketplace/search', shortCache(15), async (req: Request, res: Response) => {
    try {
        const q = String(req.query.q || '').replace(/\0/g, '').trim();
        if (!q || q.length < 2) return ok(res, { products: [], services: [], sellers: [], categories: [] });

        const [products, services, sellers, categories] = await Promise.all([
            db.product.findMany({
                where: productPublicWhere({
                    OR: [
                        { name: { contains: q, mode: 'insensitive' } },
                        { description: { contains: q, mode: 'insensitive' } },
                        { brand: { contains: q, mode: 'insensitive' } },
                        { category: { name: { contains: q, mode: 'insensitive' } } },
                        { organization: { organizationName: { contains: q, mode: 'insensitive' } } }
                    ]
                }),
                take: 6,
                select: {
                    id: true,
                    name: true,
                    price: true,
                    discountPrice: true,
                    currency: true,
                    brand: true,
                    unitOfMeasure: true,
                    category: { select: { id: true, name: true } },
                    organization: { select: { id: true, organizationName: true, verificationStatus: true, city: true, district: true } },
                    images: {
                        include: { fileAsset: { select: { id: true, url: true } } },
                        orderBy: [{ isPrimary: 'desc' }, { displayOrder: 'asc' }],
                        take: 1
                    }
                }
            }),
            db.service.findMany({
                where: servicePublicWhere({
                    OR: [
                        { name: { contains: q, mode: 'insensitive' } },
                        { description: { contains: q, mode: 'insensitive' } },
                        { category: { name: { contains: q, mode: 'insensitive' } } },
                        { organization: { organizationName: { contains: q, mode: 'insensitive' } } }
                    ]
                }),
                take: 6,
                select: {
                    id: true,
                    name: true,
                    pricingModel: true,
                    basePrice: true,
                    currency: true,
                    category: { select: { id: true, name: true } },
                    organization: { select: { id: true, organizationName: true, verificationStatus: true, city: true, district: true } },
                    images: {
                        include: { fileAsset: { select: { id: true, url: true } } },
                        take: 1
                    }
                }
            }),
            db.organization.findMany({
                where: {
                    ...sellerOrganizationWhere,
                    OR: [
                        { organizationName: { contains: q, mode: 'insensitive' } },
                        { city: { contains: q, mode: 'insensitive' } },
                        { district: { contains: q, mode: 'insensitive' } }
                    ]
                },
                take: 5,
                select: {
                    id: true,
                    organizationName: true,
                    organizationType: true,
                    city: true,
                    district: true,
                    state: true,
                    verificationStatus: true,
                    logoFile: { select: organizationLogoSelect },
                    profile: { select: organizationProfileBrandSelect }
                }
            }),
            db.category.findMany({
                where: {
                    isActive: true,
                    name: { contains: q, mode: 'insensitive' }
                },
                take: 5,
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    type: true
                }
            })
        ]);

        return ok(res, { products, services, sellers, categories });
    } catch (error) {
        console.error('[Marketplace Search]', error);
        return apiResponse.error(res, 500, 'Search failed', 'MARKETPLACE_SEARCH_ERROR');
    }
});

export default router;
