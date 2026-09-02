import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const p = await db.product.findUnique({
    where: { id: 225 },
    include: {
      images: { include: { fileAsset: true } },
      specifications: true,
      certifications: { include: { fileAsset: true } },
    }
  });
  console.log('PRODUCT 225:', JSON.stringify(p, null, 2));

  const productImages = await db.productImage.findMany({
    where: { productId: 225 },
    include: { fileAsset: true }
  });
  console.log('PRODUCT 225 IMAGES:', JSON.stringify(productImages, null, 2));

  const directFiles = await db.fileAsset.findMany({
    where: { entityId: 225 }
  });
  console.log('DIRECT FILES FOR 225:', JSON.stringify(directFiles, null, 2));
}

main().finally(() => db.$disconnect());
