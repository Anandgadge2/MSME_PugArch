import '../config/env.js';
import { PrismaClient } from '@prisma/client'
import { invalidateByPattern } from '../services/cache.service.js';
import { encryptField, decryptField, isEncrypted, sha256, computeAuditLogChainHash, createHashFingerprint } from '../utils/crypto.js';

let lastAuditChainHash = '0000000000000000000000000000000000000000000000000000000000000000';

const ENCRYPTED_FIELDS_BY_MODEL: Record<string, string[]> = {
  user: ['mobile'],
  sellerprofile: ['pan', 'nameAsInPan', 'mobile'],
  buyerprofile: ['pan', 'nameAsInPan', 'bankAccountNo', 'bankIfsc', 'bankName', 'bankAddress', 'accountHolderName', 'mobile'],
  organization: ['panNumber'],
  sellerbankaccount: ['accountNumber', 'ifsc', 'holderName', 'bankAddress', 'bankName'],
  shgbankaccount: ['accountHolderName', 'bankName', 'ifsc'],
  shgmember: ['name', 'mobile'],
  grievanceticket: ['complainantEmail', 'complainantMobile'],
  directpurchase: ['email', 'mobileNumber'],
  deliveryaddress: ['contactPersonName', 'mobileNumber', 'alternateMobileNumber', 'addressLine1', 'addressLine2'],
  kycauthsession: ['codeVerifier'],
  preregistrationkycsession: ['codeVerifier', 'verifiedName', 'verifiedMobile'],
  userkycverification: ['verifiedName', 'verifiedEmail']
};

const SENSITIVE_JSON_KEYS = new Set([
  'pan', 'nameAsInPan', 'bankAccountNo', 'bankAccount', 'accountNumber',
  'bankIfsc', 'ifsc', 'accountHolderName', 'holderName',
  'orgPan', 'personalPan', 'panNumber'
]);

function sanitizeJsonPayload(payload: any, depth = 0): void {
  if (!payload || depth > 5 || typeof payload !== 'object') return;
  if (Array.isArray(payload)) {
    payload.forEach(item => sanitizeJsonPayload(item, depth + 1));
    return;
  }
  for (const k of Object.keys(payload)) {
    if (/^aadhaar(Number)?$/i.test(k)) {
      const val = String(payload[k] || '').replace(/\s+/g, '');
      if (val.length === 12) {
        payload.aadhaarMasked = `XXXXXXXX${val.slice(-4)}`;
        payload.aadhaarHash = createHashFingerprint(val, 'aadhaar_vault');
        delete payload[k];
      }
    } else if (SENSITIVE_JSON_KEYS.has(k)) {
      if (typeof payload[k] === 'string' && payload[k].trim() !== '' && !isEncrypted(payload[k])) {
        const lower = payload[k].trim().toLowerCase();
        const isStatus = ['approved', 'rejected', 'pending', 'submitted', 'verified'].includes(lower);
        if (!isStatus) {
          payload[k] = encryptField(payload[k]);
        }
      }
    } else if (typeof payload[k] === 'object' && payload[k] !== null) {
      if (k !== 'sectionStatus' && k !== 'sectionRejectionReasons') {
        sanitizeJsonPayload(payload[k], depth + 1);
      }
    }
  }
}

