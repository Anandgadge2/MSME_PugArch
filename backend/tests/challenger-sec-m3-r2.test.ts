import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  isPrivateDocument,
  isEnvelopeEncrypted,
  encryptBufferEnvelope,
  decryptBufferEnvelope,
  gcpStorageProvider,
  ENVELOPE_MAGIC_PREFIX,
  ALT_ENVELOPE_MAGIC_PREFIX
} from '../src/services/storage/gcp-storage.service.js';
import { getKmsProvider } from '../src/utils/crypto.js';

console.log('======================================================================');
console.log('  CHALLENGER SEC M3 R2: EMPIRICAL ADVERSARIAL VERIFICATION SUITE      ');
console.log('======================================================================\n');

const createdGcsKeys: string[] = [];
const createdLocalFiles: string[] = [];

function registerGcsKey(key: string): string {
  createdGcsKeys.push(key);
  return key;
}

function registerLocalFile(filePath: string): string {
  createdLocalFiles.push(filePath);
  return filePath;
}

async function cleanupAll(): Promise<void> {
  console.log('\n[CLEANUP] Removing test artifacts from local disk and storage...');
  for (const fp of createdLocalFiles) {
    try {
      if (fs.existsSync(fp)) {
        fs.unlinkSync(fp);
      }
    } catch {
      // Ignore cleanup error
    }
  }
  for (const k of createdGcsKeys) {
    try {
      await gcpStorageProvider.deleteFile(k).catch(() => null);
    } catch {
      // Ignore cleanup error
    }
  }
}

