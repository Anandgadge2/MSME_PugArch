import '../config/env.js';
import { PrismaClient } from '@prisma/client';
import { encryptField, isEncrypted, createHashFingerprint } from '../utils/crypto.js';

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');
const BATCH_SIZE = 100;

interface MigrationStats {
  processed: number;
  encrypted: number;
  fingerprinted: number;
  skipped: number;
  errors: number;
}

async function backfillUsers(): Promise<MigrationStats> {
  const stats: MigrationStats = { processed: 0, encrypted: 0, fingerprinted: 0, skipped: 0, errors: 0 };
  console.log('\n--- 1. Migrating User Table ---');

  let cursor: number | undefined = undefined;

  while (true) {
    const users: Array<{ id: number; mobile: string | null; mobileFingerprint: string | null }> = await prisma.user.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      select: { id: true, mobile: true, mobileFingerprint: true },
      orderBy: { id: 'asc' }
    });

    if (users.length === 0) break;

    for (const u of users) {
      stats.processed++;
      cursor = u.id;

      if (!u.mobile) {
        stats.skipped++;
        continue;
      }

      const needsEncryption = !isEncrypted(u.mobile);
      const needsFingerprint = !u.mobileFingerprint;

      if (!needsEncryption && !needsFingerprint) {
        stats.skipped++;
        continue;
      }

      try {
        const plainMobile = u.mobile;
        const encryptedMobile = needsEncryption ? encryptField(plainMobile) : u.mobile;
        const fingerprint = needsFingerprint ? createHashFingerprint(plainMobile, 'mobile') : u.mobileFingerprint;

        if (!isDryRun) {
          await (prisma.user as any).update({
            where: { id: u.id },
            data: {
              mobile: encryptedMobile,
              mobileFingerprint: fingerprint
            }
          });
        }

        if (needsEncryption) stats.encrypted++;
        if (needsFingerprint) stats.fingerprinted++;
      } catch (err) {
        console.error(`[Error] Failed to update user ID ${u.id}:`, err);
        stats.errors++;
      }
    }
  }

  return stats;
}

async function backfillBuyerProfiles(): Promise<MigrationStats> {
  const stats: MigrationStats = { processed: 0, encrypted: 0, fingerprinted: 0, skipped: 0, errors: 0 };
  console.log('\n--- 2. Migrating BuyerProfile Table ---');

  let cursor: number | undefined = undefined;

  while (true) {
    const buyers: Array<{
      id: number;
      mobile: string | null;
      mobileFingerprint: string | null;
      pan: string | null;
      nameAsInPan: string | null;
      bankAccountNo: string | null;
      bankIfsc: string | null;
    }> = await prisma.buyerProfile.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      select: {
        id: true,
        mobile: true,
        mobileFingerprint: true,
        pan: true,
        nameAsInPan: true,
        bankAccountNo: true,
        bankIfsc: true
      },
      orderBy: { id: 'asc' }
    });

    if (buyers.length === 0) break;

    for (const b of buyers) {
      stats.processed++;
      cursor = b.id;

      const updateData: Record<string, string | null> = {};
      let changed = false;

      // Mobile
      if (b.mobile && !isEncrypted(b.mobile)) {
        updateData.mobile = encryptField(b.mobile);
        changed = true;
      }
      if (b.mobile && !b.mobileFingerprint) {
        updateData.mobileFingerprint = createHashFingerprint(b.mobile, 'mobile');
        changed = true;
      }

      // PAN
      if (b.pan && !isEncrypted(b.pan)) {
        updateData.pan = encryptField(b.pan);
        changed = true;
      }

      // Name as in PAN
      if (b.nameAsInPan && !isEncrypted(b.nameAsInPan)) {
        updateData.nameAsInPan = encryptField(b.nameAsInPan);
        changed = true;
      }

      // Bank details
      if (b.bankAccountNo && !isEncrypted(b.bankAccountNo)) {
        updateData.bankAccountNo = encryptField(b.bankAccountNo);
        changed = true;
      }
      if (b.bankIfsc && !isEncrypted(b.bankIfsc)) {
        updateData.bankIfsc = encryptField(b.bankIfsc);
        changed = true;
      }

      if (!changed) {
        stats.skipped++;
        continue;
      }

      try {
        if (!isDryRun) {
          await (prisma.buyerProfile as any).update({
            where: { id: b.id },
            data: updateData
          });
        }
        stats.encrypted++;
      } catch (err) {
        console.error(`[Error] Failed to update BuyerProfile ID ${b.id}:`, err);
        stats.errors++;
      }
    }
  }

  return stats;
}

