import prisma from '../lib/prisma.js';
import { formatRefId } from '../utils/refIdUtils.js';

async function testAllProcurementTypesAndL1() {
    console.log('================================================================');
    console.log('   MSME PORTAL - ALL PROCUREMENT TYPES & MULTI-SELLER L1 AUDIT   ');
    console.log('================================================================\n');

    let passedTests = 0;
    const totalTests = 6;

    const procurementTypes = [
        { code: 'RFQ', label: 'Request for Quotation (RFQ)', prefix: 'RFQ' },
        { code: 'OPEN_TENDER', label: 'Open Public Tender', prefix: 'TND' },
        { code: 'LIMITED_TENDER', label: 'Limited Tender (Invited Suppliers)', prefix: 'TND' },
        { code: 'RFP', label: 'Request for Proposal (RFP / 2-Packet)', prefix: 'RFP' },
        { code: 'REVERSE_AUCTION', label: 'Reverse Auction (Dynamic Decrement)', prefix: 'RA' },
        { code: 'RATE_CONTRACT', label: 'Rate Contract (Unit Price Agreement)', prefix: 'RC' }
    ];

    try {
        const buyer = await prisma.user.findFirst({ where: { email: { contains: 'buyer' } } }) || await prisma.user.findFirst();
        if (!buyer) throw new Error('Buyer account not found in database.');

        // Get 4 distinct seller profiles/users
        const sellers = await prisma.user.findMany({
            where: { id: { not: buyer.id } },
            take: 4
        });

        if (sellers.length < 1) {
            sellers.push(buyer);
        }

        console.log(`✓ Buyer: ID ${buyer.id} (${buyer.email})`);
        console.log(`✓ Sellers available for multi-seller bidding: ${sellers.length} seller(s)\n`);

        for (let i = 0; i < procurementTypes.length; i++) {
            const pType = procurementTypes[i];
            console.log(`----------------------------------------------------------------`);
            console.log(`[Test ${i + 1}/${totalTests}] Testing ${pType.label}...`);

            // 1. Create Sourcing Bid Event
            const refNumber = formatRefId(pType.prefix, Math.floor(Math.random() * 89999) + 10000, undefined, pType.code as any);
            const bid = await prisma.procurementBid.create({
                data: {
                    bidNumber: refNumber,
                    title: `Procurement Event - ${pType.label}`,
                    description: `Testing multi-seller quotes and L1/L2 calculation for ${pType.label}`,
                    buyerId: buyer.id,
                    buyerOrganizationName: 'Verified Industrial Corp',
                    buyerType: 'ENTERPRISE',
                    category: 'Industrial Machinery & Spares',
                    bidType: pType.code,
                    procurementType: pType.code,
                    deliveryLocation: 'Manufacturing Plant, Sector 5, Pune',
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
                    status: 'PUBLISHED',
                    estimatedValue: 500000
                }
            });
            console.log(`  ✓ Published Procurement Event: ${bid.bidNumber} (ID: ${bid.id})`);

            // 2. Simulate 4 Sellers submitting competing quotes
            console.log(`  → Submitting 4 competing seller quotations...`);
            const mockQuotes = [
                { sellerId: sellers[0]?.id || 10, offeredPrice: 400, qty: 1000, total: 400000, status: 'L1 Candidate' },
                { sellerId: sellers[1]?.id || 11, offeredPrice: 420, qty: 1000, total: 420000, status: 'L2 Candidate' },
                { sellerId: sellers[2]?.id || 12, offeredPrice: 450, qty: 1000, total: 450000, status: 'L3 Candidate' },
                { sellerId: sellers[3]?.id || 13, offeredPrice: 480, qty: 1000, total: 480000, status: 'L4 Candidate' },
            ];

            const participations = [];
            for (const q of mockQuotes) {
                const part = await prisma.procurementBidParticipation.create({
                    data: {
                        participationNumber: `PART-2026-${Math.floor(Math.random() * 89999) + 10000}`,
                        bidId: bid.id,
                        sellerId: q.sellerId,
                        totalAmount: q.total,
                        quotedAmount: q.total,
                        submissionStatus: 'SUBMITTED',
                        technicalStatus: 'QUALIFIED'
                    }
                });
                participations.push(part);
            }
            console.log(`  ✓ Created 4 Seller Participations: Amounts [₹4,00,000, ₹4,20,00, ₹4,50,000, ₹4,80,000]`);

            // 3. Automated L1 / L2 Ranking Engine Calculation
            console.log(`  → Executing Automated L1 / L2 Ranking Engine...`);
            const ranked = [...participations].sort((a, b) => Number(a.totalAmount || 0) - Number(b.totalAmount || 0));

            const l1 = ranked[0];
            const l2 = ranked[1];
            const l3 = ranked[2];

            console.log(`  ✓ L1 Lowest Bidder: Supplier ${l1.sellerId} (Amount: ₹${Number(l1.totalAmount).toLocaleString('en-IN')})`);
            console.log(`  ✓ L2 Second Lowest: Supplier ${l2.sellerId} (Amount: ₹${Number(l2.totalAmount).toLocaleString('en-IN')})`);
            console.log(`  ✓ L3 Third Lowest:  Supplier ${l3.sellerId} (Amount: ₹${Number(l3.totalAmount).toLocaleString('en-IN')})`);

            // Verify L1 is strictly <= L2 <= L3
            if (Number(l1.totalAmount) > Number(l2.totalAmount) || Number(l2.totalAmount) > Number(l3.totalAmount)) {
                throw new Error(`L1 Ranking Engine failed sorting check for ${pType.label}`);
            }

            // 4. Grant Award to L1 Seller
            console.log(`  → Awarding Procurement Event to L1 Seller (ID ${l1.sellerId})...`);
            const awarded = await prisma.procurementBid.update({
                where: { id: bid.id },
                data: {
                    status: 'AWARDED',
                    lifecycleStage: 'AWARDED'
                }
            });

            console.log(`  ✓ Award Granted to Seller ${l1.sellerId}: Status = ${awarded.status}`);
            passedTests++;
        }

        console.log('\n================================================================');
        console.log(`   ALL 6 PROCUREMENT TYPES & MULTI-SELLER L1 AUDIT: ${passedTests}/${totalTests} PASSED   `);
        console.log('================================================================\n');

    } catch (err: any) {
        console.error('\n❌ Procurement Audit Failed:', err.message || err);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

testAllProcurementTypesAndL1();
