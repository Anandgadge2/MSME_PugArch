import prisma from '../lib/prisma.js';
import { verifyPassword } from '../services/password.service.js';

async function testAuth() {
  const users = await prisma.user.findMany({
    where: { email: { in: ['trl@gmail.com', 'fortis@gmail.com', 'koshal@gmail.com'] } },
    include: { organization: true, buyerProfile: true, sellerProfile: true }
  });

  for (const u of users) {
    const valid = await verifyPassword('Pass@1234567', u.password);
    console.log(`User: ${u.email} | Role: ${u.role} | Org: ${u.organization?.organizationName} (ID: ${u.organizationId}) | Password Valid: ${valid} | Status: ${u.accountStatus} | Email Verified: ${u.emailVerified}`);
  }
}

testAuth().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
