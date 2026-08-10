import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { isRedisReady, redis } from '../config/redis.js';
import { redisKeyPrefixes } from '../constants/redis-keys.js';

type CacheRecord = {
  value: string;
  expiresAt?: number;
};

const memoryCache = new Map<string, CacheRecord>();

let redisCircuitOpenUntil = 0;

const shouldUseRedis = () => {
  if (Date.now() < redisCircuitOpenUntil) return false;
  return ['redis', 'valkey'].includes(env.CACHE_DRIVER) && Boolean(redis) && isRedisReady();
};

const encode = (value: unknown) => JSON.stringify(value);

const decode = <T>(raw: string | null | undefined): T | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as T;
  }
};

const deleteExpiredMemoryRecord = (key: string, record?: CacheRecord) => {
  if (!record) return true;
  if (record.expiresAt && record.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return true;
  }
  return false;
};

let lastRedisWarnTime = 0;
const handleRedisError = (action: string, key: string, err: any) => {
  // Open circuit breaker for 60 seconds if Redis fails or times out
  redisCircuitOpenUntil = Date.now() + 60000;
  const now = Date.now();
  if (now - lastRedisWarnTime > 60000) {
    lastRedisWarnTime = now;
    logger.warn({ key, err: err?.message }, `Redis ${action} timed out or failed; circuit breaker opened for 60s, using in-memory cache fallback`);
  }
};

export const getCache = async <T = unknown>(key: string): Promise<T | null> => {
  if (shouldUseRedis()) {
    try {
      const raw = await redis!.get(key);
      return decode<T>(raw);
    } catch (err: any) {
      handleRedisError('getCache', key, err);
    }
  }

  const record = memoryCache.get(key);
  if (deleteExpiredMemoryRecord(key, record)) return null;
  return decode<T>(record?.value);
};

export const setCache = async (key: string, value: unknown, ttlSeconds?: number) => {
  const raw = encode(value);
  if (shouldUseRedis()) {
    try {
      const ttl = (ttlSeconds && ttlSeconds > 0) ? ttlSeconds : 86400;
      await redis!.set(key, raw, 'EX', ttl);
      return;
    } catch (err: any) {
      handleRedisError('setCache', key, err);
    }
  }

  memoryCache.set(key, {
    value: raw,
    expiresAt: ttlSeconds && ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : undefined
  });
};

export const deleteCache = async (key: string) => {
  if (shouldUseRedis()) {
    try {
      await redis!.del(key);
    } catch (err: any) {
      handleRedisError('deleteCache', key, err);
    }
  }
  memoryCache.delete(key);
};

const pendingLoads = new Map<string, Promise<any>>();

export const getOrSetCache = async <T>(key: string, loader: () => Promise<T>, ttlSeconds?: number): Promise<T> => {
  const cached = await getCache<T>(key);
  if (cached !== null) return cached;

  let loadPromise = pendingLoads.get(key);
  if (!loadPromise) {
    loadPromise = loader().then(async (value) => {
      await setCache(key, value, ttlSeconds);
      pendingLoads.delete(key);
      return value;
    }).catch((error) => {
      pendingLoads.delete(key);
      throw error;
    });
    pendingLoads.set(key, loadPromise);
  }

  return loadPromise;
};

export const invalidateByPattern = async (pattern: string) => {
  if (!pattern.startsWith(redisKeyPrefixes.cache)) {
    logger.warn({ pattern }, 'Refusing to invalidate non-cache Redis pattern');
    return 0;
  }

  const globToRegex = (glob: string) =>
    '^' + glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';

  let deleted = 0;
  for (const key of Array.from(memoryCache.keys())) {
    const regex = new RegExp(globToRegex(pattern));
    if (regex.test(key)) {
      memoryCache.delete(key);
      deleted += 1;
    }
  }

  if (!shouldUseRedis()) return deleted;

  const prefix = env.REDIS_PREFIX || '';
  const scanPattern = prefix ? `${prefix}${pattern}` : pattern;
  const stream = redis!.scanStream({ match: scanPattern, count: 100 });

  for await (const keys of stream as AsyncIterable<string[]>) {
    if (keys.length === 0) continue;
    const normalizedKeys = prefix
      ? keys.map(key => key.startsWith(prefix) ? key.slice(prefix.length) : key)
      : keys;
    deleted += await redis!.del(...normalizedKeys);
  }

  return deleted;
};