function encryptModelPayload(fields: string[], data: any): void {
  if (!data || typeof data !== 'object') return;
  if (Array.isArray(data)) {
    data.forEach(item => encryptModelPayload(fields, item));
    return;
  }
  // UIDAI Aadhaar Act Regulation 16A & Circular 2017: Zero-Storage Gatekeeper
  if ('aadhaarNumber' in data) {
    if (data.aadhaarNumber) {
      const rawDigits = String(data.aadhaarNumber).replace(/\s+/g, '');
      if (/^\d{12}$/.test(rawDigits)) {
        if (!data.aadhaarMasked) {
          data.aadhaarMasked = `XXXXXXXX${rawDigits.slice(-4)}`;
        }
        if (!data.aadhaarHash) {
          data.aadhaarHash = createHashFingerprint(rawDigits, 'aadhaar_vault');
        }
      }
    }
    delete data.aadhaarNumber;
  }
  // GAP 5 Blind Indexing: mobileFingerprint & panFingerprint
  if ('mobile' in data && data.mobile) {
    const rawMobile = typeof data.mobile === 'string' ? data.mobile : data.mobile?.set;
    if (typeof rawMobile === 'string' && rawMobile.trim() !== '') {
      if (!data.mobileFingerprint) {
        const plainMobile = isEncrypted(rawMobile) ? decryptField(rawMobile) : rawMobile.trim();
        if (plainMobile) {
          data.mobileFingerprint = createHashFingerprint(plainMobile, 'mobile');
        }
      }
    }
  }
  if ('panNumber' in data && data.panNumber) {
    const rawPan = typeof data.panNumber === 'string' ? data.panNumber : data.panNumber?.set;
    if (typeof rawPan === 'string' && rawPan.trim() !== '') {
      if (!data.panFingerprint) {
        const plainPan = isEncrypted(rawPan) ? decryptField(rawPan) : rawPan.trim();
        if (plainPan) {
          data.panFingerprint = createHashFingerprint(plainPan, 'pan');
        }
      }
    }
  } else if ('pan' in data && data.pan) {
    const rawPan = typeof data.pan === 'string' ? data.pan : data.pan?.set;
    if (typeof rawPan === 'string' && rawPan.trim() !== '') {
      if (!data.panFingerprint) {
        const plainPan = isEncrypted(rawPan) ? decryptField(rawPan) : rawPan.trim();
        if (plainPan) {
          data.panFingerprint = createHashFingerprint(plainPan, 'pan');
        }
      }
    }
  }
  for (const f of fields) {
    if (typeof data[f] === 'string' && data[f].trim() !== '') {
      data[f] = encryptField(data[f]);
    } else if (data[f] && typeof data[f].set === 'string' && data[f].set.trim() !== '') {
      data[f].set = encryptField(data[f].set);
    }
  }
  if (data.registrationDetails && typeof data.registrationDetails === 'object') {
    sanitizeJsonPayload(data.registrationDetails);
  }
}

function decryptDeep<T>(record: T, depth = 0): T {
  if (!record || depth > 8 || typeof record !== 'object') return record;
  if (record instanceof Date || Buffer.isBuffer(record)) return record;
  if ((record as any).constructor && ((record as any).constructor.name === 'Decimal' || (record as any)._isDecimal === true)) {
    return record;
  }

  if (Array.isArray(record)) {
    for (let i = 0; i < record.length; i++) {
      record[i] = decryptDeep(record[i], depth + 1);
    }
    return record;
  }

  for (const key of Object.keys(record)) {
    const val = (record as any)[key];
    if (typeof val === 'string' && isEncrypted(val)) {
      (record as any)[key] = decryptField(val);
    } else if (val && typeof val === 'object') {
      (record as any)[key] = decryptDeep(val, depth + 1);
    }
  }
  return record;
}

const AFFECTED_MODELS = new Set([
  'cart', 'cartitem', 'procurementapproval', 'goodsreceiptnote', 
  'tender', 'purchaseorder', 'invoice', 'quoterequest', 'bid', 
  'deliverytracking', 'product', 'service', 'user', 'orgmembership', 'quoteresponse'
]);

