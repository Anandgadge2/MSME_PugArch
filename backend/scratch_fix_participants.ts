import './src/config/env.js';
import prisma from './src/config/prisma.js';

async function main() {
  const db = prisma as any;

  // Let's update participant with id: 1 to have sellerOrgId: 2
  const updated = await db.auctionParticipant.update({
    where: { id: 1 },
    data: { sellerOrgId: 2 }
  });
  console.log('UPDATED PARTICIPANT:', updated);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
