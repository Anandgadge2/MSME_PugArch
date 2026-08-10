import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

const isDev = env.NODE_ENV === 'development';

const redisOptions = {
  keyPrefix: env.REDIS_PREFIX,
  db: env.REDIS_DB,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  commandTimeout: 2000,
  enableReadyCheck: true,
  connectTimeout: isDev ? 1500 : 3000,
  keepAlive: 10000,
  retryStrategy(times: number) {
    // In dev: give up immediately after 1 attempt so startup is instant.
    // In prod: retry longer (15 attempts) for transient network issues.
    const maxRetries = isDev ? 1 : 15;
    if (times > maxRetries) {
      if (isDev) {
        logger.info('Redis unavailable; running with in-memory fallback');
      } else {
        logger.warn('Redis max reconnect attempts reached; switching to in-memory fallback permanently');
      }
      return null;
    }
    return Math.min(times * (isDev ? 200 : 300), isDev ? 1000 : 5000);
  },
  tls: env.REDIS_TLS ? {} : undefined
};

const getRedisInstance = () => {
  if (env.CACHE_DRIVER === 'memory') {
    logger.info('Running with in-memory cache driver (Redis disabled)');
    return null;
  }
  if (env.REDIS_HOST) {
    return new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      ...redisOptions
    });
  }
  if (env.REDIS_URL) {
    return new Redis(env.REDIS_URL, redisOptions);
  }
  logger.info('No REDIS_HOST or REDIS_URL configured; running with in-memory fallback only');
  return null;
};

export const redis = getRedisInstance();

let errorLogCount = 0;

if (redis) {
  redis.on('connect', () => {
    logger.info('Redis client initiating connection');
  });
  redis.on('ready', () => {
    errorLogCount = 0; // reset error log count on successful connection
    logger.info({ prefix: env.REDIS_PREFIX, tls: env.REDIS_TLS }, 'Redis connection established and ready');
  });
  redis.on('error', error => {
    errorLogCount += 1;
    if (errorLogCount === 1) {
      logger.warn({ err: error, tls: env.REDIS_TLS }, 'Redis connection failed or disconnected; using in-memory fallback where available');
    } else if (errorLogCount === 2 && !isDev) {
      logger.warn({ tls: env.REDIS_TLS }, 'Redis connection still failing; suppressing further error logs');
    }
  });
  redis.on('end', () => {
    logger.warn('Redis connection closed permanently');
  });
}

let connectionStarted = false;

export const connectRedis = async () => {
  if (!redis || connectionStarted || redis.status === 'ready') return redis;
  connectionStarted = true;

  await redis.connect().catch(error => {
    logger.warn({ err: error, tls: env.REDIS_TLS }, 'Redis unavailable; continuing with fallback mode');
  });
  if (isRedisReady()) {
    logger.info({ prefix: env.REDIS_PREFIX, tls: env.REDIS_TLS }, 'Redis connected');
  }
  return redis;
};

export const isRedisReady = () => redis?.status === 'ready';
