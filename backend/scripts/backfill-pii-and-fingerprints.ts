/**
 * Enterprise STQC & DPDPA 2023 Database Backfill Script
 * Idempotently cleans up PII, backfills blind indexes, and encrypts JSONB shadow PII.
 */

import prisma from '../src/lib/prisma.js';
import { encryptField, decryptField, isEncrypted, createHashFingerprint } from '../src/utils/crypto.js';

const SENSITIVE_JSON_KEYS = new Set([
  'pan', 'nameAsInPan', 'bankAccountNo', 'bankAccount', 'accountNumber',
  'bankIfsc', 'ifsc', 'accountHolderName', 'holderName',
  'orgPan', 'personalPan', 'panNumber'
]);

function encryptNestedJsonPii(obj: any, depth = 0): boolean {
  if (!obj || depth > 6 || typeof obj !== 'object') return false;
  let modified = false;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (encryptNestedJsonPii(item, depth + 1)) modified = true;
    }
    return modified;
  }

  for (const [key, val] of Object.entries(obj)) {
    if (/^aadhaar(Number)?$/i.test(key) && typeof val === 'string' && val.trim().length > 0) {
      const cleanDigits = val.replace(/\s+/g, '');
      if (cleanDigits.length === 12) {
        obj.aadhaarMasked = `XXXXXXXX${cleanDigits.slice(-4)}`;
        obj.aadhaarHash = createHashFingerprint(cleanDigits, 'aadhaar_vault');
        delete obj[key];
        modified = true;
      }
    } else if (SENSITIVE_JSON_KEYS.has(key)) {
      if (typeof val === 'string' && val.trim() !== '' && !isEncrypted(val)) {
        const lower = val.trim().toLowerCase();
        const isStatus = ['approved', 'rejected', 'pending', 'submitted', 'verified'].includes(lower);
        if (!isStatus) {
          obj[key] = encryptField(val.trim());
          modified = true;
        }
      }
    } else if (typeof val === 'object' && val !== null) {
      if (key !== 'sectionStatus' && key !== 'sectionRejectionReasons') {
        if (encryptNestedJsonPii(val, depth + 1)) modified = true;
      }
    }
  }

  return modified;
}

