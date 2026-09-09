const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const titles = [
    'canteen service',
    'water bottles',
    'COLLEGE BAGS',
    'Annual Rate Contract for Office Stationery',
    'Supply of Laptops for Corporate Employees',
    'title 1',
    'Supply of Multifunction Laser Printers',
    'school stationary customize',
    'Design, Supply, Installation & Commissioning of 500 kW Solar Power Plant',
    'Cupidatat mollitia n',
    'bags'
  ];

  for (const t of titles) {
    const pb = await prisma.procurementBid.findMany({
      where: { buyerId: 4, title: { contains: t, mode: 'insensitive' } },
      select: { id: true, bidNumber: true, title: true }
    });
    const req = await prisma.requirement.findMany({
      where: { buyerId: 4, title: { contains: t, mode: 'insensitive' } },
      select: { id: true, requirementNumber: true, title: true }
    });
    const rc = await prisma.contract.findMany({
      where: { title: { contains: t, mode: 'insensitive' } },
      select: { id: true, contractNumber: true, title: true }
    });
    const auc = await prisma.auction.findMany({
      where: { title: { contains: t, mode: 'insensitive' } },
      select: { id: true, referenceNo: true, title: true }
    });
    const br = await prisma.buyerRequirement.findMany({
      where: { createdById: 4, title: { contains: t, mode: 'insensitive' } },
      select: { id: true, title: true }
    });
    console.log('--- ' + t + ' ---');
    if (pb.length) console.log('  ProcurementBids:', pb);
    if (req.length) console.log('  Requirements:', req);
    if (rc.length) console.log('  Contracts:', rc);
    if (auc.length) console.log('  Auctions:', auc);
    if (br.length) console.log('  BuyerRequirements:', br);
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
