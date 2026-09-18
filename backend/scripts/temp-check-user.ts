import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Ready");
}

main().finally(() => prisma.$disconnect());
