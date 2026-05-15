const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Attempting to connect to PostgreSQL database...");
  try {
    await prisma.$connect();
    console.log("SUCCESS: Prisma successfully connected to the database!");
    const count = await prisma.user.count();
    console.log("SUCCESS: Found " + count + " user records in the database!");
  } catch (error) {
    console.error("DATABASE CONNECTION ERROR DETAILS:");
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
