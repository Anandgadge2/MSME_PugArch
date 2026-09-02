import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const p = await db.product.findUnique({
    where: { id: 225 },
    include: {
      images: { include: { fileAsset: true } },
      specifications: true,
      certifications: { include: { fileAsset: true } },
      seller: { select: { id: true, name: true, organizationId: true } },
      organization: true,
    }
  });
  const files = await db.fileAsset.findMany({
    where: {
      OR: [
        { entityId: 225 },
        { ownerId: p?.seller?.id }
      ]
    }
  });
  console.log('PRODUCT DATA:', JSON.stringify(p, null, 2));
  console.log('ATTACHED FILES:', JSON.stringify(files, null, 2));
}

main().finally(() => db.$disconnect());
