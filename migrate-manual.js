process.env.DATABASE_URL = "postgresql://neondb_owner:npg_U0XLepHlbI8z@ep-dark-term-aq1uyd71-pooler.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require";

const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const prisma = new PrismaClient();

function computeChecksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function splitStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  while (i < sql.length) {
    if (sql.slice(i, i + 2) === '$$') {
      current += '$$';
      let j = i + 2;
      let foundEnd = false;
      while (j < sql.length) {
        if (sql.slice(j, j + 2) === '$$') {
          current += sql.slice(i + 2, j + 2);
          i = j + 2;
          foundEnd = true;
          break;
        }
        j++;
      }
      if (!foundEnd) {
        current += sql.slice(i + 2);
        i = sql.length;
      }
      continue;
    }
    
    const char = sql[i];
    if (char === ';') {
      statements.push(current.trim());
      current = '';
    } else {
      current += char;
    }
    i++;
  }
  if (current.trim()) {
    statements.push(current.trim());
  }
  return statements.filter(s => s.length > 0);
}

async function runMigration(migrationName) {
  const migrationDir = path.join(__dirname, 'backend', 'prisma', 'migrations', migrationName);
  const sqlPath = path.join(migrationDir, 'migration.sql');
  
  if (!fs.existsSync(sqlPath)) {
    console.error(`Migration SQL not found at ${sqlPath}`);
    return;
  }
  
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const checksum = computeChecksum(sql);
  
  console.log(`\nRunning migration: ${migrationName}`);
  
  // 1. Check if already applied
  const existing = await prisma.$queryRawUnsafe(
    'SELECT id FROM "_prisma_migrations" WHERE "migration_name" = $1',
    migrationName
  );
  
  if (existing && existing.length > 0) {
    console.log(`Migration ${migrationName} is already applied. Skipping.`);
    return;
  }
  
  // 2. Split and execute statements one by one without transaction
  const statements = splitStatements(sql);
  console.log(`Split migration into ${statements.length} statements.`);
  for (const stmt of statements) {
    console.log(`Executing: ${stmt.slice(0, 100)}...`);
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (err) {
      const msg = String(err.message || '');
      if (msg.includes('already exists') || msg.includes('already a column') || msg.includes('duplicate')) {
        console.log(`Relation/index/column already exists, skipping statement.`);
      } else {
        console.error(`Statement failed:`, err);
        throw err;
      }
    }
  }
  
  // 3. Insert record into _prisma_migrations
  const id = crypto.randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "_prisma_migrations" (
      "id",
      "checksum",
      "finished_at",
      "migration_name",
      "logs",
      "rolled_back_at",
      "started_at",
      "applied_steps_count"
    ) VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), 1)`,
    id,
    checksum,
    migrationName
  );
  
  console.log(`Migration ${migrationName} applied successfully.`);
}

async function main() {
  const migrations = [
    '20260624101000_add_pre_registration_kyc_session',
    '20260624150000_catalogue_import_and_service_specs'
  ];
  
  for (const migration of migrations) {
    await runMigration(migration);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
