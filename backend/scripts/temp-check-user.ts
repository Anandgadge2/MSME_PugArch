import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { name: { contains: 'Sandhya' } },
    include: { organization: true, sellerProfile: true }
  });

  console.log('USER DATA:', JSON.stringify({
    id: user?.id,
    name: user?.name,
    email: user?.email,
    registrationDetails: user?.registrationDetails,
    organization: user?.organization,
    sellerProfile: user?.sellerProfile
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
