import './src/config/env.js';
import prisma from './src/lib/prisma.js';

async function main() {
  const drafts = await prisma.bidWizardDraft.findMany({});
  console.log(`Found ${drafts.length} bid wizard drafts in DB.`);
  for (const d of drafts) {
    console.log(`\nBidWizardDraft ID: ${d.id}, bidType: ${d.bidType}`);
    console.log("formData JSON:", JSON.stringify(d.formData, null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
