import { PrismaClient } from '@prisma/client';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const prisma = new PrismaClient();
const { listPublicBids } = require('../dist/src/modules/procurementBid/procurement-bid.service.js');

async function test() {
  // Let's find all sellers
  const sellers = await prisma.user.findMany({
    where: { role: 'seller' },
    select: { id: true, name: true, organizationId: true }
  });
  console.log('Sellers:', sellers);

  // Let's check requirements in database matching 'RFQ-2026-47973' or 'RFQ-2026-96981' or 'lkjlajglsdjfj'
  const reqs = await prisma.requirement.findMany({
    where: {
      OR: [
        { requirementNumber: { in: ['RFQ-2026-47973', 'RFQ-2026-96981', 'RFQ-2026-15534'] } },
        { title: { in: ['lkjlajglsdjfj', 'khuda 1', 'GOLD CArrot'] } }
      ]
    },
    select: {
      id: true,
      requirementNumber: true,
      title: true,
      procurementMethod: true,
      canonicalMethod: true,
      payload: true,
      status: true
    }
  });
  console.log('Requirements in DB:', reqs.map(r => ({
    id: r.id,
    reqNumber: r.requirementNumber,
    title: r.title,
    method: r.canonicalMethod,
    status: r.status,
    rfqType: r.payload?.rfqType,
    selection: r.payload?.vendors?.selection,
    invited: r.payload?.vendors?.invitedSellers
  })));

  const bids = await prisma.procurementBid.findMany({
    where: {
      bidNumber: { in: ['RFQ-2026-47973', 'RFQ-2026-96981', 'RFQ-2026-15534'] }
    },
    include: { invitations: true }
  });
  console.log('Bids in DB:', bids.map(b => ({
    id: b.id,
    bidNumber: b.bidNumber,
    visibility: b.visibility,
    bidType: b.bidType,
    procurementType: b.procurementType,
    invitations: b.invitations
  })));
}

test().finally(() => prisma.$disconnect());
