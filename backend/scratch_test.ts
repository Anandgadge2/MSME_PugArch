import './src/config/env.js';
import { connectRedis } from './src/config/redis.js';
import { setCache, getCache } from './src/services/cache.service.js';
import { redis } from './src/config/redis.js';

async function main() {
  await connectRedis();
  console.log('Testing setCache with 60 seconds TTL...');
  await setCache('test_ttl_key', { hello: 'world' }, 60);

  const val = await getCache('test_ttl_key');
  console.log('getCache value:', val);

  if (redis) {
    const rawVal = await redis.get('cache:test_ttl_key');
    console.log('redis.get value:', rawVal);

    const ttl = await redis.ttl('cache:test_ttl_key');
    console.log('redis.ttl:', ttl);
  }
}

main().catch(console.error).finally(() => process.exit(0));
