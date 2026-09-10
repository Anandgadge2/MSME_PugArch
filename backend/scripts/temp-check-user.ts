import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'kartikkanzode@gmail.com' }
  });
  console.log('USER:', user?.id, user?.email);

  const pos = await prisma.purchaseOrder.findMany({
    where: {
      sellerId: user?.id
    },
    select: { id: true, poNumber: true, status: true }
  });
  console.log('POS for user 71:', pos);

  const trackings = await prisma.deliveryTracking.findMany({
    where: {
      purchaseOrder: { sellerId: user?.id }
    },
    select: { id: true, status: true, trackingNumber: true }
  });
  console.log('Trackings for user 71:', trackings);

  // If none, check all POs in the system
  if (pos.length === 0) {
    const allPos = await prisma.purchaseOrder.findMany({
      take: 5,
      select: { id: true, poNumber: true, sellerId: true, seller: { select: { email: true } } }
    });
    console.log('Sample all POs:', allPos);
  }
}

main().finally(() => prisma.$disconnect());
