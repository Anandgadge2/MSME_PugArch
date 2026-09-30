import { Router, type Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { ApiError } from '../utils/ApiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import type { AuthRequest } from '../middleware/authenticate.js';
import { createApprovalChain } from '../services/approval-chain.service.js';
import { numberSeries } from '../services/workflow/workflow-common.js';
import { normalizeCanonicalMethod } from '../utils/procurement-methods.js';
import { notifyPurchaseOrderCreated } from '../services/invoice-pdf.service.js';
import { logger } from '../config/logger.js';

const router = Router();

// Gated behind authenticate middleware
router.use('/direct-purchases', authenticate);

const asyncRoute = (
    handler: (req: AuthRequest, res: Response) => Promise<unknown>
) =>
    async (req: AuthRequest, res: Response) => {
        try {
            await handler(req, res);
        } catch (err: any) {
            const status = err?.statusCode || 500;
            const message = status < 500 ? err.message : 'Unable to complete request';
            return apiResponse.error(res, status, message, err?.code || 'REQUEST_FAILED');
        }
    };

const ok = (res: Response, data: unknown, status = 200) =>
    res.status(status).json({ success: true, data });

const ensureOrg = (req: AuthRequest) => {
    if (!req.user?.organizationId) {
        throw new ApiError(400, 'You must belong to an organisation to make direct purchases.', 'ORG_REQUIRED');
    }
};

// ─── Zod Schemas ─────────────────────────────────────────────────────────────



const placeOrderSchema = z.object({
    deliveryAddressId: z.number().int().positive().optional().nullable(),
    deliveryAddress: z.string().trim().min(3, 'Delivery address line is required'),
    city: z.string().trim().min(1, 'City is required'),
    state: z.string().trim().min(1, 'State is required'),
    pincode: z.string().trim().min(3, 'Pincode is required'),
    contactName: z.string().trim().min(1, 'Contact person name is required'),
    mobileNumber: z.string().trim().min(5, 'Mobile number is required'),

    sameAsDelivery: z.boolean().optional().default(true),
    billingAddress: z.string().trim().optional().nullable(),
    companyName: z.string().trim().optional().nullable(),
    gstin: z.string().trim().optional().nullable(),

    deliveryInstructions: z.string().trim().max(1000).optional().nullable(),
    expectedDeliveryDate: z.string().trim().optional().nullable(),
    paymentMethod: z.string().trim().optional().default('PAY_ON_INVOICE'),
    termsAccepted: z.boolean().refine(val => val === true, {
        message: 'You must accept the Direct Purchase Terms and Statutory Compliance Agreement to proceed.'
    }).optional()
});


// ─── Routes ──────────────────────────────────────────────────────────────────

// 1. GET /api/direct-purchases
router.get(
    '/direct-purchases',
    asyncRoute(async (req, res) => {
        ensureOrg(req);
        const orgId = req.user!.organizationId!;

        const directPurchases = await prisma.directPurchase.findMany({
            where: {
                buyer: {
                    organizationId: orgId
                }
            },
            include: {
                buyer: {
                    select: { id: true, name: true, email: true }
                },
                seller: {
                    select: { id: true, name: true, email: true }
                },
                deliveryAddress: true,
                requirement: {
                    include: {
                        items: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return ok(res, directPurchases);
    })
);

// 2. GET /api/direct-purchases/:id
router.get(
    '/direct-purchases/:id',
    asyncRoute(async (req, res) => {
        ensureOrg(req);
        const orgId = req.user!.organizationId!;
        const dpId = parseInt(req.params.id, 10);

        if (isNaN(dpId)) {
            throw new ApiError(400, 'Invalid direct purchase ID');
        }

        const directPurchase = await prisma.directPurchase.findFirst({
            where: {
                id: dpId,
                buyer: {
                    organizationId: orgId
                }
            },
            include: {
                buyer: {
                    select: { id: true, name: true, email: true }
                },
                seller: {
                    select: { id: true, name: true, email: true }
                },
                deliveryAddress: true,
                requirement: {
                    include: {
                        items: true
                    }
                }
            }
        });

        if (!directPurchase) {
            throw new ApiError(404, 'Direct purchase request not found');
        }

        return ok(res, directPurchase);
    })
);



// 4. POST /api/direct-purchases/:id/send-to-seller
router.post(
    '/direct-purchases/:id/send-to-seller',
    asyncRoute(async (req, res) => {
        ensureOrg(req);
        const orgId = req.user!.organizationId!;
        const dpId = parseInt(req.params.id, 10);

        if (isNaN(dpId)) {
            throw new ApiError(400, 'Invalid direct purchase ID');
        }

        const directPurchase = await prisma.directPurchase.findFirst({
            where: {
                id: dpId,
                buyer: {
                    organizationId: orgId
                }
            }
        });

        if (!directPurchase) {
            throw new ApiError(404, 'Direct purchase request not found');
        }

        if (directPurchase.status !== 'APPROVED' || directPurchase.workflowStatus !== 'READY_TO_SEND_TO_SELLER') {
            throw new ApiError(400, 'Direct purchase must be approved before sending to the seller.', 'NOT_APPROVED');
        }

        const updated = await prisma.directPurchase.update({
            where: { id: dpId },
            data: {
                status: 'REQUESTED',
                workflowStatus: 'SENT_TO_SELLER'
            }
        });

        // Send notification to seller
        try {
            await prisma.notification.create({
                data: {
                    userId: directPurchase.sellerId,
                    title: 'New Direct Purchase Request',
                    message: `You have received a new Direct Purchase request (${directPurchase.purchaseNumber}).`,
                    type: 'direct_purchase_requested',
                    priority: 'high',
                    redirectUrl: '/seller/orders'
                }
            });
        } catch (err) {
            console.error('Failed to notify seller about direct purchase:', err);
        }

        return ok(res, updated);
    })
);

// 5. POST /api/direct-purchases/place-order
// Direct Purchase checkout: Creates PurchaseOrder(s) directly from Cart without creating Procurement/RFQ
router.post(
    '/direct-purchases/place-order',
    asyncRoute(async (req, res) => {
        const buyerId = req.user!.id;
        const orgId = req.user!.organizationId;

        const body = placeOrderSchema.parse(req.body);

        // Fetch active cart (by orgId or createdById)
        const cart = await prisma.cart.findFirst({
            where: {
                ...(orgId ? { organizationId: orgId } : { createdById: buyerId }),
                status: 'ACTIVE'
            },
            include: {
                items: true
            }
        });

        if (!cart || cart.items.length === 0) {
            throw new ApiError(400, 'Your active cart is empty.', 'CART_EMPTY');
        }

        // Group items by sellerId
        const itemsBySeller: Record<number, typeof cart.items> = {};
        for (const item of cart.items) {
            if (!itemsBySeller[item.sellerId]) {
                itemsBySeller[item.sellerId] = [];
            }
            itemsBySeller[item.sellerId].push(item);
        }

        const createdOrders: any[] = [];

        await prisma.$transaction(async (tx) => {
            for (const [sellerIdStr, items] of Object.entries(itemsBySeller)) {
                const sellerId = parseInt(sellerIdStr, 10);
                let totalAmount = 0;
                const poItemsData: any[] = [];

                for (const item of items) {
                    let unitPrice = Number(item.unitPrice);
                    let taxRate = 0;
                    let itemName = item.itemName;
                    let unitOfMeasure = item.unitOfMeasure;

                    if (item.productId) {
                        const product = await tx.product.findUnique({
                            where: { id: item.productId }
                        });
                        if (!product || product.status !== 'ACTIVE') {
                            throw new ApiError(400, `Product "${item.itemName}" is unavailable.`, 'PRODUCT_UNAVAILABLE');
                        }
                        unitPrice = Number(product.discountPrice || product.price || unitPrice);
                        taxRate = Number(product.taxRate || 0);
                        itemName = product.name;
                        unitOfMeasure = product.unitOfMeasure || 'units';
                    } else if (item.serviceId) {
                        const service = await tx.service.findUnique({
                            where: { id: item.serviceId }
                        });
                        if (!service || service.status !== 'ACTIVE') {
                            throw new ApiError(400, `Service "${item.itemName}" is unavailable.`, 'SERVICE_UNAVAILABLE');
                        }
                        unitPrice = Number(service.discountPrice || service.basePrice || unitPrice);
                        taxRate = Number(service.taxRate || 0);
                        itemName = service.name;
                        unitOfMeasure = 'service';
                    }

                    const qty = Number(item.quantity);
                    const excl = qty * unitPrice;
                    const lineTotal = excl + excl * (taxRate / 100);
                    totalAmount += lineTotal;

                    poItemsData.push({
                        productId: item.productId || null,
                        itemName,
                        quantity: item.quantity,
                        unitOfMeasure,
                        unitPrice,
                        taxRate,
                        totalAmount: lineTotal
                    });
                }

                const poNum = numberSeries('PO');
                const firstItemName = poItemsData[0]?.itemName || 'Items';
                const poTitle = poItemsData.length === 1
                    ? `Direct Purchase of ${firstItemName}`
                    : `Direct Purchase of ${firstItemName} & ${poItemsData.length - 1} other item(s)`;

                const fullDeliveryAddress = `${body.deliveryAddress}, ${body.city}, ${body.state} - ${body.pincode}. Contact: ${body.contactName} (${body.mobileNumber})`;
                const fullBillingAddress = body.sameAsDelivery
                    ? fullDeliveryAddress
                    : (body.billingAddress || fullDeliveryAddress);

                const daysToAdd = body.expectedDeliveryDate ? 14 : 30;
                const expectedDelivery = body.expectedDeliveryDate
                    ? new Date(body.expectedDeliveryDate)
                    : new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);

                const po = await tx.purchaseOrder.create({
                    data: {
                        poNumber: poNum,
                        buyerId,
                        sellerId,
                        title: poTitle,
                        amount: totalAmount,
                        totalValue: totalAmount,
                        status: 'ORDER_PLACED',
                        poStatus: 'ISSUED',
                        sourceType: 'direct_purchase',
                        deliveryAddress: fullDeliveryAddress,
                        paymentTerms: body.paymentMethod || 'PAY_ON_INVOICE',
                        expectedDelivery,
                        items: {
                            create: poItemsData
                        },
                        metadata: {
                            deliveryDetails: {
                                address: body.deliveryAddress,
                                city: body.city,
                                state: body.state,
                                pincode: body.pincode,
                                contactName: body.contactName,
                                mobileNumber: body.mobileNumber,
                                instructions: body.deliveryInstructions || null
                            },
                            billingDetails: {
                                sameAsDelivery: body.sameAsDelivery,
                                billingAddress: fullBillingAddress,
                                companyName: body.companyName || null,
                                gstin: body.gstin || null
                            },
                            paymentMethod: body.paymentMethod,
                            sellerAcceptance: 'PENDING',
                            placedAt: new Date().toISOString()
                        }
                    }
                });

                await tx.deliveryWorkflow.create({
                    data: { purchaseOrderId: po.id, status: 'created' }
                });

                createdOrders.push({
                    poId: po.id,
                    poNumber: poNum,
                    sellerId,
                    totalAmount
                });

                // Notify seller
                try {
                    await tx.notification.create({
                        data: {
                            userId: sellerId,
                            title: 'New Direct Order Received',
                            message: `Purchase Order ${poNum} for "${poTitle}" requires your acceptance.`,
                            type: 'purchase_order_created',
                            priority: 'high',
                            redirectUrl: '/seller/orders'
                        }
                    });
                } catch {
                    // non-fatal
                }
            }

            // Update cart status to CONVERTED_TO_ORDER
            await tx.cart.update({
                where: { id: cart.id },
                data: {
                    status: 'CONVERTED_TO_ORDER',
                    convertedAt: new Date()
                }
            });
        }, { timeout: 30000 });

        // Dispatch email notifications with official Purchase Order PDF attached to both Seller and Buyer
        for (const order of createdOrders) {
            notifyPurchaseOrderCreated(order.poId).catch(err => {
                logger.warn({ err, poId: order.poId }, 'Failed to dispatch purchase order notifications and PDF');
            });
        }

        return ok(res, { orders: createdOrders }, 201);
    })
);

export default router;
export { router as directPurchaseRoutes };

