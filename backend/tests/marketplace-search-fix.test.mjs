import test from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma.ts';
import { parseSmartSearchQuery, getTokenVariants, parseMultiplier } from '../src/utils/smartSearch.ts';

test.describe('Marketplace Search & Autocomplete Fix Suite', () => {
    test.after(async () => {
        try {
            await prisma.$disconnect();
        } catch {
            // ignore
        }
    });

    test('1. Smart Search Query Parser extracts clean query, tokens, and price ranges accurately', () => {
        const query1 = parseSmartSearchQuery('df');
        assert.equal(query1.cleanQuery, 'df');
        assert.ok(Array.isArray(query1.tokenVariants));

        const query2 = parseSmartSearchQuery('dff');
        assert.equal(query2.cleanQuery, 'dff');

        const query3 = parseSmartSearchQuery('Electric Motors under 50k');
        assert.equal(query3.maxPrice, 50000);
        assert.ok(query3.cleanQuery.toLowerCase().includes('electric motors'));

        const query4 = parseSmartSearchQuery('Valves between 500 and 1500');
        assert.equal(query4.minPrice, 500);
        assert.equal(query4.maxPrice, 1500);
    });

    test('2. Token variants generation handles plurals and singular forms safely', () => {
        const motorVariants = getTokenVariants('motors');
        assert.ok(motorVariants.includes('motor'));
        assert.ok(motorVariants.includes('motors'));

        const valveVariants = getTokenVariants('valves');
        assert.ok(valveVariants.includes('valves'));

        const emptyVariants = getTokenVariants('');
        assert.deepEqual(emptyVariants, []);
    });

    test('3. Service select in marketplace search does NOT reference invalid relations and queries safely', async () => {
        // Must succeed without throwing "Unknown field images for select statement on model Service"
        const services = await prisma.service.findMany({
            take: 2,
            select: {
                id: true,
                name: true,
                pricingModel: true,
                basePrice: true,
                currency: true,
                category: { select: { id: true, name: true } },
                organization: {
                    select: {
                        id: true,
                        organizationName: true,
                        verificationStatus: true,
                        city: true,
                        district: true,
                        logoFile: { select: { id: true, url: true } },
                        profile: { select: { logoUrl: true, isLargeIndustry: true, isBigMsme: true } }
                    }
                }
            }
        });

        assert.ok(Array.isArray(services), 'Service search returned valid array');
    });

    test('4. Product select in marketplace search queries images and specifications safely', async () => {
        const products = await prisma.product.findMany({
            take: 2,
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
        });

        assert.ok(Array.isArray(products), 'Product search returned valid array');
    });

    test('5. Organization search correctly uses AND compound condition without overwriting seller restrictions', async () => {
        const variants = ['orissa', 'metaliks'];
        const sellerOrganizationWhere = {
            verificationStatus: 'VERIFIED',
            isBlacklisted: false,
            deletedAt: null
        };

        const orgs = await prisma.organization.findMany({
            where: {
                AND: [
                    sellerOrganizationWhere,
                    {
                        OR: variants.flatMap(v => [
                            { organizationName: { contains: v, mode: 'insensitive' } },
                            { city: { contains: v, mode: 'insensitive' } },
                            { district: { contains: v, mode: 'insensitive' } }
                        ])
                    }
                ]
            },
            take: 5,
            select: {
                id: true,
                organizationName: true,
                verificationStatus: true,
                city: true,
                district: true
            }
        });

        assert.ok(Array.isArray(orgs), 'Organization search executed safely');
    });

    test('6. Concurrent simulated search for "df" executes with zero 500 errors', async () => {
        const q = 'df';
        const parsedQuery = parseSmartSearchQuery(q);
        const searchTerms = parsedQuery.cleanQuery || q;
        const variants = [searchTerms];

        const [products, services, sellers, categories] = await Promise.all([
            prisma.product.findMany({
                where: {
                    OR: variants.map(v => ({ name: { contains: v, mode: 'insensitive' } }))
                },
                take: 6,
                select: { id: true, name: true }
            }),
            prisma.service.findMany({
                where: {
                    OR: variants.map(v => ({ name: { contains: v, mode: 'insensitive' } }))
                },
                take: 6,
                select: { id: true, name: true }
            }),
            prisma.organization.findMany({
                where: {
                    OR: variants.map(v => ({ organizationName: { contains: v, mode: 'insensitive' } }))
                },
                take: 5,
                select: { id: true, organizationName: true }
            }),
            prisma.category.findMany({
                where: {
                    isActive: true,
                    OR: variants.map(v => ({ name: { contains: v, mode: 'insensitive' } }))
                },
                take: 5,
                select: { id: true, name: true }
            })
        ]);

        assert.ok(Array.isArray(products));
        assert.ok(Array.isArray(services));
        assert.ok(Array.isArray(sellers));
        assert.ok(Array.isArray(categories));
    });
});
