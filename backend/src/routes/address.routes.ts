import { Router, type Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import type { AuthRequest } from '../middleware/authenticate.js';
import { handleSecureRouteError } from '../utils/routeHelpers.js';

const router = Router();

// Require authentication for all address endpoints
router.use('/buyer', authenticate);

const asyncRoute = (
    handler: (req: AuthRequest, res: Response) => Promise<unknown>
) =>
    async (req: AuthRequest, res: Response) => {
        try {
            await handler(req, res);
        } catch (err: any) {
            return handleSecureRouteError(res, err);
        }
    };

const ok = (res: Response, data: unknown, status = 200) =>
    res.status(status).json({ success: true, data });

const ensureOrg = async (req: AuthRequest) => {
    if (!req.user?.organizationId) {
        const user = await prisma.user.findUnique({
            where: { id: req.user!.id },
            select: { organizationId: true, buyerProfile: { select: { organizationId: true } } }
        });
        const resolvedOrgId = user?.organizationId || user?.buyerProfile?.organizationId;
        if (resolvedOrgId) {
            req.user!.organizationId = resolvedOrgId;
            return;
        }
        throw new ApiError(400, 'You must belong to an organisation to use delivery addresses.', 'ORG_REQUIRED');
    }
};

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const createGroupSchema = z.object({
    groupName: z.string().trim().min(1, 'Group name is required').max(100),
    groupDescription: z.string().trim().max(500).optional(),
    isDefaultGroup: z.boolean().optional()
});

const createAddressSchema = z.object({
    addressGroupId: z.number().int().positive().nullable().optional(),
    addressLabel: z.string().trim().min(1, 'Address label is required').max(100),
    organizationName: z.string().trim().max(200).nullable().optional(),
    contactPersonName: z.string().trim().min(1, 'Contact person name is required').max(100),
    mobileNumber: z.string().trim().min(10, 'Valid mobile number is required').max(15),
    alternateMobileNumber: z.string().trim().max(15).nullable().optional(),
    email: z.string().trim().email('Valid email is required').nullable().optional().or(z.literal('')),
    addressLine1: z.string().trim().min(1, 'Address line 1 is required').max(300),
    addressLine2: z.string().trim().max(300).nullable().optional(),
    city: z.string().trim().min(1, 'City is required').max(100),
    district: z.string().trim().min(1, 'District is required').max(100),
    state: z.string().trim().min(1, 'State is required').max(100),
    pincode: z.string().trim().min(6, 'Pincode must be at least 6 digits').max(10),
    landmark: z.string().trim().max(200).nullable().optional(),
    gstState: z.string().trim().max(100).nullable().optional(),
    placeOfSupply: z.string().trim().max(100).nullable().optional(),
    addressType: z.string().trim().default('OFFICE'),
    isDefault: z.boolean().optional()
});

const updateAddressSchema = createAddressSchema.partial();

// ─── Routes ──────────────────────────────────────────────────────────────────

// 1. GET /api/buyer/address-groups
router.get(
    '/buyer/address-groups',
    asyncRoute(async (req, res) => {
        await ensureOrg(req);
        const orgId = req.user!.organizationId!;

        const groups = await prisma.addressGroup.findMany({
            where: {
                organizationId: orgId,
                isActive: true
            },
            include: {
                addresses: {
                    where: { isActive: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return ok(res, groups);
    })
);

// 2. POST /api/buyer/address-groups
router.post(
    '/buyer/address-groups',
    asyncRoute(async (req, res) => {
        await ensureOrg(req);
        const orgId = req.user!.organizationId!;
        const buyerId = req.user!.id;

        const body = createGroupSchema.parse(req.body);

        // If setting as default, clear other default groups
        if (body.isDefaultGroup) {
            await prisma.addressGroup.updateMany({
                where: { organizationId: orgId, isDefaultGroup: true },
                data: { isDefaultGroup: false }
            });
        }

        const newGroup = await prisma.addressGroup.create({
            data: {
                buyerId,
                organizationId: orgId,
                groupName: body.groupName,
                groupDescription: body.groupDescription,
                isDefaultGroup: body.isDefaultGroup || false,
                isActive: true
            }
        });

        return ok(res, newGroup, 201);
    })
);

// 3. GET /api/buyer/delivery-addresses
router.get(
    '/buyer/delivery-addresses',
    asyncRoute(async (req, res) => {
        await ensureOrg(req);
        const orgId = req.user!.organizationId!;

        let addresses = await prisma.deliveryAddress.findMany({
            where: {
                organizationId: orgId,
                isActive: true
            },
            include: {
                addressGroup: true
            },
            orderBy: [
                { isDefault: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        // If no saved delivery addresses exist for this organization, auto-provision from authentic onboarding / GST records
        if (addresses.length === 0) {
            const user = await prisma.user.findUnique({
                where: { id: req.user!.id },
                include: {
                    buyerProfile: true,
                    organization: true
                }
            });

            if (user) {
                const bp = user.buyerProfile || ({} as any);
                const org = user.organization || ({} as any);
                const reg = (user.registrationDetails as Record<string, any>) || {};
                const gst = (reg.gstDetails as Record<string, any>) || {};

                const addressLine1 = (
                    bp.registeredAddress ||
                    bp.corporateAddress ||
                    bp.address ||
                    org.addressLine1 ||
                    gst.address ||
                    gst.principalPlaceOfBusiness ||
                    reg.registeredAddress ||
                    reg.address ||
                    ''
                ).trim();

                const city = (bp.city || org.city || gst.city || reg.city || 'Jharsuguda').trim();
                const district = (bp.district || org.district || gst.district || reg.district || 'Jharsuguda').trim();
                const state = (bp.state || org.state || gst.state || reg.state || 'ODISHA').trim();
                const pincode = (bp.pincode || org.pincode || gst.pincode || reg.pincode || '768201').trim();
                const contactPersonName = (bp.representativeName || user.name || 'Purchasing Officer').trim();
                const mobileNumber = (bp.mobile || user.mobile || '9999999999').trim();
                const orgName = (org.organizationName || bp.organizationName || user.name || 'Organization').trim();

                if (addressLine1) {
                    try {
                        const autoAddr = await prisma.deliveryAddress.create({
                            data: {
                                buyerId: user.id,
                                organizationId: orgId,
                                addressLabel: 'Registered Head Office',
                                organizationName: orgName,
                                contactPersonName,
                                mobileNumber,
                                alternateMobileNumber: bp.alternateMobile || null,
                                email: bp.email || user.email || null,
                                addressLine1,
                                addressLine2: org.addressLine2 || null,
                                city,
                                district,
                                state,
                                pincode,
                                addressType: 'OFFICE',
                                isDefault: true,
                                isActive: true
                            },
                            include: {
                                addressGroup: true
                            }
                        });
                        addresses = [autoAddr];
                    } catch (err) {
                        console.error('[Auto Delivery Address Creation] Failed:', err);
                    }
                }
            }
        }

        return ok(res, addresses);
    })
);

// 4. POST /api/buyer/delivery-addresses
router.post(
    '/buyer/delivery-addresses',
    asyncRoute(async (req, res) => {
        await ensureOrg(req);
        const orgId = req.user!.organizationId!;
        const buyerId = req.user!.id;

        const body = createAddressSchema.parse(req.body);

        // Handle transaction for default address clearing
        const newAddress = await prisma.$transaction(async (tx) => {
            if (body.isDefault) {
                await tx.deliveryAddress.updateMany({
                    where: { organizationId: orgId, isDefault: true },
                    data: { isDefault: false }
                });
            }

            return tx.deliveryAddress.create({
                data: {
                    buyerId,
                    organizationId: orgId,
                    addressGroupId: body.addressGroupId || null,
                    addressLabel: body.addressLabel,
                    organizationName: body.organizationName || null,
                    contactPersonName: body.contactPersonName,
                    mobileNumber: body.mobileNumber,
                    alternateMobileNumber: body.alternateMobileNumber || null,
                    email: body.email || null,
                    addressLine1: body.addressLine1,
                    addressLine2: body.addressLine2 || null,
                    city: body.city,
                    district: body.district,
                    state: body.state,
                    pincode: body.pincode,
                    landmark: body.landmark || null,
                    gstState: body.gstState || null,
                    placeOfSupply: body.placeOfSupply || null,
                    addressType: body.addressType || 'OFFICE',
                    isDefault: body.isDefault || false,
                    isActive: true
                }
            });
        });

        return ok(res, newAddress, 201);
    })
);

// 5. PATCH /api/buyer/delivery-addresses/:id
router.patch(
    '/buyer/delivery-addresses/:id',
    asyncRoute(async (req, res) => {
        await ensureOrg(req);
        const orgId = req.user!.organizationId!;
        const addressId = parseInt(req.params.id, 10);

        if (isNaN(addressId)) {
            throw new ApiError(400, 'Invalid address ID');
        }

        const address = await prisma.deliveryAddress.findFirst({
            where: { id: addressId, organizationId: orgId, isActive: true }
        });

        if (!address) {
            throw new ApiError(404, 'Address not found');
        }

        const body = updateAddressSchema.parse(req.body);

        const updatedAddress = await prisma.$transaction(async (tx) => {
            if (body.isDefault) {
                await tx.deliveryAddress.updateMany({
                    where: { organizationId: orgId, isDefault: true },
                    data: { isDefault: false }
                });
            }

            return tx.deliveryAddress.update({
                where: { id: addressId },
                data: {
                    addressGroupId: body.addressGroupId !== undefined ? body.addressGroupId : undefined,
                    addressLabel: body.addressLabel,
                    organizationName: body.organizationName,
                    contactPersonName: body.contactPersonName,
                    mobileNumber: body.mobileNumber,
                    alternateMobileNumber: body.alternateMobileNumber,
                    email: body.email || null,
                    addressLine1: body.addressLine1,
                    addressLine2: body.addressLine2,
                    city: body.city,
                    district: body.district,
                    state: body.state,
                    pincode: body.pincode,
                    landmark: body.landmark,
                    gstState: body.gstState,
                    placeOfSupply: body.placeOfSupply,
                    addressType: body.addressType,
                    isDefault: body.isDefault
                }
            });
        });

        return ok(res, updatedAddress);
    })
);

// 6. DELETE /api/buyer/delivery-addresses/:id
router.delete(
    '/buyer/delivery-addresses/:id',
    asyncRoute(async (req, res) => {
        await ensureOrg(req);
        const orgId = req.user!.organizationId!;
        const addressId = parseInt(req.params.id, 10);

        if (isNaN(addressId)) {
            throw new ApiError(400, 'Invalid address ID');
        }

        const address = await prisma.deliveryAddress.findFirst({
            where: { id: addressId, organizationId: orgId, isActive: true }
        });

        if (!address) {
            throw new ApiError(404, 'Address not found');
        }

        // Soft delete
        await prisma.deliveryAddress.update({
            where: { id: addressId },
            data: { isActive: false, isDefault: false }
        });

        return ok(res, { message: 'Address deleted successfully' });
    })
);

// 7. POST /api/buyer/delivery-addresses/:id/default
router.post(
    '/buyer/delivery-addresses/:id/default',
    asyncRoute(async (req, res) => {
        await ensureOrg(req);
        const orgId = req.user!.organizationId!;
        const addressId = parseInt(req.params.id, 10);

        if (isNaN(addressId)) {
            throw new ApiError(400, 'Invalid address ID');
        }

        const address = await prisma.deliveryAddress.findFirst({
            where: { id: addressId, organizationId: orgId, isActive: true }
        });

        if (!address) {
            throw new ApiError(404, 'Address not found');
        }

        await prisma.$transaction([
            prisma.deliveryAddress.updateMany({
                where: { organizationId: orgId, isDefault: true },
                data: { isDefault: false }
            }),
            prisma.deliveryAddress.update({
                where: { id: addressId },
                data: { isDefault: true }
            })
        ]);

        return ok(res, { message: 'Default address updated successfully' });
    })
);

export default router;
export { router as addressRoutes };
