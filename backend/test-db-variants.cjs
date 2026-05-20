const { PrismaClient } = require('@prisma/client');

const baseUri = "postgresql://neondb_owner:npg_U0XLepHlbI8z@ep-dark-term-aq1uyd71.c-8.us-east-1.aws.neon.tech/neondb";
const variants = [
  { name: "Original (sslmode=require&channel_binding=require)", url: baseUri + "?sslmode=require&channel_binding=require" },
  { name: "Only sslmode=require", url: baseUri + "?sslmode=require" },
  { name: "No query parameters", url: baseUri },
  { name: "sslmode=no-verify", url: baseUri + "?sslmode=no-verify" }
];

async function testVariant(variant) {
  console.log(`\nTesting variant: ${variant.name}`);
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: variant.url
      }
    }
  });

  try {
    await prisma.$connect();
    console.log("SUCCESS: Prisma successfully connected!");
    const count = await prisma.user.count();
    console.log("SUCCESS: Found " + count + " user records!");
    return true;
  } catch (error) {
    console.error("FAILED: Code:", error.code, "Message:", error.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  for (const variant of variants) {
    const success = await testVariant(variant);
    if (success) {
      console.log(`\n*** WORKING CONNECTION STRING: ${variant.url} ***`);
      break;
    }
  }
}

main();