async function backfillSellerProfiles(): Promise<MigrationStats> {
  const stats: MigrationStats = { processed: 0, encrypted: 0, fingerprinted: 0, skipped: 0, errors: 0 };
  console.log('\n--- 3. Migrating SellerProfile Table ---');

  let cursor: number | undefined = undefined;

  while (true) {
    const sellers: Array<{
      id: number;
      mobile: string | null;
      mobileFingerprint: string | null;
      pan: string | null;
      nameAsInPan: string | null;
    }> = await prisma.sellerProfile.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      select: {
        id: true,
        mobile: true,
        mobileFingerprint: true,
        pan: true,
        nameAsInPan: true
      },
      orderBy: { id: 'asc' }
    });

    if (sellers.length === 0) break;

    for (const s of sellers) {
      stats.processed++;
      cursor = s.id;

      const updateData: Record<string, string | null> = {};
      let changed = false;

      // Mobile
      if (s.mobile && !isEncrypted(s.mobile)) {
        updateData.mobile = encryptField(s.mobile);
        changed = true;
      }
      if (s.mobile && !s.mobileFingerprint) {
        updateData.mobileFingerprint = createHashFingerprint(s.mobile, 'mobile');
        changed = true;
      }

      // PAN
      if (s.pan && !isEncrypted(s.pan)) {
        updateData.pan = encryptField(s.pan);
        changed = true;
      }

      // Name as in PAN
      if (s.nameAsInPan && !isEncrypted(s.nameAsInPan)) {
        updateData.nameAsInPan = encryptField(s.nameAsInPan);
        changed = true;
      }

      if (!changed) {
        stats.skipped++;
        continue;
      }

      try {
        if (!isDryRun) {
          await (prisma.sellerProfile as any).update({
            where: { id: s.id },
            data: updateData
          });
        }
        stats.encrypted++;
      } catch (err) {
        console.error(`[Error] Failed to update SellerProfile ID ${s.id}:`, err);
        stats.errors++;
      }
    }
  }

  return stats;
}

async function backfillOrganizations(): Promise<MigrationStats> {
  const stats: MigrationStats = { processed: 0, encrypted: 0, fingerprinted: 0, skipped: 0, errors: 0 };
  console.log('\n--- 4. Migrating Organization Table ---');

  let cursor: number | undefined = undefined;

  while (true) {
    const orgs: Array<{
      id: number;
      panNumber: string | null;
      panFingerprint: string | null;
    }> = await prisma.organization.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      select: {
        id: true,
        panNumber: true,
        panFingerprint: true
      },
      orderBy: { id: 'asc' }
    });

    if (orgs.length === 0) break;

    for (const o of orgs) {
      stats.processed++;
      cursor = o.id;

      if (!o.panNumber) {
        stats.skipped++;
        continue;
      }

      const needsEncryption = !isEncrypted(o.panNumber);
      const needsFingerprint = !o.panFingerprint;

      if (!needsEncryption && !needsFingerprint) {
        stats.skipped++;
        continue;
      }

      try {
        const plainPan = o.panNumber;
        const encryptedPan = needsEncryption ? encryptField(plainPan) : o.panNumber;
        const fingerprint = needsFingerprint ? createHashFingerprint(plainPan, 'pan') : o.panFingerprint;

        if (!isDryRun) {
          await (prisma.organization as any).update({
            where: { id: o.id },
            data: {
              panNumber: encryptedPan,
              panFingerprint: fingerprint
            }
          });
        }

        if (needsEncryption) stats.encrypted++;
        if (needsFingerprint) stats.fingerprinted++;
      } catch (err) {
        console.error(`[Error] Failed to update Organization ID ${o.id}:`, err);
        stats.errors++;
      }
    }
  }

  return stats;
}

async function main() {
  console.log('====================================================');
  console.log(`🔐 PII Encryption & Blind Index Backfill Utility`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (No database modifications)' : 'LIVE (Encrypting & updating)'}`);
  console.log('====================================================');

  const startTime = Date.now();

  try {
    const userStats = await backfillUsers();
    console.log(`User: ${userStats.processed} checked, ${userStats.encrypted} encrypted, ${userStats.skipped} skipped, ${userStats.errors} errors`);

    const buyerStats = await backfillBuyerProfiles();
    console.log(`BuyerProfile: ${buyerStats.processed} checked, ${buyerStats.encrypted} encrypted, ${buyerStats.skipped} skipped, ${buyerStats.errors} errors`);

    const sellerStats = await backfillSellerProfiles();
    console.log(`SellerProfile: ${sellerStats.processed} checked, ${sellerStats.encrypted} encrypted, ${sellerStats.skipped} skipped, ${sellerStats.errors} errors`);

    const orgStats = await backfillOrganizations();
    console.log(`Organization: ${orgStats.processed} checked, ${orgStats.encrypted} encrypted, ${orgStats.skipped} skipped, ${orgStats.errors} errors`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n====================================================');
    console.log(`✅ Backfill completed in ${duration}s`);
    if (isDryRun) {
      console.log(`ℹ️ This was a dry run. To execute real changes, run without --dry-run.`);
    }
    console.log('====================================================\n');
  } catch (error) {
    console.error('Fatal error during backfill:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

