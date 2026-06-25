import './src/config/env.js';
import prisma from './src/lib/prisma.js';

async function main() {
  // 1. Fetch User 6 and Organization details
  const user = await prisma.user.findUnique({
    where: { id: 6 },
    include: {
      sellerProfile: true,
      organization: true,
      orgMemberships: {
        include: { organization: true }
      }
    }
  });
  console.log('USER 6:', JSON.stringify({
    id: user?.id,
    email: user?.email,
    role: user?.role,
    organizationId: user?.organizationId,
    organizationName: user?.organization?.organizationName,
    orgMemberships: user?.orgMemberships?.map(m => ({
      organizationId: m.organizationId,
      orgRole: m.orgRole,
      isActive: m.isActive,
      name: m.organization?.organizationName
    }))
  }, null, 2));

  // 2. Fetch all reverse auctions
  const auctions = await prisma.auction.findMany();
  console.log(`\nTOTAL AUCTIONS: ${auctions.length}`);
  for (const a of auctions) {
    console.log(`Auction ID: ${a.id}, Title: ${a.title}, Status: ${a.status}, StatusEnum: ${a.statusEnum}, startPrice: ${a.startPrice}`);
  }

  // 3. Fetch all auction participants
  const participants = await prisma.auctionParticipant.findMany();
  console.log(`\nTOTAL PARTICIPANTS: ${participants.length}`);
  for (const p of participants) {
    console.log(`Participant ID: ${p.id}, Auction ID: ${p.auctionId}, SellerOrgId: ${p.sellerOrgId}, SellerUserId: ${p.sellerUserId}, Status: ${p.status}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
