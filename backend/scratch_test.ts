import './src/config/env.js';
import prisma from './src/config/prisma.js';

async function main() {
  const verifications = await prisma.userKycVerification.findMany({
    where: { status: 'FAILED' },
    orderBy: { updatedAt: 'desc' },
    take: 10
  });
  console.log(`Found ${verifications.length} failed UserKycVerification records:`);
  for (const v of verifications) {
    console.log(`UserId: ${v.userId}, status: ${v.status}, code: ${v.lastErrorCode}, message: ${v.lastErrorMessage}, updatedAt: ${v.updatedAt}`);
  }

  const logs = await prisma.kycAuditLog.findMany({
    where: { status: 'FAILED' },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(`\nFound ${logs.length} failed KycAuditLog records:`);
  for (const l of logs) {
    console.log(`UserId: ${l.userId}, action: ${l.action}, message: ${l.message}, createdAt: ${l.createdAt}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
