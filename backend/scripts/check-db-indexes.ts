import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();

async function checkDatabasePerformance() {
  console.log('Connecting to database...');
  try {
    // 1. Check Unindexed Foreign Keys
    console.log('\n--- 1. UNINDEXED FOREIGN KEYS (POTENTIAL PERFORMANCE BOTTLENECKS) ---');
    const unindexedFks = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
          c.conrelid::regclass::text AS table_name,
          c.conname AS foreign_key_name,
          pg_get_constraintdef(c.oid) AS constraint_definition
      FROM
          pg_constraint c
      WHERE
          c.contype = 'f'
          AND NOT EXISTS (
              SELECT 1
              FROM pg_index i
              WHERE i.indrelid = c.conrelid
                AND (i.indkey::int2[])[0:cardinality(c.conkey)-1] = c.conkey
          )
      ORDER BY
          table_name;
    `);

    if (unindexedFks.length === 0) {
      console.log('🎉 Excellent! All foreign keys are supported by indexes.');
    } else {
      console.log(`Found ${unindexedFks.length} unindexed foreign keys:`);
      console.table(unindexedFks.map(fk => ({
        Table: String(fk.table_name),
        Constraint: String(fk.foreign_key_name),
        Definition: String(fk.constraint_definition)
      })));
    }

    // 2. Check Table Scan statistics (Seq Scan vs Index Scan)
    console.log('\n--- 2. TABLE SCAN STATISTICS (SEQ SCANS VS INDEX SCANS) ---');
    const tableStats = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        relname AS table_name,
        seq_scan AS sequential_scans,
        idx_scan AS index_scans,
        n_live_tup AS estimated_rows,
        CASE
          WHEN (seq_scan + idx_scan) = 0 THEN 0
          ELSE ROUND(100.0 * idx_scan / (seq_scan + idx_scan), 2)
        END AS index_hit_rate_pct
      FROM pg_stat_user_tables
      WHERE (seq_scan + idx_scan) > 0
      ORDER BY seq_scan DESC
      LIMIT 15;
    `);

    if (tableStats.length === 0) {
      console.log('No scan statistics available (likely a fresh database).');
    } else {
      console.table(tableStats.map(stat => ({
        Table: stat.table_name,
        'Seq Scans': Number(stat.sequential_scans),
        'Index Scans': Number(stat.index_scans),
        Rows: Number(stat.estimated_rows),
        'Index Hit Rate (%)': `${stat.index_hit_rate_pct}%`
      })));
    }

    // 3. Database Cache Hit Ratio
    console.log('\n--- 3. DATABASE CACHE HIT RATIO (SHOULD BE >99%) ---');
    const cacheStats = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        sum(heap_blks_read) as heap_read,
        sum(heap_blks_hit) as heap_hit,
        CASE 
          WHEN (sum(heap_blks_read) + sum(heap_blks_hit)) = 0 THEN 0
          ELSE ROUND(100.0 * sum(heap_blks_hit) / (sum(heap_blks_read) + sum(heap_blks_hit)), 2)
        END as cache_hit_ratio_pct
      FROM pg_statio_user_tables;
    `);

    if (cacheStats.length > 0 && cacheStats[0].cache_hit_ratio_pct !== null) {
      console.log(`Database Cache Hit Ratio: ${cacheStats[0].cache_hit_ratio_pct}%`);
      if (Number(cacheStats[0].cache_hit_ratio_pct) < 99) {
        console.log('⚠️ Warning: Cache hit ratio is below 99%. Performance may degrade under load.');
      } else {
        console.log('🎉 Cache hit ratio is excellent (>= 99%).');
      }
    }

  } catch (error) {
    console.error('Error executing query:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabasePerformance();
