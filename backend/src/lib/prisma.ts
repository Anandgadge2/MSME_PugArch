import '../config/env.js';
import { PrismaClient } from '@prisma/client'
import { invalidateByPattern } from '../services/cache.service.js';
import { encryptField, decryptField, isEncrypted } from '../utils/crypto.js';

const ENCRYPTED_FIELDS_BY_MODEL: Record<string, string[]> = {
  sellerprofile: ['pan', 'nameAsInPan'],
  buyerprofile: ['pan', 'nameAsInPan', 'bankAccountNo', 'bankIfsc', 'bankName', 'bankAddress', 'accountHolderName'],
  sellerbankaccount: ['accountNumber', 'ifsc', 'holderName', 'bankAddress', 'bankName']
};

function encryptModelPayload(fields: string[], data: any): void {
  if (!data || typeof data !== 'object') return;
  if (Array.isArray(data)) {
    data.forEach(item => encryptModelPayload(fields, item));
    return;
  }
  for (const f of fields) {
    if (typeof data[f] === 'string' && data[f].trim() !== '') {
      data[f] = encryptField(data[f]);
    } else if (data[f] && typeof data[f].set === 'string' && data[f].set.trim() !== '') {
      data[f].set = encryptField(data[f].set);
    }
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
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // STQC Data-at-Rest Encryption: Transparently encrypt sensitive fields on write
          if (model) {
            const modelLower = model.toLowerCase();
            const fieldsToEncrypt = ENCRYPTED_FIELDS_BY_MODEL[modelLower];
            if (fieldsToEncrypt && ['create', 'update', 'upsert', 'createMany', 'updateMany'].includes(operation)) {
              if (operation === 'upsert') {
                if ((args as any)?.create) encryptModelPayload(fieldsToEncrypt, (args as any).create);
                if ((args as any)?.update) encryptModelPayload(fieldsToEncrypt, (args as any).update);
              } else if ((args as any)?.data) {
                encryptModelPayload(fieldsToEncrypt, (args as any).data);
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
