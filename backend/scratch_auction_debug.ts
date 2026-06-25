import './src/config/env.js';
import prisma from './src/config/prisma.js';

async function main() {
  const db = prisma as any;
  const sellerOrgId = 2; // Anand Gadge's organizationId
  
  console.log('Mimicking GET /api/reverse-auctions for sellerOrgId = 2:');
  const participantRows = await db.auctionParticipant.findMany({
    where: { sellerOrgId },
    select: { auctionId: true }
  });
  console.log('Participant Rows:', participantRows);
  
  const ids = participantRows.map((row: any) => row.auctionId);
  const auctions = await db.auction.findMany({
    where: { id: { in: ids } }
  });
  console.log('Auctions Returned:', auctions);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