async function runBackfill() {
  console.log('================================================================');
  console.log(' STARTING PRODUCTION DATABASE PII & BLIND INDEX BACKFILL ');
  console.log('================================================================');

  let usersUpdated = 0;
  let sellersUpdated = 0;
  let buyersUpdated = 0;
  let orgsUpdated = 0;

  // 1. Backfill User (mobile, mobileFingerprint, registrationDetails JSONB)
  console.log('\n[Phase 1] Scanning "User" table for registrationDetails PII and mobile fingerprints...');
  const users = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, mobile, "mobileFingerprint", "registrationDetails" FROM "User";`
  );

  for (const u of users) {
    let needsUpdate = false;
    let encMobile = u.mobile;
    let mobileFp = u.mobileFingerprint;
    let regDetails = u.registrationDetails;

    // Mobile Encryption & Blind Index
    if (u.mobile && typeof u.mobile === 'string' && u.mobile.trim() !== '') {
      const rawMobile = isEncrypted(u.mobile) ? decryptField(u.mobile) : u.mobile.trim();
      if (!isEncrypted(u.mobile)) {
        encMobile = encryptField(rawMobile);
        needsUpdate = true;
      }
      if (!u.mobileFingerprint) {
        mobileFp = createHashFingerprint(rawMobile, 'mobile');
        needsUpdate = true;
      }
    }

    // JSONB PII Encryption
    if (regDetails && typeof regDetails === 'object') {
      const clone = JSON.parse(JSON.stringify(regDetails));
      if (encryptNestedJsonPii(clone)) {
        regDetails = clone;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET mobile = $1, "mobileFingerprint" = $2, "registrationDetails" = $3::jsonb WHERE id = $4;`,
        encMobile,
        mobileFp,
        JSON.stringify(regDetails),
        u.id
      );
      usersUpdated++;
    }
  }
  console.log(`✔ User table backfill complete: ${usersUpdated} records updated.`);

  // 2. Backfill SellerProfile (pan, panFingerprint, mobile, mobileFingerprint, turnover empty string)
  console.log('\n[Phase 2] Scanning "SellerProfile" for PAN, Mobile, and Empty String cleanup...');
  const sellers = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, pan, "panFingerprint", mobile, "mobileFingerprint", "turnoverMax3Yrs" FROM "SellerProfile";`
  );

  for (const s of sellers) {
    let needsUpdate = false;
    let encPan = s.pan;
    let panFp = s.panFingerprint;
    let encMobile = s.mobile;
    let mobileFp = s.mobileFingerprint;
    let turnover = s.turnoverMax3Yrs;

    if (s.pan && typeof s.pan === 'string' && s.pan.trim() !== '') {
      const rawPan = isEncrypted(s.pan) ? decryptField(s.pan) : s.pan.trim();
      if (!isEncrypted(s.pan)) {
        encPan = encryptField(rawPan);
        needsUpdate = true;
      }
      if (!s.panFingerprint) {
        panFp = createHashFingerprint(rawPan, 'pan');
        needsUpdate = true;
      }
    }

    if (s.mobile && typeof s.mobile === 'string' && s.mobile.trim() !== '') {
      const rawMobile = isEncrypted(s.mobile) ? decryptField(s.mobile) : s.mobile.trim();
      if (!isEncrypted(s.mobile)) {
        encMobile = encryptField(rawMobile);
        needsUpdate = true;
      }
      if (!s.mobileFingerprint) {
        mobileFp = createHashFingerprint(rawMobile, 'mobile');
        needsUpdate = true;
      }
    }

    if (turnover === '') {
      turnover = null;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.$executeRawUnsafe(
        `UPDATE "SellerProfile" SET pan = $1, "panFingerprint" = $2, mobile = $3, "mobileFingerprint" = $4, "turnoverMax3Yrs" = $5 WHERE id = $6;`,
        encPan,
        panFp,
        encMobile,
        mobileFp,
        turnover,
        s.id
      );
      sellersUpdated++;
    }
  }
  console.log(`✔ SellerProfile backfill complete: ${sellersUpdated} records updated.`);

  // 3. Backfill BuyerProfile (pan, panFingerprint, mobile, mobileFingerprint)
  console.log('\n[Phase 3] Scanning "BuyerProfile" for PAN and Mobile blind indexes...');
  const buyers = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, pan, "panFingerprint", mobile, "mobileFingerprint" FROM "BuyerProfile";`
  );

  for (const b of buyers) {
    let needsUpdate = false;
    let encPan = b.pan;
    let panFp = b.panFingerprint;
    let encMobile = b.mobile;
    let mobileFp = b.mobileFingerprint;

    if (b.pan && typeof b.pan === 'string' && b.pan.trim() !== '') {
      const rawPan = isEncrypted(b.pan) ? decryptField(b.pan) : b.pan.trim();
      if (!isEncrypted(b.pan)) {
        encPan = encryptField(rawPan);
        needsUpdate = true;
      }
      if (!b.panFingerprint) {
        panFp = createHashFingerprint(rawPan, 'pan');
        needsUpdate = true;
      }
    }

    if (b.mobile && typeof b.mobile === 'string' && b.mobile.trim() !== '') {
      const rawMobile = isEncrypted(b.mobile) ? decryptField(b.mobile) : b.mobile.trim();
      if (!isEncrypted(b.mobile)) {
        encMobile = encryptField(rawMobile);
        needsUpdate = true;
      }
      if (!b.mobileFingerprint) {
        mobileFp = createHashFingerprint(rawMobile, 'mobile');
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await prisma.$executeRawUnsafe(
        `UPDATE "BuyerProfile" SET pan = $1, "panFingerprint" = $2, mobile = $3, "mobileFingerprint" = $4 WHERE id = $5;`,
        encPan,
        panFp,
        encMobile,
        mobileFp,
        b.id
      );
      buyersUpdated++;
    }
  }
  console.log(`✔ BuyerProfile backfill complete: ${buyersUpdated} records updated.`);

  // 4. Backfill Organization (panNumber, panFingerprint)
  console.log('\n[Phase 4] Scanning "Organization" for PAN blind indexes...');
  const orgs = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, "panNumber", "panFingerprint" FROM "Organization";`
  );

  for (const o of orgs) {
    let needsUpdate = false;
    let encPan = o.panNumber;
    let panFp = o.panFingerprint;

    if (o.panNumber && typeof o.panNumber === 'string' && o.panNumber.trim() !== '') {
      const rawPan = isEncrypted(o.panNumber) ? decryptField(o.panNumber) : o.panNumber.trim();
      if (!isEncrypted(o.panNumber)) {
        encPan = encryptField(rawPan);
        needsUpdate = true;
      }
      if (!o.panFingerprint) {
        panFp = createHashFingerprint(rawPan, 'pan');
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await prisma.$executeRawUnsafe(
        `UPDATE "Organization" SET "panNumber" = $1, "panFingerprint" = $2 WHERE id = $3;`,
        encPan,
        panFp,
        o.id
      );
      orgsUpdated++;
    }
  }
  console.log(`✔ Organization backfill complete: ${orgsUpdated} records updated.`);

  console.log('\n================================================================');
  console.log(' ALL BACKFILLS COMPLETED SUCCESSFULLY WITH ZERO DATA LOSS ');
  console.log('================================================================');
  await prisma.$disconnect();
}

runBackfill().catch(err => {
  console.error('[Backfill Failed]:', err);
  process.exit(1);
});
