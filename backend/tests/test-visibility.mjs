import { PrismaClient } from '@prisma/client';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const prisma = new PrismaClient();
const { listPublicBids, canActorViewBid } = require('../dist/src/modules/procurementBid/procurement-bid.service.js');

async function test() {
  const bid314 = await prisma.procurementBid.findUnique({
    where: { id: 314 },
    include: { invitations: true, participations: true }
  });
  console.log('Bid 314:', {
    id: bid314.id,
    bidNumber: bid314.bidNumber,
    visibility: bid314.visibility,
    invitations: bid314.invitations
  });
  const allSellers = await prisma.user.findMany({
    where: { role: 'seller' },
    select: { id: true, name: true, organizationId: true }
  });
  for (const s of allSellers) {
    const actor = { id: s.id, role: 'seller', organizationId: s.organizationId };
    const canView = canActorViewBid(actor, bid314);
    const listRes = await listPublicBids({}, actor);
    const inList = listRes.items.some(b => b.id === 314 || b.bidNumber === bid314?.bidNumber);
    console.log(`Seller ID: ${s.id}, Org: ${s.organizationId} -> canView: ${canView}, inList: ${inList}`);
  }
}
test().finally(() => prisma.$disconnect());
