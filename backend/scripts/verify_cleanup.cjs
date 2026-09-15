const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TITLES = [
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

async function verify() {
  console.log('=== VERIFYING FINAL PORTAL DATA ===');

  for (const t of TITLES) {
    const pb = await prisma.procurementBid.count({
      where: { title: { contains: t, mode: 'insensitive' } }
    });
    const req = await prisma.requirement.count({
      where: { title: { contains: t, mode: 'insensitive' } }
    });
    const rc = await prisma.contract.count({
      where: { title: { contains: t, mode: 'insensitive' } }
    });
    const auc = await prisma.auction.count({
      where: { title: { contains: t, mode: 'insensitive' } }
    });
    const br = await prisma.buyerRequirement.count({
      where: { title: { contains: t, mode: 'insensitive' } }
    });
    const parts = await prisma.procurementBidParticipation.count({
      where: { bid: { title: { contains: t, mode: 'insensitive' } } }
    });
    const responses = await prisma.requirementResponse.count({
      where: { requirement: { title: { contains: t, mode: 'insensitive' } } }
    });

    const total = pb + req + rc + auc + br + parts + responses;
    console.log(`"${t}": total traces = ${total} (pb=${pb}, req=${req}, rc=${rc}, auc=${auc}, br=${br}, sellerParts=${parts}, sellerResponses=${responses})`);
  }
}

verify()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
