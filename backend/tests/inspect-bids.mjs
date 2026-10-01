import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const bids = await prisma.procurementBid.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      bidNumber: true,
      title: true,
      bidType: true,
      procurementType: true,
      visibility: true,
      technicalPacket: true,
      invitations: true
    }
  });
  for (const b of bids) {
    const tp = b.technicalPacket || {};
    const vendors = tp.vendors || {};
    console.log({
      id: b.id,
      bidNumber: b.bidNumber,
      title: b.title,
      bidType: b.bidType,
      procurementType: b.procurementType,
      visibility: b.visibility,
      vendorsSelection: vendors.selection,
      vendorsInvited: vendors.invitedSellers,
      invitationsCount: b.invitations?.length
    });
  }
}
main().finally(() => prisma.$disconnect());
