const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Attempting to connect to PostgreSQL database at 34.93.235.136:5432...");
  try {
    await prisma.$connect();
    console.log("SUCCESS: Prisma successfully connected to the database!");
    const count = await prisma.user.count();
    console.log("SUCCESS: Found " + count + " user records in the database!");
  } catch (error) {
    console.error("DATABASE CONNECTION ERROR:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
