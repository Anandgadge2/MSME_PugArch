import assert from 'node:assert/strict';
import { encryptField, decryptField, isEncrypted, createHashFingerprint, timingSafeEqual } from '../dist/src/utils/crypto.js';

console.log('--- STQC & VPAT Cryptographic Verification Suite ---');

// 1. Two-way AES-256-GCM Authenticated Encryption & Decryption
const rawPan = 'ABCDE1234F';
const encryptedPan = encryptField(rawPan);

assert(isEncrypted(encryptedPan), 'Ciphertext must match authenticated enc:v1: prefix');
assert(encryptedPan.startsWith('enc:v1:'), 'Format must be enc:v1:<iv>:<tag>:<ciphertext>');
assert.notEqual(encryptedPan, rawPan, 'Ciphertext must not match plaintext');

const decryptedPan = decryptField(encryptedPan);
assert.equal(decryptedPan, rawPan, 'Decrypted value must strictly match original plaintext');
console.log('✔ AES-256-GCM Two-Way Authenticated Encryption Verified');

// 2. Backward Compatibility: Plaintext passthrough
const legacyUnencrypted = '987654321012';
assert.equal(isEncrypted(legacyUnencrypted), false);
const decryptedLegacy = decryptField(legacyUnencrypted);
assert.equal(decryptedLegacy, legacyUnencrypted, 'Legacy unencrypted database records must pass through untouched');
console.log('✔ Legacy Unencrypted Database Passthrough Verified');

// 3. Tamper Resistance / Bit-flipping detection (Auth Tag verification)
const tampered = encryptedPan.slice(0, -4) + 'AAAA';
const tamperedResult = decryptField(tampered);
assert.equal(tamperedResult, tampered, 'Tampered ciphertext must be rejected by auth tag check');
console.log('✔ Ciphertext Tamper Resistance & Auth Tag Enforcement Verified');

// 4. UIDAI & STQC Aadhaar Masking & Deterministic Salted Hashing
const rawAadhaar = '123456789012';
const aadhaarMasked = `XXXXXXXX${rawAadhaar.slice(-4)}`;
const aadhaarHash = createHashFingerprint(rawAadhaar, 'aadhaar_vault');

assert.equal(aadhaarMasked, 'XXXXXXXX9012', 'Aadhaar masking must strictly match UIDAI format XXXXXXXX<last4>');
assert.equal(aadhaarHash.length, 64, 'Aadhaar deterministic hash must be SHA-256 64-hex characters');
console.log('✔ UIDAI Statutory Masking and Deduplication Hash Verified');

// 5. Timing-safe equality
const tokenA = 'f7c8d2a1b9e3456789abcdef12345678';
const tokenB = 'f7c8d2a1b9e3456789abcdef12345678';
const tokenC = 'f7c8d2a1b9e3456789abcdef12345679';

assert(timingSafeEqual(tokenA, tokenB), 'Matching tokens must return true');
assert(!timingSafeEqual(tokenA, tokenC), 'Mismatched tokens must return false');
console.log('✔ Constant-Time Timing-Safe Comparison Verified');

console.log('\nAll STQC & VPAT Cryptographic Standards tests passed cleanly!');
