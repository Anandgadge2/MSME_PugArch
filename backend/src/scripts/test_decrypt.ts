import { decryptField } from '../utils/crypto.js';

console.log('Decrypted PAN:', decryptField('enc:v1:kid-2026a:diLHpYa4rBrEpC15:QGq3NyQmpqTnc3IIoxQspw==:yI/0igVhRX583Q=='));
console.log('Decrypted Name:', decryptField('enc:v1:kid-2026a:Dm2d0QN7IS7t9YNj:+pGsulnCXD2tyfdADtCHIA==:Vdk8aA5X9BmgdcZ3Qx7ywyJGSWGkpO3k2TAraW1qVRUa4I='));
console.log('Decrypted Mobile:', decryptField('enc:v1:kid-2026a:F9q1ygTLqWi9Cwnu:1atT6edrEX08HDnTA3BdQg==:vLwAg2q2WjMYUA=='));

