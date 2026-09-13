import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const contracts = await prisma.contract.findMany({ select: { id: true, title: true, contractNumber: true, startDate: true, endDate: true, createdAt: true } });
    console.log('Contracts:', JSON.stringify(contracts, null, 2));

    const auctions = await prisma.auction.findMany({ select: { id: true, title: true, startTime: true, endTime: true, createdAt: true } });
    console.log('Auctions:', JSON.stringify(auctions, null, 2));

    const bids = await prisma.procurementBid.findMany({ select: { id: true, title: true, startDate: true, endDate: true, createdAt: true } });
    console.log('ProcurementBids:', JSON.stringify(bids, null, 2));

    const requirements = await prisma.requirement.findMany({ select: { id: true, title: true, createdAt: true, approvedAt: true, lastDate: true } });
    console.log('Requirements:', JSON.stringify(requirements, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();

