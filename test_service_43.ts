import jwt from 'jsonwebtoken';
import * as service from './backend/src/modules/procurementBid/procurement-bid.service.ts';
import prisma from './backend/src/lib/prisma.ts';

async function test() {
  const user = await prisma.user.findUnique({
    where: { id: 6 },
    include: { organization: true, sellerProfile: true }
  });

  const directBid = await service.resolveBid('43', service.leanBidInclude);
  const serialized = service.serializeBid(directBid, {
    actor: user,
    includeParticipants: true,
    includeFinancial: true
  });

  console.log('--- SERIALIZED BID 43 FOR USER 6 ---');
  console.log('hasSubmittedProposal:', serialized.hasSubmittedProposal);
  console.log('myParticipation:', serialized.myParticipation ? { id: serialized.myParticipation.id, status: serialized.myParticipation.status, submissionStatus: serialized.myParticipation.submissionStatus, sellerId: serialized.myParticipation.sellerId } : null);
  console.log('participations count:', serialized.participations?.length);
  console.log('participations:', serialized.participations);
}

test().catch(console.error).finally(() => prisma.$disconnect());
