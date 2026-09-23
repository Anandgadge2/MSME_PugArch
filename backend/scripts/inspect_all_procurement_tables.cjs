const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== INSPECTING ALL PRISMA MODELS IN DATABASE ===\n');
  
  const keys = Object.keys(prisma).filter(k => 
    !k.startsWith('_') && 
    !k.startsWith('$') && 
    typeof prisma[k] === 'object' && 
    prisma[k] !== null &&
    typeof prisma[k].count === 'function'
  );

  const modelCounts = {};
  for (const m of keys) {
    try {
      const count = await prisma[m].count();
      if (count > 0) {
        modelCounts[m] = count;
        console.log(`[DATA EXISTS] ${m}: ${count} records`);
      }
    } catch (err) {
      console.log(`[ERROR] ${m}: ${err.message}`);
    }
  }

  console.log('\n=== SUMMARY OF NON-EMPTY MODELS WITH DATA ===');
  console.log(JSON.stringify(modelCounts, null, 2));

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
