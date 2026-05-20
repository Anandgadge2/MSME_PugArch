require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
console.log("Loaded DATABASE_URL from .env:", process.env.DATABASE_URL);
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log("Attempting to connect to PostgreSQL database with loaded URL...");
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