async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of readableStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function runEmpiricalSuite(): Promise<void> {
  let passedAssertions = 0;
  let testGroup = 0;

  function markPassed(desc: string) {
    passedAssertions++;
    console.log(`  ✔ [PASS ${passedAssertions}] ${desc}`);
  }

  try {
    // =========================================================================
    // OBJECTIVE 1: CATEGORY SCOPING WITH LEADING SLASHES & NORMALIZATION
    // =========================================================================
    testGroup++;
    console.log(`\n--- TEST GROUP ${testGroup}: Category Scoping with Leading Slashes & Path Normalization ---`);

    // 1.1 Specified required paths with leading slashes
    assert.equal(
      isPrivateDocument({}, '/kyc/aadhaar.pdf'),
      true,
      "'/kyc/aadhaar.pdf' with empty options must be identified as private"
    );
    markPassed("Leading slash path '/kyc/aadhaar.pdf' identified as private");

    assert.equal(
      isPrivateDocument({}, '/documents/invoice.pdf'),
      true,
      "'/documents/invoice.pdf' with empty options must be identified as private"
    );
    markPassed("Leading slash path '/documents/invoice.pdf' identified as private");

    assert.equal(
      isPrivateDocument({}, '/sellers/123/license.pdf'),
      true,
      "'/sellers/123/license.pdf' with empty options must be identified as private"
    );
    markPassed("Leading slash path '/sellers/123/license.pdf' identified as private");

    // 1.2 Additional paths with single & multiple leading slashes
    const leadingSlashCases = [
      { options: {}, key: '/buyers/456/profile.pdf', label: '/buyers/456/profile.pdf' },
      { options: {}, key: '/pbg/guarantee.pdf', label: '/pbg/guarantee.pdf' },
      { options: {}, key: '/cheques/cancelled.png', label: '/cheques/cancelled.png' },
      { options: {}, key: '/invoices/inv_2026.pdf', label: '/invoices/inv_2026.pdf' },
      { options: {}, key: '/purchase-orders/po_101.pdf', label: '/purchase-orders/po_101.pdf' },
      { options: {}, key: '///kyc///aadhaar_multi.pdf', label: '///kyc/// multi-leading-slash' },
      { options: {}, key: '////documents////nested//inv.pdf', label: '////documents//// multi-leading-slash' },
      { options: { folder: '/kyc/' }, key: 'aadhaar.pdf', label: "{ folder: '/kyc/' }" },
      { options: { folder: '/documents' }, key: 'invoice.pdf', label: "{ folder: '/documents' }" },
      { options: { folder: '/sellers/123' }, key: 'license.pdf', label: "{ folder: '/sellers/123' }" },
      { options: { folder: '/buyers/456/' }, key: 'profile.pdf', label: "{ folder: '/buyers/456/' }" },
      { options: { folder: '\\kyc\\aadhaar.pdf' }, key: '\\kyc\\aadhaar.pdf', label: 'Windows backslash \\kyc\\' },
      { options: { folder: '\\sellers\\123\\license.pdf' }, key: '\\sellers\\123\\license.pdf', label: 'Windows backslash \\sellers\\' },
      { options: { folder: '  /kyc/  ' }, key: '  /kyc/doc.pdf  ', label: 'Whitespace + leading slash' }
    ];

    for (const sc of leadingSlashCases) {
      const isPriv = isPrivateDocument(sc.options, sc.key);
      assert.equal(isPriv, true, `Expected ${sc.label} to be identified as private document`);
      markPassed(`Path variant [${sc.label}] correctly scoped to private`);
    }

    // =========================================================================
    // OBJECTIVE 2: PLURAL CATEGORIES & ENTITY TYPES ENVELOPE ENCRYPTION
    // =========================================================================
    testGroup++;
    console.log(`\n--- TEST GROUP ${testGroup}: Plural Categories & Entity Types Scoping and Storage Encryption ---`);

    const pluralTestCases = [
      { options: { folder: 'sellers' }, key: 'sellers/123/gst.pdf', name: 'folder: sellers' },
      { options: { folder: 'buyers' }, key: 'buyers/456/order.pdf', name: 'folder: buyers' },
      { options: { metadata: { entityType: 'seller_document' } }, key: 'doc.pdf', name: 'metadata: seller_document' },
      { options: { metadata: { entityType: 'buyer_document' } }, key: 'doc.pdf', name: 'metadata: buyer_document' },
      { options: { folder: 'sellers/123', metadata: { entityType: 'seller_document' } }, key: 'sellers/123/license.pdf', name: 'compound sellers/123 + seller_document' },
      { options: { folder: 'buyers/456', metadata: { entityType: 'buyer_document' } }, key: 'buyers/456/onboarding.pdf', name: 'compound buyers/456 + buyer_document' },
      { options: { folder: 'documents' }, key: 'documents/contract.pdf', name: 'folder: documents' },
      { options: { folder: 'purchase_orders' }, key: 'purchase_orders/po.pdf', name: 'folder: purchase_orders' },
      { options: { folder: 'contracts' }, key: 'contracts/tender.pdf', name: 'folder: contracts' }
    ];

    for (const pt of pluralTestCases) {
      assert.equal(isPrivateDocument(pt.options, pt.key), true, `Plural category ${pt.name} must evaluate to private`);
      markPassed(`Plural category check: ${pt.name} evaluated to private`);
    }

    // 2.2 Live Upload and Envelope Verification for Plural Entities ('sellers' & 'buyers')
    console.log('\n  Executing live storage uploads for plural entities:');
    const entitiesToUpload = [
      { folder: 'sellers', entityType: 'seller_document', filename: `seller_cert_${Date.now()}.pdf`, secret: `CONFIDENTIAL_SELLER_CERT_DATA_${Date.now()}` },
      { folder: 'buyers', entityType: 'buyer_document', filename: `buyer_po_${Date.now()}.pdf`, secret: `CONFIDENTIAL_BUYER_PURCHASE_DATA_${Date.now()}` }
    ];

    for (const ent of entitiesToUpload) {
      const payload = Buffer.from(ent.secret, 'utf8');
      const uploadRes = await gcpStorageProvider.uploadBuffer(payload, ent.filename, {
        folder: ent.folder,
        mimeType: 'application/pdf',
        originalName: ent.filename,
        metadata: { entityType: ent.entityType }
      });
      registerGcsKey(uploadRes.key);
      const localMirror = path.resolve(process.cwd(), 'uploads', uploadRes.key);
      registerLocalFile(localMirror);

      // Verify raw stored bytes directly
      const rawStoredBytes = await streamToBuffer(gcpStorageProvider.getRawReadStream(uploadRes.key));

      // Assert envelope encrypted
      assert.equal(isEnvelopeEncrypted(rawStoredBytes), true, `Raw stored bytes for [${uploadRes.key}] must be envelope-encrypted`);
      assert.equal(
        rawStoredBytes.subarray(0, ENVELOPE_MAGIC_PREFIX.length).toString('utf8'),
        ENVELOPE_MAGIC_PREFIX,
        `Raw stored bytes for [${uploadRes.key}] must start with ${ENVELOPE_MAGIC_PREFIX}`
      );

      // Assert plaintext is NEVER present in stored ciphertext
      assert.equal(
        rawStoredBytes.includes(payload),
        false,
        `Plaintext secret must NEVER be visible in stored bytes for [${uploadRes.key}]`
      );

      // Assert transparent streaming decryption
      const decryptedStream = gcpStorageProvider.createReadStream(uploadRes.key);
      const streamedBytes = await streamToBuffer(decryptedStream);
      assert.equal(Buffer.compare(streamedBytes, payload), 0, `Decrypted stream must match original plaintext for [${uploadRes.key}]`);

      markPassed(`Plural category [${ent.folder}] uploaded as envelope-encrypted ciphertext and transparently decrypted`);
    }

    // =========================================================================
    // OBJECTIVE 3: PUBLIC CATEGORIES & EXPLICIT ISPUBLIC BYPASS
    // =========================================================================
    testGroup++;
    console.log(`\n--- TEST GROUP ${testGroup}: Public Categories & Explicit isPublic Bypass ---`);

    const publicCategories = ['banners', 'products', 'company-logos', 'org-logos', 'category-photos', 'videos'];
    for (const pubFolder of publicCategories) {
      assert.equal(
        isPrivateDocument({ folder: pubFolder }, `${pubFolder}/asset.png`),
        false,
        `Public folder [${pubFolder}] must NOT be identified as private`
      );
      markPassed(`Public folder [${pubFolder}] bypassed private scoping`);
    }

    const publicEntityTypes = ['banner', 'product', 'product_image', 'logo', 'company_logo', 'organization_logo', 'stamp', 'signature', 'public'];
    for (const pubType of publicEntityTypes) {
      assert.equal(
        isPrivateDocument({ metadata: { entityType: pubType } }, `file.png`),
        false,
        `Public entityType [${pubType}] must NOT be identified as private`
      );
      markPassed(`Public entityType [${pubType}] bypassed private scoping`);
    }

    // 3.2 Explicit isPublic: true override on private folders
    const privateFoldersForOverride = ['kyc', 'sellers', 'buyers', 'invoices', 'pbg', 'cheques', 'gst', 'documents'];
    for (const privFolder of privateFoldersForOverride) {
      assert.equal(
        isPrivateDocument({ folder: privFolder, isPublic: true }, `${privFolder}/public_notice.pdf`),
        false,
        `options.isPublic === true MUST override private folder [${privFolder}]`
      );
      markPassed(`isPublic: true successfully overrode private folder [${privFolder}]`);
    }

    // 3.3 Live Upload Verification: Public categories must store raw unencrypted bytes without envelope headers
    console.log('\n  Executing live storage uploads for public assets:');
    const publicUploads = [
      { folder: 'banners', filename: `banner_${Date.now()}.png`, mimeType: 'image/png' },
      { folder: 'products', filename: `product_${Date.now()}.jpg`, mimeType: 'image/jpeg' },
      { folder: 'company-logos', filename: `logo_${Date.now()}.png`, mimeType: 'image/png' },
      { folder: 'kyc', filename: `kyc_public_guide_${Date.now()}.pdf`, mimeType: 'application/pdf', isPublic: true }
    ];

    for (const pub of publicUploads) {
      const pubPayload = crypto.randomBytes(4096);
      const uploadRes = await gcpStorageProvider.uploadBuffer(pubPayload, pub.filename, {
        folder: pub.folder,
        mimeType: pub.mimeType,
        originalName: pub.filename,
        isPublic: pub.isPublic ?? false
      });
      registerGcsKey(uploadRes.key);
      const localMirror = path.resolve(process.cwd(), 'uploads', uploadRes.key);
      registerLocalFile(localMirror);

      const rawBytes = await streamToBuffer(gcpStorageProvider.getRawReadStream(uploadRes.key));

      // Must NOT be envelope encrypted
      assert.equal(isEnvelopeEncrypted(rawBytes), false, `Public object [${uploadRes.key}] must NOT be envelope encrypted`);
      assert.equal(
        rawBytes.subarray(0, ENVELOPE_MAGIC_PREFIX.length).toString('utf8') === ENVELOPE_MAGIC_PREFIX,
        false,
        `Public object [${uploadRes.key}] must NOT start with magic prefix`
      );

      // Verbatim exact match
      assert.equal(Buffer.compare(rawBytes, pubPayload), 0, `Stored bytes must match original verbatim for public [${uploadRes.key}]`);

      // Read via createReadStream
      const stream = gcpStorageProvider.createReadStream(uploadRes.key);
      const streamedBytes = await streamToBuffer(stream);
      assert.equal(Buffer.compare(streamedBytes, pubPayload), 0, `Streamed bytes must match original verbatim for public [${uploadRes.key}]`);

      markPassed(`Public object [${uploadRes.key}] stored verbatim without headers and streamed cleanly`);
    }

    // =========================================================================
    // OBJECTIVE 4: BIT-LEVEL CIPHERTEXT & HEADER TAMPERING (AUTH TAG ENFORCEMENT)
    // =========================================================================
    testGroup++;
    console.log(`\n--- TEST GROUP ${testGroup}: Bit-Level Ciphertext & Header Tampering ---`);

    const confidentialSecret = Buffer.from('TOP_SECRET_RESERVED_DISCLOSURE_FINANCIAL_CONTRACT_2026', 'utf8');
    const validEnvelope = await encryptBufferEnvelope(confidentialSecret);

    assert.equal(isEnvelopeEncrypted(validEnvelope), true, 'Generated buffer must be envelope encrypted');

    // 4.1 Header Format Validation: MSME_ENV:v1:<encDek>:<ivHex>:<tagHex>\n<ciphertext>
    const newlineIdx = validEnvelope.indexOf('\n');
    assert.ok(newlineIdx > 0, 'Header must contain newline separator');
    const headerStr = validEnvelope.subarray(0, newlineIdx).toString('utf8');
    const tokens = headerStr.split(':');

    assert.equal(tokens[0], 'MSME_ENV', "Header token 0 must be 'MSME_ENV'");
    assert.equal(tokens[1], 'v1', "Header token 1 must be 'v1'");

    const tagHex = tokens[tokens.length - 1];
    const ivHex = tokens[tokens.length - 2];
    assert.equal(ivHex.length, 24, 'IV must be 24 hex characters (12 bytes)');
    assert.equal(tagHex.length, 32, 'Auth tag must be 32 hex characters (16 bytes)');

    const ciphertext = validEnvelope.subarray(newlineIdx + 1);
    assert.equal(ciphertext.length, confidentialSecret.length, 'AES-256-GCM ciphertext length must equal plaintext length');
    markPassed('Envelope header strictly complies with MSME_ENV:v1:<encDek>:<ivHex>:<tagHex>\\n format');

    // 4.2 Single-Bit Ciphertext Flipping at offsets (start, middle, end)
    console.log('\n  Testing single-bit flipping across ciphertext boundaries:');
    const testOffsets = [
      { name: 'first byte (offset 0)', idx: 0 },
      { name: 'middle byte', idx: Math.floor(ciphertext.length / 2) },
      { name: 'last byte', idx: ciphertext.length - 1 }
    ];

    for (const { name, idx } of testOffsets) {
      const tampered = Buffer.from(validEnvelope);
      // Ciphertext starts at newlineIdx + 1
      tampered[newlineIdx + 1 + idx] ^= 0x01; // flip 1 bit

      let decryptedData: Buffer | null = null;
      let caughtError: any = null;

      try {
        decryptedData = await decryptBufferEnvelope(tampered);
      } catch (err) {
        caughtError = err;
      }

      assert.ok(caughtError, `Tampering at ${name} must throw an error`);
      assert.equal(decryptedData, null, `Tampered payload must NEVER release decrypted plaintext`);
      assert.ok(
        String(caughtError?.message || caughtError).toLowerCase().includes('tag') ||
        String(caughtError?.message || caughtError).toLowerCase().includes('failed'),
        `Error must signify authentication tag or decryption failure, got: ${caughtError?.message}`
      );
      markPassed(`Bit-flip at ${name} strictly rejected by AES-GCM authentication tag verification`);
    }

    // 4.3 Tampering with Authentication Tag in Header
    console.log('\n  Testing header tampering:');
    const badTagTokens = [...tokens];
    const flippedTagByte = (parseInt(badTagTokens[badTagTokens.length - 1][0], 16) ^ 1).toString(16);
    badTagTokens[badTagTokens.length - 1] = flippedTagByte + badTagTokens[badTagTokens.length - 1].slice(1);
    const badTagHeader = badTagTokens.join(':') + '\n';
    const badTagEnvelope = Buffer.concat([Buffer.from(badTagHeader, 'utf8'), ciphertext]);

    await assert.rejects(
      async () => decryptBufferEnvelope(badTagEnvelope),
      /failed|tag/i,
      'Corrupted authentication tag in header must be rejected'
    );
    markPassed('Header authentication tag tampering rejected');

    // 4.4 Tampering with IV in Header
    const badIvTokens = [...tokens];
    const flippedIvByte = (parseInt(badIvTokens[badIvTokens.length - 2][0], 16) ^ 1).toString(16);
    badIvTokens[badIvTokens.length - 2] = flippedIvByte + badIvTokens[badIvTokens.length - 2].slice(1);
    const badIvHeader = badIvTokens.join(':') + '\n';
    const badIvEnvelope = Buffer.concat([Buffer.from(badIvHeader, 'utf8'), ciphertext]);

    await assert.rejects(
      async () => decryptBufferEnvelope(badIvEnvelope),
      /failed|tag/i,
      'Tampered IV in header must cause authentication tag rejection'
    );
    markPassed('Header IV tampering rejected');

    // 4.5 Tampering with Wrapped DEK in Header
    const badDekTokens = [...tokens];
    badDekTokens[2] = badDekTokens[2].slice(0, -2) + (badDekTokens[2].endsWith('AA') ? 'BB' : 'AA');
    const badDekHeader = badDekTokens.join(':') + '\n';
    const badDekEnvelope = Buffer.concat([Buffer.from(badDekHeader, 'utf8'), ciphertext]);

    await assert.rejects(
      async () => decryptBufferEnvelope(badDekEnvelope),
      /failed|tag|unsupported|unable|invalid/i,
      'Corrupted wrapped DEK must fail unwrapping'
    );
    markPassed('Header wrapped DEK tampering rejected');

    // 4.6 Header Formatting Edge Cases
    // Missing newline delimiter
    const missingNewline = Buffer.from(`MSME_ENV:v1:dek:123456789012345678901234:12345678901234567890123456789012:cipher`, 'utf8');
    await assert.rejects(
      async () => decryptBufferEnvelope(missingNewline),
      /newline delimiter missing/i,
      'Missing newline delimiter must throw'
    );
    markPassed('Missing newline delimiter rejected');

    // Insufficient tokens in header
    const incompleteTokens = Buffer.from(`MSME_ENV:v1:only_two\nCiphertext`, 'utf8');
    await assert.rejects(
      async () => decryptBufferEnvelope(incompleteTokens),
      /Corrupted envelope encryption header/i,
      'Insufficient tokens in header must throw'
    );
    markPassed('Malformed header with insufficient tokens rejected');

    // 4.7 Stream Reading on Tampered Stored File
    console.log('\n  Testing createReadStream error propagation on tampered storage object:');
    const corruptKey = `kyc/corrupt_test_${Date.now()}.bin`;
    const corruptLocalPath = path.resolve(process.cwd(), 'uploads', corruptKey);
    registerLocalFile(corruptLocalPath);
    fs.mkdirSync(path.dirname(corruptLocalPath), { recursive: true });

    const tamperedPayload = Buffer.from(validEnvelope);
    tamperedPayload[tamperedPayload.length - 1] ^= 0x55; // corrupt last byte of ciphertext
    fs.writeFileSync(corruptLocalPath, tamperedPayload);

    const corruptStream = gcpStorageProvider.createReadStream(corruptKey);
    let streamFailed = false;
    let streamReceivedData = false;

    await new Promise<void>((resolve) => {
      corruptStream.on('data', () => {
        streamReceivedData = true;
      });
      corruptStream.on('error', () => {
        streamFailed = true;
        resolve();
      });
      corruptStream.on('end', () => {
        resolve();
      });
    });

    assert.equal(streamFailed, true, 'createReadStream must emit error on tampered stored ciphertext');
    assert.equal(streamReceivedData, false, 'createReadStream must NEVER emit data on tampered stored ciphertext');
    markPassed('createReadStream emitted error and withheld data on tampered stored file');

    // =========================================================================
    // OBJECTIVE 5: ROUND-TRIP STREAMING UPLOAD & DOWNLOAD ACROSS SIZES
    // =========================================================================
    testGroup++;
    console.log(`\n--- TEST GROUP ${testGroup}: Round-Trip Streaming Upload & Download Across Sizes ---`);

    const payloadSizeSuites = [
      { name: '100 Bytes', size: 100 },
      { name: '1 MB', size: 1024 * 1024 },
      { name: '3 MB', size: 3 * 1024 * 1024 }
    ];

    for (const { name, size } of payloadSizeSuites) {
      console.log(`\n  Executing round-trip streaming test for size: ${name} (${size} bytes)...`);
      const originalPayload = crypto.randomBytes(size);
      const testKey = `documents/roundtrip_${size}_${Date.now()}.bin`;

      // 1. Upload buffer via uploadBuffer
      const uploadRes = await gcpStorageProvider.uploadBuffer(originalPayload, testKey, {
        folder: 'documents',
        mimeType: 'application/octet-stream',
        originalName: `roundtrip_${size}.bin`
      });
      registerGcsKey(uploadRes.key);
      const localMirror = path.resolve(process.cwd(), 'uploads', uploadRes.key);
      registerLocalFile(localMirror);

      // 2. Inspect raw bytes in storage (GCS or disk) without decryption
      const rawStoredBytes = await streamToBuffer(gcpStorageProvider.getRawReadStream(uploadRes.key));

      // Must be envelope encrypted
      assert.equal(isEnvelopeEncrypted(rawStoredBytes), true, `Stored object for ${name} must be envelope encrypted`);
      assert.equal(
        rawStoredBytes.subarray(0, ENVELOPE_MAGIC_PREFIX.length).toString('utf8'),
        ENVELOPE_MAGIC_PREFIX,
        `Stored object for ${name} must start with ${ENVELOPE_MAGIC_PREFIX}`
      );

      // Plaintext must not exist anywhere in raw bytes
      assert.equal(
        rawStoredBytes.includes(originalPayload.subarray(0, Math.min(originalPayload.length, 64))),
        false,
        `Plaintext must NOT appear in raw stored bytes for ${name}`
      );

      // 3. Download and transparently decrypt via createReadStream()
      const readStream = gcpStorageProvider.createReadStream(uploadRes.key);
      const decryptedStreamBuffer = await streamToBuffer(readStream);

      assert.equal(decryptedStreamBuffer.length, originalPayload.length, `Decrypted stream length must match original for ${name}`);
      assert.equal(
        Buffer.compare(originalPayload, decryptedStreamBuffer),
        0,
        `Decrypted stream bytes must match original 100% byte-for-byte for ${name}`
      );

      // 4. Retrieve via getFileBuffer()
      const fileBuffer = await gcpStorageProvider.getFileBuffer(uploadRes.key);
      assert.equal(fileBuffer.length, originalPayload.length, `getFileBuffer length must match original for ${name}`);
      assert.equal(Buffer.compare(originalPayload, fileBuffer), 0, `getFileBuffer bytes must match original for ${name}`);

      markPassed(`Round-trip streaming upload & download verified for ${name} (${size} bytes)`);
    }

    // 5.4 Boundary condition: 0-byte (Empty) buffer round-trip
    console.log('\n  Testing boundary condition: zero-byte (0-byte) buffer:');
    const emptyPayload = Buffer.alloc(0);
    const emptyEncrypted = await encryptBufferEnvelope(emptyPayload);
    assert.equal(isEnvelopeEncrypted(emptyEncrypted), true, 'Empty payload must still produce valid envelope structure');
    const emptyDecrypted = await decryptBufferEnvelope(emptyEncrypted);
    assert.equal(emptyDecrypted.length, 0, 'Decrypted empty payload must have 0 length');
    markPassed('Zero-byte payload encrypted and decrypted cleanly');

    // 5.5 CWE-226: Memory Hygiene Verification on Ephemeral DEK
    console.log('\n  Testing CWE-226 ephemeral DEK buffer zeroization:');
    const capturedEncryptDeks: Buffer[] = [];
    const originalRandomBytes = crypto.randomBytes;
    (crypto as any).randomBytes = function (size: number) {
      const buf = originalRandomBytes.call(crypto, size);
      if (size === 32) {
        capturedEncryptDeks.push(buf);
      }
      return buf;
    };

    const ephemeralProbe = Buffer.from('ZEROIZATION_EMPIRICAL_PROBE_2026', 'utf8');
    await encryptBufferEnvelope(ephemeralProbe);
    (crypto as any).randomBytes = originalRandomBytes;

    assert.ok(capturedEncryptDeks.length > 0, 'Must have captured DEK buffer during encryption');
    const dekBuf = capturedEncryptDeks[0];
    assert.equal(dekBuf.every(b => b === 0), true, 'All 32 bytes of ephemeral DEK must be zeroized to 0x00');
    markPassed('CWE-226 ephemeral DEK zeroization verified (all 32 bytes = 0x00)');

    console.log('\n======================================================================');
    console.log(`  ALL CHALLENGE TESTS PASSED: ${passedAssertions} EMPIRICAL ASSERTIONS VERIFIED!`);
    console.log('======================================================================\n');

  } finally {
    await cleanupAll();
  }
}

runEmpiricalSuite()
  .then(() => {
    console.log('CHALLENGER SUITE EXIT: SUCCESS (Code 0)');
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('\n❌ CHALLENGER ADVERSARIAL SUITE FAILED:');
    console.error(err);
    await cleanupAll();
    process.exit(1);
  });
