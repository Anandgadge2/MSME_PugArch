import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function testLeaks() {
  // Let's inspect the code of marketplace requirements:
  // In marketplace.routes.ts line 2755:
  /*
  const currentUserId = req.user?.id ? Number(req.user.id) : null;
  const filteredLegacy = (legacyRequirements || []).filter((reqItem: any) => {
      const method = reqItem.canonicalMethod || reqItem.procurementMethod || '';
      const isRestricted = ['DIRECT_PURCHASE', 'CATALOG_PURCHASE', 'REPEAT_ORDER', 'LIMITED_TENDER', 'SINGLE_SOURCE', 'EMERGENCY_PURCHASE'].includes(method.toUpperCase());
      const isLimitedRfq = method.toUpperCase() === 'RFQ' && reqItem.payload && typeof reqItem.payload === 'object' && (reqItem.payload as any).rfqType === 'LIMITED';
      
      if (isRestricted || isLimitedRfq) {
          if (!currentUserId) return false;
          const invited = Array.isArray((reqItem.payload as any)?.vendors?.invitedSellers) ? (reqItem.payload as any).vendors.invitedSellers : [];
          return invited.includes(currentUserId);
      }
      return true;
  });
  */

  // Notice:
  // If req.user is Seller 9 (userId: 9, organizationId: 6):
  // reqItem 93:
  // method: 'RFQ'
  // rfqType: 'LIMITED'
  // isLimitedRfq: true!
  // invited: [ 3 ] (which is Organization ID 3!)
  // currentUserId: 9!
  // invited.includes(9) -> false! So filteredLegacy filters it out!
  
  // BUT WAIT!
  // What about `buyerRequirements`?
  // Let's check if `buyerRequirements` table has anything!
  const buyerReqs = await prisma.buyerRequirement.findMany({
    where: {
      OR: [
        { title: { contains: 'lkjlajglsdjfj' } },
        { title: { contains: 'GOLD CArrot' } }
      ]
    }
  });
  console.log('BuyerRequirement table matches:', buyerReqs.length);

  // Now, WHAT DOES `procurementBid.findMany` with `pbWhere` return?
  // In marketplace.routes.ts:
  // pbWhere has: visibility: 'PUBLIC'
  // For Bid 314, visibility is 'PRIVATE', so pbWhere does NOT return it.

  // THEN WHAT ABOUT `/api/procurement/bids` (listPublicBids)?
  // Let's check how listPublicBids handles Bid 314 for Seller 9:
  const seller9 = { id: 9, role: 'seller', organizationId: 6 };
  const actorInviteIds = [Number(seller9.id), Number(seller9.organizationId)]; // [9, 6]
  
  // Look at listPublicBids in procurement-bid.service.ts line 2214:
  /*
  const invitedBidFilters = actorInviteIds.flatMap(value => ([
    { technicalPacket: { path: ['vendors', 'invitedSellers'], array_contains: value } },
    { technicalPacket: { path: ['qualifiedVendors'], array_contains: value } }
  ]));
  */
  // For seller 9, value is 9 and 6. In technicalPacket, invitedSellers has [3]. So it does NOT match.

  // THEN WHERE DID THE USER SEE IT?!
  // Let's check the other endpoints!
  // What endpoints exist on the seller side?
  // 1. /api/seller/opportunities (wait! Where is this in frontend?)
  // 2. /api/marketplace/requirements
  // 3. /api/procurement/bids
  // 4. /api/buyer/requirements
  // 5. /api/tenders
  // 6. /api/rfq
  // 7. /api/requirements
  // 8. What about direct URL? /tenders?tender=RFQ-2026-47973
  // 9. What about /seller/opportunities?
  // 10. What about SellerDashboardPage?
}

testLeaks().finally(() => prisma.$disconnect());
