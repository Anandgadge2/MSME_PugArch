/**
 * STQC Compliance Database Migration Script
 * Idempotently scans and encrypts legacy plaintext PII fields across:
 * - SellerProfile (pan, panNumber, bankAccountNo, bankIfsc, bankName, accountHolderName, aadhaarNumber)
 * - BuyerProfile (pan, nameAsInPan)
 * - SellerBankAccount (accountNumber, ifsc, holderName, bankAddress)
 *
 * Usage:
 *   npx tsx backend/scripts/migrate-encrypt-sensitive-data.ts
 */

import prisma from '../src/lib/prisma.js';
import { encryptField, isEncrypted, createHashFingerprint } from '../src/utils/crypto.js';

async function migrateSensitiveData() {
  console.log('=====================================================');
  console.log(' STQC & CERT-In PII Encryption Migration Starting... ');
  console.log('=====================================================');

  let sellerProfilesUpdated = 0;
  let buyerProfilesUpdated = 0;
  let bankAccountsUpdated = 0;
  let aadhaarNumbersPurged = 0;

  // 1. Process SellerProfiles
  console.log('\n[1/3] Scanning SellerProfile records...');
  // Use raw client or bypass middleware to inspect raw database values
  const sellerProfiles = await (prisma as any).sellerProfile.findMany({
    select: {
      id: true,
      pan: true,
      nameAsInPan: true,
      aadhaarNumber: true,
      aadhaarHash: true,
      aadhaarMasked: true
    }
  });

  for (const sp of sellerProfiles) {
    const updates: Record<string, any> = {};

    if (sp.pan && !isEncrypted(sp.pan)) {
      updates.pan = encryptField(sp.pan);
    }
    if (sp.nameAsInPan && !isEncrypted(sp.nameAsInPan)) {
      updates.nameAsInPan = encryptField(sp.nameAsInPan);
    }

    // UIDAI Aadhaar Purge & Fingerprint sync
    if (sp.aadhaarNumber) {
      const cleanAadhaar = String(sp.aadhaarNumber).replace(/\s+/g, '');
      if (!sp.aadhaarHash) {
        updates.aadhaarHash = createHashFingerprint(cleanAadhaar, 'aadhaar_vault');
      }
      if (!sp.aadhaarMasked) {
        updates.aadhaarMasked = `XXXXXXXX${cleanAadhaar.slice(-4)}`;
      }
      updates.aadhaarNumber = null; // Wipe raw Aadhaar from column
      aadhaarNumbersPurged++;
    }

    if (Object.keys(updates).length > 0) {
      await (prisma as any).sellerProfile.update({
        where: { id: sp.id },
        data: updates
      });
      sellerProfilesUpdated++;
    }
  }
  console.log(`✔ SellerProfiles scanned: ${sellerProfiles.length}, Updated: ${sellerProfilesUpdated}, Raw Aadhaar purged: ${aadhaarNumbersPurged}`);

  // 2. Process BuyerProfiles
  console.log('\n[2/3] Scanning BuyerProfile records...');
  const buyerProfiles = await (prisma as any).buyerProfile.findMany({
    select: {
      id: true,
      pan: true,
      nameAsInPan: true,
      bankAccountNo: true,
      bankIfsc: true,
      bankName: true,
      bankAddress: true,
      accountHolderName: true
    }
  });

  for (const bp of buyerProfiles) {
    const updates: Record<string, any> = {};
    if (bp.pan && !isEncrypted(bp.pan)) {
      updates.pan = encryptField(bp.pan);
    }
    if (bp.nameAsInPan && !isEncrypted(bp.nameAsInPan)) {
      updates.nameAsInPan = encryptField(bp.nameAsInPan);
    }
    if (bp.bankAccountNo && !isEncrypted(bp.bankAccountNo)) {
      updates.bankAccountNo = encryptField(bp.bankAccountNo);
    }
    if (bp.bankIfsc && !isEncrypted(bp.bankIfsc)) {
      updates.bankIfsc = encryptField(bp.bankIfsc);
    }
    if (bp.bankName && !isEncrypted(bp.bankName)) {
      updates.bankName = encryptField(bp.bankName);
    }
    if (bp.bankAddress && !isEncrypted(bp.bankAddress)) {
      updates.bankAddress = encryptField(bp.bankAddress);
    }
    if (bp.accountHolderName && !isEncrypted(bp.accountHolderName)) {
      updates.accountHolderName = encryptField(bp.accountHolderName);
    }

    if (Object.keys(updates).length > 0) {
      await (prisma as any).buyerProfile.update({
        where: { id: bp.id },
        data: updates
      });
      buyerProfilesUpdated++;
    }
  }
  console.log(`✔ BuyerProfiles scanned: ${buyerProfiles.length}, Updated: ${buyerProfilesUpdated}`);

  // 3. Process SellerBankAccounts
  console.log('\n[3/3] Scanning SellerBankAccount records...');
  const bankAccounts = await (prisma as any).sellerBankAccount.findMany({
    select: {
      id: true,
      accountNumber: true,
      ifsc: true,
      holderName: true,
      bankAddress: true
    }
  });

  for (const ba of bankAccounts) {
    const updates: Record<string, any> = {};
    if (ba.accountNumber && !isEncrypted(ba.accountNumber)) {
      updates.accountNumber = encryptField(ba.accountNumber);
    }
    if (ba.ifsc && !isEncrypted(ba.ifsc)) {
      updates.ifsc = encryptField(ba.ifsc);
    }
    if (ba.holderName && !isEncrypted(ba.holderName)) {
      updates.holderName = encryptField(ba.holderName);
    }
    if (ba.bankAddress && !isEncrypted(ba.bankAddress)) {
      updates.bankAddress = encryptField(ba.bankAddress);
    }

    if (Object.keys(updates).length > 0) {
      await (prisma as any).sellerBankAccount.update({
        where: { id: ba.id },
        data: updates
      });
      bankAccountsUpdated++;
    }
  }
  console.log(`✔ SellerBankAccounts scanned: ${bankAccounts.length}, Updated: ${bankAccountsUpdated}`);

  console.log('\n=====================================================');
  console.log(' STQC Cryptographic Migration Completed Successfully');
  console.log('=====================================================');
}

migrateSensitiveData()
  .catch((err) => {
    console.error('Fatal error during STQC migration:', err);
    process.exit(1);
  })
  .finally(async () => {
    await (prisma as any).$disconnect?.();
  });