const prismaClientSingleton = () => {
  let dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !dbUrl.includes('connection_limit=')) {
    const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_VERSION || process.env.LAMBDA_TASK_ROOT);
    const connectionLimit = process.env.PRISMA_CONNECTION_LIMIT || (isServerless ? '2' : '10');
    const poolTimeout = process.env.PRISMA_POOL_TIMEOUT || '30';
    dbUrl += (dbUrl.includes('?') ? '&' : '?') + `connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}`;
  }
  const client = new PrismaClient(dbUrl ? {
    datasources: {
      db: {
        url: dbUrl
      }
    }
  } : undefined)
  return client.$extends({
    query: {
      financialLedgerEntry: {
        update() {
          throw new Error('Financial ledger entries are immutable; create a reversal entry instead.')
        },
        updateMany() {
          throw new Error('Financial ledger entries are immutable; create reversal entries instead.')
        },
        delete() {
          throw new Error('Financial ledger entries are immutable; create a reversal entry instead.')
        },
        deleteMany() {
          throw new Error('Financial ledger entries are immutable; create reversal entries instead.')
        }
      },
      auditLog: {
        update() {
          throw new Error('Audit logs are immutable append-only records per CERT-In Directions 2022.');
        },
        updateMany() {
          throw new Error('Audit logs are immutable append-only records per CERT-In Directions 2022.');
        },
        delete() {
          throw new Error('Audit logs cannot be deleted; mandatory 180-day retention per CERT-In Directions 2022.');
        },
        deleteMany() {
          throw new Error('Audit logs cannot be deleted; mandatory 180-day retention per CERT-In Directions 2022.');
        }
      },
      kycAuditLog: {
        update() {
          throw new Error('KYC audit logs are immutable append-only records per UIDAI / DPDPA.');
        },
        updateMany() {
          throw new Error('KYC audit logs are immutable append-only records per UIDAI / DPDPA.');
        },
        delete() {
          throw new Error('KYC audit logs cannot be deleted.');
        },
        deleteMany() {
          throw new Error('KYC audit logs cannot be deleted.');
        }
      },
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // STQC Data-at-Rest Encryption: Transparently encrypt sensitive fields on write
          if (model) {
            const modelLower = model.toLowerCase();
            if (modelLower === 'auditlog' && operation === 'create' && (args as any)?.data) {
              const d = (args as any).data;
              if (!d.details || typeof d.details !== 'object') d.details = {};
              const now = Date.now();
              const prevHash = lastAuditChainHash;
              const chainHash = computeAuditLogChainHash(prevHash, {
                action: d.action || '',
                userId: d.userId,
                entityType: d.entityType,
                entityId: d.entityId,
                timestamp: now
              });
              d.details.prevHash = prevHash;
              d.details.chainHash = chainHash;
              d.details.integrityHash = chainHash;
              lastAuditChainHash = chainHash;
            }
            const fieldsToEncrypt = ENCRYPTED_FIELDS_BY_MODEL[modelLower];
            if (fieldsToEncrypt && ['create', 'update', 'upsert', 'createMany', 'updateMany'].includes(operation)) {
              if (operation === 'upsert') {
                if ((args as any)?.create) encryptModelPayload(fieldsToEncrypt, (args as any).create);
                if ((args as any)?.update) encryptModelPayload(fieldsToEncrypt, (args as any).update);
              } else if ((args as any)?.data) {
                encryptModelPayload(fieldsToEncrypt, (args as any).data);
              }
            }

            // Transparent query rewriting/augmentation for mobile and pan blind indexes
            if ((args as any)?.where && operation !== 'findUnique') {
              const where = (args as any).where;
              if (['user', 'buyerprofile', 'sellerprofile'].includes(modelLower) && typeof where.mobile === 'string' && !where.OR) {
                const rawVal = where.mobile;
                const fp = createHashFingerprint(rawVal, 'mobile');
                where.OR = [
                  { mobileFingerprint: fp },
                  { mobile: rawVal }
                ];
                delete where.mobile;
              }
              if (modelLower === 'organization' && typeof where.panNumber === 'string' && !where.OR) {
                const rawVal = where.panNumber;
                const fp = createHashFingerprint(rawVal, 'pan');
                where.OR = [
                  { panFingerprint: fp },
                  { panNumber: rawVal }
                ];
                delete where.panNumber;
              }
            }
          }

          const rawResult = await query(args);
          // STQC Data-at-Rest Decryption: Transparently decrypt ciphertext on read
          const result = decryptDeep(rawResult);
          if (
            model &&
            AFFECTED_MODELS.has(model.toLowerCase()) &&
            ['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'].includes(operation)
          ) {
            // Optimize User update invalidations to prevent unnecessary invalidations on lastLoginAt, etc.
            let shouldInvalidateSummary = true;
            const modelLower = model.toLowerCase();
            
            if (modelLower === 'user') {
              if (operation === 'update' || operation === 'updateMany') {
                const dataKeys = (args as any)?.data ? Object.keys((args as any).data) : [];
                const kpiAffectingFields = ['onboardingStatus', 'role', 'organizationId'];
                shouldInvalidateSummary = dataKeys.some(key => kpiAffectingFields.includes(key));
              }
              
              // Proactively invalidate user auth cache when user details/roles/status are modified
              const userId = (args as any)?.where?.id;
              if (userId) {
                try {
                  await invalidateByPattern(`cache:auth:user:${userId}:*`);
                } catch (err) {
                  console.error('[Cache Invalidation] Failed to invalidate user auth cache:', err);
                }
              }
            } else if (modelLower === 'orgmembership') {
              // Invalidate user auth cache when user's organization membership changes (e.g. role updated, deactivated)
              const userId = (args as any)?.where?.userId || (args as any)?.data?.userId || (args as any)?.where?.userId_organizationId?.userId;
              if (userId) {
                try {
                  await invalidateByPattern(`cache:auth:user:${userId}:*`);
                } catch (err) {
                  console.error('[Cache Invalidation] Failed to invalidate user auth cache on orgmembership change:', err);
                }
              } else {
                // If specific user ID cannot be determined, invalidate all auth caches to be safe
                try {
                  await invalidateByPattern('cache:auth:user:*');
                } catch (err) {
                  console.error('[Cache Invalidation] Failed to invalidate all user auth caches:', err);
                }
              }
            }

            if (shouldInvalidateSummary) {
              try {
                await invalidateByPattern('cache:dashboard:summary:*');
                await invalidateByPattern('cache:admin:kpi-summary');
              } catch (err) {
                console.error('[Cache Invalidation] Failed to invalidate dashboard/admin cache:', err);
              }
            }
          }
          return result;
        }
      }
    }
  })
}

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
