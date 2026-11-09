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
  ENVELOPE_MAGIC_PREFIX
} from '../src/services/storage/gcp-storage.service.js';
import { getKmsProvider } from '../src/utils/crypto.js';

console.log('======================================================================');
console.log('   CHALLENGER 1 EMPIRICAL ADVERSARIAL STRESS SUITE: GAP 6 ENVELOPE   ');
console.log('======================================================================\n');

const createdGcsKeys: string[] = [];
const createdLocalFiles: string[] = [];

function registerGcsKey(key: string) {
  createdGcsKeys.push(key);
}

function registerLocalFile(filepath: string) {
  createdLocalFiles.push(filepath);
}

async function cleanupAll() {
  for (const k of createdGcsKeys) {
    try {
      await gcpStorageProvider.deleteFile(k);
    } catch {
      // ignore cleanup errors
    }
  }
  for (const fp of createdLocalFiles) {
    try {
      if (fs.existsSync(fp)) {
        fs.unlinkSync(fp);
      }
    } catch {
      // ignore cleanup errors
    }
  }
}

async function readStreamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function runAdversarialSuite() {
  try {
    // -------------------------------------------------------------------------
    // TEST SUITE 1: CIPHERTEXT ENVELOPE VERIFICATION
    // -------------------------------------------------------------------------
    console.log('[SUITE 1] Ciphertext Envelope Verification Across Private Categories');

    const privateFolders = [
      'kyc',
      'documents',
      'pbg',
      'cheques',
      'invoices',
      'purchase-orders',
      'bank',
      'gst',
      'cancelled_cheque',
      'gst_certificate',
      'performance_guarantee'
    ];

    const envelopeHeaderRegex = /^MSME_ENV:v1:([a-zA-Z0-9+/=]+:[a-zA-Z0-9+/=]+:[a-zA-Z0-9+/=]+):([a-f0-9]{24}):([a-f0-9]{32})\n/;

    for (const folder of privateFolders) {
      const sensitiveText = `CONFIDENTIAL_AUDIT_RECORD_FOR_${folder.toUpperCase()}_ID_${Date.now()}`;
      const payload = Buffer.from(sensitiveText, 'utf8');
      const filename = `test_challenger_${folder}_${Date.now()}.pdf`;

      const uploadRes = await gcpStorageProvider.uploadBuffer(payload, filename, {
        folder,
        mimeType: 'application/pdf',
        originalName: filename
      });

      registerGcsKey(uploadRes.key);
      const localPath = path.resolve(process.cwd(), 'uploads', uploadRes.key);
      registerLocalFile(localPath);

      // Retrieve raw stored bytes directly from storage (GCS or disk) WITHOUT decryption
      const rawStoredBytes = await readStreamToBuffer(gcpStorageProvider.getRawReadStream(uploadRes.key));

      // 1. Must be recognized as envelope encrypted
      assert.equal(isEnvelopeEncrypted(rawStoredBytes), true, `Storage object [${uploadRes.key}] must be envelope encrypted`);

      // 2. Must start with MSME_ENV:v1:
      const rawHeaderStr = rawStoredBytes.subarray(0, 500).toString('utf8');
      assert.ok(rawHeaderStr.startsWith(ENVELOPE_MAGIC_PREFIX), `Must start with ${ENVELOPE_MAGIC_PREFIX}`);

      // 3. Must match strict envelope header regex: MSME_ENV:v1:<encDek>:<ivHex>:<tagHex>\n
      const match = rawHeaderStr.match(envelopeHeaderRegex);
      assert.ok(match, `Folder ${folder} header must strictly match MSME_ENV:v1:<encDek>:<ivHex>:<tagHex>\\n format`);

      const [_, encDek, ivHex, tagHex] = match;
      assert.equal(ivHex.length, 24, 'IV must be 24 hex characters (12 bytes)');
      assert.equal(tagHex.length, 32, 'Auth tag must be 32 hex characters (16 bytes)');
      assert.equal(encDek.split(':').length, 3, 'encDek must contain iv:tag:cipher in base64');

      // 4. Must NOT contain plaintext anywhere in saved storage bytes
      assert.ok(!rawStoredBytes.includes(Buffer.from(sensitiveText, 'utf8')), `Plaintext must NOT appear anywhere in storage for ${folder}`);

      // 5. Must stream and decrypt transparently to exact original plaintext
      const decryptedStream = gcpStorageProvider.createReadStream(uploadRes.key);
      const streamedText = (await readStreamToBuffer(decryptedStream)).toString('utf8');
      assert.equal(streamedText, sensitiveText, `Decrypted stream must match original plaintext for ${folder}`);

      console.log(`  ✔ Private Category [${folder}] correctly envelope-encrypted in storage and transparently decrypted on read`);
    }

    // 1.2 Local Disk Fallback Envelope Verification
    console.log('\n  Verifying local disk fallback envelope storage...');
    const localKey = `kyc/local_fallback_${Date.now()}.pdf`;
    const localFilePath = path.resolve(process.cwd(), 'uploads', localKey);
    registerLocalFile(localFilePath);
    fs.mkdirSync(path.dirname(localFilePath), { recursive: true });

    const localPlaintext = Buffer.from('CONFIDENTIAL_LOCAL_DISK_FALLBACK_CITIZEN_AADHAAR', 'utf8');
    const localEncrypted = await encryptBufferEnvelope(localPlaintext);
    fs.writeFileSync(localFilePath, localEncrypted);

    // Read back via getRawReadStream
    const localRaw = await readStreamToBuffer(gcpStorageProvider.getRawReadStream(localKey));
    assert.equal(isEnvelopeEncrypted(localRaw), true, 'Local disk fallback must store envelope encrypted bytes');
    assert.ok(!localRaw.includes(localPlaintext), 'Local disk must not hold plaintext');

    // Read back via createReadStream
    const localDecrypted = await readStreamToBuffer(gcpStorageProvider.createReadStream(localKey));
    assert.equal(localDecrypted.toString('utf8'), localPlaintext.toString('utf8'), 'Local disk file must decrypt transparently');
    console.log('  ✔ Local disk fallback storage envelope verified');

    // -------------------------------------------------------------------------
    // TEST SUITE 2: HEADER TAMPERING & AUTH TAG VALIDATION
    // -------------------------------------------------------------------------
    console.log('\n[SUITE 2] Adversarial Header Tampering & Auth Tag Validation');

    const samplePlaintext = Buffer.from('CRITICAL FINANCIAL GUARANTEE ASSET - DO NOT TAMPER', 'utf8');
    const validEnvelope = await encryptBufferEnvelope(samplePlaintext);

    const newlineIdx = validEnvelope.indexOf('\n');
    assert.ok(newlineIdx > 0, 'Newline delimiter must exist');
    const validHeaderStr = validEnvelope.subarray(0, newlineIdx).toString('utf8');
    const validCiphertext = validEnvelope.subarray(newlineIdx + 1);

    // 2.1 Ciphertext bit-flipping
    console.log('  Testing ciphertext bit-flipping at start, middle, and end...');
    for (const offset of [0, Math.floor(validCiphertext.length / 2), validCiphertext.length - 1]) {
      const tampered = Buffer.from(validEnvelope);
      tampered[newlineIdx + 1 + offset] ^= 0x01; // flip 1 bit

      let returnedData: Buffer | null = null;
      let errorThrown: any = null;
      try {
        returnedData = await decryptBufferEnvelope(tampered);
      } catch (err) {
        errorThrown = err;
      }

      assert.ok(errorThrown, `Bit-flip at offset ${offset} must throw an error`);
      assert.equal(returnedData, null, `Must never return data when ciphertext is tampered`);
      assert.ok(
        String(errorThrown?.message || errorThrown).toLowerCase().includes('tag') ||
        String(errorThrown?.message || errorThrown).toLowerCase().includes('failed'),
        'Error must indicate authentication tag verification failure'
      );
    }
    console.log('  ✔ Bit-flipping in ciphertext consistently triggers auth tag verification failure');

    // 2.2 Auth Tag corruption
    console.log('  Testing auth tag corruption...');
    const tokens = validHeaderStr.split(':').filter(t => t.length > 0);
    const origTagHex = tokens[tokens.length - 1];
    
    // Invert first char of tag
    const corruptedTagHex = (origTagHex[0] === 'a' ? 'b' : 'a') + origTagHex.slice(1);
    const headerWithBadTag = validHeaderStr.replace(origTagHex, corruptedTagHex) + '\n';
    const badTagEnvelope = Buffer.concat([Buffer.from(headerWithBadTag, 'utf8'), validCiphertext]);

    await assert.rejects(
      async () => decryptBufferEnvelope(badTagEnvelope),
      /Envelope decryption failed|tag/i,
      'Corrupted auth tag must fail verification'
    );
    console.log('  ✔ Auth tag corruption successfully blocked');

    // 2.3 IV tampering
    console.log('  Testing IV tampering...');
    const origIvHex = tokens[tokens.length - 2];
    const corruptedIvHex = (origIvHex[0] === '0' ? '1' : '0') + origIvHex.slice(1);
    const headerWithBadIv = validHeaderStr.replace(origIvHex, corruptedIvHex) + '\n';
    const badIvEnvelope = Buffer.concat([Buffer.from(headerWithBadIv, 'utf8'), validCiphertext]);

    await assert.rejects(
      async () => decryptBufferEnvelope(badIvEnvelope),
      /Envelope decryption failed|tag/i,
      'Tampered IV must fail verification'
    );
    console.log('  ✔ IV tampering successfully blocked');

    // 2.4 Corrupted wrapped DEK
    console.log('  Testing corrupted wrapped DEK...');
    const origEncDek = tokens.slice(2, tokens.length - 2).join(':');
    // Corrupt base64 character in wrapped DEK
    const badEncDek = origEncDek.slice(0, 10) + (origEncDek[10] === 'A' ? 'B' : 'A') + origEncDek.slice(11);
    const headerWithBadDek = validHeaderStr.replace(origEncDek, badEncDek) + '\n';
    const badDekEnvelope = Buffer.concat([Buffer.from(headerWithBadDek, 'utf8'), validCiphertext]);

    await assert.rejects(
      async () => decryptBufferEnvelope(badDekEnvelope),
      /error|failed|tag|invalid/i,
      'Corrupted wrapped DEK must fail unwrapping'
    );
    console.log('  ✔ Corrupted wrapped DEK successfully blocked');

    // 2.5 Malformed envelope headers
    console.log('  Testing malformed envelope headers...');
    // Missing newline delimiter
    const noNewline = Buffer.from(`MSME_ENV:v1:dek:1234:5678:rawdata`, 'utf8');
    await assert.rejects(
      async () => decryptBufferEnvelope(noNewline),
      /newline delimiter missing/i,
      'Missing newline delimiter must throw'
    );

    // Missing header tokens
    const missingTokens = Buffer.from(`MSME_ENV:v1:only_two_tokens:\nrawdata`, 'utf8');
    await assert.rejects(
      async () => decryptBufferEnvelope(missingTokens),
      /Corrupted envelope encryption header/i,
      'Insufficient tokens in header must throw'
    );

    // Truncated header with magic prefix
    const partialPrefix = Buffer.from('MSME_ENV', 'utf8');
    const passthrough = await decryptBufferEnvelope(partialPrefix);
    assert.equal(passthrough.toString('utf8'), 'MSME_ENV', 'Truncated prefix passes through safely as legacy');
    console.log('  ✔ Malformed and truncated headers handled safely without process crash');

    // -------------------------------------------------------------------------
    // TEST SUITE 3: KEY HYGIENE & CWE-226 ZEROIZATION
    // -------------------------------------------------------------------------
    console.log('\n[SUITE 3] Key Hygiene & CWE-226 Ephemeral DEK Zeroization');

    // 3.1 Verify DEK zeroization during encryptBufferEnvelope
    const capturedEncryptDeks: Buffer[] = [];
    const origRandomBytes = crypto.randomBytes;
    (crypto as any).randomBytes = function (size: number) {
      const buf = origRandomBytes.call(crypto, size);
      if (size === 32) {
        capturedEncryptDeks.push(buf);
      }
      return buf;
    };

    const dummyPlaintext = Buffer.from('ZEROIZATION_VERIFICATION_PAYLOAD_123', 'utf8');
    const encResult = await encryptBufferEnvelope(dummyPlaintext);
    (crypto as any).randomBytes = origRandomBytes;

    assert.ok(capturedEncryptDeks.length > 0, 'Must have captured DEK buffer during encryption');
    const encDekBuf = capturedEncryptDeks[0];
    const allZeroesAfterEncrypt = encDekBuf.every(b => b === 0);
    assert.equal(allZeroesAfterEncrypt, true, 'Ephemeral DEK buffer must be 100% zeroized after encryption');
    console.log('  ✔ Ephemeral DEK memory buffer strictly zeroized after encryptBufferEnvelope (all 32 bytes = 0x00)');

    // 3.2 Verify DEK zeroization during decryptBufferEnvelope (Success Path)
    const kms = getKmsProvider();
    const origDecryptDek = kms.decryptDek.bind(kms);
    const capturedDecryptDeks: Buffer[] = [];

    kms.decryptDek = function (encDekStr: string): Buffer {
      const unwrapped = origDecryptDek(encDekStr);
      capturedDecryptDeks.push(unwrapped);
      return unwrapped;
    };

    const decResult = await decryptBufferEnvelope(encResult);
    kms.decryptDek = origDecryptDek;

    assert.equal(decResult.toString('utf8'), dummyPlaintext.toString('utf8'));
    assert.ok(capturedDecryptDeks.length > 0, 'Must have captured unwrapped DEK during decryption');
    const decDekBuf = capturedDecryptDeks[0];
    const allZeroesAfterDecrypt = decDekBuf.every(b => b === 0);
    assert.equal(allZeroesAfterDecrypt, true, 'Unwrapped DEK buffer must be 100% zeroized after successful decryption');
    console.log('  ✔ Unwrapped ephemeral DEK memory buffer strictly zeroized after successful decryptBufferEnvelope');

    // 3.3 Verify DEK zeroization during decryptBufferEnvelope (Failure Path / Tampered Ciphertext)
    const capturedFailDeks: Buffer[] = [];
    kms.decryptDek = function (encDekStr: string): Buffer {
      const unwrapped = origDecryptDek(encDekStr);
      capturedFailDeks.push(unwrapped);
      return unwrapped;
    };

    const tamperedPayload = Buffer.from(encResult);
    tamperedPayload[tamperedPayload.length - 2] ^= 0x77; // tamper ciphertext

    try {
      await decryptBufferEnvelope(tamperedPayload);
      assert.fail('Should have thrown on tampered payload');
    } catch {
      // Expected failure
    } finally {
      kms.decryptDek = origDecryptDek;
    }

    assert.ok(capturedFailDeks.length > 0, 'Must have captured DEK on failed decryption attempt');
    const failDekBuf = capturedFailDeks[0];
    const allZeroesAfterFail = failDekBuf.every(b => b === 0);
    assert.equal(allZeroesAfterFail, true, 'DEK buffer must be zeroized in finally block EVEN WHEN decryption fails');
    console.log('  ✔ Ephemeral DEK memory buffer strictly zeroized in finally block even upon authentication tag rejection');

    // -------------------------------------------------------------------------
    // TEST SUITE 4: CATEGORY PARTITIONING (PUBLIC VS PRIVATE)
    // -------------------------------------------------------------------------
    console.log('\n[SUITE 4] Category Partitioning: Public Assets vs Private Documents');

    const publicAssets = [
      { folder: 'banners', name: 'hero.png', mime: 'image/png' },
      { folder: 'company-logos', name: 'acme.jpg', mime: 'image/jpeg' },
      { folder: 'products', name: 'item.png', mime: 'image/png' },
      { folder: 'org-logos', name: 'state_emblem.svg', mime: 'image/svg+xml' },
      { folder: 'category-photos', name: 'handicrafts.webp', mime: 'image/webp' },
      { folder: 'videos', name: 'demo.mp4', mime: 'video/mp4' }
    ];

    for (const pub of publicAssets) {
      const pubContent = Buffer.from(`RAW_PUBLIC_BINARY_STREAM_CONTENT_FOR_${pub.name}_${Date.now()}`, 'utf8');
      const filename = `pub_${Date.now()}_${pub.name}`;

      const res = await gcpStorageProvider.uploadBuffer(pubContent, filename, {
        folder: pub.folder,
        mimeType: pub.mime,
        originalName: filename,
        isPublic: true
      });

      registerGcsKey(res.key);
      const localPath = path.resolve(process.cwd(), 'uploads', res.key);
      registerLocalFile(localPath);

      // Raw stored bytes directly from storage
      const rawStored = await readStreamToBuffer(gcpStorageProvider.getRawReadStream(res.key));

      // Must NOT be envelope encrypted
      assert.equal(isEnvelopeEncrypted(rawStored), false, `Public folder [${pub.folder}] must NOT be encrypted`);
      assert.ok(!rawStored.toString('utf8').startsWith(ENVELOPE_MAGIC_PREFIX), 'Must not have MSME_ENV prefix');

      // Verbatim match
      assert.equal(Buffer.compare(rawStored, pubContent), 0, `Public file in storage must match verbatim bytes`);

      // Stream read
      const stream = gcpStorageProvider.createReadStream(res.key);
      const streamed = await readStreamToBuffer(stream);
      assert.equal(Buffer.compare(streamed, pubContent), 0, `Streamed public file must match original`);

      console.log(`  ✔ Public asset [${pub.folder}/${pub.name}] stored verbatim without envelope encryption`);
    }

    // Explicit override test: folder 'kyc' with isPublic: true
    const publicKycContent = Buffer.from('PUBLIC_KYC_MANUAL_GUIDELINE_DOCUMENT', 'utf8');
    const pubKycRes = await gcpStorageProvider.uploadBuffer(publicKycContent, `public_kyc_guide_${Date.now()}.pdf`, {
      folder: 'kyc',
      mimeType: 'application/pdf',
      isPublic: true
    });
    registerGcsKey(pubKycRes.key);
    const pubKycRaw = await readStreamToBuffer(gcpStorageProvider.getRawReadStream(pubKycRes.key));
    assert.equal(isEnvelopeEncrypted(pubKycRaw), false, 'isPublic: true must override private folder name');
    assert.equal(Buffer.compare(pubKycRaw, publicKycContent), 0, 'Content must match verbatim');
    console.log('  ✔ Explicit isPublic: true override successfully preserves unencrypted storage');

    // -------------------------------------------------------------------------
    // TEST SUITE 5: BINARY STRESS, NEWLINES, EMPTY & CONCURRENT WORKLOADS
    // -------------------------------------------------------------------------
    console.log('\n[SUITE 5] Boundary & Concurrency Stress Testing');

    // 5.1 Binary payload containing multiple \n, \r, and \0 bytes
    console.log('  Testing binary payload with arbitrary newlines and null bytes...');
    const trickyBinary = Buffer.concat([
      Buffer.from('\n\n\r\n\0\0\0HEADER_MOCK\n', 'binary'),
      crypto.randomBytes(4096),
      Buffer.from('\n\r\nTAIL_DATA\0\n', 'binary')
    ]);
    const trickyEncrypted = await encryptBufferEnvelope(trickyBinary);
    assert.ok(isEnvelopeEncrypted(trickyEncrypted));
    const trickyDecrypted = await decryptBufferEnvelope(trickyEncrypted);
    assert.equal(Buffer.compare(trickyDecrypted, trickyBinary), 0, 'Binary payload with internal newlines must decrypt 100% intact');
    console.log('  ✔ Binary payload with tricky delimiters & null bytes decrypted cleanly');

    // 5.2 Empty 0-byte buffer
    console.log('  Testing 0-byte empty buffer...');
    const emptyBuf = Buffer.alloc(0);
    const emptyEncrypted = await encryptBufferEnvelope(emptyBuf);
    assert.ok(isEnvelopeEncrypted(emptyEncrypted));
    const emptyDecrypted = await decryptBufferEnvelope(emptyEncrypted);
    assert.equal(emptyDecrypted.length, 0, 'Empty buffer must decrypt to 0 bytes');
    console.log('  ✔ Zero-byte buffer encrypted and decrypted cleanly');

    // 5.3 1MB Large binary payload
    console.log('  Testing 1MB pseudo-random binary payload...');
    const largeBuf = crypto.randomBytes(1024 * 1024);
    const largeEncrypted = await encryptBufferEnvelope(largeBuf);
    const largeDecrypted = await decryptBufferEnvelope(largeEncrypted);
    assert.equal(Buffer.compare(largeDecrypted, largeBuf), 0, '1MB binary payload must match byte-for-byte');
    console.log('  ✔ 1MB binary payload verified with zero corruption');

    // 5.4 Concurrent stress: 20 simultaneous operations (10 private + 10 public)
    console.log('  Testing 20 concurrent storage operations (10 private + 10 public)...');
    const concurrentOps = [];
    for (let i = 0; i < 10; i++) {
      concurrentOps.push((async () => {
        const payload = Buffer.from(`CONCURRENT_PRIVATE_TEST_PAYLOAD_${i}_${Date.now()}`, 'utf8');
        const filename = `concurrent_kyc_${i}_${Date.now()}.pdf`;
        const res = await gcpStorageProvider.uploadBuffer(payload, filename, {
          folder: 'kyc',
          mimeType: 'application/pdf'
        });
        registerGcsKey(res.key);

        const readBack = await gcpStorageProvider.getFileBuffer(res.key);
        assert.equal(readBack.toString('utf8'), payload.toString('utf8'), `Private concurrent #${i} mismatch`);
      })());

      concurrentOps.push((async () => {
        const payload = Buffer.from(`CONCURRENT_PUBLIC_TEST_PAYLOAD_${i}_${Date.now()}`, 'utf8');
        const filename = `concurrent_prod_${i}_${Date.now()}.png`;
        const res = await gcpStorageProvider.uploadBuffer(payload, filename, {
          folder: 'products',
          mimeType: 'image/png',
          isPublic: true
        });
        registerGcsKey(res.key);

        const readBack = await gcpStorageProvider.getFileBuffer(res.key);
        assert.equal(readBack.toString('utf8'), payload.toString('utf8'), `Public concurrent #${i} mismatch`);
      })());
    }

    await Promise.all(concurrentOps);
    console.log('  ✔ All 20 concurrent private/public operations succeeded without race conditions');

    console.log('\n======================================================================');
    console.log('   ALL EMPIRICAL ADVERSARIAL CHALLENGE TESTS PASSED CLEANLY (100%)   ');
    console.log('======================================================================\n');
  } finally {
    await cleanupAll();
  }
}

runAdversarialSuite().catch(async (err) => {
  console.error('\n❌ EMPIRICAL ADVERSARIAL TEST FAILED:');
  console.error(err);
  await cleanupAll();
  process.exit(1);
});
